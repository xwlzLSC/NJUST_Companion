const projectPaths = require('./fixtures/project-paths.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const core = require('../js/library-core');

const ROOT = path.resolve(__dirname, '..');
const MINI = process.env.MINI_PROGRAM_ROOT || projectPaths.mini("");
const WXML_COMPILER = process.env.WXML_COMPILER_PATH || (process.platform === 'win32'
  ? path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Tencent',
    '微信web开发者工具', 'code', 'package.nw', 'node_modules', 'wcc-exec', 'wcc.exe') : '');
const SEARCH = fs.readFileSync(path.join(__dirname, 'fixtures/library-search.html'), 'utf8');
const DETAIL = fs.readFileSync(path.join(__dirname, 'fixtures/library-detail.html'), 'utf8');
const Parser = new JSDOM('').window.DOMParser;
const doc = html => core.browserDocument(html, Parser);
const params = { query: '高等数学' };
const result = () => core.parseSearch(doc(SEARCH), params);
const detail = () => core.parseDetail(doc(DETAIL), 'abcd1234');
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function cloudHarness(html = SEARCH) {
  const schoolRequire = createRequire(path.join(MINI, 'cloudfunctions/njustSync2/index.js'));
  const calls = [];
  const exports = {};
  const context = {
    exports, module: { exports }, console, setTimeout, clearTimeout,
    require: name => {
      if (name === './library-core') return require(path.join(MINI, 'cloudfunctions/njustLibrary/library-core.js'));
      if (name === 'cheerio') return schoolRequire('cheerio');
      if (name === 'axios') return {
        create: config => ({
          get: async url => {
            calls.push({ config, url });
            if (html instanceof Error) throw html;
            return { status: 200, data: html };
          }
        })
      };
      throw new Error('unexpected cloud dependency ' + name);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(MINI, 'cloudfunctions/njustLibrary/index.js'), 'utf8'), context);
  return { calls, main: exports.main };
}

test('search parameters encode Chinese and reserve characters without changing the fixed host', () => {
  const url = new URL(core.buildSearchUrl({ query: '数学 & C++', searchType: 'title', page: 2, onlyAvailable: true }));
  assert.equal(url.origin, 'http://202.119.83.14:8080');
  assert.equal(url.searchParams.get('strText'), '数学 & C++');
  assert.equal(url.searchParams.get('onlylendable'), 'yes');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('displaypg'), '20');
});

test('input validation rejects empty, oversized, invalid types and arbitrary detail URLs', () => {
  for (const input of [{ query: '' }, { query: 'x'.repeat(101) }, { query: 'x', page: 0 }, { query: 'x', page: 501 }, { query: 'x', searchType: '../reader' }, { query: 'x', doctype: 'evil' }]) {
    assert.throws(() => core.buildSearchUrl(input));
  }
  for (const id of ['http://127.0.0.1', '../secrets', 'abc&url=x', 'a'.repeat(65), '']) assert.throws(() => core.buildDetailUrl(id));
  assert.equal(core.idFromHref('https://evil.example/item.php?marc_no=abc'), '');
  assert.equal(core.idFromHref('//evil.example/item.php?marc_no=abc'), '');
  assert.equal(core.idFromHref('javascript:alert(1)'), '');
});

test('search parses title, author, publisher, call number and zero available copies', () => {
  const value = result();
  assert.equal(value.books.length, 2);
  assert.equal(value.totalCount, 23);
  assert.equal(value.hasMore, true);
  assert.equal(value.books[0].title, '高等数学 & 应用');
  assert.equal(value.books[0].author, '张三编著');
  assert.equal(value.books[0].publisher, '测试出版社 2025');
  assert.equal(value.books[0].callNo, 'O13/1000');
  assert.equal(value.books[0].holdingsCount, 3);
  assert.equal(value.books[0].availableCount, 0);
  assert.equal(value.books[1].title, 'Introduction to C++.第2版');
  assert.equal(value.books[1].availableCount, 2);
});

test('pagination counts use navigation fallback when count text is missing', () => {
  const html = SEARCH.replace(/<p>检索到[\s\S]*?<\/p>/, '');
  assert.equal(core.parseSearch(doc(html), { query: 'x', page: 2 }).totalCount, 23);
  const last = html.replace(/<div id="num">[\s\S]*?<\/div>/, '');
  assert.equal(core.parseSearch(doc(last), { query: 'x' }).hasMore, false);
});

