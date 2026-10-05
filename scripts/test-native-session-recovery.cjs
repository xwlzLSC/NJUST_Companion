const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, defer } = require('./fixtures/native-harness.cjs');
const businessBase = 'https://bkjw.njust.edu.cn/njlgdx/';
const cached = { schedule: [{ name: '离线课程' }], grades: [], certs: [], exams: [], meta: { semester: '2026-2027-1' } };
const passwordState = { loggedIn: true, username: 'test-account', accountKey: 'test-account', profile: 'academic-cas',
  businessBase, rememberPassword: true, credentialsSaved: true, autoLoginEnabled: true };
const wechatState = { loggedIn: true, username: '微信授权用户', accountKey: 'wechat:mock-owner',
  profile: 'academic-cas-wechat', businessBase, wechatLoginSelected: true };
const snapshot = (state, cookies, savedAt = Date.now()) => new Map([['snapshot', {
  owner: state.accountKey, savedAt, cookies
}]]);
const casCookies = ['https://ids.njust.edu.cn', { JSESSIONID: 'fake-cas-session', TGC: 'fake-cas-tgc' }];
const academicCookies = ['https://bkjw.njust.edu.cn', { JSESSIONID: 'fake-academic-session' }];

test('first password login saves real school cookies outside WebView and restores after process kill', async () => {
  const first = harness({ control: { passwordMode: true } });
  await first.api.loginAndSync({ username: 'test-account', password: 'test-password', rememberPassword: true });
  assert.equal(first.control.capacitorCookieReads, 0);
  assert.equal(first.storage.has('njust-native-sync-cookies'), false);
  assert.equal(first.sessionStore.get('snapshot').owner, 'test-account');
  assert.equal(JSON.parse(first.storage.get('njust-native-sync-state')).password, '');
  const next = harness({ storage: first.storage, sessionStore: first.sessionStore, credentials: first.credentials(),
    clock: first.now(), control: { ready: true, passwordMode: true } });
  assert.equal(next.runtime.size, 0);
  const result = await next.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, true);
  assert.equal(next.control.cookieRestoreCount, 1);
  assert.equal(next.control.postCount, 0);
  assert.equal(result.status.accountKey, 'test-account');
  assert.equal(result.status.lastSyncAt, first.internal.getState().lastSyncAt);
});

test('password login does not publish success before credentials and session are committed', async () => {
  const gate = defer();
  const h = harness({ control: { passwordMode: true, persistGate: gate } });
  const login = h.api.loginAndSync({ username: 'test-account', password: 'test-password', rememberPassword: true });
  for (let i = 0; i < 30 && !h.control.cookieSaveCount; i++) await new Promise(done => setImmediate(done));
  assert.equal(h.control.cookieSaveCount, 1);
  assert.equal(h.events.some(event => event.loggedIn), false);
  assert.equal(JSON.parse(h.storage.get('njust-native-sync-state')).loggedIn, false);
  gate.resolve();
  assert.equal((await login).status.loggedIn, true);
  assert.equal(h.sessionStore.get('snapshot').owner, 'test-account');
});

test('WeChat login does not publish success until its identity-bound session snapshot is committed', async () => {
  const h = harness({ control: { qrStatus: '1' } });
  const attempt = await h.api.beginWechatLogin();
  h.control.persistGate = defer();
  h.control.persistGateOnOwner = `wechat:${attempt.uuid}`;
  h.events.length = 0;
  const login = h.api.pollWechatLogin();
  await new Promise(done => setImmediate(done));
  assert.equal(h.events.some(event => event.loggedIn), false);
  assert.equal(JSON.parse(h.storage.get('njust-native-sync-state')).loggedIn, false);
  h.control.persistGate.resolve();
  assert.equal((await login).status.loggedIn, true);
  assert.equal(h.sessionStore.get('snapshot').owner, `wechat:${attempt.uuid}`);
});

