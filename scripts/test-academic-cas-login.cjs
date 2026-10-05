const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync('js/native-sync.js', 'utf8');
const profile = source.slice(source.indexOf('const PROFILE = {'), source.indexOf('function createEmptyData('));
const login = source.slice(source.indexOf('function parseCasLoginForm('), source.indexOf('async function smartLogin('));
const html = `<form id="pwdFromId" action="/authserver/login">
  <input name="username"><input name="passwordText"><input name="password">
  <input name="_eventId" value="submit"><input name="cllt" value="userNameLogin">
  <input name="dllt" value="generalLogin"><input name="execution" value="e3s3">
  <input id="pwdEncryptSalt" value="1234567890abcdef"></form>
  <script>var service = 'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';</script>`;
const mobileHtml = `<form id="pwdFromId" action="/authserver/login">
  <input name="username"><input name="userPassword"><input name="password">
  <input name="_eventId" value="submit"><input name="cllt" value="userNameLogin">
  <input name="dllt" value="generalLogin"><input name="execution" value="e3s4">
  <input id="pwdEncryptSalt" value="1234567890abcdef"></form>`;
let servedLoginHtml = html;
const requests = [];
const state = { loggedIn: false, username: '', lastError: '', businessBase: '' };
const context = vm.createContext({
  URL, URLSearchParams, TextEncoder, Uint8Array, Array, String,
  global: { crypto: crypto.webcrypto, btoa },
  nativeState: state,
  CAS_DESKTOP_USER_AGENT: 'test-desktop-agent',
  pendingCasLogin: null,
  createDocument: text => new JSDOM(text).window.document,
  buildUrl: (base, path) => new URL(path, base).toString(),
  fetchCasText: async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith('indexsso.jsp') && options.method !== 'POST') return { html: servedLoginHtml, response: { url: 'https://ids.njust.edu.cn/authserver/login' }, url: 'https://ids.njust.edu.cn/authserver/login' };
    if (url.includes('/authserver/bfp/info')) return { html: '', response: {} };
    if (url.includes('/authserver/checkNeedCaptcha.htl')) return { html: '{"isNeed":false}', response: {} };
    if (options.method === 'POST') return { html: '<title>学生个人中心</title>', response: { url: 'https://bkjw.njust.edu.cn/njlgdx/framework/main.jsp' }, url: 'https://bkjw.njust.edu.cn/njlgdx/framework/main.jsp' };
    throw new Error('unexpected URL ' + url);
  },
  fetchText: async (url, options = {}) => context.fetchCasText(url, options),
  verifySession: async () => true,
  saveSecureCredentials: async () => {},
  clearSecureCredentials: async () => {},
  saveState: () => {},
  snapshotCookies: async () => {},
  clearCookieSnapshot: () => {},
  requirePlugins: () => ({ Cookies: { clearAllCookies: async () => {} } }),
  isUnauthenticatedPage: () => false
});
vm.runInContext(profile + login, context);

