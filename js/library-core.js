/** @maintenance
 * 公共图书检索的跨端契约与纯解析逻辑。只访问固定 OPAC 查询路径，不携带智慧理工密码或教务 Cookie。
 * 浏览器/APK 使用 DOM 适配器，云函数使用 Cheerio 适配器；共同输出同一种列表/馆藏数据和 UI 状态。
 * 共享副本应保持一致；列表、详情请求都需防止旧查询响应覆盖新查询。
 */
/**
 * NJUST public catalogue contract and UI state. Original implementation;
 * no CAS credentials or school session cookies are used by this feature.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NJUSTLibraryCore = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';

  const BASE_URL = 'http://202.119.83.14:8080/uopac/opac/';
  const REVISION = '2026-10-02-library-1';
  const PAGE_SIZE = 20;
  const MAX_PAGE = 500;
  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const validId = value => /^[A-Za-z0-9_-]{1,64}$/.test(String(value || ''));

  /** @maintenance
   * 集中校验关键词、检索字段、文献类型和页码，再由 buildSearchUrl 编码。不要直接把用户输入当作 URL 或 SQL 条件。
   */
  function normalizeSearch(input = {}) {
    const query = clean(input.query);
    if (!query) throw new Error('请输入书名、作者或 ISBN');
    if (query.length > 100) throw new Error('搜索内容最多 100 个字符');
    const searchType = input.searchType || 'title';
    const doctype = input.doctype || 'ALL';
    const page = input.page == null ? 1 : Number(input.page);
    if (!['title', 'author', 'isbn', 'keyword', 'callno', 'publisher'].includes(searchType)) throw new Error('不支持的检索方式');
    if (!['ALL', '01', '02', '11'].includes(doctype)) throw new Error('不支持的文献类型');
    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) throw new Error('页码超出范围');
    return { query, searchType, doctype, page, onlyAvailable: input.onlyAvailable === true };
  }

  function buildSearchUrl(input) {
    const p = normalizeSearch(input);
    const values = {
      strSearchType: p.searchType, strText: p.query, historyCount: '1',
      doctype: p.doctype, lang_code: 'ALL', displaypg: PAGE_SIZE,
      sort: 'CATA_DATE', orderby: 'DESC', location: 'ALL',
      showmode: 'list', match_flag: 'forward', with_ebook: 'on',
      onlylendable: p.onlyAvailable ? 'yes' : 'no', page: p.page
    };
    return BASE_URL + 'openlink.php?' + Object.keys(values).map(key =>
      encodeURIComponent(key) + '=' + encodeURIComponent(values[key])).join('&');
  }

  function buildDetailUrl(id) {
    if (!validId(id)) throw new Error('无效的图书编号');
    return BASE_URL + 'item.php?marc_no=' + id;
  }

  /** @maintenance
   * 只提取站内 item.php 的受限 marc_no，不接受任意外链。详情页始终使用已知的固定基础地址。
   */
  function idFromHref(href) {
    let value = clean(href);
    if (value.startsWith(BASE_URL)) value = value.slice(BASE_URL.length);
    else if (/^[a-z]+:|^\/\//i.test(value)) return '';
    value = value.replace(/^\.\//, '');
    if (!/^item\.php\?/.test(value) || value.includes('#')) return '';
    const match = value.match(/[?&]marc_no=([A-Za-z0-9_-]{1,64})(?:&|$)/);
    return match ? match[1] : '';
  }

  // Adapter boundary keeps the parser usable with DOMParser in the APK and
  // lightweight Cheerio in the cloud function, without evaluating school HTML.
  function browserDocument(html, Parser) {
    const ParserClass = Parser || (typeof DOMParser === 'function' ? DOMParser : null);
    if (!ParserClass) throw new Error('图书页面解析组件不可用');
    const doc = new ParserClass().parseFromString(String(html), 'text/html');
    return {
      all: (selector, node = doc) => Array.from(node.querySelectorAll(selector)),
      text: node => node ? node.textContent : '',
      attr: (node, name) => node ? node.getAttribute(name) || '' : '',
      without: (node, selector) => {
        if (!node) return '';
        const clone = node.cloneNode(true);
        clone.querySelectorAll(selector).forEach(item => item.remove());
        return clone.textContent;
      },
      lines: node => {
        if (!node) return [];
        const clone = node.cloneNode(true);
        clone.querySelectorAll('span,a,img,script,style').forEach(item => item.remove());
        clone.querySelectorAll('br').forEach(item => item.replaceWith('\n'));
        return clone.textContent.split(/\n+/).map(clean).filter(Boolean);
      }
    };
  }

  /** @maintenance
   * 解析馆藏列表而非登录页。保留学校提供的馆藏/可借数量；找不到字段时用未知值，不假装有可借图书。
   */
  function parseSearch(doc, input) {
    const params = normalizeSearch(input);
    const list = doc.all('#search_book_list')[0];
    const wholeText = clean(doc.text(doc.all('body')[0]));
    const anchors = doc.all('a');
    const countMatch = wholeText.match(/检索到\s*(\d+)\s*条/);
    const countLink = anchors.map(a => doc.attr(a, 'href')).join(' ').match(/[?&]count=(\d+)/);
    const reportedCount = countMatch ? Number(countMatch[1]) : countLink ? Number(countLink[1]) : null;
    if (!list && reportedCount !== 0 && !/没有(?:找到|检索到)|未(?:找到|检索到)|无检索结果|没有相关/.test(wholeText)) {
      throw new Error('图书馆返回了无法识别的页面，请稍后重试');
    }
    const books = [];
    const seen = new Set();
    const entries = list ? doc.all('li.book_list_info', list) : [];
    entries.forEach(item => {
      const heading = doc.all('h3', item)[0];
      const link = heading && doc.all('a', heading)[0];
      const id = link && idFromHref(doc.attr(link, 'href'));
      if (!id || seen.has(id)) return;
      seen.add(id);
      const paragraph = doc.all('p', item)[0];
      const summary = clean(doc.text(paragraph && doc.all('span', paragraph)[0]));
      const lines = doc.lines(paragraph);
      const holdings = summary.match(/馆藏复本[：:]\s*(\d+)/);
      const available = summary.match(/可借复本[：:]\s*(\d+)/);
      books.push({
        id, title: clean(doc.text(link)).replace(/^\d{1,5}[.．]\s*/, ''),
        author: lines[0] || '', publisher: lines[1] || '',
        callNo: clean(doc.without(heading, 'a,span')).replace(/^[\s\-/:]+/, ''),
        docType: clean(doc.text(heading && doc.all('span', heading)[0])),
        holdingsSummary: summary, holdingsCount: holdings ? Number(holdings[1]) : null,
        availableCount: available ? Number(available[1]) : null,
        detailUrl: buildDetailUrl(id)
      });
    });
    if (entries.length && !books.length) throw new Error('图书馆书目格式已变化，暂时无法打开结果');
    const totalCount = reportedCount == null ? books.length : reportedCount;
    const next = anchors.some(a => /下一页/.test(doc.text(a)) && /[?&]page=\d+/.test(doc.attr(a, 'href')));
    return {
      books: books.slice(0, PAGE_SIZE), totalCount, page: params.page, pageSize: PAGE_SIZE,
      hasMore: params.page < MAX_PAGE && (next || totalCount > params.page * PAGE_SIZE),
      sourceUrl: buildSearchUrl(params), fetchedAt: new Date().toISOString()
    };
  }

  function isAvailable(status) {
    const value = clean(status);
    return !/不可|不外借|仅供|借出|预约|遗失|剔旧|非外借/.test(value) && /可借|在馆/.test(value);
  }

  function parseDetail(doc, id) {
    buildDetailUrl(id);
    const fields = [];
    doc.all('dl').forEach(dl => {
      const labels = doc.all('dt', dl);
      const values = doc.all('dd', dl);
      labels.forEach((label, i) => {
        const key = clean(doc.text(label)).replace(/[：:]$/, '');
        const value = clean(doc.text(values[i]));
        if (key && value) fields.push({ label: key, value });
      });
    });
    const lookup = label => (fields.find(item => item.label.includes(label)) || {}).value || '';
    const isbnAndPrice = lookup('ISBN及定价').split('/');
    const table = doc.all('table#item')[0];
    if (!table && !fields.some(item => /题名|ISBN|载体形态/.test(item.label))) {
      throw new Error('图书详情暂时不可用，请稍后重试');
    }
    const rows = table ? doc.all('tr', table) : [];
    const header = rows.length ? doc.all('th,td', rows[0]).map(cell => clean(doc.text(cell))) : [];
    const index = (pattern, fallback) => {
      const position = header.findIndex(label => pattern.test(label));
      return position >= 0 ? position : fallback;
    };
    const locations = [];
    rows.slice(1).forEach(row => {
      const cells = doc.all('td', row).map(cell => clean(doc.text(cell)));
      if (cells.length < 5) return;
      const status = cells[index(/书刊状态|借阅状态|^状态$/, 4)] || '';
      locations.push({
        callNo: cells[index(/索书号/, 0)] || '',
        barcode: cells[index(/条码/, 1)] || '',
        volume: cells[index(/年卷期/, 2)] || '',
        location: cells[index(/馆藏地|校区/, 3)] || '',
        status, available: isAvailable(status),
        dueDate: (status.match(/\d{4}-\d{1,2}-\d{1,2}/) || [])[0] || '',
        returnLocation: cells[index(/还书位置/, 5)] || ''
      });
    });
    return {
      id, isbn: clean(isbnAndPrice[0]), price: clean(isbnAndPrice.slice(1).join('/')),
      pages: lookup('载体形态'), publisher: lookup('出版发行'),
      summary: lookup('提要文摘').slice(0, 2000),
      locations: locations.slice(0, 500), availableCount: locations.filter(item => item.available).length,
      sourceUrl: buildDetailUrl(id), fetchedAt: new Date().toISOString()
    };
  }

  function withDeadline(task, milliseconds = 16000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('图书馆连接超时，请稍后重试或切换网络')), milliseconds);
      Promise.resolve().then(task).then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
  }

  function createController(transport, onChange = () => {}) {
    let sequence = 0;
    let state = {
      status: 'idle', error: '', books: [], params: null, page: 1, totalCount: 0,
      hasMore: false, fetchedAt: '', selected: null, detail: null, detailStatus: 'idle', detailError: ''
    };
    const snapshot = () => ({ ...state, books: state.books.slice() });
    const emit = () => onChange(snapshot());
    return {
      snapshot,
      async search(input) {
        const params = normalizeSearch(input);
        const request = ++sequence;
        const sameQuery = state.params && ['query', 'searchType', 'doctype', 'onlyAvailable'].every(key => state.params[key] === params[key]);
        state = { ...state, status: 'loading', error: '', selected: null, detail: null, detailStatus: 'idle', detailError: '' };
        if (!sameQuery) Object.assign(state, { books: [], totalCount: 0, page: 1, hasMore: false });
        emit();
        try {
          const result = await withDeadline(() => transport.search(params), 22000);
          if (request !== sequence) return;
          if (!result || !Array.isArray(result.books)) throw new Error('图书检索服务返回的数据格式不正确');
          state = { ...state, ...result, params, status: 'ready', error: '' };
        } catch (error) {
          if (request !== sequence) return;
          state = { ...state, status: 'error', error: clean(error.message || '图书搜索失败') };
        }
        emit();
      },
      async open(id) {
        const book = state.books.find(item => item.id === id);
        if (!book || state.status === 'loading') return;
        const request = ++sequence;
        state = { ...state, selected: book, detail: null, detailStatus: 'loading', detailError: '' };
        emit();
        try {
          const detail = await withDeadline(() => transport.detail(id), 22000);
          if (request !== sequence) return;
          if (!detail || !Array.isArray(detail.locations)) throw new Error('馆藏服务返回的数据格式不正确');
          state = { ...state, detail, detailStatus: 'ready' };
        } catch (error) {
          if (request !== sequence) return;
          state = { ...state, detailStatus: 'error', detailError: clean(error.message || '馆藏查询失败') };
        }
        emit();
      },
      back() {
        sequence++;
        state = { ...state, selected: null, detail: null, detailStatus: 'idle', detailError: '' };
        emit();
      },
      cancel() {
        sequence++;
        state = { ...state, status: state.books.length ? 'ready' : 'idle', selected: null, detail: null, detailStatus: 'idle', detailError: '' };
      }
    };
  }

  return { BASE_URL, REVISION, PAGE_SIZE, clean, normalizeSearch, buildSearchUrl,
    buildDetailUrl, idFromHref, browserDocument, parseSearch, parseDetail,
    isAvailable, withDeadline, createController };
});