test('empty search results are distinct from an upstream login or error page', () => {
  assert.equal(core.parseSearch(doc('<body>检索到 0 条结果</body>'), params).books.length, 0);
  assert.throws(() => core.parseSearch(doc('<body>系统维护中</body>'), params), /无法识别/);
  assert.throws(() => core.parseSearch(doc(SEARCH.replaceAll('item.php?marc_no=', 'https://evil.example/item.php?marc_no=')), params), /格式已变化/);
});

test('detail preserves room, barcode, due date and differentiates non-lendable copies', () => {
  const value = detail();
  assert.equal(value.isbn, '978-7-000-00000-0');
  assert.equal(value.price, 'CNY49.00');
  assert.equal(value.pages, '320页:图;24cm');
  assert.equal(value.locations.length, 3);
  assert.equal(value.availableCount, 1);
  assert.equal(value.locations[0].barcode, 'TEST0001');
  assert.match(value.locations[0].location, /503室/);
  assert.equal(value.locations[1].dueDate, '2026-10-11');
  assert.equal(value.locations[2].available, false);
});

test('detail maps holdings by column labels instead of relying solely on positions', () => {
  const html = '<body><dl><dt>ISBN及定价</dt><dd>123/CNY0</dd></dl><table id="item"><tr><th>书刊状态</th><th>校区—馆藏地</th><th>条码号</th><th>索书号</th><th>年卷期</th></tr><tr><td>可借</td><td>703室</td><td>TEST9</td><td>O13/9</td><td>上册</td></tr></table></body>';
  const row = core.parseDetail(doc(html), 'test9').locations[0];
  assert.equal(row.location, '703室');
  assert.equal(row.callNo, 'O13/9');
  assert.equal(row.barcode, 'TEST9');
  assert.equal(row.available, true);
  assert.equal(row.returnLocation, '');
});

test('valid book metadata without a holdings table is not a network error', () => {
  const html = DETAIL.replace(/<table[\s\S]*?<\/table>/, '');
  assert.equal(core.parseDetail(doc(html), 'abcd1234').locations.length, 0);
  assert.throws(() => core.parseDetail(doc('<body>Access denied</body>'), 'abcd1234'), /暂时不可用/);
});

test('cloud and native parsers have identical field semantics and share the same source', async () => {
  const cloud = cloudHarness();
  const response = await cloud.main({ action: 'search', query: '高等数学' });
  assert.equal(response.ok, true);
  const expected = result();
  delete response.result.fetchedAt;
  delete expected.fetchedAt;
  assert.deepEqual(JSON.parse(JSON.stringify(response.result)), expected);
  const canonical = fs.readFileSync(path.join(ROOT, 'js/library-core.js'), 'utf8').replace(/\r\n/g, '\n').trim();
  for (const target of ['miniprogram/utils/library-core.js', 'cloudfunctions/njustLibrary/library-core.js']) {
    assert.equal(fs.readFileSync(path.join(MINI, target), 'utf8').replace(/\r\n/g, '\n').trim(), canonical);
  }
});

test('cloud uses an anonymous bounded client and ignores credentials, cookies and supplied URLs', async () => {
  const cloud = cloudHarness(DETAIL);
  const response = await cloud.main({ action: 'detail', id: 'abcd1234', url: 'http://127.0.0.1', password: 'not-real', cookies: 'not-real' });
  assert.equal(response.ok, true);
  assert.equal(cloud.calls.length, 1);
  const { config, url } = cloud.calls[0];
  assert.equal(url, core.buildDetailUrl('abcd1234'));
  assert.equal(config.maxRedirects, 0);
  assert.equal(config.timeout, 14000);
  assert.equal(config.headers.Cookie, undefined);
  assert.equal(config.headers.Authorization, undefined);
  assert.equal(config.jar, undefined);
  assert.equal((await cloud.main({ action: 'detail', id: 'http://localhost' })).ok, false);
  assert.equal(cloud.calls.length, 1);
});

