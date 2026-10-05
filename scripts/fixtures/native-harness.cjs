// In-memory native HTTP/cookie/Keystore simulation. Never connects to school.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../../js/native-sync.js'), 'utf8');
const service = 'http://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';
const pageUrl = 'https://ids.njust.edu.cn/authserver/login?service=' + encodeURIComponent(service);
const form = '<form id="qrLoginForm" action="/authserver/login"><input name="execution" value="test-execution"><input name="lt" value="test-lt"></form>';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLp0AAAAASUVORK5CYII=';
const defer = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function harness(options = {}) {
  const storage = options.storage || new Map();
  const runtime = options.runtime || new Map();
  const sessionStore = options.sessionStore || new Map();
  if (options.state) storage.set('njust-native-sync-state', JSON.stringify(options.state));
  if (options.data) storage.set('njust-native-sync-data', JSON.stringify(options.data));
  let clock = options.clock || Date.now();
  const control = { qrStatus: '0', ready: false, timeoutPost: false, rejectPost: false, badImage: false,
    postCount: 0, tokenCount: 0, imageCount: 0, clearCount: 0, secureLoadCount: 0, secureClearCount: 0,
    onRequest: null, ssoReady: false, cookieSaveCount: 0, cookieRestoreCount: 0, capacitorCookieReads: 0,
    cookieReadUrls: [], ...options.control };
  const requests = [];
  const events = [];
  let credentials = options.credentials || {};
  const dom = new JSDOM('', { url: 'https://localhost/' });
  const textResponse = (text, status = 200, headers = {}) => ({ status, headers: { 'content-type': 'text/html;charset=UTF-8', ...headers }, data: Buffer.from(text).toString('base64') });
  const Plugins = {
    SecureCredentials: {
      load: async () => { control.secureLoadCount++; return credentials; },
      clear: async () => { control.secureClearCount++; credentials = {}; }, save: async value => { credentials = value; }
    }
  };
  const Cookies = {
    clearAllCookies: async () => { control.clearCount++; runtime.clear(); sessionStore.clear(); },
    getCookies: async ({ url }) => { control.cookieReadUrls.push(url); return runtime.get(new URL(url).origin) || {}; },
    saveSession: async ({ owner }) => {
      control.cookieSaveCount++;
      if (control.persistGate && (!control.persistGateOnOwner || owner === control.persistGateOnOwner)) await control.persistGate.promise;
      if (control.persistError) throw new Error('mock secure storage failure');
      if (!runtime.size) return { saved: false };
      sessionStore.set('snapshot', { owner, savedAt: clock, cookies: JSON.parse(JSON.stringify([...runtime])) });
      return { saved: true };
    },
    restoreSession: async ({ owner }) => {
      control.cookieRestoreCount++;
      const saved = sessionStore.get('snapshot');
      if (!saved || saved.owner !== owner || clock - saved.savedAt > 30 * 86400000 || clock < saved.savedAt) return { restored: false };
      for (const [url, values] of saved.cookies) runtime.set(url, { ...values });
      return { restored: true };
    },
    clearSession: async () => { sessionStore.clear(); }
  };
  Plugins.SchoolSession = Cookies;
  const Http = { request: async request => {
    requests.push(request);
    if (control.onRequest) {
      const override = await control.onRequest(request);
      if (override) return override;
    }
    const url = new URL(request.url);
    if (url.pathname.endsWith('indexsso.jsp') && !url.searchParams.has('ticket')) {
      if (control.ssoReady && runtime.get('https://ids.njust.edu.cn')?.TGC) {
        control.ready = true;
        runtime.set('https://bkjw.njust.edu.cn', { JSESSIONID: 'fake-renewed-academic-session' });
        return textResponse('<title>学生个人中心</title>');
      }
      runtime.set('https://ids.njust.edu.cn', { JSESSIONID: 'fake-cas-session' });
      return textResponse('', 302, { location: pageUrl });
    }
    if (url.origin === 'https://ids.njust.edu.cn') {
      if (url.pathname.endsWith('/bfp/info')) return textResponse('');
      if (url.pathname.endsWith('/checkNeedCaptcha.htl')) return textResponse('{"isNeed":false}');
      if (url.pathname.endsWith('/getToken')) {
        control.tokenCount++;
        return textResponse('mock-school-token-' + String(control.tokenCount).padStart(4, '0'));
      }
      if (url.pathname.endsWith('/getCode')) {
        control.imageCount++;
        return control.badImage ? textResponse('<html>unavailable</html>')
          : { status: 200, headers: { 'content-type': 'image/png' }, data: png };
      }
      if (url.pathname.endsWith('/getStatus.htl')) return textResponse(control.qrStatus);
      if (request.method === 'POST') {
        control.postCount++;
        if (control.rejectPost) return textResponse('<form id="pwdFromId">授权已失效</form>');
        control.ready = true;
        control.ssoReady = true;
        runtime.set('https://ids.njust.edu.cn', { JSESSIONID: 'fake-cas-session', TGC: 'fake-cas-ticket-granting-cookie' });
        runtime.set('https://bkjw.njust.edu.cn', { JSESSIONID: 'fake-academic-session' });
        if (control.timeoutPost) throw new Error('timeout after token consumption');
        return textResponse('', 302, { location: service + '?ticket=mock-ticket' });
      }
      return textResponse(form + (control.passwordMode ? '<form id="pwdFromId" action="/authserver/login"><input name="username"><input name="userPassword"><input name="password"><input name="execution" value="test-password-execution"><input id="pwdEncryptSalt" value="1234567890abcdef"></form>' : ''));
    }
    if (url.pathname.endsWith('main.jsp') || url.searchParams.has('ticket')) {
      return textResponse(control.ready ? '<title>学生个人中心</title>' : '<form id="pwdFromId"></form>');
    }
    return textResponse('<table id="dataList"><tr><th>无安排</th></tr></table>');
  } };
  class MockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const context = vm.createContext({ URL, URLSearchParams, Date: MockDate, TextEncoder, TextDecoder, Uint8Array,
    console, setTimeout, clearTimeout, crypto: webcrypto, DOMParser: dom.window.DOMParser, CustomEvent: dom.window.CustomEvent,
    atob: value => Buffer.from(value, 'base64').toString('binary'), btoa: value => Buffer.from(value, 'binary').toString('base64'),
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    dispatchEvent: event => events.push({ ...event.detail }),
    capacitorExports: { Capacitor: { isNativePlatform: () => true }, CapacitorHttp: Http,
      // Simulate the real SDK: getCookies ignores url and reads localhost.
      CapacitorCookies: { getCookies: async () => { control.capacitorCookieReads++; return {}; } }, registerPlugin: name => Plugins[name] },
    NJUSTParser: { parseSchedule: () => [], parseGrades: () => [], parseLevelExams: () => [], parseExams: () => [] }
  });
  context.window = context;
  // Test hooks are injected only into this VM; never included in app assets.
  vm.runInContext(source.replace('global.NJUSTNativeSync = {', `global.__test = {
    parseCasQrForm, verifySession, isAllowedCasRedirect, getState: () => nativeState,
    setSections: sections => { fetchScheduleData = sections.schedule; fetchGradesData = sections.grades;
      fetchCertsData = sections.certs; fetchExamsData = sections.exams; }
  }; global.NJUSTNativeSync = {`), context);
  return { api: context.NJUSTNativeSync, internal: context.__test, context, storage, runtime, sessionStore, requests, events, control,
    credentials: () => ({ ...credentials }),
    advance: milliseconds => { clock += milliseconds; }, now: () => clock, textResponse };
}
module.exports = { harness, defer, form, pageUrl, service, png };
