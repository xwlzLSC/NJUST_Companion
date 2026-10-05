const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { png, defer } = require('./fixtures/native-harness.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const controller = source.slice(source.indexOf('let loginBusy = false;'), source.indexOf('async function syncNativeLoginPreference('));
const capacitorSource = fs.readFileSync(require.resolve('@capacitor/core'), 'utf8');

function uiHarness({ nativeProxy = false } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'https://localhost/' });
  const timers = new Map();
  const intervals = new Map();
  const calls = { begin: 0, image: 0, poll: 0, cancel: 0, save: 0, share: 0, open: 0, copy: 0, thenReads: 0, nativeMethods: [], toasts: [] };
  const control = { hidden: false, pollFail: false, authorized: false, gate: null, imageGate: null, saveGate: null, openGate: null,
    copyGate: null, bridgeHang: false, listenerHang: false, bridgeUnavailable: false, opened: true };
  let clock = Date.now();
  let timerId = 0;
  let pending = null;
  Object.defineProperty(dom.window.document, 'hidden', { get: () => control.hidden });
  const api = {
    isSupported: () => true,
    beginWechatLogin: async ({ includeImage }) => {
      calls.begin++;
      pending = { uuid: 'mock-ui-challenge', url: 'https://ids.njust.edu.cn/authserver/qrCode/qrCodeLogin.do?uuid=mock-ui-challenge',
        expiresAt: clock + 180000, verifyUntil: clock + 225000, imageDataUrl: includeImage ? 'data:image/png;base64,' + png : '' };
      return { ...pending };
    },
    getPendingWechatLogin: () => pending,
    getWechatQrImage: async () => {
      calls.image++;
      if (control.imageGate) await control.imageGate.promise;
      if (!pending) throw new Error('微信授权已取消');
      pending.imageDataUrl = 'data:image/png;base64,' + png;
      return { ...pending };
    },
    cancelWechatLogin: () => { calls.cancel++; pending = null; },
    pollWechatLogin: async () => {
      calls.poll++;
      if (control.gate) await control.gate.promise;
      if (control.pollFail) throw new Error('network timeout');
      if (control.authorized) { pending = null; return { state: 'authorized', status: { loggedIn: true, lastSyncAt: '' }, data: { schedule: [] }, warning: 'HTTP 503' }; }
      return { state: 'pending' };
    }
  };
  const bridge = {
    addListener: async () => { if (control.listenerHang) await new Promise(() => {}); },
    copyLinkAndOpenWechat: async () => { calls.share++; if (control.bridgeHang) await new Promise(() => {}); return { copied: true, opened: control.opened }; },
    saveQrImage: async () => { calls.save++; if (control.saveGate) await control.saveGate.promise; },
    openWechat: async () => { calls.open++; if (control.openGate) await control.openGate.promise; }
  };
  let registeredBridge = bridge;
  if (nativeProxy) {
    // Use the installed Capacitor runtime, not just a plain JS object. Its
    // Proxy synthesizes `then`, which exposed the actual APK-only deadlock.
    const capContext = vm.createContext({ exports: {}, console, androidBridge: {}, Capacitor: {
      PluginHeaders: [{ name: 'WechatBridge', methods: [
        ...['saveQrImage', 'openWechat', 'copyLinkAndOpenWechat', 'removeListener'].map(name => ({ name, rtype: 'promise' })),
        { name: 'addListener', rtype: 'callback' }
      ] }],
      nativePromise: async (plugin, method, options) => {
        assert.equal(plugin, 'WechatBridge');
        calls.nativeMethods.push(method);
        return bridge[method]?.(options);
      },
      nativeCallback: (plugin, method) => {
        assert.equal(plugin, 'WechatBridge');
        assert.equal(method, 'addListener');
        calls.nativeMethods.push(method);
        return bridge.addListener().then(() => 'mock-listener');
      }
    } });
    vm.runInContext(capacitorSource, capContext);
    const proxy = capContext.exports.registerPlugin('WechatBridge');
    registeredBridge = new Proxy(proxy, { get(target, property, receiver) {
      if (property === 'then') calls.thenReads++;
      return Reflect.get(target, property, receiver);
    } });
  }
  class MockDate extends Date { static now() { return clock; } }
  const context = vm.createContext({ window: { NJUSTNativeSync: api, capacitorExports: { registerPlugin: () => {
    if (control.bridgeUnavailable) throw new Error('微信组件不可用，请更新安装包');
    return registeredBridge;
  } } }, document: dom.window.document,
    localStorage: dom.window.localStorage, Date: MockDate, console,
    setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: callback => { const id = ++timerId; intervals.set(id, callback); return id; }, clearInterval: id => intervals.delete(id),
    state: { server: {}, loginPrefs: {}, currentPage: 'settings' }, DEFAULT_LOGIN_PREFS: {},
    isNativeSyncAvailable: () => true, showToast: message => calls.toasts.push(message),
    copyTextToClipboard: async () => { calls.copy++; if (control.copyGate) await control.copyGate.promise; },
    buildGradeSignature: () => '', persistLoginPrefs: async () => {}, persistCurrentData: async () => {}, afterDataChanged: async () => {},
    applyRemoteData: () => {}, renderCurrentPage: () => {}, renderHome: () => {}, renderServerStatus: () => {}
  });
  vm.runInContext(controller + '\nfunction uiState(){return {mode:wechatLoginMode,busy:wechatLoginBusy,checking:wechatLoginChecking,link:wechatLoginLink,expired:wechatLoginExpired,paused:wechatLoginPaused};}', context);
  return { context, document: dom.window.document, timers, intervals, calls, control, advance: ms => { clock += ms; } };
}