test('cloud network failures are visible errors, never disguised as zero results', async () => {
  const error = Object.assign(new Error('timeout of 14000ms exceeded'), { isAxiosError: true });
  const response = await cloudHarness(error).main({ action: 'search', query: 'x' });
  assert.equal(response.ok, false);
  assert.match(response.error, /超时/);
  assert.equal(response.result, undefined);
});

test('a newer search wins and late responses do not replace it', async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const c = core.createController({ search: () => (++calls === 1 ? first.promise : second.promise) });
  const one = c.search({ query: '旧关键词' });
  const two = c.search({ query: '新关键词' });
  second.resolve(result());
  await two;
  first.resolve({ ...result(), books: [] });
  await one;
  assert.equal(c.snapshot().params.query, '新关键词');
  assert.equal(c.snapshot().books.length, 2);
});

test('closing details prevents a late response from reopening the selected book', async () => {
  const pending = deferred();
  const c = core.createController({ search: async () => result(), detail: () => pending.promise });
  await c.search(params);
  const task = c.open('abcd1234');
  assert.equal(c.snapshot().detailStatus, 'loading');
  c.back();
  pending.resolve(detail());
  await task;
  assert.equal(c.snapshot().selected, null);
  assert.equal(c.snapshot().detail, null);
});

test('search/detail errors release busy state and allow retry', async () => {
  let fail = true;
  const c = core.createController({
    search: async () => { if (fail) throw Error('网络暂不可用'); return result(); },
    detail: async () => { if (fail) throw Error('馆藏暂不可用'); return detail(); }
  });
  await c.search(params);
  assert.equal(c.snapshot().status, 'error');
  fail = false;
  await c.search(params);
  fail = true;
  await c.open('abcd1234');
  assert.equal(c.snapshot().detailStatus, 'error');
  fail = false;
  await c.open('abcd1234');
  assert.equal(c.snapshot().detailStatus, 'ready');
});

test('deadline rejects a hanging operation and handles its late completion', async () => {
  const pending = deferred();
  await assert.rejects(core.withDeadline(() => pending.promise, 5), /超时/);
  pending.resolve('late');
});

test('mini library requests use the standalone function without login recovery or data deletion', async () => {
  const calls = [];
  const exports = {};
  const context = {
    module: { exports }, setTimeout, clearTimeout,
    require: name => name === './library-core' ? core : {
      callCloudFunction: async (...args) => {
        calls.push(args);
        return { ok: true, libraryRevision: core.REVISION, result: result() };
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(MINI, 'miniprogram/utils/library-api.js'), 'utf8'), context);
  await context.module.exports.search({ query: '高等数学' });
  assert.equal(calls[0][0], 'njustLibrary');
  assert.equal(calls[0][1], 'search');
  assert.equal(calls[0][2].query, '高等数学');
});

test('mini page search, pagination, detail and visibility lifecycle are connected', async () => {
  let page;
  const requests = [];
  const transport = {
    search: async p => { requests.push(p); return { ...result(), page: p.page }; },
    detail: async () => detail()
  };
  const context = {
    Page: config => { page = config; }, wx: { showToast() {}, stopPullDownRefresh() {} },
    require: name => name.endsWith('library-core') ? core : name.endsWith('library-api') ? transport : { applyThemeToPage() {} },
    console
  };
  vm.runInNewContext(fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.js'), 'utf8'), context);
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = data => Object.assign(page.data, data);
  page.onLoad();
  page.onShow();
  page.onQueryInput({ detail: { value: '高等数学' } });
  await page.search();
  assert.equal(page.data.view.books.length, 2);
  await page.nextPage();
  assert.equal(requests[1].page, 2);
  await page.openBook({ currentTarget: { dataset: { id: 'abcd1234' } } });
  assert.equal(page.data.view.detail.locations.length, 3);
  page.closeDetail();
  assert.equal(page.data.view.selected, null);
  const xml = fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.wxml'), 'utf8');
  for (const match of xml.matchAll(/\bbind(?:tap|input|change|confirm)="([^"]+)"/g)) assert.equal(typeof page[match[1]], 'function', match[1]);
  page.onHide();
  page.onShow();
  assert.notEqual(page.data.view.status, 'loading');
});

test('mini library WXML bindings do not contain HTML-escaped comparison operators', () => {
  const xml = fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.wxml'), 'utf8');
  for (const match of xml.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    assert.doesNotMatch(match[1], /&(?:lt|gt|amp);|&#(?:60|62|38|x(?:3c|3e|26));/i,
      'WXML binding expressions must use operators, not HTML entities: ' + match[1]);
  }
});

test('mini library results use full-width view rows rather than WeChat fixed-width native buttons', () => {
  const xml = fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.wxss'), 'utf8');
  assert.match(xml, /<view\s+class="section-card library-book /);
  assert.doesNotMatch(xml, /<button\b[^>]*class="[^"]*\blibrary-book\b/);
  assert.match(xml, /hover-class="library-book-pressed"/);
  assert.match(xml, /aria-role="button"/);
  assert.match(styles, /\.library-list \.library-book\s*\{[^}]*width:\s*100%;[^}]*margin:\s*0;/);
  assert.match(styles, /\.library-book-main\s*\{[^}]*display:\s*flex;/);
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.js'), 'utf8'), {
    Page: config => { page = config; }, require: () => ({}), console
  });
  let opened = '';
  let status = 'loading';
  const context = { _controller: { snapshot: () => ({ status }), open: id => { opened = id; } } };
  page.openBook.call(context, { currentTarget: { dataset: { id: 'abcd1234' } } });
  assert.equal(opened, '');
  status = 'ready';
  page.openBook.call(context, { currentTarget: { dataset: { id: 'abcd1234' } } });
  assert.equal(opened, 'abcd1234');
});