test('a valid WeChat academic session restores after restart without loading any password', async () => {
  const h = harness({ state: wechatState, data: cached, sessionStore: snapshot(wechatState, [casCookies, academicCookies]),
    credentials: { username: 'other-old-account', password: 'must-not-be-used' }, control: { ready: true } });
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, true);
  assert.equal(result.status.loginMethod, 'wechat');
  assert.equal(result.status.accountKey, wechatState.accountKey);
  assert.equal(result.data.schedule[0].name, '离线课程');
  assert.equal(h.control.secureLoadCount, 0);
  assert.equal(h.control.postCount + h.control.tokenCount, 0);
});

for (const state of [passwordState, wechatState]) test(`${state.profile}: expired academic session renews via valid CAS SSO without parsing a password form`, async () => {
  const h = harness({ state, data: cached, sessionStore: snapshot(state, [casCookies, academicCookies]),
    credentials: { username: 'test-account', password: 'test-password' }, control: { ssoReady: true, ready: false } });
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, true);
  assert.equal(result.status.connectionUncertain, false);
  assert.equal(result.status.lastError, '');
  assert.equal(result.status.accountKey, state.accountKey);
  assert.equal(h.control.postCount + h.control.tokenCount, 0);
  assert.ok(h.control.cookieReadUrls.includes('https://ids.njust.edu.cn/authserver/'));
  assert.ok(h.requests.some(request => request.url.endsWith('indexsso.jsp')));
});

test('password auto recovery accepts an already-authenticated SSO landing page for its known owner only', async () => {
  const h = harness({ state: passwordState, credentials: { username: 'test-account', password: 'test-password' } });
  h.control.onRequest = async request => {
    if (request.url.endsWith('indexsso.jsp')) {
      h.control.ready = true;
      h.runtime.set(academicCookies[0], academicCookies[1]);
      return h.textResponse('<title>学生个人中心</title>');
    }
  };
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, true);
  assert.equal(result.status.accountKey, 'test-account');
  assert.equal(h.control.postCount, 0);
  assert.equal(result.status.lastError, '');
});

test('expired WeChat CAS needs fresh user confirmation, never submits an old password or loses offline data', async () => {
  const h = harness({ state: wechatState, data: cached, sessionStore: snapshot(wechatState, [casCookies, academicCookies]),
    credentials: { username: 'old-account', password: 'must-not-be-used' }, control: { ready: false, ssoReady: false } });
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, false);
  assert.match(result.status.lastError, /微信授权会话已到期/);
  assert.equal(result.status.connectionUncertain, false);
  assert.equal(result.data.schedule[0].name, '离线课程');
  assert.equal(h.control.secureLoadCount + h.control.postCount + h.control.tokenCount, 0);
  assert.equal(h.sessionStore.size, 0);
});

test('expired password SSO can fall back to the Keystore password once after restart', async () => {
  const h = harness({ state: passwordState, data: cached, sessionStore: snapshot(passwordState, [casCookies, academicCookies]),
    credentials: { username: 'test-account', password: 'test-password' }, control: { ready: false, ssoReady: false, passwordMode: true } });
  const [a, b] = await Promise.all([h.api.getStatus({ check: true }), h.api.getStatus({ check: true })]);
  assert.equal(a.status.loggedIn, true);
  assert.equal(b.status.loggedIn, true);
  assert.equal(h.control.postCount, 1);
  assert.equal(a.status.accountKey, 'test-account');
});

test('network timeout while renewing SSO preserves data and does not retry the password blindly', async () => {
  const h = harness({ state: passwordState, data: cached, sessionStore: snapshot(passwordState, [casCookies]),
    credentials: { username: 'test-account', password: 'test-password' } });
  h.control.onRequest = async request => { if (request.url.endsWith('indexsso.jsp')) throw new Error('network timeout'); };
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.connectionUncertain, true);
  assert.match(result.status.lastError, /会话恢复待确认/);
  assert.equal(result.data.schedule[0].name, '离线课程');
  assert.equal(h.control.postCount, 0);
  assert.equal(result.status.recovering, false);
});

