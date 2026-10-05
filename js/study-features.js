/** @maintenance
 * 网页/APK 的检查与提醒适配层。使用 schedule-insights 的纯算法，再将检查历史写入 IndexedDB。
 * 原生提醒状态来自系统插件，不等于 JavaScript 计划已成功投递；浏览器与 APK 权限能力不同，提示必须区分平台。
 */
/* Shared timetable audit and platform-aware reminder inspection. */
(function () {
  'use strict';
  const core = window.NJUSTInsights;
  let audit = null;
  let reminderStatus = { pending: [], checked: false, error: '', busy: false };
  let refreshId = 0;
  const esc = value => escapeHtml(String(value == null ? '' : value));
  const ownerFor = status => cleanText(status?.accountKey || status?.username || state.server.accountKey
    || state.server.username || getLoginPrefs().username) || 'local';
  const hint = message => `<div class="setting-desc mt-12">${esc(message)}</div>`;

  async function load() {
    audit = await dbGet('scheduleAudit') || null;
    if (!audit && state.data.schedule.length) {
      audit = core.updateAudit(null, state.data.schedule, { owner: ownerFor(), semester: state.data.meta.semester,
        stamp: state.data.meta.sources?.schedule?.importedAt || state.data.meta.importedAt });
      await persist();
    }
  }
  async function persist() { await dbSet('scheduleAudit', audit); }
  async function clearAudit() { audit = null; await persist(); }

  function inspectRemote(data, status = {}) {
    const owner = ownerFor(status);
    const changedOwner = Boolean(audit && audit.owner !== owner);
    if (audit && audit.owner !== owner) audit = null;
    if (!Array.isArray(data.schedule)) return data;
    const source = data.meta?.sources?.schedule;
    if (source?.error) {
      // A failed/partial sync is not a deletion or a new timetable version.
      return { ...data, schedule: changedOwner ? [] : audit?.baseline || state.data.schedule };
    }
    const stamp = normalizeIsoTime(source?.importedAt || data.meta?.importedAt) || '';
    if (!stamp && !status.importing) return data;
    const semester = data.meta?.semester || data.schedule.find(item => item?.semester)?.semester || state.data.meta.semester;
    if (!status.importing && audit?.stamp === stamp && audit?.semester === semester) {
      return { ...data, schedule: audit.baseline || data.schedule };
    }
    audit = core.updateAudit(audit, data.schedule, { owner, semester, stamp, at: new Date().toISOString() });
    if (!audit.blocked) return data;
    return { ...data, schedule: audit.baseline,
      meta: { ...data.meta, sources: { ...data.meta?.sources,
        schedule: { ...state.data.meta.sources?.schedule, error: '完整性检查发现异常，已保留上次有效课表' } } } };
  }

  function reportTitle() {
    if (!audit) return '尚未检查，请先同步课表';
    if (audit.blocked) return '本次同步有异常，已保留上次课表';
    if (audit.report.errors) return `发现 ${audit.report.errors} 个问题，请核对学校课表`;
    if (audit.report.warnings) return `未发现解析错误，${audit.report.warnings} 项需要核对`;
    return '未发现周次、节次解析异常';
  }
  function renderAudit() {
    const target = document.getElementById('insights-content');
    if (!target) return;
    const report = audit?.report;
    const latest = audit?.history?.[0];
    const sourceCoverage = core.meetings(audit?.baseline || []).filter(item => core.sourceWeeks(item.weekText).length).length;
    target.innerHTML = `<div class="card">
      <div class="setting-label">${esc(reportTitle())}</div>
      ${hint(report ? `${audit.semester || '未标注学期'} · ${report.meetingCount} 组课程安排 · ${report.count} 条分段记录 · 检查于 ${formatDateTime(report.checkedAt)}` : '首次有效同步建立基线，后续有效同步才记录变更。')}
      ${hint(`保留原始周次的安排：${sourceCoverage} 组。检查可发现分段周次遗漏和非法字段，但不能证明网页上未抓到的课程不存在。`)}
      <div class="action-row mt-12"><button class="btn btn-outline" onclick="NJUSTStudyFeatures.checkCurrent()">检查当前课表</button><button class="btn btn-soft" onclick="navigate('schedule')">返回课表</button></div>
      ${(report?.issues || []).map(item => `<div class="study-issue ${item.severity}"><strong>${esc(item.name)}</strong><div>${esc(item.message)}</div></div>`).join('')}
    </div>
    <div class="section-title">同步变更记录</div>
    ${hint('按账号和学期隔离，保存最近 10 次有效变更。不同分段写法合并比较，不会把相同周次误报为变更。本地自定义课程与调课设置不参与教务同步比较。')}
    ${!latest ? '<div class="card">暂无变更。首次同步只建立基线。</div>' : (audit.history || []).map((record, index) => `
      <div class="card"><div class="study-card-head"><strong>${esc(formatDateTime(record.at))} · ${record.changes.length} 项变更</strong>
        <button class="btn btn-outline btn-sm" onclick="NJUSTStudyFeatures.restore(${index})">恢复此版本之前的课表</button></div>
        ${record.changes.map(change => `<div class="study-change"><strong>${esc(({ added: '新增', removed: '删除', modified: '调整' })[change.type])} · ${esc(change.name)}${change.fields?.length ? '（' + esc(change.fields.join('、')) + '）' : ''}</strong>
          ${change.before ? `<div class="setting-desc">原：${esc(change.before)}</div>` : ''}${change.after ? `<div class="setting-desc">现：${esc(change.after)}</div>` : ''}</div>`).join('')}
      </div>`).join('')}`;
  }
  async function checkCurrent() {
    const report = core.validateSchedule(state.data.schedule);
    if (!audit || !audit.blocked) {
      audit = { ...(audit || core.updateAudit(null, state.data.schedule, { owner: ownerFor(), semester: state.data.meta.semester })), report };
      await persist();
    }
    renderAudit();
    showToast(audit?.blocked ? '当前保留的是旧课表；上次同步异常仍需核对' : report.errors ? `发现 ${report.errors} 个问题` : '检查完成，未发现解析异常');
  }
  async function restore(index) {
    const record = audit?.history?.[index];
    if (!record || !window.confirm('恢复这次同步之前的本地课表？成绩、考试、自定义课程不变；下次新同步仍以学校课表为准。')) return;
    const restored = JSON.parse(JSON.stringify(record.previous));
    audit = core.updateAudit(audit, restored, { owner: audit.owner, semester: audit.semester, stamp: audit.stamp });
    state.data.schedule = restored.map(normalizeScheduleItem).filter(Boolean);
    state.data.meta.sources.schedule = { ...(state.data.meta.sources.schedule || {}), error: '', count: restored.length };
    await persistCurrentData();
    await afterDataChanged();
    renderAudit();
    showToast('本地课表已恢复，提醒也已重新安排');
  }

  function examWarnings(exam) {
    const time = core.examWindow(exam), now = Date.now();
    if (!time) return '<div class="study-issue warning">日期或时间待定，暂不安排考试提醒。</div>';
    if (time.end <= now) return '';
    const day = new Date(`${exam.date}T00:00:00+08:00`);
    const week = getWeekForDate(state.data.meta.semesterStart, day);
    const courses = day >= new Date(`${state.data.meta.semesterStart}T00:00:00+08:00`)
      ? getCoursesForDay(getTodayWeekday(day), week).map(course => {
        const range = getPeriodRange(course.periods);
        return { name: course.name, start: new Date(`${exam.date}T${range.start}:00+08:00`).getTime(), end: new Date(`${exam.date}T${range.end}:00+08:00`).getTime() };
      }) : [];
    const warnings = core.conflicts(exam, state.data.exams, courses);
    return warnings.map(message => `<div class="study-issue warning">${esc(message)}</div>`).join('');
  }

  function renderReminders() {
    const target = document.getElementById('reminders-content');
    if (!target) return;
    const settings = getNotificationSettings(), plugin = getLocalNotificationsPlugin();
    const planned = buildScheduledNotifications();
    const pending = new Set(reminderStatus.pending.map(item => Number(item.id)));
    const unknown = state.data.exams.filter(item => !core.examWindow(item));
    target.innerHTML = `<div class="card">
      <div class="setting-label">${plugin ? '安卓提醒状态' : '网页提醒预览'}</div>
      ${hint(plugin ? `通知：${settings.permissionState === 'granted' ? '已允许' : '未允许或未检查'} · 精确闹钟：${settings.exactAlarmState === 'granted' ? '已允许' : '未开启或不支持'}` : '浏览器版仅预览提醒计划，不会在后台发送系统通知。请使用 APK 或小程序订阅消息。')}
      ${hint(`总开关：${settings.enabled ? '已开启' : '未开启'} · 考试提醒：${settings.examReminders ? '已开启' : '未开启'} · ${planned.length} 条候选计划${plugin && reminderStatus.checked ? ' · 系统已排队 ' + reminderStatus.pending.length + ' 条' : ''}`)}
      ${hint('考试默认考前一天、两小时前提醒；已过期、时间不明确或提醒时刻已过的记录不会安排。最多排队 64 条，按提醒时间排序。系统已排队不代表一定送达，仍受省电及权限设置影响。')}
      ${reminderStatus.error ? `<div class="study-issue error">${esc(reminderStatus.error)}</div>` : ''}
      ${settings.lastNotificationError ? `<div class="study-issue error">上次调度：${esc(settings.lastNotificationError)}</div>` : ''}
      <div class="action-row mt-12"><button class="btn btn-outline" onclick="NJUSTStudyFeatures.refreshReminders()">${reminderStatus.busy ? '正在检查…' : '刷新检查'}</button><button class="btn btn-primary" onclick="NJUSTStudyFeatures.rebuildReminders()">重新安排提醒</button><button class="btn btn-soft" onclick="NJUSTStudyFeatures.testNotification()">发送测试通知</button></div>
      ${hint('安卓请允许通知与精确闹钟，并在系统电池设置中允许后台运行。课程与待办开关在设置页修改。')}
    </div>
    <div class="section-title">即将提醒</div>
    ${planned.length ? planned.map(item => `<div class="card"><div class="study-card-head"><strong>${esc(item.title)}</strong><span class="study-status">${!plugin ? '仅预览' : !settings.enabled ? '未启用' : !reminderStatus.checked ? '待检查' : pending.has(item.id) ? '系统已排队' : '未排队'}</span></div><div class="setting-desc">提醒于 ${esc(formatDateTime(item.schedule.at))}</div>${hint(item.body)}</div>`).join('') : '<div class="card">暂无可安排的未来提醒。请同步考试、课表或创建带截止时间的待办，并确认相关开关已开启。</div>'}
    ${unknown.length ? `<div class="section-title">时间待定，未安排提醒</div><div class="card">${unknown.map(item => `<div class="study-change">${esc(item.name)} · ${esc(item.date || '日期待定')} · ${esc(item.time || '时间待定')}</div>`).join('')}</div>` : ''}`;
  }
  async function refreshReminders() {
    const request = ++refreshId;
    reminderStatus.busy = true;
    renderReminders();
    const plugin = getLocalNotificationsPlugin();
    try {
      await refreshNotificationStatus({ silent: true, prompt: false, persist: true });
      const result = plugin ? await plugin.getPending() : { notifications: [] };
      if (request !== refreshId) return;
      reminderStatus = { pending: result.notifications || [], checked: Boolean(plugin), error: '', busy: false };
    } catch (error) {
      if (request !== refreshId) return;
      reminderStatus = { pending: [], checked: false, error: error.message || '系统提醒队列读取失败', busy: false };
    }
    if (state.currentPage === 'reminders') renderReminders();
  }
  async function rebuildReminders() {
    if (!getLocalNotificationsPlugin()) { showToast('网页只支持预览，请使用 APK'); return; }
    state.notificationSettings.enabled = true;
    await persistNotificationSettings();
    await scheduleNotifications({ silent: false });
    await refreshReminders();
  }
  async function testNotification() {
    const plugin = getLocalNotificationsPlugin();
    if (!plugin) { showToast('测试系统通知需要安卓安装版'); return; }
    try {
      const ready = await refreshNotificationStatus({ prompt: true, persist: true, silent: false });
      if (ready.permissionState !== 'granted') return;
      await plugin.schedule({ notifications: [{ id: getNotificationId('notification-test'), title: '提醒功能测试', body: '看到这条消息说明系统通知可以显示。定时提醒还需允许后台运行。', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, extra: { type: 'test' } }] });
      showToast('已安排测试通知，约 5 秒后显示');
      await refreshReminders();
    } catch (error) { showToast(error.message || '测试通知安排失败'); }
  }
  function render() {
    const summary = document.getElementById('schedule-insights-summary');
    if (summary) summary.innerHTML = `<button class="study-summary-link" onclick="navigate('insights')">${esc(reportTitle())} · 查看变更记录</button>`;
    const settingsSummary = document.getElementById('settings-insights-summary');
    if (settingsSummary) settingsSummary.textContent = reportTitle() + (audit?.history?.length ? ` · 已记录 ${audit.history.length} 次有效变更` : '');
    if (state.currentPage === 'insights') renderAudit();
    if (state.currentPage === 'reminders') { renderReminders(); void refreshReminders(); }
  }
  window.NJUSTStudyFeatures = { load, persist, clearAudit, inspectRemote, render, checkCurrent, restore, examWarnings,
    refreshReminders, rebuildReminders, testNotification };
})();
