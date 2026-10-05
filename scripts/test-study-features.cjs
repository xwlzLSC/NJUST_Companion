const projectPaths = require('./fixtures/project-paths.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../js/schedule-insights');
const course = overrides => ({ name: '科技论文写作', code: '04068801', sequence: '4', teacher: '测试教师', room: 'IV-C105',
  weekday: 1, periods: [4, 5], startWeek: 4, endWeek: 5, weekText: '4-5,8-12(周)', ...overrides });
const complete = [course(), course({ startWeek: 8, endWeek: 12 })];
const exam = overrides => ({ name: '科技论文写作', date: '2026-10-20', time: '13:30~15:30', room: 'IV-C105', ...overrides });

test('segmented weeks include the later ranges and detect missing / extra weeks', () => {
  assert.deepEqual(core.sourceWeeks('4-5,8-12(周)'), [4, 5, 8, 9, 10, 11, 12]);
  assert.deepEqual(core.sourceWeeks('1，3-9（单周）'), [1, 3, 5, 7, 9]);
  assert.equal(core.validateSchedule(complete).errors, 0);
  assert.match(core.validateSchedule([course()]).issues[0].message, /8,9,10,11,12/);
  assert.match(core.validateSchedule([course({ endWeek: 12 })]).issues[0].message, /多出了.*6,7/);
});
test('invalid raw records are reported before normalization could discard them', () => {
  const report = core.validateSchedule([course({ weekday: 9, periods: [], startWeek: 0 }), null]);
  assert.equal(report.errors, 5);
});
test('same effective weeks with different splits do not generate changes', () => {
  const singles = [4, 5, 8, 9, 10, 11, 12].map(week => course({ startWeek: week, endWeek: week }));
  assert.deepEqual(core.diffSchedules(complete, singles), []);
});
test('odd/even field applies to source weeks and renamed courses are recorded', () => {
  assert.equal(core.validateSchedule([course({ startWeek: 1, endWeek: 18, weekText: '1-18(周)', oddEven: '单' })]).errors, 0);
  const renamed = core.diffSchedules(complete, complete.map(item => ({ ...item, name: '科技论文写作（新名称）' })));
  assert.ok(renamed[0].fields.includes('名称'));
});
test('change records capture rooms, teacher, weeks, added and deleted courses', () => {
  const changed = complete.map(item => ({ ...item, room: 'I-205', teacher: '新教师' }));
  const diff = core.diffSchedules(complete, changed);
  assert.equal(diff.length, 1);
  assert.deepEqual(diff[0].fields, ['地点', '教师']);
  assert.match(diff[0].after, /新教师/);
  assert.equal(core.diffSchedules(complete, []).at(0).type, 'removed');
  assert.equal(core.diffSchedules([], complete).at(0).type, 'added');
});
test('bad and empty syncs retain a good baseline; account / semester switch is isolated', () => {
  const options = { owner: 'account-a', semester: '2026-2027-1' };
  const first = core.updateAudit(null, complete, options);
  const broken = core.updateAudit(first, [course()], options);
  assert.equal(broken.blocked, true);
  assert.deepEqual(broken.baseline, complete);
  assert.equal(broken.history.length, 0);
  assert.equal(core.updateAudit(first, [], options).blocked, true);
  assert.equal(core.updateAudit(first, [], { ...options, semester: '2026-2027-2' }).blocked, false);
  assert.equal(core.updateAudit(first, complete, { ...options, owner: 'account-b' }).history.length, 0);
});
test('audit history is bounded and restoring old data is itself a visible change', () => {
  const options = { owner: 'a', semester: 's' };
  let audit = core.updateAudit(null, complete, options);
  for (let n = 0; n < 14; n++) audit = core.updateAudit(audit, complete.map(item => ({ ...item, room: 'R' + n })), { ...options, at: String(n) });
  assert.equal(audit.history.length, 10);
  const old = audit.history[0].previous;
  const restored = core.updateAudit(audit, old, options);
  assert.deepEqual(restored.baseline, old);
  assert.equal(restored.history[0].changes[0].type, 'modified');
});
test('exam time is validated and interpreted as China time, not cloud server UTC', () => {
  assert.equal(core.examWindow(exam()).start, Date.parse('2026-10-20T13:30:00+08:00'));
  assert.equal(core.examWindow(exam({ date: '2026-02-30' })), null);
  assert.equal(core.examWindow(exam({ time: '24:00-25:00' })), null);
  assert.equal(core.examWindow(exam({ time: '15:30-13:30' })), null);
  assert.equal(core.examWindow(exam({ time: '待定' })), null);
});
test('two exam offsets, stable identities, dedupe and past/unknown filtering', () => {
  const now = Date.parse('2026-10-01T00:00:00+08:00');
  const plans = core.examReminders([exam(), exam(), exam({ date: '2026-09-01' }), exam({ time: '' })], now);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map(item => item.minutes), [1440, 120]);
  assert.equal(plans[0].eventAt - plans[0].notifyAt, 86400000);
  assert.equal(core.examReminders([exam()], Date.parse('2026-10-20T12:00:00+08:00')).length, 0);
  assert.notEqual(core.examKey(exam()), core.examKey(exam({ room: 'I-205' })));
});
test('exam conflicts exclude boundaries and include effective course windows', () => {
  const conflict = core.conflicts(exam(), [exam(), exam({ name: '另一场考试', time: '15:00-17:00' }), exam({ name: '不冲突', time: '15:30-17:30' })],
    [{ name: '课程', start: Date.parse('2026-10-20T14:00:00+08:00'), end: Date.parse('2026-10-20T14:45:00+08:00') }]);
  assert.equal(conflict.length, 2);
  assert.ok(conflict.every(item => !item.includes('不冲突')));
});
test('native notification cap retains soonest items across all categories', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const fn = source.slice(source.indexOf('function buildScheduledNotifications()'), source.indexOf('async function cancelScheduledNotifications'));
  const context = vm.createContext({ window: { NJUSTInsights: core }, Date, state: { data: { exams: [exam({ date: '2026-12-31' })] }, todos: Array.from({ length: 80 }, (_, i) => ({ id: String(i), title: 'task', remindMinutes: 0, at: new Date(Date.now() + (81 - i) * 86400000) })) },
    getNotificationSettings: () => ({ todoReminders: true, examReminders: true }),
    getTodoDateTime: todo => todo.at, formatTodoDueText: () => 'test', getNotificationId: seed => seed });
  vm.runInContext(fn, context);
  const planned = context.buildScheduledNotifications();
  assert.equal(planned.length, 64);
  assert.ok(planned.every((item, i) => !i || item.schedule.at >= planned[i - 1].schedule.at));
});

