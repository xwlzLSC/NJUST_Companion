const projectPaths = require('./fixtures/project-paths.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(projectPaths.mini("miniprogram/utils/api.js"), 'utf8');
const start = source.indexOf('async function withAutoLogin(');
const end = source.indexOf('async function callCloud(', start);
assert.ok(start >= 0 && end > start);

async function check(base, expectedRetries) {
  let taskCalls = 0;
  let loginCalls = 0;
  const context = vm.createContext({
    loadCloudSession: () => ({ businessBase: base }),
    loadLoginPrefs: () => ({ rememberPassword: true, username: 'student', password: 'saved' }),
    loadSyncPrefs: () => ({ cloudAuthType: 'portal' }),
    isInteractiveLoginActive: () => false,
    callCloudFunction: async (_name, action) => {
      assert.equal(action, 'portalLoginOnly');
      loginCalls += 1;
      return { ok: true };
    },
    getErrorMessage: error => error.message,
    CLOUD_FUNCTION_NAME: 'njustSync2',
    AUTO_LOGIN_FAILURE_COOLDOWN_MS: 60000,
    Date
  });
  vm.runInContext('let autoLoginPromise = null; let lastAutoLoginFailureAt = 0;\n' + source.slice(start, end), context);
  const task = async () => {
    taskCalls += 1;
    if (taskCalls === 1) throw new Error('教务系统会话检查超时，教务系统响应较慢，请稍后重试');
    return { ok: true };
  };
  if (expectedRetries) {
    const result = await context.withAutoLogin(task);
    assert.equal(result.autoRecovered, true);
  } else {
    await assert.rejects(context.withAutoLogin(task), /会话检查超时/);
  }
  assert.equal(loginCalls, expectedRetries);
  assert.equal(taskCalls, expectedRetries ? 2 : 1);
}

Promise.resolve()
  .then(() => check('http://202.119.81.112:9080/njlgdx/', 1))
  .then(() => check('https://bkjw.njust.edu.cn/njlgdx/', 0))
  .then(() => console.log('PASS: stale 112 session retries CAS login; other network timeouts do not force login'))
  .catch(error => { console.error(error); process.exitCode = 1; });
