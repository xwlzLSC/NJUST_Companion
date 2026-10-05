const test = require('node:test');
const assert = require('node:assert/strict');
const { createService, normalizeExamReminder } = require('../integrations/wechat/cloud/study-reminders');
const { createRunner, subscribeTime } = require('../integrations/wechat/cloud/reminder-runner');

function fakeDb() {
  const collections = new Map();
  const table = name => { if (!collections.has(name)) collections.set(name, new Map()); return collections.get(name); };
  const matches = (row, criteria) => Object.entries(criteria).every(([key, value]) => value && value.op
    ? value.op === 'exists' ? (row[key] !== undefined) === value.value : value.op === 'lt' ? row[key] < value.value : row[key] <= value.value
    : row[key] === value);
  function query(name, criteria = {}, start = 0, limit = 100, order) {
    const rows = () => { const filtered = [...table(name).values()].filter(row => matches(row, criteria)); if (order) filtered.sort((a, b) => String(a[order]).localeCompare(String(b[order]))); return filtered.slice(start, start + limit); };
    return { where: next => query(name, next, start, limit, order), skip: n => query(name, criteria, n, limit, order), limit: n => query(name, criteria, start, n, order), orderBy: field => query(name, criteria, start, limit, field),
      get: async () => ({ data: rows().map(row => ({ ...row })) }),
      update: async ({ data }) => { const selected = rows(); selected.forEach(row => Object.assign(row, data)); return { stats: { updated: selected.length } }; },
      doc: id => ({ get: async () => ({ data: table(name).get(id) }), set: async ({ data }) => { table(name).set(id, { ...data, _id: id }); },
        update: async ({ data }) => { assert.ok(table(name).has(id)); Object.assign(table(name).get(id), data); } }) };
  }
  return { collections, createCollection: async name => { table(name); }, collection: query,
    command: { lte: value => ({ op: 'lte', value }), lt: value => ({ op: 'lt', value }), exists: value => ({ op: 'exists', value }) } };
}
const now = Date.parse('2026-10-01T08:00:00+08:00');
const reminder = overrides => ({ id: 'test-exam|120', name: '测试考试', minutes: 120, notifyAt: now + 60000, eventAt: now + 7260000, body: '2026-10-01 10:01 · I-205', ...overrides });
const cloudMock = (sent, fail) => ({ openapi: { subscribeMessage: { send: async payload => { if (fail) throw fail; sent.push(payload); } } } });