test('mode switching keeps the same authorization and never opens WeChat automatically', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('link');
  const link = h.context.uiState().link;
  await h.context.startWechatLogin('qr');
  assert.equal(h.calls.begin, 1);
  assert.equal(h.calls.image, 1);
  assert.equal(h.context.uiState().link, link);
  assert.equal(h.calls.share + h.calls.open, 0);
  assert.equal(h.document.getElementById('wechat-link-panel').hidden, true);
  assert.equal(h.document.getElementById('wechat-login-qr').hidden, false);
});

test('explicit QR save/open and link copy/share call only their corresponding native action', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('qr');
  await h.context.saveWechatLoginQr();
  await h.context.openWechatForLogin();
  await h.context.selectWechatLoginMode('link');
  await h.context.copyWechatLoginLink();
  await h.context.shareWechatLoginLink();
  assert.deepEqual([h.calls.save, h.calls.open, h.calls.copy, h.calls.share], [1, 1, 1, 1]);
});

test('hidden app stops all polling/countdown timers and resumes only one check', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('qr');
  h.control.hidden = true;
  h.document.dispatchEvent(new h.document.defaultView.Event('visibilitychange'));
  assert.equal(h.timers.size, 0);
  assert.equal(h.intervals.size, 0);
  await h.context.checkWechatLogin({ silent: true });
  assert.equal(h.calls.poll, 0);
  h.control.hidden = false;
  h.control.gate = defer();
  h.context.resumeWechatLoginChecks();
  h.context.resumeWechatLoginChecks();
  assert.equal(h.calls.poll, 1);
  h.control.gate.resolve();
  await new Promise(done => setImmediate(done));
  assert.equal(h.timers.size, 1);
});

test('expiry removes QR image/link and prevents save or forwarding until explicit renewal', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('qr');
  h.advance(180001);
  h.context.updateWechatLoginPanel();
  assert.equal(h.context.uiState().expired, true);
  assert.equal(h.document.getElementById('wechat-login-qr').hasAttribute('src'), false);
  await h.context.saveWechatLoginQr();
  await h.context.shareWechatLoginLink();
  assert.equal(h.calls.save + h.calls.share, 0);
  await h.context.refreshWechatLogin();
  assert.equal(h.calls.begin, 2);
  assert.equal(h.context.uiState().expired, false);
});