const miniRoot = process.env.MINI_PROGRAM_ROOT || projectPaths.mini('miniprogram');
test('mini store checks original week text and never treats failed sync as deletions', { skip: !fs.existsSync(path.join(miniRoot, 'utils/store.js')) }, () => {
  const storage = new Map();
  global.wx = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) };
  const store = require(path.join(miniRoot, 'utils/store.js'));
  store.saveCloudSession({ username: 'account-a', loggedIn: true });
  const data = { schedule: complete, meta: { semester: '2026-2027-1', importedAt: '2026-09-30T01:00:00Z', sources: { schedule: { importedAt: '2026-09-30T01:00:00Z' } } } };
  store.replaceRemoteData(data);
  const saved = store.replaceRemoteData({ ...data, schedule: [course()], meta: { ...data.meta, importedAt: '2026-09-30T02:00:00Z', sources: { schedule: { importedAt: '2026-09-30T02:00:00Z' } } } });
  assert.equal(saved.schedule.length, 2);
  assert.equal(store.loadScheduleAudit().blocked, true);
  assert.equal(saved.schedule[0].weekText, '4-5,8-12(周)');
  store.mergeRemoteData({ ...data, schedule: [], meta: { ...data.meta, sources: { schedule: { error: 'timeout' } } } });
  assert.equal(store.loadAppData().schedule.length, 2);
  store.saveCloudSession({ username: 'account-b', loggedIn: true });
  store.replaceRemoteData(data);
  assert.equal(store.loadScheduleAudit().owner, 'account-b');
  assert.equal(store.loadScheduleAudit().history.length, 0);
  delete global.wx;
});

test('mini consent grants one reminder and failed uploads can retry without new consent', { skip: !fs.existsSync(path.join(miniRoot, 'utils/study.js')) }, async () => {
  const storage = new Map(), uploads = [];
  let accepted = true, consentCount = 0, failUpload = false;
  global.wx = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    requestSubscribeMessage: options => { consentCount++; options.success({ [options.tmplIds[0]]: accepted ? 'accept' : 'reject' }); } };
  const store = require(path.join(miniRoot, 'utils/store.js'));
  const api = require(path.join(miniRoot, 'utils/api.js'));
  const original = api.syncExamReminders;
  api.syncExamReminders = async payload => { uploads.push(payload); if (failUpload) throw new Error('upload timeout'); return { ok: true, studyRevision: '2026-09-30-study-1' }; };
  try {
    const futureDate = new Date(Date.now() + 30 * 86400000 + 8 * 3600000).toISOString().slice(0, 10);
    store.saveCloudSession({ username: 'consent-test' });
    store.saveAppData({ exams: [exam({ date: futureDate })] });
    const study = require(path.join(miniRoot, 'utils/study.js'));
    const plans = study.reminderPlans();
    assert.equal(plans.length, 2);
    await study.subscribeExam(plans[0].id);
    assert.equal(uploads.at(-1).reminders.length, 1);
    assert.equal(consentCount, 1);
    await assert.rejects(() => study.subscribeExam(plans[0].id), /已订阅/);
    assert.equal(consentCount, 1);
    accepted = false;
    await assert.rejects(() => study.subscribeExam(plans[1].id), /未同意/);
    assert.equal(study.authorizedRecords().length, 1);
    await study.cancelExam(plans[0].id);
    assert.deepEqual(uploads.at(-1).cancelIds, [plans[0].id]);
    accepted = true; failUpload = true;
    await assert.rejects(() => study.subscribeExam(plans[0].id), /upload timeout/);
    assert.equal(study.authorizedRecords()[0].pendingReset, true);
    const attempts = consentCount;
    failUpload = false;
    await study.reconcileExamReminders();
    assert.ok(uploads.at(-1).resetIds.includes(plans[0].id));
    assert.equal(consentCount, attempts);
    assert.equal(study.authorizedRecords()[0].pendingReset, false);
  } finally { api.syncExamReminders = original; delete global.wx; }
});
