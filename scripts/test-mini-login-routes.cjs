const projectPaths = require('./fixtures/project-paths.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(projectPaths.mini("cloudfunctions/njustSync2/index.js"), 'utf8');
const profileSection = source.slice(source.indexOf('const PROFILE = {'), source.indexOf('const PORTAL = {'));
const baseSection = source.slice(source.indexOf('function resolveBusinessBase('), source.indexOf('function pickDefined('));
const checkUrlSection = source.slice(source.indexOf('function isClassicMainFrameUrl('), source.indexOf('function normalizeClassicLoginError('));
const timeoutSection = source.slice(source.indexOf('function isSchoolNetworkTimeout('), source.indexOf('function schoolRequestError('));
const loginSection = source.slice(source.indexOf('async function loginClassicWithOcr('), source.indexOf('async function verifyBusinessSession('));
let warmedUp = false;
const context = vm.createContext({
  cleanText: value => String(value || '').trim(),
  AUTH_DEADLINE_MS: 42000,
  canUseDedicatedOcr: async () => true,
  cloud: { callFunction: async options => {
    assert.equal(options.data.action, 'warmup');
    assert.ok(options.timeout > 15000);
    warmedUp = true;
    return { result: { ok: true, ready: true } };
  } },
  createSession: (_jar, _base, _user, entryOrigin) => ({ entryOrigin }),
  fetchCaptcha: async () => {
    assert.equal(warmedUp, true, 'Load OCR model before requesting a time-sensitive captcha');
    return Buffer.from('image');
  },
  solveCaptchaOCR: async () => 'abcd',
  completeClassicLogin: async session => {
    if (session.entryOrigin !== 'https://bkjw.njust.edu.cn') {
      throw new Error('教务系统会话验证超时，请稍后重试');
    }
  },
  schoolRequestError: (_stage, error) => error,
  console
});
vm.runInContext(profileSection + baseSection + checkUrlSection + timeoutSection + loginSection, context);

const official = context.classicEntryPaths('https://bkjw.njust.edu.cn');
assert.equal(official.loginPagePath, '/njlgdx/framework/main.jsp');
assert.equal(official.captchaPath, '/njlgdx/verifycode.servlet');
assert.equal(official.loginPath, '/njlgdx/xk/Verifyservlet');

const legacy = context.classicEntryPaths('http://202.119.81.113:8080');
assert.equal(legacy.loginPagePath, '/');
assert.equal(legacy.captchaPath, '/verifycode.servlet');
assert.equal(legacy.loginPath, '/Logon.do?method=logon');

assert.equal(context.isClassicMainFrameUrl('https://bkjw.njust.edu.cn/njlgdx/framework/main.jsp'), true);
assert.equal(context.isClassicMainFrameUrl('http://202.119.81.113:9080/njlgdx/framework/main.jsp'), true);
assert.equal(context.isClassicMainFrameUrl('https://example.com/njlgdx/framework/main.jsp'), false);
assert.equal(context.preferredClassicEntryOrigins('1')[0], 'https://bkjw.njust.edu.cn');
assert.equal(context.preferredClassicEntryOrigins('2')[0], 'http://202.119.81.113:8080');
assert.equal(context.isSchoolNetworkTimeout({ errMsg: 'callFunction:fail ESOCKETTIMEDOUT' }), true);
context.loginClassicWithOcr('test-user', 'test-password').then(result => {
  assert.equal(result.attempt, 2);
  assert.equal(result.session.entryOrigin, 'https://bkjw.njust.edu.cn');
  console.log('PASS: official HTTPS and legacy IP login routes; timeout fallback');
}).catch(error => { console.error(error); process.exitCode = 1; });
