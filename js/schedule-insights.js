/** @maintenance
 * 课表完整性、差异记录和考试提醒计划的共享纯计算模块，不联网、不请求权限、不发送通知。
 * 保留原始 weekText，比较展开后的分段周次；遇到疑似不完整新课表时先保留最近一次可靠结果。
 * 网页/APK 与小程序使用相同算法，但通知权限和实际投递由各平台适配层负责。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NJUSTInsights = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const text = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const sorted = values => [...new Set(values)].sort((a, b) => a - b);
  const periods = item => sorted((Array.isArray(item.periods) ? item.periods : []).map(Number).filter(Number.isInteger));
  const parity = item => /单/.test(item.oddEven || '') ? 1 : /双/.test(item.oddEven || '') ? 2 : 0;
  const courseKey = item => item.code ? text(item.code) + '|' + text(item.sequence) : text(item.name);
  const meetingKey = item => [courseKey(item), Number(item.weekday), periods(item).join(','), text(item.room), text(item.teacher)].join('|');
  function weeksOf(item) {
    const start = Number(item.startWeek), end = Number(item.endWeek), oddEven = parity(item);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 60) return [];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
      .filter(week => !oddEven || week % 2 === (oddEven === 1 ? 1 : 0));
  }
  /** @maintenance
   * 从学校原始文本展开每段周次，支持分隔符和单双周。该结果用于检查解析后的课表是否丢段，不能只取最小/最大值。
   */
  function sourceWeeks(value) {
    const raw = text(value).replace(/[，、;；]/g, ',').replace(/[—–～~－]/g, '-');
    const match = raw.match(/(\d+\s*(?:-\s*\d+)?(?:\s*,\s*\d+\s*(?:-\s*\d+)?)*)\s*(?:[（(]\s*)?(?:单|双)?周/);
    if (!match) return [];
    const oddEven = /单/.test(raw) ? 1 : /双/.test(raw) ? 2 : 0;
    const result = [];
    for (const part of match[1].split(',')) {
      const bounds = part.split('-').map(value => Number(value.trim()));
      const first = bounds[0], last = bounds[1] == null ? first : bounds[1];
      if (first < 1 || last < first || last > 60) continue;
      for (let week = first; week <= last; week++) {
        if (!oddEven || week % 2 === (oddEven === 1 ? 1 : 0)) result.push(week);
      }
    }
    return sorted(result);
  }
  function meetings(schedule) {
    const map = new Map();
    for (const item of schedule || []) {
      const key = meetingKey(item);
      if (!map.has(key)) map.set(key, { ...item, periods: periods(item), weeks: [] });
      const entry = map.get(key);
      entry.weeks = sorted(entry.weeks.concat(weeksOf(item)));
    }
    return [...map.values()].sort((a, b) => meetingKey(a).localeCompare(meetingKey(b)));
  }
  function describe(item) {
    if (!item) return '';
    return '周' + ['日', '一', '二', '三', '四', '五', '六', '日'][item.weekday]
      + ' · 第' + periods(item).join(',') + '节 · ' + (item.room || '地点待定')
      + ' · 第' + (item.weeks || weeksOf(item)).join(',') + '周'
      + (item.teacher ? ' · ' + text(item.teacher) : '');
  }
  function validateSchedule(schedule) {
    const items = Array.isArray(schedule) ? schedule : [], issues = [], groups = new Map();
    const add = (severity, item, message) => issues.push({ severity, name: text(item && item.name) || '未命名课程', message });
    for (const item of items) {
      if (!item || !text(item.name) || /^(?:&nbsp;|\u00a0)$/.test(text(item.name))) {
        add('error', item, '课程名称缺失'); continue;
      }
      if (!Number.isInteger(Number(item.weekday)) || item.weekday < 1 || item.weekday > 7) add('error', item, '星期不合法');
      const slots = periods(item);
      if (!slots.length || slots.some(value => value < 1 || value > 14)) add('error', item, '节次缺失或超出 1–14 节');
      if (!weeksOf(item).length) add('error', item, '周次缺失或范围不合法');
      if (!text(item.room)) add('warning', item, '上课地点未提供，请以学校通知为准');
      const key = meetingKey(item);
      if (!groups.has(key)) groups.set(key, { item, actual: [], expected: [] });
      const group = groups.get(key);
      group.actual.push(...weeksOf(item));
      const oddEven = parity(item);
      group.expected.push(...sourceWeeks(item.weekText).filter(week => !oddEven || week % 2 === (oddEven === 1 ? 1 : 0)));
    }
    for (const group of groups.values()) {
      const missing = sorted(group.expected).filter(week => !group.actual.includes(week));
      if (missing.length) add('error', group.item, '原始周次“' + text(group.item.weekText) + '”包含第' + missing.join(',') + '周，解析结果缺失');
      const extra = group.expected.length ? sorted(group.actual).filter(week => !group.expected.includes(week)) : [];
      if (extra.length) add('error', group.item, '解析结果多出了原始周次未安排的第' + extra.join(',') + '周');
    }
    const unique = [...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()];
    return { checkedAt: new Date().toISOString(), count: items.length, meetingCount: groups.size,
      errors: unique.filter(item => item.severity === 'error').length,
      warnings: unique.filter(item => item.severity === 'warning').length, issues: unique };
  }
  function diffSchedules(previous, current) {
    const original = meetings(previous);
    let left = original, right = meetings(current);
    const signature = item => JSON.stringify([meetingKey(item), text(item.name), item.weeks]);
    left = left.filter(item => !right.some(next => signature(next) === signature(item)));
    right = right.filter(item => !original.some(old => signature(old) === signature(item)));
    const changes = [];
    while (left.length) {
      const before = left.shift();
      const candidates = right.map((after, index) => ({ after, index,
        score: (Number(before.weekday) !== Number(after.weekday) ? 4 : 0)
          + (periods(before).join() !== periods(after).join() ? 3 : 0)
          + (text(before.room) !== text(after.room) ? 1 : 0) }))
        .filter(item => courseKey(item.after) === courseKey(before)).sort((a, b) => a.score - b.score);
      if (!candidates.length) { changes.push({ type: 'removed', name: before.name, before: describe(before), after: '' }); continue; }
      const after = right.splice(candidates[0].index, 1)[0];
      const fields = [];
      if (Number(before.weekday) !== Number(after.weekday) || periods(before).join() !== periods(after).join()) fields.push('时间');
      if (text(before.room) !== text(after.room)) fields.push('地点');
      if (before.weeks.join() !== after.weeks.join()) fields.push('周次');
      if (text(before.teacher) !== text(after.teacher)) fields.push('教师');
      if (text(before.name) !== text(after.name)) fields.push('名称');
      changes.push({ type: 'modified', name: after.name, fields, before: describe(before), after: describe(after) });
    }
    right.forEach(after => changes.push({ type: 'added', name: after.name, before: '', after: describe(after) }));
    return changes;
  }
  /** @maintenance
   * 更新按账号、学期隔离的检查与变更历史；异常快照应提示待确认，不能无条件替换可靠基线。
   */
  function updateAudit(existing, schedule, options = {}) {
    schedule = Array.isArray(schedule) ? schedule : [];
    const old = existing || {}, report = validateSchedule(schedule);
    const at = options.at || new Date().toISOString(), semester = text(options.semester), owner = text(options.owner);
    const sameScope = old.semester === semester && old.owner === owner;
    const baseline = sameScope && Array.isArray(old.baseline) ? old.baseline : null;
    if (baseline && baseline.length && !schedule.length) {
      report.errors++;
      report.issues.push({ severity: 'error', name: '本次课表', message: '本次返回空课表，保留上次课表；如已换学期，请确认学期后重新同步' });
    }
    const blocked = Boolean(baseline && baseline.length && report.errors);
    if (baseline && schedule.length && meetings(schedule).length < meetings(baseline).length * 0.6) {
      report.warnings++;
      report.issues.push({ severity: 'warning', name: '课表数量变化', message: '课程安排数量减少超过 40%，请核对变更记录及学校课表' });
    }
    const changes = baseline && !blocked ? diffSchedules(baseline, schedule) : [];
    const history = sameScope ? (old.history || []).slice() : [];
    if (changes.length) history.unshift({ id: at, at, changes, previous: baseline, current: schedule });
    return { owner, semester, stamp: options.stamp || (sameScope ? old.stamp : '') || '', report, blocked,
      baseline: blocked ? baseline : JSON.parse(JSON.stringify(schedule)),
      history: history.slice(0, 10), lastChangedAt: changes.length ? at : sameScope ? old.lastChangedAt || '' : '' };
  }
  function examWindow(exam) {
    const date = text(exam.date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const times = text(exam.time).match(/(\d{1,2})[:：](\d{2})(?:\s*[-~～—至]\s*(\d{1,2})[:：](\d{2}))?/);
    if (!date || !times) return null;
    const [year, month, day] = date.slice(1).map(Number), hour = Number(times[1]), minute = Number(times[2]);
    // School times are Asia/Shanghai, including on servers running in UTC.
    const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (hour > 23 || minute > 59 || local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) return null;
    const start = local.getTime() - 8 * 3600000;
    let end = start + 2 * 60 * 60 * 1000;
    if (times[3] != null) {
      if (Number(times[3]) > 23 || Number(times[4]) > 59) return null;
      end = Date.UTC(year, month - 1, day, Number(times[3]), Number(times[4])) - 8 * 3600000;
      if (end <= start) return null;
    }
    return { start, end };
  }
  function examKey(exam) { return [courseKey(exam), text(exam.date), text(exam.time), text(exam.room), text(exam.seat)].join('|'); }
  function examReminders(exams, now = Date.now()) {
    const map = new Map();
    (exams || []).forEach(exam => {
      const window = examWindow(exam);
      if (!window || window.start <= now) return;
      [1440, 120].forEach(minutes => {
        const notifyAt = window.start - minutes * 60000;
        if (notifyAt <= now + 30000) return;
        const id = examKey(exam) + '|' + minutes;
        map.set(id, { id, name: exam.name, title: '考试：' + exam.name, minutes,
          location: text(exam.room) || '考场待定', seat: text(exam.seat),
          label: minutes === 1440 ? '考前一天' : '考前两小时',
          notifyAt, eventAt: window.start, expiresAt: Math.min(window.start, notifyAt + 3600000),
          body: exam.date + ' ' + exam.time + ' · ' + (exam.room || '考场待定') + (exam.seat ? ' · 座位 ' + exam.seat : '') });
      });
    });
    return [...map.values()].sort((a, b) => a.notifyAt - b.notifyAt);
  }
  function conflicts(exam, exams, courseWindows = []) {
    const target = examWindow(exam);
    if (!target) return [];
    const result = [];
    const overlap = other => target.start < other.end && other.start < target.end;
    (exams || []).forEach(other => {
      const window = examWindow(other);
      if (examKey(other) !== examKey(exam) && window && overlap(window)) result.push('与考试“' + other.name + '”时间冲突');
    });
    courseWindows.forEach(course => { if (overlap(course)) result.push('与课程“' + course.name + '”时间冲突'); });
    return [...new Set(result)];
  }
  return { weeksOf, sourceWeeks, meetings, describe, validateSchedule, diffSchedules, updateAudit, examWindow, examKey, examReminders, conflicts };
});
