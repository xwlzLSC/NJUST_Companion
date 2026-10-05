const projectPaths = require('./fixtures/project-paths.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');
const { createService, createRepository, parseQrForm, REVISION, TTL_MS } = require('../integrations/wechat/cloud/wechat-login');
const cloudRoot = process.env.MINI_CLOUD_ROOT || projectPaths.mini("cloudfunctions/njustSync2");
const miniRoot = process.env.MINI_PROGRAM_ROOT || projectPaths.mini("miniprogram");
const cheerio = require(path.join(cloudRoot, 'node_modules/cheerio'));
const serviceUrl = 'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';
const pageUrl = 'https://ids.njust.edu.cn/authserver/login?service=' + encodeURIComponent(serviceUrl);
const qrForm = `<form id="qrLoginForm" action="/authserver/login"><input name="execution" value="e1s1"><input name="lt" value="test-lt"></form>`;
const uuid = 'mock-school-qr-123456789';
const clone = value => value == null ? value : structuredClone(value);
// A genuinely decodable PNG, not the old base64 encoding of the word 'image'.
const qrPng = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAIUlEQVR4AYXBAQEAMAiAME7/zt4Esr1ZHCRIkCBBggQJHxtuBAxSsWhBAAAAAElFTkSuQmCC';

function fakeDb() {
  const records = new Map();
  let transactionTail = Promise.resolve();
  const collection = name => ({
    doc: id => ({
      get: async () => ({ data: clone(records.get(name + ':' + id)) || null }),
      set: async ({ data }) => { records.set(name + ':' + id, clone(data)); }
    }),
    where: criteria => ({ update: async ({ data }) => {
      const key = name + ':' + criteria._id, old = records.get(key);
      const matches = old && Object.entries(criteria).every(([field, value]) => field === '_id' || old[field] === value);
      if (matches) records.set(key, { ...old, ...clone(data) });
      return { stats: { updated: matches ? 1 : 0 } };
    } })
  });
  return { records, collection, runTransaction: callback => {
    const result = transactionTail.then(() => callback({ collection }));
    transactionTail = result.catch(() => {});
    return result;
  } };
}

function harness() {
  const db = fakeDb();
  let clock = Date.now();
  const state = { qrStatus: '0', ready: false, postTimeout: false, rejected: false, requests: [], statusGate: null, badImage: false };
  const repository = createRepository(db, 'njust_sessions', () => clock);
  const deps = {
    repository, now: () => clock, createDocument: cheerio.load,
    createSession: jar => ({ jar: clone(jar) || { cookies: [] } }),
    serializeSession: async session => clone(session.jar),
    responseUrl: response => response.url,
    fetchText: async (session, url, options) => {
      state.requests.push({ url, options });
      if (url === serviceUrl) { session.jar.cookies.push('CAS-session'); return { html: qrForm, response: { url: pageUrl } }; }
      if (url.includes('/getToken')) return { html: uuid };
      if (url.includes('/getStatus.htl')) {
        if (state.statusGate) await state.statusGate;
        session.jar.cookies.push('status-cookie');
        return { html: state.qrStatus };
      }
      throw new Error('unexpected school request');
    },
    fetchImage: async (_session, url, options) => {
      state.requests.push({ url, options });
      return { status: 200, headers: { 'content-type': state.badImage ? 'text/html' : 'image/png;charset=UTF-8' }, data: Buffer.from('image-fixture') };
    },
    requestTextNoRedirect: async (session, url, options) => {
      state.requests.push({ url, options });
      assert.ok(session.jar.cookies.includes('CAS-session'));
      assert.ok(session.jar.cookies.includes('status-cookie'));
      session.jar.cookies.push('academic-cookie');
      if (state.postTimeout) { const error = new Error('timeout after token consumed'); error.code = 'ETIMEDOUT'; throw error; }
      return { response: { status: state.rejected ? 401 : 200 }, html: state.rejected ? qrForm : '学生个人中心' };
    },
    followResponseRedirects: async () => { throw new Error('unexpected redirect'); },
    verify: async session => state.ready && session.jar.cookies.includes('academic-cookie') ? { businessBase: 'https://bkjw.njust.edu.cn/njlgdx/' } : null,
    isUnauthenticatedPage: html => html.includes('pwdFromId'),
    isTimeout: error => error.code === 'ETIMEDOUT',
    status: record => ({ loggedIn: Boolean(record.active), username: record.active?.username || '',
      loginMethod: record.active?.loginMethod || '', accountKey: record.active?.accountKey || '' })
  };
  return { db, repository, state, deps, service: createService(deps), advance: ms => { clock += ms; },
    pending: () => db.records.get('njust_sessions:wechat-user-a'),
    user: () => db.records.get('njust_sessions:user-a'),
    posts: () => state.requests.filter(request => request.options?.method === 'POST') };
}