test('changing the saved username cannot restore and relabel another account SSO', async () => {
  const h = harness({ state: passwordState, data: cached, sessionStore: snapshot(passwordState, [casCookies, academicCookies]),
    credentials: { username: 'test-account', password: 'test-password' }, control: { ssoReady: true, ready: true, passwordMode: true } });
  await h.api.saveLoginPreference({ username: 'new-account', password: 'new-password', rememberPassword: true });
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, true);
  assert.equal(result.status.accountKey, 'new-account');
  assert.equal(result.status.username, 'new-account');
  assert.equal(h.control.cookieRestoreCount, 0);
  assert.equal(h.control.postCount, 1);
  const post = h.requests.find(request => request.method === 'POST');
  assert.equal(new URLSearchParams(post.data).get('username'), 'new-account');
});

test('manual new-account login never accepts an unrelated authenticated page', async () => {
  const h = harness({ state: passwordState, control: { ready: true } });
  h.control.onRequest = async request => request.url.endsWith('indexsso.jsp') ? h.textResponse('<title>学生个人中心</title>') : null;
  await assert.rejects(h.api.loginAndSync({ username: 'new-account', password: 'password' }), /无法确认其账号/);
  assert.notEqual(h.internal.getState().accountKey, 'new-account');
  assert.equal(h.internal.getState().loggedIn, false);
});

test('encrypted snapshot is bound to its owner and cannot restore a different WeChat identity', async () => {
  const other = { ...wechatState, accountKey: 'wechat:another-owner' };
  const h = harness({ state: other, data: cached, sessionStore: snapshot(wechatState, [casCookies, academicCookies]),
    control: { ready: true } });
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, false);
  assert.equal(result.data.schedule[0].name, '离线课程');
  assert.equal(h.runtime.size, 0);
  assert.equal(h.requests.length, 0);
});

test('secure session storage failure warns about restart but does not deny verified school login', async () => {
  const h = harness({ control: { passwordMode: true, persistError: true } });
  const result = await h.api.loginAndSync({ username: 'test-account', password: 'password', rememberPassword: true });
  assert.equal(result.status.loggedIn, true);
  assert.match(result.status.sessionSaveWarning, /安全保存失败/);
  assert.equal(h.storage.has('njust-native-sync-cookies'), false);
});

test('a lost session without remembered password is not falsely displayed as still logged in', async () => {
  const h = harness({ state: { ...passwordState, rememberPassword: false, credentialsSaved: false, autoLoginEnabled: false }, data: cached });
  const result = await h.api.getStatus({ check: true });
  assert.equal(result.status.loggedIn, false);
  assert.equal(result.data.schedule[0].name, '离线课程');
  assert.match(result.status.lastError, /重新登录/);
  assert.equal(h.requests.length, 0);
});

test('native bridge is school-scoped, encrypted and uses normal WeChat launcher instead of ACTION_SEND', () => {
  const root = path.join(__dirname, '../android/app/src/main/java/com/njust/companion');
  const session = fs.readFileSync(path.join(root, 'SchoolSessionPlugin.java'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'WechatBridgePlugin.java'), 'utf8');
  assert.match(session, /CookieManager\.getInstance\(\)\.getCookie\(url\)/);
  assert.match(session, /AES\/GCM\/NoPadding/);
  assert.match(session, /AndroidKeyStore/);
  assert.match(session, /owner\.equals\(snapshot\.getString\("owner"\)\)/);
  assert.match(session, /path\.substring\(0, path\.length\(\) - 1\)/);
  assert.match(session, /recordCookieHeaders\(uri, headers\)/);
  assert.match(session, /cookie\.getDomain\(\)/);
  assert.match(session, /entry\.put\("expiresAt"/);
  assert.match(bridge, /clipboard\.setPrimaryClip\(clip\)/);
  assert.match(bridge, /getLaunchIntentForPackage\("com.tencent.mm"\)/);
  assert.doesNotMatch(bridge, /new Intent\(Intent\.ACTION_SEND\)/);
});