test('network errors back off to 15 seconds then pause; manual check can resume', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('link');
  h.control.pollFail = true;
  await h.context.checkWechatLogin({ silent: true });
  assert.equal([...h.timers.values()][0].ms, 8000);
  for (let i = 0; i < 4; i++) await h.context.checkWechatLogin({ silent: true });
  assert.equal(h.context.uiState().paused, true);
  assert.equal(h.timers.size, 0);
  h.control.pollFail = false;
  await h.context.checkWechatLogin();
  assert.equal(h.context.uiState().paused, false);
  assert.equal([...h.timers.values()][0].ms, 4000);
});

test('authorization success clears transient QR/timers and does not fake a successful sync timestamp', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('qr');
  h.control.authorized = true;
  await h.context.checkWechatLogin();
  assert.equal(h.context.uiState().link, '');
  assert.equal(h.timers.size + h.intervals.size, 0);
  assert.equal(h.context.state.server.lastSyncAt, '');
  assert.equal(h.document.getElementById('wechat-login-qr').hasAttribute('src'), false);
});

test('hung native open action times out, unlocks all actions and copies the link as fallback', async () => {
  const h = uiHarness();
  await h.context.startWechatLogin('link');
  h.control.bridgeHang = true;
  const action = h.context.shareWechatLoginLink();
  await new Promise(done => setImmediate(done));
  assert.equal(h.context.uiState().busy, true);
  const deadline = [...h.timers.values()].find(timer => timer.ms === 5000);
  assert.ok(deadline);
  deadline.callback();
  await action;
  assert.equal(h.context.uiState().busy, false);
  assert.equal(h.calls.share, 1);
  assert.equal(h.calls.copy, 1);
  assert.equal(h.document.querySelector('button[onclick="cancelWechatLogin()"]')?.disabled, false);
  assert.match(h.calls.toasts.at(-1), /未及时响应.*链接已复制/);
  assert.equal(h.context.cancelWechatLogin(), true);
});

test('optional listener registration cannot prevent opening WeChat', async () => {
  const h = uiHarness();
  h.control.listenerHang = true;
  await h.context.startWechatLogin('link');
  await h.context.shareWechatLoginLink();
  assert.equal(h.calls.share, 1);
  assert.equal(h.context.uiState().busy, false);
  assert.match(h.document.getElementById('wechat-login-message').textContent, /链接已复制并打开微信/);
  for (const timer of [...h.timers.values()]) if (timer.ms === 5000) timer.callback();
  await new Promise(done => setImmediate(done));
});

test('missing WeChat preserves a successful native copy without falsely claiming it opened', async () => {
  const h = uiHarness();
  h.control.opened = false;
  await h.context.startWechatLogin('link');
  await h.context.shareWechatLoginLink();
  assert.equal(h.calls.share, 1);
  assert.equal(h.calls.copy, 0);
  assert.equal(h.context.uiState().busy, false);
  assert.match(h.document.getElementById('wechat-login-message').textContent, /未能自动打开微信/);
});

test('real Capacitor Proxy saves a QR without being assimilated as a Promise', { timeout: 1500 }, async () => {
  const h = uiHarness({ nativeProxy: true });
  // Match app startup, which initializes this bridge before the first click.
  vm.runInContext('getWechatBridge(); void 0;', h.context);
  await h.context.startWechatLogin('qr');
  await h.context.saveWechatLoginQr();
  assert.equal(h.calls.save, 1);
  assert.ok(h.calls.nativeMethods.includes('saveQrImage'));
  assert.equal(h.calls.thenReads, 0);
  assert.equal(h.context.uiState().busy, false);
  assert.equal(h.document.querySelector('button[onclick="cancelWechatLogin()"]')?.disabled, false);
});