test('mini library WXML and WXSS compile with the installed WeChat compilers', {
  skip: !process.env.WXML_COMPILER_PATH && (!WXML_COMPILER || !fs.existsSync(WXML_COMPILER))
}, t => {
  const compiled = spawnSync(WXML_COMPILER, ['pages/library/index.wxml'], {
    cwd: path.join(MINI, 'miniprogram'), encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    windowsHide: true
  });
  assert.ifError(compiled.error);
  assert.equal(compiled.status, 0, compiled.stderr || 'WXML compiler failed');
  assert.ok(compiled.stdout.length > 0, 'WXML compiler emitted page code');
  const styleCompiler = process.env.WXSS_COMPILER_PATH || path.join(path.dirname(WXML_COMPILER), 'wcsc.exe');
  if (!process.env.WXSS_COMPILER_PATH && !fs.existsSync(styleCompiler)) {
    t.diagnostic('WXSS compiler not installed; WXML compilation was checked');
    return;
  }
  const styles = spawnSync(styleCompiler, ['pages/library/index.wxss'], {
    cwd: path.join(MINI, 'miniprogram'), encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    windowsHide: true
  });
  assert.ifError(styles.error);
  assert.equal(styles.status, 0, styles.stderr || 'WXSS compiler failed');
  assert.match(styles.stdout, /library-list/, 'WXSS compiler emitted the library page, not only app.wxss');
});

test('mini library pagination bindings disable boundary pages and loading requests', () => {
  const xml = fs.readFileSync(path.join(MINI, 'miniprogram/pages/library/index.wxml'), 'utf8');
  const previous = xml.match(/<button\b[^>]*bindtap="previousPage"\s+disabled="\{\{([\s\S]*?)\}\}"/);
  const next = xml.match(/<button\b[^>]*bindtap="nextPage"\s+disabled="\{\{([\s\S]*?)\}\}"/);
  assert.ok(previous, 'previous-page disabled binding exists');
  assert.ok(next, 'next-page disabled binding exists');
  const cases = [
    { page: 0, hasMore: true, status: 'ready', previous: true, next: false },
    { page: 1, hasMore: true, status: 'ready', previous: true, next: false },
    { page: 2, hasMore: true, status: 'ready', previous: false, next: false },
    { page: 2, hasMore: false, status: 'ready', previous: false, next: true },
    { page: 1, hasMore: true, status: 'loading', previous: true, next: true },
    { page: 2, hasMore: true, status: 'loading', previous: true, next: true },
    { page: 2, hasMore: false, status: 'error', previous: false, next: true }
  ];
  for (const view of cases) {
    assert.equal(vm.runInNewContext(previous[1], { view }), view.previous, JSON.stringify(view));
    assert.equal(vm.runInNewContext(next[1], { view }), view.next, JSON.stringify(view));
  }
});

