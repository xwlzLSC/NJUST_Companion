const REVISION = '2026-09-30-study-1';
const COLLECTIONS = ['njust_todo_reminders', 'njust_exam_reminders'];
const HEALTH_COLLECTION = 'njust_reminder_health';
const TEMPLATE_ID = 'JyrAnL0vBDZ3QLfe4JzItfPGsnZw2i4cfSGfQbYP0kI';
const text = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
function subscribeTime(value) {
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return '';
  const date = new Date(stamp + 8 * 3600000), pad = number => String(number).padStart(2, '0');
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日 ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
function errorReason(error) {
  const message = [error && (error.errCode || error.errcode || error.code), error && (error.message || error.errMsg)].join(' ');
  if (/43101|refuse to accept/i.test(message)) return '订阅额度不足或用户未接受，请重新订阅后重试';
  if (/47003|argument invalid/i.test(message)) return '订阅消息模板参数不合法，请检查模板';
  if (/43100|template/i.test(message)) return '订阅消息模板不可用';
  return text(message) || '订阅消息发送失败';
}
function createRunner(cloud, db, now = () => Date.now()) {
  const command = db.command;
  async function ensure(name) { try { await db.createCollection(name); } catch {} }
  async function due(limit) {
    const stamp = new Date(now()).toISOString(), all = [];
    for (const name of COLLECTIONS) {
      await ensure(name);
      const result = await db.collection(name).where({ active: true, reminderEnabled: true,
        notifiedAt: null, dueAt: command.lte(stamp), retryCount: command.lt(5) }).orderBy('dueAt', 'asc').limit(limit).get();
      (result.data || []).forEach(record => all.push({ ...record, collection: name }));
    }
    return all.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, limit);
  }
  async function claim(record) {
    const stamp = new Date(now()).toISOString();
    if (record.leaseUntil > stamp || record.nextAttemptAt > stamp) return false;
    const criteria = { _id: record._id, active: true, notifiedAt: null,
      leaseUntil: record.leaseUntil == null ? command.exists(false) : record.leaseUntil };
    const result = await db.collection(record.collection).where(criteria).update({ data: {
      leaseUntil: new Date(now() + 120000).toISOString(), lastAttemptAt: stamp } });
    return Boolean(result.stats && result.stats.updated === 1);
  }
  async function send(record) {
    const exam = record.kind === 'exam';
    await cloud.openapi.subscribeMessage.send({ touser: record.openid, templateId: TEMPLATE_ID,
      page: exam ? 'pages/exams/index' : 'pages/todos/index', lang: 'zh_CN', data: {
        thing2: { value: text(record.title || '新的提醒').slice(0, 20) },
        time8: { value: subscribeTime(exam ? record.eventAt : record.dueAt) },
        thing11: { value: text(exam ? `${record.label} · ${record.location || record.note}${record.seat ? ' 座位' + record.seat : ''}` : record.note || (record.linkedCourseName ? '关联课程：' + record.linkedCourseName : '请到待办页面查看具体信息')).slice(0, 20) },
        thing1: { value: text(record.todoType || (exam ? '考试安排' : '日常待办')).slice(0, 20) },
        time3: { value: subscribeTime(record.createdAt || new Date(now()).toISOString()) }
      } });
  }
  async function run(event = {}) {
    const started = new Date(now()).toISOString();
    const limit = Math.max(1, Math.min(50, Number(event.limit) || 50));
    const records = await due(limit);
    let sent = 0, failed = 0, expired = 0, skipped = 0;
    for (const record of records) {
      if (!await claim(record)) { skipped++; continue; }
      const doc = db.collection(record.collection).doc(record._id);
      const stamp = new Date(now()).toISOString();
      if (record.kind === 'exam' && (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= now() || Date.parse(record.eventAt) <= now())) {
        await doc.update({ data: { active: false, expiredAt: stamp, leaseUntil: '', lastError: '提醒已过期，未发送旧考试消息' } });
        expired++; continue;
      }
      try {
        await send(record);
        await doc.update({ data: { active: false, notifiedAt: new Date(now()).toISOString(), lastError: '', leaseUntil: '', nextAttemptAt: '' } });
        sent++;
      } catch (error) {
        const reason = errorReason(error), retries = Number(record.retryCount || 0) + 1;
        await doc.update({ data: { active: !/订阅额度不足|模板/.test(reason) && retries < 5,
          retryCount: retries, lastError: reason, leaseUntil: '', nextAttemptAt: new Date(now() + retries * 60000).toISOString() } });
        failed++;
      }
    }
    await ensure(HEALTH_COLLECTION);
    await db.collection(HEALTH_COLLECTION).doc('timer').set({ data: { lastRunAt: started,
      finishedAt: new Date(now()).toISOString(), scanned: records.length, sent, failed, expired, studyRevision: REVISION } });
    return { ok: true, studyRevision: REVISION, scanned: records.length, sent, failed, expired, skipped };
  }
  return { run };
}
module.exports = { createRunner, subscribeTime, errorReason, REVISION };
