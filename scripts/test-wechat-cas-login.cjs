const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, defer, form, pageUrl, service } = require('./fixtures/native-harness.cjs');

test('QR form preserves school HTTP service and rejects other hosts, paths, ports and credentials', () => {
  const h = harness();
  assert.equal(new URL(h.internal.parseCasQrForm(form, pageUrl).actionUrl).searchParams.get('service'), service);
  for (const invalid of ['https://evil.example/', 'https://bkjw.njust.edu.cn/not-sso',
    'https://bkjw.njust.edu.cn:444/njlgdx/indexsso.jsp', 'https://user@bkjw.njust.edu.cn/njlgdx/indexsso.jsp']) {
    assert.throws(() => h.internal.parseCasQrForm(form, 'https://ids.njust.edu.cn/authserver/login?service=' + encodeURIComponent(invalid)), /目标地址异常/);
  }
  assert.throws(() => h.internal.parseCasQrForm(form.replace('/authserver/login', 'https://evil.example/login'), pageUrl), /目标地址异常/);
});

test('link and QR modes share one token, one cookie jar and cached school image', async () => {
  const h = harness();
  const [link, duplicate] = await Promise.all([h.api.beginWechatLogin(), h.api.beginWechatLogin()]);
  assert.equal(link.uuid, duplicate.uuid);
  assert.equal(link.imageDataUrl, '');
  const qr = await h.api.beginWechatLogin({ includeImage: true });
  assert.equal(qr.url, link.url);
  assert.match(qr.imageDataUrl, /^data:image\/png;base64,/);
  await h.api.getWechatQrImage();
  assert.equal(h.control.tokenCount, 1);
  assert.equal(h.control.imageCount, 1);
  assert.equal(h.control.clearCount, 1);
  assert.equal(h.storage.has('njust-native-sync-cookies'), false);
  assert.equal(h.sessionStore.get('snapshot').owner, `pending:${link.uuid}`);
  assert.equal(h.control.capacitorCookieReads, 0);
  assert.match(h.requests[0].headers['User-Agent'], /Windows NT/);
});

test('image failure leaves a usable link without regenerating the challenge', async () => {
  const h = harness({ control: { badImage: true } });
  const result = await h.api.beginWechatLogin({ includeImage: true });
  assert.match(result.warning, /图片加载失败/);
  assert.equal(h.api.getPendingWechatLogin().url, result.url);
  assert.equal(h.control.tokenCount, 1);
});

test('concurrent return/manual checks submit the authorization once and synchronize once', async () => {
  const h = harness({ control: { qrStatus: '1' } });
  await h.api.beginWechatLogin({ includeImage: true });
  const [a, b] = await Promise.all([h.api.pollWechatLogin(), h.api.pollWechatLogin()]);
  assert.equal(a.state, 'authorized');
  assert.equal(b.state, 'authorized');
  assert.equal(h.control.postCount, 1);
  assert.equal(h.requests.filter(r => r.url.includes('xskb_list')).length, 1);
  assert.equal(a.status.loginMethod, 'wechat');
  assert.match(a.status.accountKey, /^wechat:/);
  assert.equal(h.control.secureClearCount, 1);
  assert.equal(h.api.getPendingWechatLogin(), null);
});

test('uncertain POST survives WebView recreation and restores cookies without replay', async () => {
  const h = harness({ control: { qrStatus: '1', timeoutPost: true } });
  await h.api.beginWechatLogin();
  h.control.onRequest = async r => r.url.endsWith('main.jsp') ? h.textResponse('', 503) : null;
  assert.equal((await h.api.pollWechatLogin()).state, 'establishing');
  assert.equal(h.control.postCount, 1);
  assert.equal(JSON.parse(h.storage.get('njust-native-wechat-attempt')).submitted, true);
  const restarted = harness({ storage: h.storage, sessionStore: h.sessionStore, clock: h.now(), control: { qrStatus: '1', ready: true } });
  const result = await restarted.api.pollWechatLogin();
  assert.equal(result.state, 'authorized');
  assert.equal(restarted.control.postCount, 0);
  assert.ok(restarted.runtime.get('https://ids.njust.edu.cn').JSESSIONID);
});

test('expired unsubmitted token never posts; submitted token gets verification-only grace', async () => {
  const h = harness();
  await h.api.beginWechatLogin();
  h.advance(180001);
  await assert.rejects(h.api.pollWechatLogin(), /过期/);
  assert.equal(h.control.postCount, 0);
  const grace = harness({ control: { qrStatus: '1', timeoutPost: true } });
  await grace.api.beginWechatLogin();
  grace.control.onRequest = async r => r.url.endsWith('main.jsp') ? grace.textResponse('', 503) : null;
  await grace.api.pollWechatLogin();
  grace.advance(181000);
  assert.equal(grace.api.getPendingWechatLogin().submitted, true);
  grace.advance(45000);
  assert.equal(grace.api.getPendingWechatLogin(), null);
  await assert.rejects(grace.api.pollWechatLogin(), /过期/);
  assert.equal(grace.control.postCount, 1);
});

test('cancelled in-flight status cannot submit or clear a newer cookie jar', async () => {
  const h = harness({ control: { qrStatus: '1' } });
  await h.api.beginWechatLogin();
  const gate = defer();
  h.control.onRequest = async r => { if (r.url.includes('getStatus.htl')) await gate.promise; };
  const old = h.api.pollWechatLogin();
  await new Promise(done => setImmediate(done));
  h.api.cancelWechatLogin();
  await assert.rejects(h.api.beginWechatLogin(), /正在处理会话/);
  gate.resolve();
  await assert.rejects(old, /已取消/);
  assert.equal(h.control.postCount, 0);
  const fresh = await h.api.beginWechatLogin();
  assert.equal(h.api.getPendingWechatLogin().uuid, fresh.uuid);
});

test('choosing WeChat never silently reloads or logs in with an old remembered password', async () => {
  const h = harness({ state: { username: 'old-account', rememberPassword: true, credentialsSaved: true },
    credentials: { username: 'old-account', password: 'test-only-old-password' } });
  await h.api.beginWechatLogin();
  h.api.cancelWechatLogin();
  await h.api.getStatus();
  assert.equal(h.control.secureLoadCount, 0);
  assert.equal(h.control.postCount, 0);
  assert.equal((await h.api.getStatus()).status.rememberPassword, false);
});

test('tampered persisted CAS action is discarded before any HTTP request', async () => {
  const h = harness();
  await h.api.beginWechatLogin();
  const value = JSON.parse(h.storage.get('njust-native-wechat-attempt'));
  value.actionUrl = 'https://evil.example/steal';
  h.storage.set('njust-native-wechat-attempt', JSON.stringify(value));
  const restarted = harness({ storage: h.storage, clock: h.now() });
  assert.equal(restarted.api.getPendingWechatLogin(), null);
  await assert.rejects(restarted.api.pollWechatLogin(), /过期/);
  assert.equal(restarted.requests.length, 0);
});