test('both homepages keep exactly eight tiles and replace the campus network with library navigation', () => {
  const html = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')).window.document;
  assert.equal(html.querySelectorAll('.quick-grid .quick-card').length, 8);
  assert.match(html.querySelector('[data-action-key="library"]').textContent, /图书检索/);
  assert.equal(html.querySelector('[data-action-key="network"]'), null);
  assert.equal(html.querySelector('#settings-wifi-card'), null);
  assert.match(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8'), /DEFAULT_QUICK_ORDER = \['schedule', 'grades', 'exams', 'classrooms', 'sites', 'todos', 'settings', 'library'\]/);
  const xml = fs.readFileSync(path.join(MINI, 'miniprogram/pages/dashboard/index.wxml'), 'utf8');
  assert.equal((xml.match(/class="quick-card"/g) || []).length, 8);
  assert.match(xml, /bindtap="openLibrary"/);
  assert.doesNotMatch(xml, /openCampusNetwork/);
});

test('APK uses the actual Capacitor HTTP Proxy without Promise-assimilating it or sending credentials', async () => {
  const calls = [];
  let thenReads = 0;
  const capContext = vm.createContext({
    exports: {}, console, androidBridge: {}, Capacitor: {
      PluginHeaders: [{ name: 'CapacitorHttp', methods: [{ name: 'request', rtype: 'promise' }] }],
      nativePromise: async (plugin, method, options) => {
        assert.equal(plugin, 'CapacitorHttp');
        assert.equal(method, 'request');
        calls.push(options);
        return { status: 200, data: options.url.includes('item.php') ? DETAIL : SEARCH };
      }
    }
  });
  vm.runInContext(fs.readFileSync(require.resolve('@capacitor/core'), 'utf8'), capContext);
  const plugin = capContext.exports.CapacitorHttp;
  const http = new Proxy(plugin, {
    get(target, key, receiver) {
      if (key === 'then') thenReads++;
      return Reflect.get(target, key, receiver);
    }
  });
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
    url: 'https://localhost', runScripts: 'outside-only'
  });
  dom.window.capacitorExports = { Capacitor: { isNativePlatform: () => true }, CapacitorHttp: http };
  dom.window.showToast = message => { throw Error(message); };
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'js/library-core.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'js/library.js'), 'utf8'));
  dom.window.document.getElementById('library-query').value = '高等数学';
  await dom.window.NJUSTLibrary.search();
  assert.equal(dom.window.document.querySelectorAll('#library-results .library-book').length, 2);
  await dom.window.NJUSTLibrary.open('abcd1234');
  assert.equal(dom.window.document.querySelectorAll('#library-results .library-holding').length, 3);
  assert.equal(dom.window.document.getElementById('library-search-form').hidden, true);
  dom.window.NJUSTLibrary.back();
  assert.equal(dom.window.document.getElementById('library-search-form').hidden, false);
  assert.equal(thenReads, 0);
  assert.equal(calls.length, 2);
  for (const request of calls) {
    assert.equal(new URL(request.url).origin, 'http://202.119.83.14:8080');
    assert.equal(request.headers.Cookie, undefined);
    assert.equal(request.headers.Authorization, undefined);
    assert.equal(request.disableRedirects, true);
  }
  dom.window.close();
});

test('book titles containing HTML are escaped and cannot inject active image elements', async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), { url: 'https://localhost', runScripts: 'outside-only' });
  dom.window.capacitorExports = {
    Capacitor: { isNativePlatform: () => true },
    CapacitorHttp: { request: async () => ({ status: 200, data: SEARCH.replace('高等数学 &amp; 应用', '&lt;img src=x onerror=alert(1)&gt;') }) }
  };
  dom.window.showToast = message => { throw Error(message); };
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'js/library-core.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'js/library.js'), 'utf8'));
  dom.window.document.getElementById('library-query').value = 'x';
  await dom.window.NJUSTLibrary.search();
  const results = dom.window.document.getElementById('library-results');
  assert.equal(results.querySelector('img'), null);
  assert.match(results.querySelector('.library-book-title').textContent, /<img src=x onerror=alert\(1\)>/);
  dom.window.close();
});