test('real Capacitor Proxy copies/opens WeChat and never calls the phantom then method', { timeout: 1500 }, async () => {
  const h = uiHarness({ nativeProxy: true });
  await h.context.startWechatLogin('link');
  await h.context.shareWechatLoginLink();
  await h.context.openWechatForLogin();
  assert.deepEqual([h.calls.share, h.calls.open], [1, 1]);
  assert.equal(h.calls.thenReads, 0);
  assert.equal(h.calls.copy, 0);
  assert.equal(h.context.uiState().busy, false);
});

test('QR image download timeout unlocks buttons and ignores its late response', async () => {
  const h = uiHarness({ nativeProxy: true });
  await h.context.startWechatLogin('link');
  h.control.imageGate = defer();
  const action = h.context.saveWechatLoginQr();
  await new Promise(done => setImmediate(done));
  const deadline = [...h.timers.values()].find(timer => timer.ms === 12000);
  assert.ok(deadline);
  deadline.callback();
  await action;
  assert.equal(h.context.uiState().busy, false);
  assert.equal(h.calls.save, 0);
  assert.equal(h.document.querySelector('button[onclick="cancelWechatLogin()"]')?.disabled, false);
  h.control.imageGate.resolve();
  await new Promise(done => setImmediate(done));
  assert.equal(h.calls.save, 0, 'a timed-out download must not save a photo later');
  assert.equal(h.calls.thenReads, 0);
});

test('native gallery timeout unlocks other actions and does not announce late success', async () => {
  const h = uiHarness({ nativeProxy: true });
  await h.context.startWechatLogin('qr');
  h.control.saveGate = defer();
  const action = h.context.saveWechatLoginQr();
  await new Promise(done => setImmediate(done));
  assert.equal(h.calls.save, 1);
  [...h.timers.values()].find(timer => timer.ms === 12000).callback();
  await action;
  assert.equal(h.context.uiState().busy, false);
  await h.context.shareWechatLoginLink();
  assert.equal(h.calls.share, 1);
  const previousMessage = h.document.getElementById('wechat-login-message').textContent;
  h.control.saveGate.resolve();
  await new Promise(done => setImmediate(done));
  assert.equal(h.document.getElementById('wechat-login-message').textContent, previousMessage);
  assert.equal(h.calls.toasts.some(message => /二维码已保存/.test(message)), false);
});

test('slow authorization polling does not disable save/copy or mode/cancel buttons', async () => {
  const h = uiHarness({ nativeProxy: true });
  await h.context.startWechatLogin('qr');
  h.control.gate = defer();
  const checking = h.context.checkWechatLogin({ silent: true });
  assert.equal(h.context.uiState().checking, true);
  assert.equal(h.context.uiState().busy, false);
  assert.equal(h.document.getElementById('wechat-mode-link').disabled, false);
  assert.equal(h.document.querySelector('button[data-wechat-check]').disabled, true);
  await h.context.saveWechatLoginQr();
  await h.context.selectWechatLoginMode('link');
  await h.context.shareWechatLoginLink();
  assert.deepEqual([h.calls.save, h.calls.share], [1, 1]);
  assert.equal(h.context.cancelWechatLogin(), true);
  h.control.pollFail = true;
  h.control.gate.resolve();
  await checking;
  assert.equal(h.context.uiState().checking, false);
  assert.equal(h.context.uiState().link, '');
  assert.equal(h.document.getElementById('wechat-login-message').textContent, '');
  assert.equal(h.calls.toasts.some(message => /network timeout/.test(message)), false);
});

test('bridge initialization failure uses copy fallback and leaves the UI usable', async () => {
  const h = uiHarness({ nativeProxy: true });
  await h.context.startWechatLogin('link');
  h.control.bridgeUnavailable = true;
  await h.context.shareWechatLoginLink();
  assert.equal(h.calls.copy, 1);
  assert.equal(h.context.uiState().busy, false);
  assert.equal(h.document.querySelector('button[onclick="cancelWechatLogin()"]')?.disabled, false);
});
