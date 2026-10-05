const crypto = require('crypto');
const EXAM_COLLECTION = 'njust_exam_reminders';
const HEALTH_COLLECTION = 'njust_reminder_health';
const REVISION = '2026-09-30-study-1';
const text = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();

function normalizeExamReminder(item, now = Date.now()) {
  if (!item || !text(item.id) || text(item.id).length > 800 || !text(item.name)) return null;
  const minutes = Number(item.minutes), notifyAt = Number(item.notifyAt), eventAt = Number(item.eventAt);
  if (![1440, 120].includes(minutes) || !text(item.id).endsWith('|' + minutes)) return null;
  if (!Number.isFinite(notifyAt) || !Number.isFinite(eventAt) || Math.abs(eventAt - notifyAt - minutes * 60000) > 1000) return null;
  const expiresAt = Math.min(eventAt, notifyAt + 3600000);
  if (eventAt <= now || eventAt > now + 366 * 86400000 || expiresAt <= now) return null;
  const reminderId = text(item.id);
  return { reminderId, examKey: reminderId.slice(0, reminderId.lastIndexOf('|')), kind: 'exam', title: text(item.name).slice(0, 80),
    label: minutes === 1440 ? '考前一天' : '考前两小时', minutes,
    dueAt: new Date(notifyAt).toISOString(), eventAt: new Date(eventAt).toISOString(), expiresAt: new Date(expiresAt).toISOString(),
    note: text(item.body).slice(0, 500), todoType: '考试安排',
    location: text(item.location || text(item.body).split(' · ').slice(1).join(' · ') || '考场待定').slice(0, 80), seat: text(item.seat).slice(0, 20),
    createdAt: new Date(Number.isFinite(Date.parse(item.createdAt)) ? Date.parse(item.createdAt) : now).toISOString() };
}

function createService(db, now = () => Date.now()) {
  async function ensure(name) { try { await db.createCollection(name); } catch {} }
  async function list(name, openid, limit = 200) {
    const all = [];
    while (all.length < limit) {
      const result = await db.collection(name).where({ openid }).skip(all.length).limit(Math.min(100, limit - all.length)).get();
      const batch = Array.isArray(result.data) ? result.data : [];
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }
  function assertOwner(openid) { if (!openid) throw new Error('缺少微信身份，请从小程序中操作'); }
  async function sync(openid, records, resetIds = [], options = {}) {
    assertOwner(openid);
    await ensure(EXAM_COLLECTION);
    const stamp = new Date(now()).toISOString();
    const target = new Map((Array.isArray(records) ? records : []).slice(0, 64)
      .map(item => normalizeExamReminder(item, now())).filter(Boolean).map(item => [item.reminderId, item]));
    const existing = await list(EXAM_COLLECTION, openid);
    const byId = new Map(existing.map(item => [item.reminderId, item]));
    const resets = new Set(Array.isArray(resetIds) ? resetIds.slice(0, 64) : []);
    const validKeys = Array.isArray(options.validExamKeys) ? new Set(options.validExamKeys.slice(0, 300)) : null;
    const cancelledIds = new Set(Array.isArray(options.cancelIds) ? options.cancelIds.slice(0, 64) : []);
    let queued = 0, cancelled = 0;
    for (const [id, reminder] of target) {
      const old = byId.get(id);
      const sent = Boolean(old && old.notifiedAt);
      const retry = resets.has(id) && !sent;
      const stopped = Boolean(old && !old.active && !retry);
      const payload = { ...reminder, openid, active: !sent && !stopped, reminderEnabled: true,
        notifiedAt: old && old.notifiedAt || null, lastError: retry ? '' : old && old.lastError || '',
        retryCount: retry ? 0 : Number(old && old.retryCount || 0), lastAttemptAt: old && old.lastAttemptAt || '',
        leaseUntil: old && old.leaseUntil || '', nextAttemptAt: retry ? '' : old && old.nextAttemptAt || '',
        cancelledAt: retry ? '' : old && old.cancelledAt || '', expiredAt: old && old.expiredAt || '', syncedAt: stamp };
      const docId = old && old._id || crypto.createHash('sha256').update(openid + '|' + id).digest('hex');
      // Do not overwrite a live sender's lease or erase sent state on routine reconciliation.
      if (old) {
        if (retry && !old.notifiedAt && !(old.leaseUntil > stamp)) await db.collection(EXAM_COLLECTION).doc(docId).update({ data: payload });
      } else await db.collection(EXAM_COLLECTION).doc(docId).set({ data: payload });
      if (payload.active) queued++;
    }
    for (const old of existing) {
      const oldKey = old.examKey || old.reminderId.slice(0, old.reminderId.lastIndexOf('|'));
      const shouldCancel = cancelledIds.has(old.reminderId) || (validKeys ? !validKeys.has(oldKey) : !target.has(old.reminderId));
      if (!shouldCancel || old.notifiedAt || (!old.active && !cancelledIds.has(old.reminderId))) continue;
      await db.collection(EXAM_COLLECTION).doc(old._id).update({ data: { active: false, reminderEnabled: false, cancelledAt: stamp, syncedAt: stamp } });
      cancelled++;
    }
    return { ok: true, studyRevision: REVISION, queued, cancelled };
  }
  async function status(openid) {
    assertOwner(openid);
    await ensure(EXAM_COLLECTION);
    const exams = await list(EXAM_COLLECTION, openid);
    let todos = [], health = null;
    try { todos = await list('njust_todo_reminders', openid); } catch {}
    try { health = (await db.collection(HEALTH_COLLECTION).doc('timer').get()).data; } catch {}
    const records = exams.concat(todos).map(item => ({ id: item.reminderId || item.todoId, kind: item.kind || 'todo',
      title: item.title, dueAt: item.dueAt, eventAt: item.eventAt || item.dueAt, label: item.label || '到期提醒',
      status: item.notifiedAt ? 'sent' : item.expiredAt || item.kind === 'exam' && Date.parse(item.expiresAt) <= now() ? 'expired'
        : item.cancelledAt ? 'cancelled' : item.lastError ? 'failed' : item.active ? 'queued' : 'disabled',
      notifiedAt: item.notifiedAt || '', lastAttemptAt: item.lastAttemptAt || '', lastError: item.lastError || '',
      retryCount: Number(item.retryCount || 0), retrying: Boolean(item.active && item.lastError) })).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
    return { ok: true, studyRevision: REVISION, records, health };
  }
  return { sync, status };
}
module.exports = { createService, normalizeExamReminder, EXAM_COLLECTION, HEALTH_COLLECTION, REVISION };