(async () => {
  await context.loginThroughCas('test-account', 'test-password', true);
  assert.equal(requests.length, 4);
  assert.ok(requests[0].url.endsWith('/njlgdx/indexsso.jsp'));
  assert.ok(requests[1].url.includes('/authserver/bfp/info?bfp='));
  assert.ok(requests[2].url.includes('/authserver/checkNeedCaptcha.htl?username='));
  const post = requests[3];
  assert.equal(new URL(post.url).searchParams.get('service'), 'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp');
  assert.equal(post.options.method, 'POST');
  assert.equal(new URLSearchParams(post.options.data).has('passwordText'), false);
  assert.notEqual(new URLSearchParams(post.options.data).get('password'), 'test-password');
  assert.equal(state.loggedIn, true);
  assert.equal(state.businessBase, 'https://bkjw.njust.edu.cn/njlgdx/');
  console.log('PASS: academic SSO redirect, fingerprint, challenge check, encrypted login');

  servedLoginHtml = mobileHtml;
  requests.length = 0;
  state.loggedIn = false;
  await context.loginThroughCas('mobile-account', 'mobile-password', false);
  const mobilePost = requests.at(-1);
  assert.equal(mobilePost.options.method, 'POST');
  assert.equal(new URLSearchParams(mobilePost.options.data).has('userPassword'), false);
  assert.notEqual(new URLSearchParams(mobilePost.options.data).get('password'), 'mobile-password');
  assert.equal(state.loggedIn, true);
  console.log('PASS: Android mobile CAS form uses userPassword without sending plaintext');

  const errorHtml = mobileHtml + '<div id="formErrorTip">验证码错误，请重新输入</div>';
  assert.equal(context.casLoginError(errorHtml), '验证码错误，请重新输入');
  const originalFetchText = context.fetchText;
  context.fetchText = async (url, options) => url.includes('checkNeedCaptcha')
    ? { html: '{"isNeed":true}' } : originalFetchText(url, options);
  requests.length = 0;
  await assert.rejects(context.loginThroughCas('mobile-account', 'mobile-password', false), /学校要求验证码/);
  assert.equal(requests.some(request => request.options.method === 'POST'), false);
  await context.loginThroughCas('mobile-account', 'mobile-password', false, 'aB2c');
  assert.equal(new URLSearchParams(requests.at(-1).options.data).get('captcha'), 'aB2c');
  assert.equal(context.pendingCasLogin, null);
  await assert.rejects(context.loginThroughCas('other-account', 'password', false, 'aB2c'), /会话已过期或账号已改变/);
  console.log('PASS: CAS captcha stays bound to its original form and account');

  const decodeContext = vm.createContext({ global: { atob }, TextDecoder, Uint8Array });
  vm.runInContext(source.slice(source.indexOf('function normalizeBase64('), source.indexOf('async function requestRaw(')), decodeContext);
  assert.equal(decodeContext.responseText({ headers: { 'Content-Type': 'application/json' }, data: { isNeed: false } }), '{"isNeed":false}');
  assert.equal(decodeContext.responseText({ headers: { 'Content-Type': 'application/json' }, data: 1 }), '1');
  assert.equal(decodeContext.responseText({ headers: {}, status: 401, data: 'Unauthorized' }), 'Unauthorized');
  assert.equal(decodeContext.responseText({ headers: {}, status: 200, data: Buffer.from(html).toString('base64') }), html);
  console.log('PASS: real Capacitor JSON, HTTP error and base64 response formats');

  const redirectRequests = [];
  const redirectContext = vm.createContext({
    URL, PROFILE: { casOrigin: 'https://ids.njust.edu.cn' },
    getHeader: (headers, key) => headers[key] || headers[key.toLowerCase()] || '',
    responseText: response => response.data || '',
    requestRaw: async (url, options) => {
      redirectRequests.push({ url, options });
      if (new URL(url).hostname === 'bkjw.njust.edu.cn' && new URL(url).pathname.endsWith('indexsso.jsp')) return { status: 302, headers: { location: 'https://ids.njust.edu.cn/authserver/login?service=https%3A%2F%2Fbkjw.njust.edu.cn%2Fnjlgdx%2Findexsso.jsp' }, data: '' };
      if (url.includes('/authserver/login') && options.method === 'GET') return { status: 200, headers: {}, data: html };
      if (url.includes('/authserver/login') && options.method === 'POST') return { status: 302, headers: { location: 'http://bkjw.njust.edu.cn/njlgdx/framework/main.jsp?ticket=stub' }, data: '' };
      if (new URL(url).pathname.endsWith('/framework/main.jsp')) return { status: 200, headers: {}, data: '<title>学生个人中心</title>' };
      throw new Error('unexpected redirect target ' + url);
    }
  });
  const redirectSource = source.slice(source.indexOf('function isAllowedCasRedirect('), source.indexOf('async function postForm('));
  vm.runInContext(redirectSource, redirectContext);
  const entry = await redirectContext.fetchCasText('https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp');
  assert.ok(entry.html.includes('passwordText'));
  const submitted = await redirectContext.fetchCasText('https://ids.njust.edu.cn/authserver/login', { method: 'POST', data: 'password=encrypted' });
  assert.ok(submitted.html.includes('学生个人中心'));
  assert.ok(redirectRequests.every(request => request.options.disableRedirects === true));
  assert.equal(redirectRequests[3].options.method, 'GET');
  assert.equal(redirectRequests[3].options.data, undefined);
  console.log('PASS: Android follows cross-origin CAS redirects without forwarding the password');
})().catch(error => { console.error(error); process.exitCode = 1; });
