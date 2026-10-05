const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, defer } = require('./fixtures/native-harness.cjs');
const businessBase = 'https://bkjw.njust.edu.cn/njlgdx/';
const cached = { schedule: [{ name: '离线课程' }], grades: [], certs: [], exams: [], meta: { semester: '2026-2027-1' } };
const confirmed = { loggedIn: true, username: '微信授权用户', accountKey: 'wechat:old-session', profile: 'academic-cas-wechat', businessBase };

test('network timeout preserves confirmed login and offline timetable', async () => {
  const h = harness({ state: confirmed, data: cached });
  h.control.onRequest = async () => { throw new Error('network timeout'); };
  assert.equal(await h.internal.verifySession(), false);
  assert.equal(h.internal.getState().loggedIn, true);
  assert.equal(h.internal.getState().connectionUncertain, true);
  assert.equal(JSON.parse(h.storage.get('njust-native-sync-data')).schedule[0].name, '离线课程');
});

test('HTTP 503 and incomplete HTML are not treated as logout or empty timetable', async () => {
  const h = harness({ state: confirmed, data: cached });
  h.control.onRequest = async () => h.textResponse('<html>maintenance</html>', 503);
  await h.internal.verifySession();
  assert.equal(h.internal.getState().loggedIn, true);
  assert.match(h.internal.getState().lastError, /HTTP 503/);
  h.control.onRequest = async () => h.textResponse('');
  await h.internal.verifySession();
  assert.equal(h.internal.getState().loggedIn, true);
  assert.equal(h.internal.getState().connectionUncertain, true);
});

test('explicit school login page invalidates session but never deletes offline data', async () => {
  const h = harness({ state: confirmed, data: cached });
  assert.equal(await h.internal.verifySession(), false);
  assert.equal(h.internal.getState().loggedIn, false);
  assert.equal(h.internal.getState().connectionUncertain, false);
  assert.equal(JSON.parse(h.storage.get('njust-native-sync-data')).schedule[0].name, '离线课程');
});

test('concurrent sync waits for the same new result rather than returning old cache', async () => {
  const h = harness({ state: confirmed, data: cached });
  const gate = defer();
  let scheduleFetches = 0;
  h.internal.setSections({
    schedule: async () => { scheduleFetches++; await gate.promise; return { items: [{ name: '新课程' }], sourceUrl: businessBase }; },
    grades: async () => ({ items: [], sourceUrl: businessBase }),
    certs: async () => ({ items: [], sourceUrl: businessBase }),
    exams: async () => ({ items: [], sourceUrl: businessBase })
  });
  const first = h.api.syncNow();
  const second = h.api.syncNow();
  await new Promise(done => setImmediate(done));
  assert.equal(scheduleFetches, 1);
  await assert.rejects(h.api.logout(), /完成后再退出/);
  gate.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.data.schedule[0].name, '新课程');
  assert.equal(b.data.schedule[0].name, '新课程');
  assert.equal(a.status.lastSyncAt, b.status.lastSyncAt);
  assert.equal(h.internal.getState().syncing, false);
});

test('failed sync preserves previous data and can be retried after promise cleanup', async () => {
  const h = harness({ state: confirmed, data: cached });
  h.control.onRequest = async r => r.url.includes('xskb_list') ? h.textResponse('maintenance', 500) : null;
  await assert.rejects(h.api.syncNow(), /HTTP 500/);
  assert.equal(h.internal.getState().syncing, false);
  assert.equal(JSON.parse(h.storage.get('njust-native-sync-data')).schedule[0].name, '离线课程');
  h.control.onRequest = null;
  await h.api.syncNow();
  assert.ok(h.internal.getState().lastSyncAt);
});

test('process restart clears persisted busy flags, not stored data or login', () => {
  const h = harness({ state: { ...confirmed, syncing: true, recovering: true }, data: cached });
  assert.equal(h.internal.getState().syncing, false);
  assert.equal(h.internal.getState().recovering, false);
  assert.equal(h.internal.getState().loggedIn, true);
});

test('concurrent session verification and status checks are single-flight', async () => {
  const h = harness({ state: confirmed, control: { ready: true } });
  h.runtime.set('https://bkjw.njust.edu.cn', { JSESSIONID: 'fake-session' });
  const [a, b] = await Promise.all([h.api.getStatus({ check: true }), h.api.getStatus({ check: true })]);
  assert.equal(a.status.loggedIn, true);
  assert.equal(b.status.loggedIn, true);
  assert.equal(h.requests.filter(r => r.url.endsWith('main.jsp')).length, 1);
});

test('new WeChat login clears old remote data only after school session is confirmed', async () => {
  const h = harness({ data: cached, control: { qrStatus: '1' } });
  await h.api.beginWechatLogin();
  assert.equal(JSON.parse(h.storage.get('njust-native-sync-data')).schedule[0].name, '离线课程');
  h.control.onRequest = async r => r.url.includes('xskb_list') ? h.textResponse('maintenance', 503) : null;
  const result = await h.api.pollWechatLogin();
  assert.equal(result.state, 'authorized');
  assert.equal(result.status.loggedIn, true);
  assert.match(result.warning, /HTTP 503/);
  assert.equal(result.status.lastSyncAt, '');
  assert.equal(result.data.schedule.length, 0);
});

test('CAS redirects never forward credentials to a foreign port or userinfo URL', () => {
  const h = harness();
  assert.equal(h.internal.isAllowedCasRedirect('https://ids.njust.edu.cn:444/authserver/login'), false);
  assert.equal(h.internal.isAllowedCasRedirect('https://user@ids.njust.edu.cn/authserver/login'), false);
  assert.equal(h.internal.isAllowedCasRedirect(businessBase), true);
});

test('remembered password recovery during sync remains supported and runs once', async () => {
  const h = harness({ state: { loggedIn: true, username: 'test-account', profile: 'academic-cas',
    rememberPassword: true, credentialsSaved: true, autoLoginEnabled: true, businessBase },
    credentials: { username: 'test-account', password: 'test-only-password' }, control: { passwordMode: true } });
  h.internal.getState().password = 'test-only-password';
  h.control.onRequest = async r => r.url.includes('xskb_list') && !h.control.ready
    ? h.textResponse('<form id="pwdFromId"></form>') : null;
  const [a, b] = await Promise.all([h.api.syncNow(), h.api.syncNow()]);
  assert.equal(a.status.loggedIn, true);
  assert.equal(b.status.loggedIn, true);
  assert.equal(h.control.postCount, 1);
  assert.ok(a.status.lastSyncAt);
  assert.equal(h.internal.getState().recovering, false);
});
