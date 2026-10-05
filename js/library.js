/** @maintenance
 * 网页/APK 图书界面与传输适配：APK 用原生 HTTP，浏览器走本地匿名代理，展示层共用 library-core。
 * 该模块不负责教务登录、借阅续借或账号恢复；网络失败只影响图书查询，不清除课表数据。
 */
(function (global) {
  'use strict';
  const core = global.NJUSTLibraryCore;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const httpError = '暂时无法连接学校图书馆，请稍后重试或切换网络';
  const countLabel = value => value == null ? '未提供' : String(value);

  async function request(action, input) {
    const url = action === 'search' ? core.buildSearchUrl(input) : core.buildDetailUrl(input);
    const cap = global.capacitorExports || global.Capacitor || {};
    const native = cap.Capacitor ? cap.Capacitor.isNativePlatform?.() : cap.isNativePlatform?.();
    if (native) {
      // Never return/await a registerPlugin Proxy: it has a synthetic then.
      const http = cap.CapacitorHttp || global.Capacitor?.registerPlugin?.('CapacitorHttp');
      if (!http) throw new Error('原生图书检索组件不可用，请更新 APK');
      let response;
      try {
        response = await core.withDeadline(() => http.request({
          url, method: 'GET', responseType: 'text', disableRedirects: true,
          connectTimeout: 6000, readTimeout: 10000,
          headers: { Accept: 'text/html' }
        }));
      } catch (error) {
        throw new Error(/超时|timeout/i.test(error.message || '') ? '图书馆连接超时，请稍后重试' : httpError);
      }
      if (Number(response.status) !== 200 || typeof response.data !== 'string' || response.data.length > 2 * 1024 * 1024) {
        throw new Error(httpError);
      }
      const doc = core.browserDocument(response.data);
      return action === 'search' ? core.parseSearch(doc, input) : core.parseDetail(doc, input);
    }
    const query = action === 'search' ? core.normalizeSearch(input) : { id: input };
    const path = '/api/library/' + action + '?' + Object.keys(query).map(key =>
      encodeURIComponent(key) + '=' + encodeURIComponent(query[key])).join('&');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 16000);
    let payload;
    try {
      const response = await fetch(path, { cache: 'no-store', signal: abort.signal });
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('图书检索后端尚未更新，请重启本地服务');
      }
      payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.error || httpError);
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('图书馆连接超时，请稍后重试');
      throw error;
    } finally {
      clearTimeout(timer);
    }
    if (payload.libraryRevision !== core.REVISION) throw new Error('图书检索后端需要更新，请重启本地服务');
    if (typeof payload.html === 'string') {
      const doc = core.browserDocument(payload.html);
      return action === 'search' ? core.parseSearch(doc, input) : core.parseDetail(doc, input);
    }
    return payload.result;
  }

  const controller = core.createController({
    search: params => request('search', params),
    detail: id => request('detail', id)
  }, render);

  function notice(text, kind = '') {
    return '<div class="card library-notice ' + kind + '" role="status">' + esc(text) + '</div>';
  }

  function bookCard(book, disabled) {
    return '<button type="button" class="card library-book" data-book-id="' + esc(book.id) + '"' +
      (disabled ? ' disabled' : '') + ' onclick="NJUSTLibrary.open(this.dataset.bookId)">' +
      '<span class="library-book-mark" aria-hidden="true"><svg><use href="#i-book"></use></svg></span>' +
      '<span class="library-book-body"><span class="library-book-type">' + esc(book.docType || '馆藏图书') + '</span>' +
      '<strong class="library-book-title">' + esc(book.title) + '</strong>' +
      '<span class="library-book-meta">' + esc(book.author || '作者信息未提供') + '</span>' +
      '<span class="library-book-meta">' + esc(book.publisher) + '</span>' +
      '<span class="library-callno">索书号：' + esc(book.callNo || '未提供') + '</span>' +
      '<span class="library-book-bottom"><span>馆藏 ' + countLabel(book.holdingsCount) + ' 册</span>' +
      '<span class="library-badge ' + (book.availableCount > 0 ? 'available' : '') + '">可借 ' +
      countLabel(book.availableCount) + ' 册</span></span></span></button>';
  }

  function detailView(view) {
    const book = view.selected;
    let html = '<button class="btn btn-outline library-back" type="button" onclick="NJUSTLibrary.back()">← 返回检索结果</button>' +
      '<div class="card library-detail-head"><span class="library-book-type">' + esc(book.docType) + '</span>' +
      '<h2>' + esc(book.title) + '</h2><p>' + esc(book.author) + '</p><p>' + esc(book.publisher) + '</p>' +
      '<strong>索书号：' + esc(book.callNo || '未提供') + '</strong></div>';
    if (view.detailStatus === 'loading') return html + notice('正在查询馆藏地点与借阅状态…');
    if (view.detailStatus === 'error') {
      return html + notice(view.detailError, 'error') +
        '<button class="btn btn-primary" type="button" onclick="NJUSTLibrary.retryDetail()">重新查询馆藏</button>';
    }
    const detail = view.detail;
    if (!detail) return html;
    html += '<div class="card library-metadata"><dl><dt>ISBN</dt><dd>' + esc(detail.isbn || '未提供') +
      '</dd><dt>定价</dt><dd>' + esc(detail.price || '未提供') +
      '</dd><dt>载体形态</dt><dd>' + esc(detail.pages || '未提供') + '</dd></dl>' +
      (detail.summary ? '<p class="library-summary">' + esc(detail.summary) + '</p>' : '') + '</div>' +
      '<div class="section-title">馆藏与借阅状态 <small>共 ' + detail.locations.length + ' 册 · 可借 ' + detail.availableCount + ' 册</small></div>';
    if (!detail.locations.length) html += notice('此书目暂未提供纸质馆藏；电子资源或新书可能没有馆藏位置。');
    detail.locations.forEach(item => {
      html += '<div class="card library-holding"><div class="library-holding-head"><strong>' +
        esc(item.location || '馆藏地点未提供') + '</strong><span class="library-badge ' +
        (item.available ? 'available' : '') + '">' + (item.available ? '可借' : '暂不可借') + '</span></div>' +
        '<p class="library-holding-status">' + esc(item.status || '状态未提供') + '</p>' +
        '<p>索书号：' + esc(item.callNo || book.callNo || '未提供') + '</p>' +
        '<p>条码号：' + esc(item.barcode || '未提供') + (item.volume ? ' · ' + esc(item.volume) : '') + '</p>' +
        (item.returnLocation ? '<p>还书位置：' + esc(item.returnLocation) + '</p>' : '') + '</div>';
    });
    html += '<p class="library-footnote">馆藏状态以图书馆实时记录为准。查询时间：' +
      esc(new Date(detail.fetchedAt).toLocaleString('zh-CN')) + '</p>';
    return html;
  }

  function render() {
    const container = document.getElementById('library-results');
    if (!container) return;
    const view = controller.snapshot();
    const form = document.getElementById('library-search-form');
    if (form) form.hidden = Boolean(view.selected);
    const searchButton = document.getElementById('library-search-btn');
    if (searchButton) {
      searchButton.disabled = view.status === 'loading';
      searchButton.textContent = view.status === 'loading' ? '检索中…' : '检索';
    }
    if (view.selected) {
      container.innerHTML = detailView(view);
      return;
    }
    let html = '';
    if (view.status === 'idle') html = notice('输入书名、作者或 ISBN，检索学校图书馆馆藏。无需登录智慧理工。');
    if (view.status === 'loading') html += notice('正在检索学校图书馆…');
    if (view.status === 'error') html += notice(view.error, 'error') +
      '<button type="button" class="btn btn-outline library-retry" onclick="NJUSTLibrary.search()">重试检索</button>';
    if (view.status === 'ready' && !view.books.length) html += notice('没有找到相关图书，可以尝试缩短关键词或切换检索方式。');
    if (view.books.length) {
      html += '<p class="library-result-count">共 ' + Number(view.totalCount) + ' 条结果 · 第 ' + view.page + ' 页</p>';
      html += view.books.map(book => bookCard(book, view.status === 'loading')).join('');
      html += '<div class="library-pagination"><button class="btn btn-outline" type="button" onclick="NJUSTLibrary.changePage(-1)"' +
        (view.page <= 1 || view.status === 'loading' ? ' disabled' : '') + '>上一页</button>' +
        '<span>第 ' + view.page + ' 页</span><button class="btn btn-outline" type="button" onclick="NJUSTLibrary.changePage(1)"' +
        (!view.hasMore || view.status === 'loading' ? ' disabled' : '') + '>下一页</button></div>' +
        '<p class="library-footnote">每页 20 条 · 点开图书查看馆藏地点、条码号与借阅状态</p>';
    }
    container.innerHTML = html;
  }

  async function search(event) {
    event?.preventDefault();
    try {
      await controller.search({
        query: document.getElementById('library-query').value,
        searchType: document.getElementById('library-search-type').value,
        doctype: document.getElementById('library-doctype').value,
        onlyAvailable: document.getElementById('library-only-available').checked,
        page: 1
      });
    } catch (error) { global.showToast(error.message); }
    return false;
  }

  global.NJUSTLibrary = {
    render, search, open: id => controller.open(id),
    back: () => controller.back(), hasDetail: () => Boolean(controller.snapshot().selected),
    retryDetail: () => controller.open(controller.snapshot().selected?.id),
    changePage: offset => {
      const view = controller.snapshot();
      if (!view.params || view.status === 'loading' || (offset > 0 && !view.hasMore) || (offset < 0 && view.page <= 1)) return;
      return controller.search({ ...view.params, page: view.page + offset });
    },
    leave: () => controller.cancel()
  };
})(window);