test('QR form requires the school CAS origin and the exact academic service', () => {
  const form = parseQrForm(qrForm, pageUrl, cheerio.load);
  assert.equal(new URL(form.actionUrl).searchParams.get('service'), serviceUrl);
  assert.equal(new URL(form.actionUrl).searchParams.get('display'), 'qrLogin');
  const currentSchoolPage = pageUrl.replace(encodeURIComponent(serviceUrl), encodeURIComponent(serviceUrl.replace('https:', 'http:')));
  assert.equal(new URL(parseQrForm(qrForm, currentSchoolPage, cheerio.load).actionUrl).searchParams.get('service'), serviceUrl.replace('https:', 'http:'));
  assert.throws(() => parseQrForm(qrForm, pageUrl.replace(encodeURIComponent(serviceUrl), encodeURIComponent('http://bkjw.njust.edu.cn:8081/njlgdx/indexsso.jsp')), cheerio.load), /目标地址异常/);
  assert.throws(() => parseQrForm(qrForm, 'https://evil.example/?service=' + encodeURIComponent(serviceUrl), cheerio.load));
  assert.throws(() => parseQrForm(qrForm, pageUrl.replace(encodeURIComponent(serviceUrl), encodeURIComponent('https://bkjw.njust.edu.cn/evil')), cheerio.load), /目标地址异常/);
  assert.throws(() => parseQrForm(qrForm.replace('action="/authserver/login"', 'action="https://evil.example/login"'), pageUrl, cheerio.load), /目标地址异常/);
  assert.throws(() => parseQrForm('<form id="pwdFromId"></form>', pageUrl, cheerio.load), /微信授权入口/);
});
test('both login options share a single challenge and no cookies are exposed', async () => {
  const h = harness(), first = await h.service.begin('user-a'), again = await h.service.begin('user-a');
  assert.equal(first.attemptId, again.attemptId);
  assert.equal(first.url, again.url);
  assert.equal(first.imageDataUrl, again.imageDataUrl);
  assert.equal(first.wechatRevision, REVISION);
  assert.equal(h.state.requests.length, 3);
  assert.equal(first.jar, undefined);
  assert.equal(first.fields, undefined);
  assert.match(h.state.requests[2].url, new RegExp('uuid=' + uuid));
});
test('pending and scanned states do not submit; confirmed authorization establishes one session', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'pending');
  h.state.qrStatus = '2';
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'confirming');
  assert.equal(h.posts().length, 0);
  assert.equal(h.user(), undefined);
  h.state.qrStatus = '1'; h.state.ready = true;
  const result = await h.service.check('user-a', attempt.attemptId);
  assert.equal(result.state, 'authorized');
  assert.equal(result.status.loggedIn, true);
  assert.equal(result.status.loginMethod, 'wechat');
  assert.equal(h.posts().length, 1);
  assert.equal(new URLSearchParams(h.posts()[0].options.data).get('uuid'), uuid);
  assert.equal(new URLSearchParams(h.posts()[0].options.data).get('cllt'), 'qrLogin');
  assert.equal(h.pending().jar, undefined, 'scrub private challenge after authorization');
  assert.equal(h.pending().uuid, undefined);
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'authorized', 'response-loss recovery is idempotent');
  assert.equal(h.posts().length, 1);
});
test('a timeout after consuming the token resumes verification, never another POST', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  h.state.qrStatus = '1'; h.state.postTimeout = true;
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'establishing');
  assert.equal(h.pending().submitted, true);
  assert.ok(h.pending().jar.cookies.includes('academic-cookie'));
  h.state.ready = true;
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'authorized');
  assert.equal(h.posts().length, 1);
});
test('simultaneous checks in different cloud containers are serialized by a lease', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  let release;
  h.state.statusGate = new Promise(resolve => { release = resolve; });
  h.state.qrStatus = '1'; h.state.ready = true;
  const first = h.service.check('user-a', attempt.attemptId);
  await new Promise(resolve => setImmediate(resolve));
  const otherContainer = createService(h.deps);
  assert.equal((await otherContainer.check('user-a', attempt.attemptId)).state, 'pending');
  release();
  assert.equal((await first).state, 'authorized');
  assert.equal(h.posts().length, 1);
});
test('cancellation during a school request prevents submission and stale session commit', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  let release;
  h.state.statusGate = new Promise(resolve => { release = resolve; });
  h.state.qrStatus = '1'; h.state.ready = true;
  const check = h.service.check('user-a', attempt.attemptId);
  await new Promise(resolve => setImmediate(resolve));
  await h.service.cancel('user-a', attempt.attemptId);
  release();
  await assert.rejects(check, /已取消/);
  assert.equal(h.posts().length, 0);
  assert.equal(h.user(), undefined);
});
test('OPENID isolation prevents another user from checking or cancelling a challenge', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  assert.equal((await h.service.check('user-b', attempt.attemptId)).state, 'expired');
  await h.service.cancel('user-b', attempt.attemptId);
  assert.equal(h.pending().state, 'pending');
  assert.equal(h.state.requests.length, 3);
});
test('expired challenges do not contact school and an explicit refresh gets a new attempt', async () => {
  const h = harness(), first = await h.service.begin('user-a');
  h.advance(TTL_MS + 1);
  assert.equal((await h.service.check('user-a', first.attemptId)).state, 'expired');
  assert.equal(h.state.requests.length, 3);
  const next = await h.service.begin('user-a');
  assert.notEqual(next.attemptId, first.attemptId);
  await h.service.cancel('user-a', first.attemptId);
  assert.equal(h.pending().attemptId, next.attemptId, 'old cancellation cannot cancel new QR');
});
test('school rejection and expiration are terminal; no token replay or stale login', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  h.state.qrStatus = '1'; h.state.rejected = true; h.state.ready = true;
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'failed');
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'failed');
  assert.equal(h.posts().length, 1);
  assert.equal(h.pending().jar, null);
  assert.equal(h.user(), undefined);
  const next = await h.service.begin('user-a');
  h.state.qrStatus = '3';
  assert.equal((await h.service.check('user-a', next.attemptId)).state, 'expired');
});
test('invalid QR images cancel preparation without modifying academic session', async () => {
  const h = harness(); h.state.badImage = true;
  await assert.rejects(h.service.begin('user-a'), /二维码图片加载失败/);
  assert.equal(h.pending().state, 'cancelled');
  assert.equal(h.user(), undefined);
});
test('rechecking after logout or account switch cannot revive a previous login', async () => {
  const h = harness(), attempt = await h.service.begin('user-a');
  h.state.qrStatus = '1'; h.state.ready = true;
  await h.service.check('user-a', attempt.attemptId);
  await assert.rejects(h.service.begin('user-a'), /当前已登录/);
  h.db.records.set('njust_sessions:user-a', { active: null });
  assert.equal((await h.service.check('user-a', attempt.attemptId)).state, 'cancelled');
});