test('exam payload requires allowed offsets and rejects already expired events', () => {
  assert.ok(normalizeExamReminder(reminder(), now));
  assert.equal(normalizeExamReminder(reminder({ minutes: 30 }), now), null);
  assert.equal(normalizeExamReminder(reminder({ eventAt: now }), now), null);
  assert.equal(normalizeExamReminder(reminder({ notifyAt: now - 7200000, eventAt: now + 60000 }), now), null);
});
test('exam subscriptions are OPENID scoped, preserve sent state and cancel removed exams', async () => {
  const db = fakeDb(), service = createService(db, () => now);
  await service.sync('user-a', [reminder()]);
  await service.sync('user-b', [reminder({ name: '另一个用户的考试' })]);
  const a = (await service.status('user-a')).records;
  assert.equal(a.length, 1); assert.equal(a[0].title, '测试考试');
  const row = [...db.collections.get('njust_exam_reminders').values()].find(item => item.openid === 'user-a');
  row.notifiedAt = new Date(now).toISOString(); row.active = false;
  await service.sync('user-a', [reminder()]);
  assert.equal(row.active, false); assert.equal((await service.status('user-a')).records[0].status, 'sent');
  await service.sync('user-b', []);
  assert.equal((await service.status('user-b')).records[0].status, 'cancelled');
  await assert.rejects(() => service.status(''), /微信身份/);
});
test('timer sends only due authorized records and reports a heartbeat', async () => {
  const db = fakeDb(), messages = [], service = createService(db, () => now);
  await service.sync('user-a', [reminder({ notifyAt: now - 60000, eventAt: now + 7140000 }), reminder({ id: 'later|120' })]);
  const result = await createRunner(cloudMock(messages), db, () => now).run();
  assert.equal(result.sent, 1); assert.equal(messages.length, 1);
  assert.equal(messages[0].page, 'pages/exams/index');
  assert.match(messages[0].data.time8.value, /2026年10月1日 09:59/);
  assert.match(messages[0].data.thing11.value, /I-205/);
  assert.ok((await service.status('user-a')).health.lastRunAt);
});
test('old exam messages expire without sending', async () => {
  let current = now;
  const db = fakeDb(), messages = [], service = createService(db, () => current);
  await service.sync('a', [reminder()]);
  current += 2 * 3600000;
  const result = await createRunner(cloudMock(messages), db, () => current).run();
  assert.equal(result.expired, 1); assert.equal(messages.length, 0);
  assert.equal((await service.status('a')).records[0].status, 'expired');
});
test('overlapping timer invocations claim the record once', async () => {
  const db = fakeDb(), messages = [], service = createService(db, () => now);
  await service.sync('a', [reminder({ notifyAt: now - 60000, eventAt: now + 7140000 })]);
  const runner = createRunner(cloudMock(messages), db, () => now);
  await Promise.all([runner.run(), runner.run()]);
  assert.equal(messages.length, 1);
});
test('refused subscriptions stop retries until fresh user authorization', async () => {
  const db = fakeDb(), service = createService(db, () => now);
  const record = reminder({ notifyAt: now - 60000, eventAt: now + 7140000 });
  await service.sync('a', [record]);
  await createRunner(cloudMock([], { errCode: 43101, errMsg: 'refuse to accept' }), db, () => now).run();
  assert.match((await service.status('a')).records[0].lastError, /订阅额度不足/);
  await service.sync('a', [record]);
  assert.equal([...db.collections.get('njust_exam_reminders').values()][0].active, false);
  await service.sync('a', [], [], { validExamKeys: ['test-exam'], cancelIds: [record.id] });
  assert.equal((await service.status('a')).records[0].status, 'cancelled');
  await service.sync('a', [record], [record.id]);
  assert.equal([...db.collections.get('njust_exam_reminders').values()][0].active, true);
});
test('legacy todo records are compatible and do not send before their due time', async () => {
  const db = fakeDb(), messages = [];
  await db.collection('njust_todo_reminders').doc('old').set({ data: { openid: 'a', todoId: 'old', active: true, reminderEnabled: true,
    notifiedAt: null, title: '原待办', dueAt: new Date(now - 60000).toISOString(), retryCount: 0, createdAt: new Date(now).toISOString() } });
  await db.collection('njust_todo_reminders').doc('future').set({ data: { openid: 'a', active: true, reminderEnabled: true,
    notifiedAt: null, title: '未来待办', dueAt: new Date(now + 60000).toISOString(), retryCount: 0 } });
  const result = await createRunner(cloudMock(messages), db, () => now).run();
  assert.equal(result.sent, 1); assert.equal(messages[0].data.thing2.value, '原待办');
});
test('transient failures back off and sent reminders never repeat after a new sync', async () => {
  let current = now;
  const db = fakeDb(), service = createService(db, () => current), messages = [];
  const record = reminder({ notifyAt: now - 60000, eventAt: now + 7140000 });
  await service.sync('a', [record]);
  await createRunner(cloudMock([], new Error('network timeout')), db, () => current).run();
  const runner = createRunner(cloudMock(messages), db, () => current);
  assert.equal((await runner.run()).sent, 0);
  current += 61000;
  assert.equal((await runner.run()).sent, 1);
  await service.sync('a', [record]); await runner.run();
  assert.equal(messages.length, 1);
});
test('server UTC does not shift school times', () => { assert.equal(subscribeTime('2026-10-01T00:00:00Z'), '2026年10月1日 08:00'); });
test('a second device keeps existing authorization; changed exams and explicit cancellation disable it', async () => {
  const db = fakeDb(), service = createService(db, () => now);
  await service.sync('a', [reminder()]);
  await service.sync('a', [], [], { validExamKeys: ['test-exam'] });
  assert.equal((await service.status('a')).records[0].status, 'queued');
  await service.sync('a', [], [], { validExamKeys: ['test-exam'], cancelIds: ['test-exam|120'] });
  assert.equal((await service.status('a')).records[0].status, 'cancelled');
  await service.sync('a', [reminder()], ['test-exam|120'], { validExamKeys: ['test-exam'] });
  assert.equal((await service.status('a')).records[0].status, 'queued');
  await service.sync('a', [], [], { validExamKeys: ['changed-exam'] });
  assert.equal((await service.status('a')).records[0].status, 'cancelled');
});
