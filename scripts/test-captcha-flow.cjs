const projectPaths = require('./fixtures/project-paths.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const miniRoot = process.env.NJUST_MINI_ROOT || projectPaths.mini("");
const cloudSource = fs.readFileSync(path.join(miniRoot, 'cloudfunctions/njustSync2/index.js'), 'utf8');

async function checkTickets() {
  const records = new Map();
  const db = { collection: () => ({
    doc: id => ({
      get: async () => ({ data: structuredClone(records.get(id)) }),
      set: async ({ data }) => { records.set(id, structuredClone(data)); }
    }),
    where: query => ({ update: async ({ data }) => {
      const entry = records.get(query._id);
      if (!entry || entry.ticket !== query.ticket || entry.used !== query.used) return { stats: { updated: 0 } };
      records.set(query._id, { ...entry, ...data });
      return { stats: { updated: 1 } };
    } })
  }) };
  const ctx = vm.createContext({
    db, Buffer, Date, crypto: require('node:crypto'), SESSION_COLLECTION: 'sessions', CAPTCHA_TTL_MS: 180000,
    cleanText: value => String(value || '').trim(), getSessionDocId: () => 'test-user',
    preferredClassicEntryOrigins: () => ['https://example.test'],
    ensureSessionCollection: async () => {}, createSession: () => ({ entryOrigin: 'https://example.test' }),
    fetchCaptcha: async () => Buffer.from([255, 216, 255]), serializeSession: async () => ({ cookies: ['test'] })
  });
  vm.runInContext(cloudSource.slice(cloudSource.indexOf('async function actionPrepareLogin('), cloudSource.indexOf('async function actionLoginAndSync(')), ctx);
  const first = await ctx.actionPrepareLogin({ username: 'student' });
  assert.equal(first.mimeType, 'image/jpeg');
  await assert.rejects(ctx.consumePendingCaptcha(first.ticket, 'other'), /账号|验证码/);
  const fresh = await ctx.actionPrepareLogin({ username: 'student' });
  await assert.rejects(ctx.consumePendingCaptcha(first.ticket, 'student'), /验证码/);
  // Simulate a concurrent active-session update; the manual challenge survives.
  records.set('test-user', { active: { loggedIn: true }, pending: null });
  const claims = await Promise.allSettled([
    ctx.consumePendingCaptcha(fresh.ticket, 'student'), ctx.consumePendingCaptcha(fresh.ticket, 'student')
  ]);
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(records.get('captcha-test-user').jar, null);
  const expired = await ctx.actionPrepareLogin({ username: 'student' });
  records.get('captcha-test-user').createdAt = new Date(Date.now() - 180001).toISOString();
  await assert.rejects(ctx.consumePendingCaptcha(expired.ticket, 'student'), /过期/);
}

function checkCasOnlyUi() {
  const page = fs.readFileSync(path.join(miniRoot, 'miniprogram/pages/profile/index.wxml'), 'utf8');
  const client = fs.readFileSync(path.join(miniRoot, 'miniprogram/pages/profile/index.js'), 'utf8');
  assert.doesNotMatch(page, /旧教务验证码入口|bindtap="submitLogin"/);
  assert.match(client, /portalLoginOnly\(/);
}
async function checkNativeCookieProtection() {
  const source = fs.readFileSync(path.join(__dirname, '../js/native-sync.js'), 'utf8');
  let touched = 0;
  const context = vm.createContext({ Date, loginInFlight: null, captchaFetchPromise: null, casCaptchaPromise: null,
    recoveryPromise: null, pendingCasLogin: null, statusPromise: null, statusChecksSession: false,
    hasPendingWechatAttempt: () => false,
    manualCaptchaUntil: Date.now() + 180000,
    loadSecureCredentials: async () => { touched++; }, requirePlugins: () => { touched++; },
    loadData: () => ({}), buildStatus: () => ({ loggedIn: false })
  });
  for (const [start, end] of [
    ['  async function restoreCookiesFromSnapshot()', '  async function hasRuntimeCookies('],
    ['  async function tryRecoverSession()', '  function canRecoverWithPassword('],
    ['  async function getStatus(', '  async function saveSemesterStart(']
  ]) vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  assert.equal(await context.restoreCookiesFromSnapshot(), false);
  assert.equal(await context.tryRecoverSession(), false);
  assert.equal((await context.getStatus()).ok, true);
  assert.equal(touched, 0);
}

const timeout = setTimeout(() => { console.error('FAIL: captcha flow test did not settle'); process.exit(1); }, 5000);
(async () => {
  await checkTickets(); checkCasOnlyUi(); await checkNativeCookieProtection();
  console.log('PASS: legacy ticket isolation, CAS-only mini login UI, native recovery protection');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(timeout));