function miniHarness({ userPath = 'wxfile://usr', canvas = false, modern = false, windowWidth = 390 } = {}) {
  const memory = new Map(), files = new Map(), timers = new Map(), calls = [];
  const fileState = { failWrite: false, failDecode: false, holdWrite: false, pendingWrites: [], writes: 0, reads: 0,
    requireBinary: false, requireBase64: false, ignoreBase64Encoding: false, writeOptions: [],
    failWriteReason: 'writeFile:fail unable to write image', imageDataUrl: 'data:image/png;base64,' + qrPng };
  const canvasState = { buffers: new Map(), holdDraw: false, pendingDraws: [], exportFail: false, holdExport: false, pendingExports: [], exports: 0 };
  let timerId = 0;
  const wx = { env: { USER_DATA_PATH: userPath },
    getStorageSync: key => clone(memory.get(key)) || '', setStorageSync: (key, value) => memory.set(key, clone(value)), removeStorageSync: key => memory.delete(key),
    getFileSystemManager: () => ({ writeFile: options => {
      fileState.writes++;
      fileState.writeOptions.push(options);
      const write = () => {
        if (fileState.failWrite || (fileState.requireBinary && Object.prototype.toString.call(options.data) !== '[object ArrayBuffer]')
          || (fileState.requireBase64 && (typeof options.data !== 'string' || options.encoding !== 'base64'))) {
          options.fail({ errMsg: fileState.failWriteReason }); return;
        }
        const bytes = typeof options.data === 'string' ? Buffer.from(options.data, options.encoding === 'base64' && !fileState.ignoreBase64Encoding ? 'base64' : 'utf8') : Buffer.from(options.data);
        files.set(options.filePath, bytes);
        options.success();
      };
      if (fileState.holdWrite) fileState.pendingWrites.push(write); else write();
    }, readdir: options => options.success({ files: [...files.keys()].filter(file => file.startsWith(userPath + '/')).map(file => file.slice(userPath.length + 1)) }),
    unlink: options => { files.delete(options.filePath); if (options.success) options.success(); } }),
    getImageInfo: options => {
      fileState.reads++;
      const bytes = files.get(options.src);
      if (fileState.failDecode || !bytes) { options.fail({ errMsg: 'getImageInfo:fail unable to decode image' }); return; }
      // Actually decode the bytes so a write success alone cannot make this
      // test falsely report that the mini's <image> can display the file.
      void Jimp.read(bytes).then(image => options.success({ path: options.src, width: image.bitmap.width, height: image.bitmap.height, type: 'png' }),
        () => options.fail({ errMsg: 'getImageInfo:fail invalid PNG' }));
    },
    showToast: options => calls.push(['toast', options.title]), showModal: options => calls.push(['modal', options]),
    previewImage: () => calls.push(['preview']), setClipboardData: options => { calls.push(['copy', options.data]); options.success(); },
    saveImageToPhotosAlbum: options => { calls.push(['album', options.filePath]); options.success(); }, openSetting: () => calls.push(['permission-setting'])
  };
  if (canvas) {
    wx.getWindowInfo = () => ({ windowWidth });
    wx.nextTick = callback => callback();
    wx.createCanvasContext = id => {
      let color = '#ffffff';
      let image;
      return {
        setFillStyle: value => { color = value; },
        fillRect: (x, y, width, height) => {
          if (!image) {
            image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
            canvasState.buffers.set(id, image);
          }
          const black = color === '#000000';
          for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
            const offset = (row * image.width + column) * 4;
            image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = black ? 0 : 255;
            image.data[offset + 3] = 255;
          }
        },
        draw: (_reserve, complete) => {
          canvasState.buffers.set(id, image);
          if (canvasState.holdDraw) canvasState.pendingDraws.push(complete); else complete();
        }
      };
    };
    if (modern) {
      wx.canIUse = feature => feature === 'canvas.type.2d';
      wx.createSelectorQuery = () => {
        let id;
        const query = { in: () => query, select: value => { id = value.slice(1); return query; }, fields: () => query,
          exec: complete => {
            const context = wx.createCanvasContext(id);
            const node = { _testId: id, width: 0, height: 0, getContext: () => ({
              set fillStyle(value) { context.setFillStyle(value); },
              fillRect: (...args) => context.fillRect(...args)
            }) };
            complete([{ node }]);
          } };
        return query;
      };
    }
    wx.canvasToTempFilePath = options => {
      const exportNumber = ++canvasState.exports;
      const image = canvasState.buffers.get(options.canvas ? options.canvas._testId : options.canvasId);
      const create = async () => {
        if (canvasState.exportFail) { options.fail({ errMsg: 'canvasToTempFilePath:fail storage limit exceeded' }); return; }
        const tempFilePath = 'wxfile://tmp_QR-' + exportNumber + '.png';
        const png = new Jimp({ width: image.width, height: image.height, color: 0xffffffff });
        png.bitmap.data = Buffer.from(image.data);
        files.set(tempFilePath, await png.getBuffer('image/png'));
        options.success({ tempFilePath });
      };
      if (canvasState.holdExport) canvasState.pendingExports.push(create); else void create();
    };
  }
  const context = vm.createContext({ wx, module: { exports: {} }, Date, Number, Promise,
    require: name => { if (name === './wechat-qr-canvas') return require(path.join(miniRoot, 'utils/wechat-qr-canvas.js')); throw new Error('Unexpected mini dependency'); },
    setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; }, setInterval: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; },
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id) });
  vm.runInContext(fs.readFileSync(path.join(miniRoot, 'utils/wechat-login.js'), 'utf8'), context);
  const utility = context.module.exports;
  const apiState = { result: { state: 'pending' }, locked: false, slowCheck: null, attemptId: 'a'.repeat(32) };
  const api = {
    getErrorMessage: error => error.message || error.errMsg,
    beginInteractiveLogin: async () => { apiState.locked = true; }, endInteractiveLogin: () => { apiState.locked = false; },
    prepareWechatLogin: async () => { calls.push(['prepare']); return { attemptId: apiState.attemptId, url: 'https://ids.njust.edu.cn/authserver/qrCode/qrCodeLogin.do?uuid=' + uuid,
      expiresAt: Date.now() + TTL_MS, imageDataUrl: fileState.imageDataUrl }; },
    checkWechatLogin: async id => { calls.push(['check', id]); if (apiState.slowCheck) await apiState.slowCheck; return apiState.result; },
    cancelWechatLogin: async id => calls.push(['cancel', id]),
    syncCurrent: async options => { calls.push(['sync', options]); return { data: { schedule: [], meta: { importedAt: 'new-sync' } }, status: apiState.result.status }; }
  };
  let data = { schedule: ['old-course'], meta: {} };
  const store = { saveLoginPrefs: prefs => calls.push(['prefs', prefs]), replaceRemoteData: next => { calls.push(['replace', next]); data = { ...next, meta: next.meta || {} }; }, loadAppData: () => data };
  const page = { ...utility.createProfileMethods(api, store), _wechatVisible: true,
    data: { ...utility.initialData, syncing: false, cloudSession: { loggedIn: false } },
    setData: (patch, complete) => { Object.assign(page.data, patch); if (complete) complete(); },
    syncCloudSession: status => { page.data.cloudSession = status; calls.push(['session', status]); },
    showSyncResultToast: () => {} };
  return { utility, page, calls, memory, files, timers, apiState, fileState, canvasState };
}
test('mini QR/link tabs reuse the challenge, and photo permission is requested only on save', async () => {
  const h = miniHarness();
  await h.page.startWechatLogin();
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'album').length, 0);
  assert.ok(h.page.data.wechatImagePath);
  const id = h.utility.loadPending().attemptId;
  h.page.selectWechatMode({ currentTarget: { dataset: { mode: 'link' } } });
  h.page.copyWechatLoginLink();
  h.page.selectWechatMode({ currentTarget: { dataset: { mode: 'qr' } } });
  assert.equal(h.utility.loadPending().attemptId, id);
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
  await h.page.saveWechatQr();
  assert.equal(h.calls.filter(call => call[0] === 'album').length, 1);
  h.page.hideWechatLogin();
  assert.equal(h.timers.size, 0);
  assert.ok(h.utility.loadPending(), 'leaving for authorization preserves pending state');
});
test('returning to mini finishes authorization, clears previous data, and synchronizes full sections', async () => {
  const h = miniHarness(); await h.page.startWechatLogin();
  assert.equal(h.calls.filter(call => call[0] === 'replace').length, 0, 'no data reset before school authentication');
  h.page.hideWechatLogin();
  h.apiState.result = { state: 'authorized', status: { loggedIn: true, username: '微信授权用户', loginMethod: 'wechat', accountKey: 'wechat:new-account' } };
  await h.page.resumeWechatLogin();
  assert.equal(h.page.data.cloudSession.loginMethod, 'wechat');
  assert.equal(h.utility.loadPending(), null);
  assert.equal(h.files.size, 0);
  const prefs = h.calls.find(call => call[0] === 'prefs')[1];
  assert.equal(prefs.rememberPassword, false);
  assert.equal(prefs.password, '');
  assert.deepEqual(Array.from(h.calls.find(call => call[0] === 'sync')[1].sections), ['schedule', 'grades', 'certs', 'exams']);
  assert.equal(h.calls.filter(call => call[0] === 'replace').length, 2);
  assert.equal(h.apiState.locked, false);
  assert.equal(h.timers.size, 0);
});
test('double taps cannot create concurrent check requests and cancelling removes the local QR', async () => {
  const h = miniHarness(); await h.page.startWechatLogin();
  let release;
  h.apiState.slowCheck = new Promise(resolve => { release = resolve; });
  const before = h.calls.filter(call => call[0] === 'check').length;
  const pending = h.page.checkWechatAuthorization();
  await h.page.checkWechatAuthorization();
  assert.equal(h.calls.filter(call => call[0] === 'check').length, before + 1);
  release(); await pending;
  await h.page.cancelWechatLoginByUser();
  assert.equal(h.utility.loadPending(), null);
  assert.equal(h.files.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.apiState.locked, false);
});
test('a final authorization response is not lost when the local QR countdown just elapsed', async () => {
  const h = miniHarness(); await h.page.startWechatLogin();
  h.page.hideWechatLogin();
  const pending = h.utility.loadPending(true);
  h.memory.set(h.utility.STORAGE_KEY, { ...pending, expiresAt: Date.now() - 1 });
  h.apiState.result = { state: 'authorized', status: { loggedIn: true, username: '微信授权用户', loginMethod: 'wechat', accountKey: 'wechat:new-account' } };
  await h.page.resumeWechatLogin();
  assert.equal(h.page.data.cloudSession.loggedIn, true);
  assert.equal(h.utility.loadPending(true), null);
});
test('mini source binds both login options and preserves existing academic password login', () => {
  const wxml = fs.readFileSync(path.join(miniRoot, 'pages/profile/index.wxml'), 'utf8');
  const profile = fs.readFileSync(path.join(miniRoot, 'pages/profile/index.js'), 'utf8');
  assert.match(wxml, /二维码登录/);
  assert.match(wxml, /链接登录/);
  assert.match(wxml, /bindtap="saveWechatQr"/);
  assert.match(wxml, /bindtap="copyWechatLoginLink"/);
  assert.match(wxml, /bindload="onWechatQrLoad"/);
  assert.match(wxml, /binderror="onWechatQrError"/);
  assert.match(wxml, /bindtap="retryWechatQr"/);
  assert.match(profile, /portalLoginOnly/);
  assert.doesNotMatch(profile, /onShow\(\)\s*{\s*wx\.removeStorageSync\('njust_wechat_login_pending'/);
});
test('every settings event binding resolves to an actual Page method', () => {
  const h = miniHarness(), utility = h.utility;
  let definition;
  const source = fs.readFileSync(path.join(miniRoot, 'pages/profile/index.js'), 'utf8');
  const context = vm.createContext({ wx: {}, Page: page => { definition = page; }, require: name => {
    if (name.endsWith('/wechat-login')) return utility;
    if (name.endsWith('/constants')) return { SOFTWARE_RELEASE_LINKS: { apk: 'fixture', releases: 'fixture' } };
    return {};
  } });
  vm.runInContext(source, context);
  const wxml = fs.readFileSync(path.join(miniRoot, 'pages/profile/index.wxml'), 'utf8');
  for (const match of wxml.matchAll(/(?:bind|catch)[a-z]+="([A-Za-z][A-Za-z0-9_]*)"/g)) {
    assert.equal(typeof definition[match[1]], 'function', 'missing settings handler: ' + match[1]);
  }
});
test('the API rejects undeployed WeChat actions and never password-recovers a WeChat session', async () => {
  const calls = [], session = { loginMethod: 'wechat', businessBase: '' };
  let oldCloud = true;
  const store = { loadSyncPrefs: () => ({ mode: 'cloud', cloudAuthType: 'portal' }), loadLoginPrefs: () => ({ rememberPassword: true, username: 'other-user', password: 'fixture-password' }), loadCloudSession: () => session };
  const context = vm.createContext({ module: { exports: {} }, Date, getApp: () => ({ globalData: { cloudEnv: 'fixture', cloudReady: true } }),
    require: name => name === './store' ? store : name === './wechat-login' ? { REVISION, hasPendingWechatLogin: () => false } : { CLOUD_ENV_ID: 'fixture' },
    wx: { cloud: { callFunction: async options => {
      calls.push(options.data.action);
      return { result: oldCloud ? { ok: false, error: '未知动作' } : { ok: false, error: '当前没有可用会话，请先重新登录' } };
    } } } });
  vm.runInContext(fs.readFileSync(path.join(miniRoot, 'utils/api.js'), 'utf8'), context);
  const api = context.module.exports;
  await assert.rejects(api.prepareWechatLogin(), /上传并部署新版/);
  oldCloud = false;
  await assert.rejects(api.keepAlive(), /没有可用会话/);
  assert.deepEqual(calls, ['prepareWechatLogin', 'keepAlive'], 'do not recover as a different remembered account');
});

test('mini writes clean base64 with explicit encoding on clients that reject ArrayBuffer bridge data', async () => {
  const h = miniHarness(); h.fileState.requireBase64 = true;
  await h.page.startWechatLogin();
  assert.equal(h.fileState.writes, 1);
  assert.equal(h.fileState.writeOptions[0].encoding, 'base64');
  assert.equal(h.fileState.writeOptions[0].data, qrPng);
  assert.equal(h.page.data.wechatImageError, '');
  assert.deepEqual(h.files.get(h.page.data.wechatImagePath), Buffer.from(qrPng, 'base64'));
  assert.equal((await Jimp.read(h.files.get(h.page.data.wechatImagePath))).bitmap.width, 8);
});

test('mini falls back to binary PNG on older bridges and verifies real image decoding before exposing its src', async () => {
  const h = miniHarness(); h.fileState.requireBinary = true;
  await h.page.startWechatLogin();
  const file = h.files.get(h.page.data.wechatImagePath);
  assert.ok(file);
  assert.deepEqual(file, Buffer.from(qrPng, 'base64'));
  assert.equal(h.fileState.reads, 1);
  assert.equal(h.page.data.wechatImageLoading, false);
  assert.equal(h.page.data.wechatImageError, '');
  assert.equal((await Jimp.read(file)).bitmap.width, 8);
  assert.equal(h.fileState.writes, 2);
  assert.notEqual(h.fileState.writeOptions[0].filePath, h.fileState.writeOptions[1].filePath);
  assert.equal(h.files.size, 1);
});

test('a bridge that ignores base64 encoding is detected by image decoding and repaired with binary', async () => {
  const h = miniHarness(); h.fileState.ignoreBase64Encoding = true;
  await h.page.startWechatLogin();
  assert.equal(h.fileState.writes, 2);
  assert.equal(h.fileState.reads, 2);
  assert.equal(h.page.data.wechatImageError, '');
  assert.deepEqual(h.files.get(h.page.data.wechatImagePath), Buffer.from(qrPng, 'base64'));
  assert.equal(h.files.size, 1);
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
});

test('a late callback from a rejected writer cannot remove the successful fallback image', async () => {
  const h = miniHarness(); h.fileState.requireBinary = true;
  await h.page.startWechatLogin();
  const displayed = h.page.data.wechatImagePath;
  const rejected = h.fileState.writeOptions[0];
  h.files.set(rejected.filePath, Buffer.from(qrPng, 'base64'));
  rejected.success();
  assert.equal(h.files.has(rejected.filePath), false);
  assert.equal(h.files.has(displayed), true);
  assert.equal(h.page.data.wechatImagePath, displayed);
});

test('disk quota errors stop immediately and show a classified reason without a private filename', async () => {
  const h = miniHarness(); h.fileState.failWrite = true;
  h.fileState.failWriteReason = 'writeFile:fail storage limit exceeded wxfile://usr/wechat-login-' + 'a'.repeat(32) + '.png';
  await h.page.startWechatLogin();
  assert.equal(h.fileState.writes, 1);
  assert.match(h.page.data.wechatImageError, /本地存储空间不足/);
  assert.doesNotMatch(h.page.data.wechatImageError, /wxfile|a{32}/);
  assert.equal(h.page.data.wechatImageLoading, false);
  h.page.copyWechatLoginLink();
  assert.equal(h.calls.filter(call => call[0] === 'copy').length, 1);
});

test('QR files also work with developer tools http://usr paths and are reused on return', async () => {
  const h = miniHarness({ userPath: 'http://usr' });
  await h.page.startWechatLogin();
  const src = h.page.data.wechatImagePath;
  assert.ok(src.startsWith('http://usr/wechat-login-'));
  h.page.hideWechatLogin();
  await h.page.resumeWechatLogin();
  assert.equal(h.page.data.wechatImagePath, src);
  assert.equal(h.fileState.writes, 1);
  assert.equal(h.fileState.reads, 2);
  await h.page.cancelWechatLoginByUser();
  assert.equal(h.files.size, 0);
});

test('file-write failure leaves link mode usable and a retry does not regenerate authorization', async () => {
  const h = miniHarness(); h.fileState.failWrite = true;
  await h.page.startWechatLogin();
  const id = h.utility.loadPending().attemptId;
  assert.equal(h.page.data.wechatImagePath, '');
  assert.match(h.page.data.wechatImageError, /本地文件写入失败/);
  assert.equal(h.page.data.wechatImageLoading, false);
  h.page.selectWechatMode({ currentTarget: { dataset: { mode: 'link' } } });
  h.page.copyWechatLoginLink();
  assert.equal(h.calls.filter(call => call[0] === 'copy').length, 1);
  h.fileState.failWrite = false;
  await h.page.retryWechatQr();
  assert.ok(h.page.data.wechatImagePath);
  assert.equal(h.utility.loadPending().attemptId, id);
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
});

test('a corrupt cached file is rebuilt and cannot remain as a blank image src', async () => {
  const h = miniHarness(); await h.page.startWechatLogin();
  const oldPath = h.page.data.wechatImagePath;
  h.files.set(oldPath, Buffer.from('not an image'));
  h.page.hideWechatLogin();
  await h.page.resumeWechatLogin();
  assert.notEqual(h.page.data.wechatImagePath, oldPath);
  assert.equal(h.files.has(oldPath), false);
  assert.equal(h.files.size, 1);
  assert.deepEqual(h.files.get(h.page.data.wechatImagePath), Buffer.from(qrPng, 'base64'));
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
});

test('native image errors rebuild once with a fresh filename then show a retry instead of blank', async () => {
  const h = miniHarness(); await h.page.startWechatLogin();
  const first = h.page.data.wechatImagePath;
  await h.page.onWechatQrError({ currentTarget: { dataset: { src: first } } });
  const second = h.page.data.wechatImagePath;
  assert.notEqual(second, first);
  assert.equal(h.fileState.writes, 2);
  await h.page.onWechatQrError({ currentTarget: { dataset: { src: second } } });
  assert.equal(h.page.data.wechatImagePath, '');
  assert.match(h.page.data.wechatImageError, /二维码显示失败.*重新加载/);
  assert.equal(h.fileState.writes, 2, 'must not loop automatic repairs');
  await h.page.retryWechatQr();
  const third = h.page.data.wechatImagePath;
  assert.ok(third);
  await h.page.onWechatQrError({ currentTarget: { dataset: { src: second } } });
  assert.equal(h.page.data.wechatImagePath, third, 'ignore late image errors from the previous src');
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
  assert.equal(h.files.size, 1);
});

test('a write callback timeout shows an error and its late write is removed without replacing the link', async () => {
  const h = miniHarness(); h.fileState.holdWrite = true;
  const starting = h.page.startWechatLogin();
  await new Promise(done => setImmediate(done));
  const deadline = [...h.timers.values()].find(timer => timer.ms === 6000);
  assert.ok(deadline);
  deadline.callback();
  await starting;
  const link = h.page.data.wechatLink;
  assert.match(h.page.data.wechatImageError, /等待超时/);
  assert.equal(h.page.data.wechatImageLoading, false);
  assert.equal(h.page.data.wechatStarting, false);
  h.fileState.pendingWrites.shift()();
  await new Promise(done => setImmediate(done));
  assert.equal(h.files.size, 0);
  assert.equal(h.page.data.wechatImagePath, '');
  assert.equal(h.page.data.wechatLink, link);
  h.fileState.holdWrite = false;
  await h.page.retryWechatQr();
  assert.ok(h.page.data.wechatImagePath);
});

test('cancelling while a QR write is pending cannot publish or leave the old image', async () => {
  const h = miniHarness(); h.fileState.holdWrite = true;
  const starting = h.page.startWechatLogin();
  await new Promise(done => setImmediate(done));
  await h.page.cancelWechatLoginByUser();
  h.fileState.pendingWrites.shift()();
  await starting;
  assert.equal(h.utility.loadPending(), null);
  assert.equal(h.page.data.wechatPending, false);
  assert.equal(h.page.data.wechatImagePath, '');
  assert.equal(h.files.size, 0);
  assert.equal(h.apiState.locked, false);
});

test('invalid image data is rejected before writing, with a usable existing link', async () => {
  const h = miniHarness(); h.fileState.imageDataUrl = 'data:image/png;base64,aW1hZ2U=';
  await h.page.startWechatLogin();
  assert.equal(h.page.data.wechatImagePath, '');
  assert.match(h.page.data.wechatImageError, /有效二维码图片/);
  assert.equal(h.fileState.writes, 0);
  h.page.copyWechatLoginLink();
  assert.equal(h.calls.filter(call => call[0] === 'copy').length, 1);
  assert.equal(h.utility.hasPendingWechatLogin(), true);
});

test('a native image decoder rejection never exposes the file as a ready image', async () => {
  const h = miniHarness(); h.fileState.failDecode = true;
  await h.page.startWechatLogin();
  assert.equal(h.page.data.wechatImagePath, '');
  assert.equal(h.page.data.wechatImageLoading, false);
  assert.match(h.page.data.wechatImageError, /图片解码失败/);
  assert.equal(h.files.size, 0);
  h.fileState.failDecode = false;
  await h.page.retryWechatQr();
  assert.ok(h.page.data.wechatImagePath);
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
});

test('concurrent QR retries share a single write and do not delete unrelated files', async () => {
  const h = miniHarness(); await h.page.startWechatLogin();
  const pending = h.utility.loadPending();
  const unrelated = 'wxfile://usr/user-photo.png';
  h.files.set(unrelated, Buffer.from('user fixture'));
  h.memory.set(h.utility.STORAGE_KEY, { ...pending, imagePath: unrelated });
  await Promise.all([h.page.retryWechatQr(), h.page.retryWechatQr()]);
  assert.equal(h.fileState.writes, 2);
  assert.equal(h.files.has(unrelated), true);
  await h.page.cancelWechatLoginByUser();
  assert.equal(h.files.has(unrelated), true);
});

test('canvas QR displays and decodes when persistent file writes fail from a full store', async () => {
  for (const windowWidth of [320, 390]) for (const modern of [false, true]) {
    const h = miniHarness({ canvas: true, modern, windowWidth });
    h.fileState.failWrite = true;
    await h.page.startWechatLogin();
    assert.equal(h.page.data.wechatCanvasReady, true);
    assert.equal(h.page.data.wechatImagePath, '');
    assert.equal(h.page.data.wechatImageError, '');
    assert.equal(h.page.data.wechatCanvasType, modern ? '2d' : '');
    assert.equal(h.fileState.writes, 0, 'display must not write a persistent image');
    assert.equal(h.fileState.reads, 0);
    assert.equal(h.canvasState.exports, 0, 'display must not export an image either');
    const image = h.canvasState.buffers.get(h.page.data.wechatCanvasId);
    assert.equal(jsQR(image.data, image.width, image.height).data, h.page.data.wechatLink);
    assert.deepEqual([...image.data.slice(0, 4)], [255, 255, 255, 255]);
    await h.page.previewWechatQr();
    assert.equal(h.page.data.wechatQrPreview, true);
    const enlarged = h.canvasState.buffers.get(h.page.data.wechatPreviewCanvasId);
    assert.equal(jsQR(enlarged.data, enlarged.width, enlarged.height).data, h.page.data.wechatLink);
    assert.equal(h.canvasState.exports, 0, 'enlarging must also work without any file');
    h.page.closeWechatQrPreview();
    assert.equal(h.page.data.wechatQrPreview, false);
  }
});

test('only expired generated QR cache files are removed, not account data or unrelated photos', async () => {
  const h = miniHarness({ canvas: true });
  const orphan = 'wxfile://usr/wechat-login-' + 'b'.repeat(32) + '-abc-1.png';
  const unrelated = 'wxfile://usr/account-backup.json';
  const lookalike = 'wxfile://usr/wechat-login-my-photo.png';
  h.files.set(orphan, Buffer.from('old QR fixture'));
  h.files.set(unrelated, Buffer.from('account fixture'));
  h.files.set(lookalike, Buffer.from('user photo fixture'));
  await h.page.startWechatLogin();
  await h.utility.cleanupQrCache();
  assert.equal(h.files.has(orphan), false);
  assert.equal(h.files.has(unrelated), true);
  assert.equal(h.files.has(lookalike), true);
  assert.equal(h.calls.filter(call => call[0] === 'replace').length, 0);
  assert.equal(h.utility.loadPending().attemptId, 'a'.repeat(32));
});

test('canvas tab switches and page return reuse the same authorization without creating files', async () => {
  const h = miniHarness({ canvas: true });
  await h.page.startWechatLogin();
  const pending = h.utility.loadPending();
  h.page.selectWechatMode({ currentTarget: { dataset: { mode: 'link' } } });
  h.page.copyWechatLoginLink();
  await h.page.selectWechatMode({ currentTarget: { dataset: { mode: 'qr' } } });
  h.page.hideWechatLogin();
  await h.page.resumeWechatLogin();
  assert.equal(h.page.data.wechatCanvasReady, true);
  assert.equal(h.utility.loadPending().attemptId, pending.attemptId);
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
  assert.equal(h.fileState.writes, 0);
});

test('canvas export is requested only on save and its own temporary file is removed afterwards', async () => {
  for (const modern of [false, true]) {
    const h = miniHarness({ canvas: true, modern });
    await h.page.startWechatLogin();
    assert.equal(h.canvasState.exports, 0);
    await h.page.saveWechatQr();
    assert.equal(h.canvasState.exports, 1);
    assert.equal(h.calls.filter(call => call[0] === 'album').length, 1);
    const exported = h.canvasState.buffers.get('wechatQrExport-' + 'a'.repeat(32));
    assert.equal(exported.width, 512);
    assert.equal(jsQR(exported.data, exported.width, exported.height).data, h.page.data.wechatLink);
    assert.equal(h.files.size, 0);
    assert.equal(h.page.data.wechatImageSaving, false);
    assert.equal(h.page.data.wechatCanvasReady, true);
  }
});

test('returning while an old draw is pending starts a fresh generation and cannot leave a blank canvas', async () => {
  const h = miniHarness({ canvas: true });
  h.canvasState.holdDraw = true;
  const beginning = h.page.startWechatLogin();
  await new Promise(done => setImmediate(done));
  const oldCanvas = h.page.data.wechatCanvasId;
  h.page.hideWechatLogin();
  h.canvasState.holdDraw = false;
  await h.page.resumeWechatLogin();
  const activeCanvas = h.page.data.wechatCanvasId;
  assert.notEqual(activeCanvas, oldCanvas);
  assert.equal(h.page.data.wechatCanvasReady, true);
  h.canvasState.pendingDraws.shift()();
  await beginning;
  assert.equal(h.page.data.wechatCanvasId, activeCanvas);
  assert.equal(h.page.data.wechatCanvasReady, true);
  assert.equal(h.calls.filter(call => call[0] === 'prepare').length, 1);
});

test('export failure cannot hide the memory QR or disable link login', async () => {
  const h = miniHarness({ canvas: true });
  await h.page.startWechatLogin();
  h.canvasState.exportFail = true;
  await h.page.saveWechatQr();
  assert.equal(h.page.data.wechatCanvasReady, true);
  assert.equal(h.page.data.wechatImageSaving, false);
  assert.equal(h.files.size, 0);
  h.page.selectWechatMode({ currentTarget: { dataset: { mode: 'link' } } });
  h.page.copyWechatLoginLink();
  assert.equal(h.calls.filter(call => call[0] === 'copy').length, 1);
});

test('draw timeout or cancellation cannot revive a stale canvas QR', async () => {
  for (const cancel of [false, true]) {
    const h = miniHarness({ canvas: true });
    h.canvasState.holdDraw = true;
    const beginning = h.page.startWechatLogin();
    await new Promise(done => setImmediate(done));
    if (cancel) await h.page.cancelWechatLoginByUser();
    else [...h.timers.values()].find(timer => timer.ms === 6000).callback();
    if (cancel) h.canvasState.pendingDraws.shift()();
    await beginning;
    if (!cancel) h.canvasState.pendingDraws.shift()();
    assert.equal(h.page.data.wechatCanvasReady, false);
    assert.equal(h.page.data.wechatImageLoading, false);
    assert.equal(h.page.data.wechatStarting, false);
    assert.equal(h.fileState.writes, 0);
    if (cancel) assert.equal(h.utility.loadPending(), null);
  }
});

test('a delayed temporary export is cleaned even after its timeout', async () => {
  const h = miniHarness({ canvas: true });
  await h.page.startWechatLogin();
  h.canvasState.holdExport = true;
  const saving = h.page.saveWechatQr();
  await new Promise(done => setImmediate(done));
  [...h.timers.values()].find(timer => timer.ms === 6000).callback();
  await saving;
  await h.canvasState.pendingExports.shift()();
  assert.equal(h.files.size, 0);
  assert.equal(h.page.data.wechatImageSaving, false);
  assert.equal(h.page.data.wechatCanvasReady, true);
  assert.equal(h.calls.filter(call => call[0] === 'album').length, 0);
});

test('a cancelled save cannot release the next attempt save button or retain its temporary image', async () => {
  const h = miniHarness({ canvas: true, modern: true });
  await h.page.startWechatLogin();
  h.canvasState.holdExport = true;
  const oldSaving = h.page.saveWechatQr();
  await new Promise(done => setImmediate(done));
  await h.page.cancelWechatLoginByUser();
  h.apiState.attemptId = 'b'.repeat(32);
  await h.page.startWechatLogin();
  const newSaving = h.page.saveWechatQr();
  await new Promise(done => setImmediate(done));
  await h.canvasState.pendingExports.shift()();
  await oldSaving;
  assert.equal(h.page.data.wechatImageSaving, true);
  assert.equal(h.page.data.wechatExportCanvasId, 'wechatQrExport-' + 'b'.repeat(32));
  assert.equal(h.files.size, 0);
  assert.equal(h.calls.filter(call => call[0] === 'album').length, 0);
  await h.canvasState.pendingExports.shift()();
  await newSaving;
  assert.equal(h.page.data.wechatImageSaving, false);
  assert.equal(h.files.size, 0);
  assert.equal(h.calls.filter(call => call[0] === 'album').length, 1);
});

test('memory QR encoder rejects non-school URLs and binds canvas readiness to the save button', () => {
  const renderer = require(path.join(miniRoot, 'utils/wechat-qr-canvas.js'));
  assert.throws(() => renderer.buildMatrix('https://example.org/qrCodeLogin.do?uuid=' + uuid), /学校/);
  assert.throws(() => renderer.buildMatrix('https://ids.njust.edu.cn/authserver/qrCode/qrCodeLogin.do?uuid=' + uuid + '&redirect=evil'), /学校/);
  const xml = fs.readFileSync(path.join(miniRoot, 'pages/profile/index.wxml'), 'utf8');
  assert.match(xml, /<canvas wx:if="\{\{wechatCanvasId\}\}"/);
  assert.match(xml, /!wechatCanvasReady && !wechatImagePath/);
  assert.match(xml, /bindtap="closeWechatQrPreview"/);
});
