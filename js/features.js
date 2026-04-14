/**
 * features.js
 * 七大人性化功能扩展模块
 * 依赖 app.js 中的全局函数（与 app.js 同一 window 环境中运行）
 */

// ─────────────────────────────────────────────────────────────────────────────
// 全局状态扩展
// ─────────────────────────────────────────────────────────────────────────────

const featureState = {
  countdownTimer: null,
  // 成绩预测：key = gradeKey，value = 用户输入的虚拟分数
  predictScores: {},
  // 分数预测列表勾选状态：key = courseKey，value = 是否纳入统计
  predictSelections: {},
  predictVisible: false,
  // 校园网认证
  wifiAuthing: false,
  // 课表背景图
  scheduleBackground: null,
  scheduleBackgroundOpacity: 0.3,
  // 空教室多选节次
  classroomSelectedPeriods: new Set(['3']),
};

let filesystemPlugin = null;
let sharePlugin = null;

function isNativePlatform() {
  const cap = window.capacitorExports || {};
  return Boolean(cap.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNativePlatform?.());
}

function getNativePlugin(name) {
  if (!isNativePlatform()) return null;
  const cap = window.capacitorExports || {};
  const registerPlugin = cap.registerPlugin || window.Capacitor?.registerPlugin;
  if (!registerPlugin) return null;
  try {
    return registerPlugin(name);
  } catch {
    return null;
  }
}

function getFilesystemPlugin() {
  if (filesystemPlugin) return filesystemPlugin;
  filesystemPlugin = getNativePlugin('Filesystem');
  return filesystemPlugin;
}

function getSharePlugin() {
  if (sharePlugin) return sharePlugin;
  sharePlugin = getNativePlugin('Share');
  return sharePlugin;
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 1：ICS 日历导出
// ─────────────────────────────────────────────────────────────────────────────

function formatICSLocalDate(date) {
  const pad = v => String(v).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeICSField(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function generateICSContent() {
  const semesterStart = state.data.meta.semesterStart;
  if (!semesterStart) {
    showToast('请先在设置页填写学期开始日期');
    return null;
  }

  const startDate = new Date(semesterStart);
  if (isNaN(startDate.getTime())) {
    showToast('学期开始日期格式错误，请重新设置');
    return null;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//南理教务助手//NJUST Companion//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:南理课表',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Shanghai',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  const courses = getAllScheduleCourses();
  courses.forEach(course => {
    for (let week = course.startWeek; week <= course.endWeek; week++) {
      if (course.oddEven === '单' && week % 2 === 0) continue;
      if (course.oddEven === '双' && week % 2 !== 0) continue;

      const dayOffset = (week - 1) * 7 + (course.weekday - 1);
      const courseDate = new Date(startDate.getTime() + dayOffset * 86400000);

      const range = getPeriodRange(course.periods);
      if (!range.start || !range.end) continue;

      const [startH, startM] = range.start.split(':').map(Number);
      const [endH, endM] = range.end.split(':').map(Number);

      const dtStart = new Date(courseDate);
      dtStart.setHours(startH, startM, 0, 0);
      const dtEnd = new Date(courseDate);
      dtEnd.setHours(endH, endM, 0, 0);

      const uid = `course-${hashString(course.id || course.name)}-w${week}-d${course.weekday}@njust-companion`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;TZID=Asia/Shanghai:${formatICSLocalDate(dtStart)}`,
        `DTEND;TZID=Asia/Shanghai:${formatICSLocalDate(dtEnd)}`,
        `SUMMARY:${escapeICSField(course.name)}`,
        `LOCATION:${escapeICSField(course.room || '')}`,
        `DESCRIPTION:${escapeICSField(`教师：${course.teacher || '未标注'}\n周次：第${week}周\n节次：${getPeriodText(course.periods)}`)}`,
        `CATEGORIES:课程`,
        'END:VEVENT'
      );
    }
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function exportToICS() {
  const courses = getAllScheduleCourses();
  if (courses.length === 0) {
    showToast('暂无课程数据，请先同步课表');
    return;
  }

  const icsContent = generateICSContent();
  if (!icsContent) return;

  if (isNativePlatform()) {
    void exportICSNative(icsContent);
    return;
  }

  exportICSWeb(icsContent);
}

async function exportICSNative(icsContent) {
  const Filesystem = getFilesystemPlugin();
  const Share = getSharePlugin();
  if (!Filesystem) {
    exportICSWeb(icsContent);
    return;
  }

  const fileName = `njust-schedule-${formatDateKey(new Date())}.ics`;
  try {
    await Filesystem.writeFile({
      path: fileName,
      data: icsContent,
      directory: 'CACHE',
      encoding: 'utf8',
      recursive: true
    });
    const fileInfo = await Filesystem.getUri({
      path: fileName,
      directory: 'CACHE'
    });
    const fileUri = fileInfo?.uri || '';
    if (!fileUri) throw new Error('未能获取导出文件路径');

    if (Share?.share) {
      try {
        await Share.share({
          title: '南理课表',
          text: '课表 ICS 文件，可导入系统日历',
          url: fileUri,
          files: [fileUri],
          dialogTitle: '导出课表日历'
        });
      } catch {
        // 分享面板被取消时，文件仍然已写入缓存目录
      }
    }

    showToast('ICS 已保存，可通过系统分享导入日历');
  } catch (error) {
    exportICSWeb(icsContent);
    if (error?.message) {
      showToast(`原生导出失败，已切换网页下载：${error.message}`);
    }
  }
}

function exportICSWeb(icsContent) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'njust-schedule.ics';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('ICS 文件已导出');
  openICSHelpModal();
}

function openICSHelpModal() {
  const modal = document.getElementById('ics-help-modal');
  if (modal) modal.classList.add('open');
}

function closeICSHelpModal() {
  const modal = document.getElementById('ics-help-modal');
  if (modal) modal.classList.remove('open');
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 2：学期&考试倒计时进度条
// ─────────────────────────────────────────────────────────────────────────────

function renderCountdownBanner() {
  const banner = document.getElementById('semester-countdown-bar');
  if (!banner) return;

  const semesterStart = state.data.meta.semesterStart;
  const now = new Date();

  // 找最近的考试
  const upcomingExam = [...(state.data.exams || [])]
    .map(exam => ({ ...exam, countdown: calcExamCountdown(exam.date) }))
    .filter(exam => exam.countdown !== null && exam.countdown >= 0)
    .sort((a, b) => a.countdown - b.countdown)[0] || null;

  if (!semesterStart && !upcomingExam) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;

  let semesterHtml = '';
  if (semesterStart) {
    const startDate = new Date(semesterStart);
    const daysPassed = Math.max(0, Math.floor((now - startDate) / 86400000));
    const totalDays = 112; // ~16 weeks
    const progress = Math.min(100, Math.round((daysPassed / totalDays) * 100));
    const weeksPassed = Math.floor(daysPassed / 7) + 1;

    semesterHtml = `
      <div class="countdown-item">
        <div class="countdown-label">本学期</div>
        <div class="countdown-bar-track">
          <div class="countdown-bar-fill" style="width:${progress}%"></div>
        </div>
        <div class="countdown-value">已过第 ${weeksPassed} 周</div>
      </div>
    `;
  }

  let examHtml = '';
  if (upcomingExam) {
    const d = upcomingExam.countdown;
    const urgency = d <= 3 ? 'urgent' : d <= 7 ? 'warn' : 'normal';
    examHtml = `
      <div class="countdown-item exam ${urgency}">
        <div class="countdown-label">${upcomingExam.name}</div>
        <div class="countdown-value exam-countdown">${d === 0 ? '📢 今天考试！' : `⏳ 还有 ${d} 天`}</div>
      </div>
    `;
  }

  banner.innerHTML = `
    <div class="countdown-shell">
      ${semesterHtml}
      ${examHtml}
    </div>
  `;
}

function startCountdownTimer() {
  if (featureState.countdownTimer) clearInterval(featureState.countdownTimer);
  renderCountdownBanner();
  featureState.countdownTimer = setInterval(() => {
    if (state.currentPage === 'home') renderCountdownBanner();
  }, 60000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 3：绩点/分数预测计算器
// ─────────────────────────────────────────────────────────────────────────────

function getPredictCourseKey(course) {
  if (!course || typeof course !== 'object') return '';
  if (course.isCustom && course.id) return `custom:${course.id}`;
  const periodKey = sortPeriodsByDisplay(course.periods).join('-');
  return [
    `semester:${cleanText(course.semester || state.data.meta.semester || '')}`,
    `name:${normalizeCourseMatchName(course.name)}`,
    `code:${cleanText(course.code)}`,
    `weekday:${Number(course.weekday) || ''}`,
    `periods:${periodKey}`,
    `weeks:${Number(course.startWeek) || ''}-${Number(course.endWeek) || ''}`,
    `oddEven:${cleanText(course.oddEven)}`
  ].join('|');
}

function findPredictRelatedGrade(courseName, preferredSemester = state.data.meta.semester) {
  const key = normalizeCourseMatchName(courseName);
  if (!key) return null;

  const matches = state.data.grades.filter(grade => normalizeCourseMatchName(grade.name) === key);
  const scopedMatches = preferredSemester
    ? matches.filter(grade => grade.semester === preferredSemester)
    : matches;

  if (!scopedMatches.length) return null;

  return scopedMatches.sort((left, right) => {
    const rightScored = typeof right.score === 'number' ? 1 : 0;
    const leftScored = typeof left.score === 'number' ? 1 : 0;
    if (rightScored !== leftScored) return rightScored - leftScored;
    if ((right.credit || 0) !== (left.credit || 0)) return (right.credit || 0) - (left.credit || 0);
    return (right.semester || '').localeCompare(left.semester || '');
  })[0] || null;
}

function getPredictStoredScore(courseKey, fallbackKey) {
  if (featureState.predictScores[courseKey] !== undefined) return featureState.predictScores[courseKey];
  if (fallbackKey && featureState.predictScores[fallbackKey] !== undefined) return featureState.predictScores[fallbackKey];
  return undefined;
}

function getPredictCourseRows() {
  const currentSemester = cleanText(state.data.meta.semester);
  const allCourses = getAllScheduleCourses().filter(course => course && cleanText(course.name));
  const semesterCourses = currentSemester
    ? allCourses.filter(course => {
        const courseSemester = cleanText(course.semester);
        return !courseSemester || courseSemester === currentSemester;
      })
    : allCourses.slice();

  const sourceCourses = semesterCourses.length ? semesterCourses : allCourses;
  const scheduleRows = sourceCourses.map(course => {
    const relatedGrade = currentSemester
      ? findPredictRelatedGrade(course.name, currentSemester)
      : findRelatedGrade(course.name);
    const courseKey = getPredictCourseKey(course);
    const gradeKey = relatedGrade ? getGradeKey(relatedGrade) : '';
    const storedScore = getPredictStoredScore(courseKey, gradeKey);
    const hasManualPrediction = storedScore !== undefined && storedScore !== '';
    const actualScore = relatedGrade ? getGradeNumericScore(relatedGrade) : null;
    const credit = Number.isFinite(course.credit) && course.credit > 0
      ? course.credit
      : (relatedGrade?.credit || 0);

    return {
      source: 'schedule',
      course,
      grade: relatedGrade,
      key: courseKey,
      fallbackKey: gradeKey,
      credit,
      actualScore,
      hasManualPrediction,
      inputValue: hasManualPrediction
        ? String(storedScore)
        : (Number.isFinite(actualScore) ? String(actualScore) : ''),
      selected: featureState.predictSelections[courseKey] !== false,
      scoreForStats: hasManualPrediction
        ? Number(storedScore)
        : actualScore
    };
  });

  if (scheduleRows.length) {
    return scheduleRows.sort((left, right) => {
      const leftWeekday = Number(left.course.weekday) || 0;
      const rightWeekday = Number(right.course.weekday) || 0;
      if (leftWeekday !== rightWeekday) return leftWeekday - rightWeekday;
      const leftPeriod = getPeriodPosition(left.course.periods?.[0] || 1);
      const rightPeriod = getPeriodPosition(right.course.periods?.[0] || 1);
      if (leftPeriod !== rightPeriod) return leftPeriod - rightPeriod;
      return left.course.name.localeCompare(right.course.name, 'zh-CN');
    });
  }

  return state.data.grades
    .filter(grade => grade && cleanText(grade.name) && (grade.credit || 0) > 0)
    .map(grade => {
      const courseKey = `grade:${getGradeKey(grade)}`;
      const storedScore = getPredictStoredScore(courseKey, getGradeKey(grade));
      const hasManualPrediction = storedScore !== undefined && storedScore !== '';
      const actualScore = getGradeNumericScore(grade);
      return {
        source: 'grade',
        course: grade,
        grade,
        key: courseKey,
        fallbackKey: getGradeKey(grade),
        credit: grade.credit || 0,
        actualScore,
        hasManualPrediction,
        inputValue: hasManualPrediction
          ? String(storedScore)
          : (Number.isFinite(actualScore) ? String(actualScore) : ''),
        selected: featureState.predictSelections[courseKey] !== false,
        scoreForStats: hasManualPrediction
          ? Number(storedScore)
          : actualScore
      };
    })
    .sort((left, right) => left.course.name.localeCompare(right.course.name, 'zh-CN'));
}

function getPredictHistoryRows() {
  const currentSemester = cleanText(state.data.meta.semester);
  return state.data.grades
    .filter(grade => grade && cleanText(grade.name) && (grade.credit || 0) > 0)
    .filter(grade => {
      if (!currentSemester) return Boolean(grade.semester);
      return grade.semester && grade.semester !== currentSemester;
    })
    .filter(grade => Number.isFinite(getGradeNumericScore(grade)))
    .map(grade => ({
      source: 'history',
      course: grade,
      grade,
      key: `history:${getGradeKey(grade)}`,
      credit: grade.credit || 0,
      actualScore: getGradeNumericScore(grade),
      hasManualPrediction: false,
      inputValue: '',
      selected: true,
      fixed: true,
      scoreForStats: getGradeNumericScore(grade)
    }))
    .sort((left, right) => {
      const semesterCompare = (right.course.semester || '').localeCompare(left.course.semester || '');
      if (semesterCompare !== 0) return semesterCompare;
      return left.course.name.localeCompare(right.course.name, 'zh-CN');
    });
}

function setPredictScore(gradeKey, value) {
  const numVal = parseFloat(value);
  if (isNaN(numVal)) {
    delete featureState.predictScores[gradeKey];
  } else {
    featureState.predictScores[gradeKey] = Math.max(0, Math.min(100, numVal));
  }
  updatePredictStats();
}

function setPredictSelection(courseKey, checked) {
  featureState.predictSelections[courseKey] = Boolean(checked);
  updatePredictStats();
}

function updatePredictStats() {
  const panel = document.getElementById('predict-stats-panel');
  if (!panel) return;

  const historyRows = getPredictHistoryRows();
  const rows = getPredictCourseRows();
  const historyGrades = historyRows.map(row => ({
    name: row.course.name,
    credit: row.credit,
    score: row.scoreForStats,
    scoreText: '',
    gpa: null,
    attribute: row.course.attribute || row.grade?.attribute || '',
    category: row.course.category || row.grade?.category || '',
    type: row.course.type || row.grade?.type || ''
  }));
  const currentGrades = rows.map(row => ({
    name: row.course.name,
    credit: row.credit,
    score: row.scoreForStats,
    scoreText: '',
    gpa: null,
    attribute: row.course.attribute || row.grade?.attribute || '',
    category: row.course.category || row.grade?.category || '',
    type: row.course.type || row.grade?.type || ''
  }));

  const allStats = computeGradeStats([...historyGrades, ...currentGrades]);
  const selectedCurrent = currentGrades.filter((_, index) => rows[index].selected);
  const selStats = computeGradeStats([...historyGrades, ...selectedCurrent]);
  const historyStats = computeGradeStats(historyGrades);
  const currentStats = computeGradeStats(currentGrades);

  panel.innerHTML = `
    <div class="predict-stats-row">
      <span>历史成绩（固定）</span>
      <strong>${formatStatValue(historyStats.gpa, 3)}</strong>
    </div>
    <div class="predict-stats-row">
      <span>本学期预测（全部）</span>
      <strong>${formatStatValue(currentStats.gpa, 3)}</strong>
    </div>
    <div class="predict-stats-row">
      <span>总预测加权均分（全部）</span>
      <strong>${formatStatValue(allStats.weightedAverage, 2)}</strong>
    </div>
    <div class="predict-stats-row">
      <span>总预测 GPA（全部）</span>
      <strong>${formatStatValue(allStats.gpa, 3)}</strong>
    </div>
    <div class="predict-stats-row">
      <span>总预测加权均分（勾选）</span>
      <strong>${formatStatValue(selStats.weightedAverage, 2)}</strong>
    </div>
    <div class="predict-stats-row">
      <span>总预测 GPA（勾选）</span>
      <strong>${formatStatValue(selStats.gpa, 3)}</strong>
    </div>
  `;
}

function togglePredictPanel() {
  featureState.predictVisible = !featureState.predictVisible;
  renderPredictPanel();
}

function renderPredictPanel() {
  const container = document.getElementById('predict-panel-container');
  if (!container) return;

  if (!featureState.predictVisible) {
    container.innerHTML = `
      <div class="card predict-toggle-card">
        <button class="btn btn-outline btn-sm" onclick="togglePredictPanel()">🔮 展开分数预测器</button>
      </div>
    `;
    return;
  }

  const historyRows = getPredictHistoryRows();
  const rows = getPredictCourseRows();
  const renderRows = rows.map(row => {
    const inputValue = row.inputValue;
    const numericScore = inputValue === '' ? null : Number(inputValue);
    const effectiveScore = Number.isFinite(numericScore) ? numericScore : null;
    const gpaLabel = Number.isFinite(effectiveScore)
      ? `${row.hasManualPrediction ? '预测' : row.actualScore !== null ? '实际' : ''} GPA ${scoreToGpa(effectiveScore)}`
      : '';
    const metaParts = [];
    if (row.source === 'schedule') {
      const weekday = WEEKDAY_NAMES[Number(row.course.weekday) || 0] || '';
      const periodText = getPeriodText(row.course.periods);
      if (weekday) metaParts.push(weekday);
      if (periodText) metaParts.push(periodText);
      if (row.course.room) metaParts.push(row.course.room);
    } else if (row.course.semester) {
      metaParts.push(formatSemesterLabel(row.course.semester));
    }
    if (row.credit > 0) metaParts.push(`${formatCreditValue(row.credit)} 学分`);
    if (row.grade && row.grade.code) metaParts.push(row.grade.code);

    const rowClass = row.actualScore === null && !row.hasManualPrediction ? 'predict-row unpublished' : 'predict-row';
    return `
      <div class="${rowClass}">
        <label class="predict-select-cell">
          <input
            class="predict-checkbox"
            type="checkbox"
            ${row.selected ? 'checked' : ''}
            onchange="setPredictSelection('${escapeJsString(row.key)}', this.checked)"
          >
        </label>
        <div class="predict-course-main">
          <div class="predict-course-name">${escapeHtml(row.course.name)}</div>
          <div class="predict-course-meta">${escapeHtml(metaParts.join(' · ') || '本学期课程')}</div>
        </div>
        <div class="predict-inputs">
          <input
            class="predict-input"
            type="number" min="0" max="100" step="0.5"
            placeholder="预期分数"
            value="${escapeHtml(inputValue)}"
            onchange="setPredictScore('${escapeJsString(row.key)}', this.value)"
            oninput="setPredictScore('${escapeJsString(row.key)}', this.value)"
          >
          <span class="predict-real">${gpaLabel}</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="card predict-panel">
      <div class="predict-panel-header">
        <span>🔮 分数预测器 <small>（${rows.length} 门本学期课程 + ${historyRows.length} 门历史成绩）</small></span>
        <button class="btn btn-soft btn-sm" onclick="togglePredictPanel()">收起</button>
      </div>
      <div class="predict-history-hint">历史成绩会自动参与总绩点计算，本学期课程可继续输入预测分数。</div>
      <div class="predict-panel-body">
        ${renderRows.length === 0
          ? '<div class="course-detail-empty" style="padding:16px;">🎉 当前没有可用于预测的本学期课程，请先同步课表。</div>'
          : renderRows.join('')}
      </div>
      <div id="predict-stats-panel" class="predict-stats-panel"></div>
    </div>
  `;
  updatePredictStats();
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 4：校园网一键认证
// ─────────────────────────────────────────────────────────────────────────────

const NJUST_WIFI_AUTH_URL = 'http://m.njust.edu.cn/portal/index.html';

async function authenticateWifi() {
  if (featureState.wifiAuthing) return;

  // 校园网账号与教务账号完全独立，不预填
  const username = (document.getElementById('wifi-username')?.value || '').trim();
  const password = (document.getElementById('wifi-password')?.value || '').trim();

  featureState.wifiAuthing = true;
  renderWifiAuthStatus('正在打开校园网认证页面...');

  try {
    showToast('正在打开校园网认证页...');
    window.open(NJUST_WIFI_AUTH_URL, '_blank');
    const hint = username ? `账号：${username} · 请在页面中手动填写密码` : '请在认证页面中填写校园网账号和密码';
    renderWifiAuthStatus(hint);
  } catch (error) {
    renderWifiAuthStatus(`打开失败：${error.message || '未知错误'}`);
    showToast('无法打开认证页，请手动访问 m.njust.edu.cn');
  } finally {
    featureState.wifiAuthing = false;
  }
}

function openWifiAuthPage() {
  window.open(NJUST_WIFI_AUTH_URL, '_blank');
  showToast('已打开校园网认证入口');
}

function renderWifiAuthStatus(text) {
  const el = document.getElementById('wifi-auth-status');
  if (el) el.textContent = text;
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 5：空教室节次多选 + 自习室智能推荐
// ─────────────────────────────────────────────────────────────────────────────

function toggleClassroomPeriod(periodKey) {
  if (featureState.classroomSelectedPeriods.has(periodKey)) {
    if (featureState.classroomSelectedPeriods.size === 1) {
      showToast('请至少保留一个节次');
      return;
    }
    featureState.classroomSelectedPeriods.delete(periodKey);
  } else {
    featureState.classroomSelectedPeriods.add(periodKey);
  }
  state.classrooms.result = null;
  state.classrooms.error = '';
  renderClassrooms();
}

function buildMultiPeriodChips() {
  return CLASSROOM_PERIOD_GROUPS.map(group => {
    const selected = featureState.classroomSelectedPeriods.has(group.key);
    return `
      <button
        class="filter-chip ${selected ? 'active' : ''}"
        onclick="toggleClassroomPeriod('${group.key}')"
        title="${group.name}"
      >
        ${escapeHtml(group.label)}
      </button>
    `;
  }).join('');
}

function getClassroomRoomKey(room) {
  return normalizeCourseMatchName(cleanText(room?.name || room?.label || room?.room || room?.id || ''));
}

function getClassroomGroupIndex(key) {
  return CLASSROOM_PERIOD_GROUPS.findIndex(item => item.key === String(key));
}

function getClassroomAnalysisGroups(selectedGroups) {
  if (!Array.isArray(selectedGroups) || !selectedGroups.length) return [];
  const indexes = selectedGroups
    .map(group => getClassroomGroupIndex(group.key))
    .filter(index => index >= 0);
  if (!indexes.length) return selectedGroups;
  const start = Math.max(0, Math.min(...indexes) - 1);
  const end = Math.min(CLASSROOM_PERIOD_GROUPS.length - 1, Math.max(...indexes) + 1);
  return CLASSROOM_PERIOD_GROUPS.slice(start, end + 1);
}

function buildClassroomSnapshot(group, payload) {
  const result = payload?.result || payload?.data || payload || {};
  const rooms = Array.isArray(result.rooms) ? result.rooms : [];
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const freeSet = new Set(rooms.map(room => getClassroomRoomKey(room)).filter(Boolean));
  return {
    group,
    result,
    rows,
    freeSet
  };
}

function mergeClassroomFreeRooms(baseRooms, nextRooms) {
  const nextMap = new Map();
  (Array.isArray(nextRooms) ? nextRooms : []).forEach(room => {
    const key = getClassroomRoomKey(room);
    if (key) nextMap.set(key, room);
  });
  return (Array.isArray(baseRooms) ? baseRooms : []).filter(room => nextMap.has(getClassroomRoomKey(room)));
}

function longestTrueRun(flags) {
  let best = 0;
  let current = 0;
  flags.forEach(flag => {
    if (flag) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  });
  return best;
}

function scoreQuietnessFromSnapshot(snapshot, roomKey) {
  const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
  const index = rows.findIndex(row => getClassroomRoomKey(row) === roomKey);
  if (index < 0) return 6;

  const neighbors = [rows[index - 1], rows[index + 1]].filter(Boolean);
  if (!neighbors.length) return 6;

  const freeNeighbors = neighbors.filter(row => (row.markers || []).length === 0).length;
  return Number((4 + (freeNeighbors / neighbors.length) * 6).toFixed(1));
}

function scoreClassroomCandidate(room, snapshots, selectedGroups, analysisGroups) {
  const roomKey = getClassroomRoomKey(room);
  if (!roomKey) return null;

  const selectedFlags = selectedGroups.map(group => snapshots.get(group.key)?.freeSet?.has(roomKey) || false);
  if (selectedFlags.length && selectedFlags.some(flag => !flag)) return null;

  const analysisFlags = analysisGroups.map(group => snapshots.get(group.key)?.freeSet?.has(roomKey) || false);
  const freeRun = longestTrueRun(analysisFlags);
  const quietnessScores = selectedGroups.length
    ? selectedGroups.map(group => scoreQuietnessFromSnapshot(snapshots.get(group.key), roomKey))
    : [6];
  const quietness = Number((quietnessScores.reduce((sum, value) => sum + value, 0) / quietnessScores.length).toFixed(1));
  const score = Number((freeRun * 10 + quietness).toFixed(2));

  return {
    room,
    roomKey,
    freeRun,
    quietness,
    score
  };
}

function buildClassroomRecommendations(candidateRooms, snapshots, selectedGroups, analysisGroups) {
  const scored = (Array.isArray(candidateRooms) ? candidateRooms : [])
    .map(room => scoreClassroomCandidate(room, snapshots, selectedGroups, analysisGroups))
    .filter(Boolean)
    .sort((left, right) =>
      right.score - left.score
      || right.freeRun - left.freeRun
      || right.quietness - left.quietness
      || cleanText(left.room?.name || left.room?.label || '').localeCompare(cleanText(right.room?.name || right.room?.label || ''), 'zh-CN')
    );

  const preferred = scored.filter(item => item.freeRun >= 2);
  const items = preferred.length ? preferred.slice(0, 5) : scored.slice(0, 5);
  return {
    items,
    fallback: preferred.length === 0,
    note: preferred.length
      ? '优先推荐连续空闲 2 大节以上、且邻近教室更安静的房间。'
      : '当前没有找到连续空闲 2 大节以上的教室，下面按安静度给出次优选择。'
  };
}

async function queryClassroomsMulti() {
  if (!state.server.available) {
    showToast('请先启动同步服务或使用安卓安装包');
    return;
  }
  if (!state.server.loggedIn) {
    showToast('请先登录教务系统');
    return;
  }

  try {
    await ensureClassroomOptions();
  } catch {
    return;
  }

  if (!state.classrooms.building) {
    showToast('请先选择楼栋');
    return;
  }

  const selectedGroups = CLASSROOM_PERIOD_GROUPS.filter(g => featureState.classroomSelectedPeriods.has(g.key));
  if (selectedGroups.length === 0) {
    showToast('请至少选择一个节次');
    return;
  }

  const meta = getClassroomQueryMeta();
  const periodLabel = selectedGroups.map(g => g.name).join('、');
  const analysisGroups = getClassroomAnalysisGroups(selectedGroups);

  state.classrooms.querying = true;
  state.classrooms.error = '';
  renderClassrooms();

  try {
    const snapshots = new Map();
    const queryPayloads = await Promise.all(analysisGroups.map(group => apiRequest('/api/classrooms/query', {
      method: 'POST',
      body: JSON.stringify({
        semester: state.classrooms.semester || state.data.meta.semester || '',
        campus: state.classrooms.campus,
        building: state.classrooms.building,
        week: meta.week,
        weekday: meta.weekday,
        startPeriodCode: group.startCode,
        endPeriodCode: group.endCode,
        dayLabel: `${meta.weekdayLabel} ${meta.dateLabel}`,
        periodLabel: group.name
      })
    }).then(payload => ({ group, payload }))));

    queryPayloads.forEach(({ group, payload }) => {
      snapshots.set(group.key, buildClassroomSnapshot(group, payload));
    });

    const selectedSnapshots = selectedGroups
      .map(group => snapshots.get(group.key))
      .filter(Boolean);
    const firstResult = selectedSnapshots[0]?.result || snapshots.get(selectedGroups[0].key)?.result || {};
    let mergedRooms = selectedSnapshots.length ? (selectedSnapshots[0]?.result?.rooms || []) : [];
    for (const snapshot of selectedSnapshots.slice(1)) {
      mergedRooms = mergeClassroomFreeRooms(mergedRooms, snapshot.result?.rooms || []);
    }
    const freeRooms = Array.isArray(mergedRooms) ? mergedRooms : [];

    state.classrooms.querying = false;
    state.classrooms.updatedAt = new Date().toISOString();
    const scoredRooms = freeRooms
      .map(room => scoreClassroomCandidate(room, snapshots, selectedGroups, analysisGroups))
      .filter(Boolean)
      .sort((left, right) =>
      (right.score || 0) - (left.score || 0)
      || (right.freeRun || 0) - (left.freeRun || 0)
      || (right.quietness || 0) - (left.quietness || 0)
      || cleanText(left.room?.name || left.room?.label || '').localeCompare(cleanText(right.room?.name || right.room?.label || ''), 'zh-CN')
    );
    const recommendations = buildClassroomRecommendations(scoredRooms.map(item => item.room), snapshots, selectedGroups, analysisGroups);
    const totalRooms = Number(firstResult?.totalRooms || freeRooms.length);
    const busyCount = Number.isFinite(totalRooms) ? Math.max(0, totalRooms - freeRooms.length) : 0;
    state.classrooms.result = {
      ...(firstResult || {}),
      semester: firstResult?.semester || state.classrooms.semester || state.data.meta.semester || '',
      campus: state.classrooms.campus,
      building: state.classrooms.building,
      week: meta.week,
      weekday: meta.weekday,
      weekdayLabel: meta.weekdayLabel,
      periodLabel,
      selectedPeriods: selectedGroups.map(group => group.key),
      selectedPeriodNames: selectedGroups.map(group => group.name),
      totalRooms,
      busyCount,
      freeCount: freeRooms.length,
      rooms: scoredRooms,
      rows: firstResult?.rows || [],
      recommendations: recommendations.items,
      recommendationNote: recommendations.note
    };
    renderClassrooms();
  } catch (error) {
    state.classrooms.querying = false;
    state.classrooms.error = error.message || '空闲教室查询失败';
    state.classrooms.result = null;
    renderClassrooms();
    showToast(state.classrooms.error);
  }
}

function renderStudyRecommendations(result) {
  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
  if (!recommendations.length) return '';

  const items = recommendations.map(item => `
    <div class="study-rec-item">
      <span class="study-rec-room">${escapeHtml(item.room?.name || item.room?.room || item.room?.id || '教室')}</span>
      <span class="study-rec-cap">连续空闲 ${escapeHtml(String(item.freeRun))} 大节</span>
      <span class="study-rec-tag ${item.quietness >= 7 ? 'large' : 'medium'}">
        静度 ${escapeHtml(String(item.quietness.toFixed ? item.quietness.toFixed(1) : item.quietness))}
      </span>
    </div>
  `).join('');

  return `
    <div class="study-rec-card card">
      <div class="study-rec-title">⭐ 推荐自习室</div>
      <div class="study-rec-note">${escapeHtml(result?.recommendationNote || '优先推荐连续空闲 2 大节以上、且邻近教室更安静的房间。')}</div>
      <div class="study-rec-list">${items}</div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 6：课程关联待办
// ─────────────────────────────────────────────────────────────────────────────

function getLinkedTodosForCourse(courseName) {
  const target = normalizeCourseMatchName(courseName);
  return (state.todos || []).filter(todo => normalizeCourseMatchName(todo.linkedCourseName) === target);
}

function openTodoLinkedToCourse(courseName) {
  if (typeof closeScheduleDetail === 'function') closeScheduleDetail();
  openTodoModal(null, courseName);
}

function buildCourseLinkedTodosHtml(courseName) {
  const todos = getLinkedTodosForCourse(courseName);

  const todoItems = todos.map(todo => `
    <div class="linked-todo-row ${todo.done ? 'done' : ''}">
      <span class="linked-todo-title">${escapeHtml(todo.title)}</span>
      <span class="linked-todo-due">${escapeHtml(formatTodoDueText(todo))}</span>
    </div>
  `).join('');

  return `
    <div class="course-detail-section">
      <div class="course-detail-section-title">
        📋 关联待办
        <button class="inline-link-btn" onclick="openTodoLinkedToCourse('${escapeJsString(courseName)}')">+ 新建关联待办</button>
      </div>
      ${todos.length > 0
        ? `<div class="linked-todos-list">${todoItems}</div>`
        : '<div class="course-detail-empty">还没有关联这门课的待办事项</div>'
      }
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 功能 7：课表分享长图（自定义背景）
// ─────────────────────────────────────────────────────────────────────────────

async function loadHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error('html2canvas 加载失败，请检查网络连接'));
    document.head.appendChild(script);
  });
}

function openScheduleBgModal() {
  const modal = document.getElementById('schedule-bg-modal');
  if (modal) modal.classList.add('open');
}

function closeScheduleBgModal() {
  const modal = document.getElementById('schedule-bg-modal');
  if (modal) modal.classList.remove('open');
}

function selectScheduleBg(type) {
  if (type === 'none') {
    featureState.scheduleBackground = null;
    featureState.scheduleBackgroundOpacity = 0.65;
    const slider = document.getElementById('schedule-page-bg-opacity');
    if (slider) slider.value = featureState.scheduleBackgroundOpacity;
  } else if (type === 'upload') {
    document.getElementById('schedule-bg-upload')?.click();
  }
  applyScheduleBoardBackground();
  saveScheduleBgPersist();
  updateScheduleBgPreview();
}

// 将背景图应用到课表网格区域（局部应用，非全局页面）
function applyScheduleBoardBackground() {
  const board = document.getElementById('schedule-board');
  const card = board?.querySelector('.schedule-board-card');
  const layer = board?.querySelector('.schedule-bg-layer');
  if (!board || !card || !layer) return;

  board.style.backgroundImage = '';
  board.style.removeProperty('--schedule-bg-mask-opacity');
  
  if (featureState.scheduleBackground) {
    const imageStrength = Math.max(0.05, Math.min(0.95, Number(featureState.scheduleBackgroundOpacity) || 0.65));
    const maskOpacity = Math.max(0.05, Math.min(0.95, 1 - imageStrength));
    card.classList.add('has-custom-bg');
    card.style.setProperty('--schedule-bg-image', `url("${featureState.scheduleBackground}")`);
    card.style.setProperty('--schedule-bg-mask-opacity', String(maskOpacity));
    layer.style.backgroundImage = `url("${featureState.scheduleBackground}")`;
    
    // 同步更新弹窗内的预览区（如有）
    const previewInner = document.querySelector('.schedule-bg-preview-inner');
    if (previewInner) {
      previewInner.style.backgroundImage = `url("${featureState.scheduleBackground}")`;
      previewInner.style.setProperty('--schedule-bg-mask-opacity', String(maskOpacity));
    }
  } else {
    card.classList.remove('has-custom-bg');
    card.style.removeProperty('--schedule-bg-image');
    card.style.setProperty('--schedule-bg-mask-opacity', '0');
    layer.style.backgroundImage = '';
    const previewInner = document.querySelector('.schedule-bg-preview-inner');
    if (previewInner) {
      previewInner.style.backgroundImage = '';
      previewInner.style.setProperty('--schedule-bg-mask-opacity', '0');
    }
  }
}

function updateScheduleBgPreview() {
  const preview = document.getElementById('schedule-bg-preview');
  const previewInner = preview?.querySelector('.schedule-bg-preview-inner');
  if (!preview) return;
  if (featureState.scheduleBackground) {
    if (previewInner) {
      previewInner.style.backgroundImage = `url("${featureState.scheduleBackground}")`;
    }
    preview.classList.add('has-bg');
  } else {
    if (previewInner) previewInner.style.backgroundImage = '';
    preview.classList.remove('has-bg');
  }
  const label = document.getElementById('bg-opacity-value');
  if (label) label.textContent = Math.round((featureState.scheduleBackgroundOpacity || 0.65) * 100) + '%';
}

function setScheduleBgOpacity(value) {
  // value 是正向“图片深浅”：数值越大，图片越清晰；只改变背景层，不改变课表/课程透明度。
  featureState.scheduleBackgroundOpacity = Math.max(0.05, Math.min(0.95, parseFloat(value) || 0.65));
  applyScheduleBoardBackground();
  
  // 更新百分比显示
  const label = document.getElementById('bg-opacity-value');
  if (label) label.textContent = Math.round(featureState.scheduleBackgroundOpacity * 100) + '%';
  
  saveScheduleBgPersist();
}

function handleScheduleBgUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    featureState.scheduleBackground = e.target.result;
    // 默认给一个较高的图片可见度
    featureState.scheduleBackgroundOpacity = 0.65;
    const slider = document.getElementById('schedule-page-bg-opacity');
    if (slider) slider.value = 0.65;
    
    applyScheduleBoardBackground();
    saveScheduleBgPersist();
    updateScheduleBgPreview();
    showToast('课表壁纸上传成功！');
  };
  reader.readAsDataURL(file);
}

function clearSchedulePageBg() {
  featureState.scheduleBackground = null;
  featureState.scheduleBackgroundOpacity = 0.65;
  const slider = document.getElementById('schedule-page-bg-opacity');
  if (slider) slider.value = 0.65;
  applyScheduleBoardBackground();
  saveScheduleBgPersist();
  updateScheduleBgPreview();
  showToast('课表背景已清除');
}

async function generateShareImage() {
  const board = document.getElementById('schedule-board');
  if (!board) {
    showToast('找不到课表区域');
    return;
  }

  if (!hasScheduleCourses()) {
    showToast('请先同步课表');
    return;
  }

  showToast('正在生成分享图，请稍候...');

  const prevMode = state.scheduleViewMode;
  let captureHost = null;
  try {
    const html2canvas = await loadHtml2Canvas();
    if (prevMode !== 'week') {
      state.scheduleViewMode = 'week';
      renderSchedule();
      await new Promise(r => setTimeout(r, 300));
    }
    applyScheduleBoardBackground();
    await new Promise(r => requestAnimationFrame(r));
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore font readiness failure
      }
    }

    const captureSource = board.querySelector('.schedule-board-card');
    if (!captureSource) {
      throw new Error('找不到课表内容');
    }

    captureHost = document.createElement('div');
    captureHost.style.position = 'fixed';
    captureHost.style.left = '-100000px';
    captureHost.style.top = '0';
    captureHost.style.zIndex = '-1';
    captureHost.style.padding = '0';
    captureHost.style.margin = '0';
    captureHost.style.background = 'transparent';
    captureHost.dataset.shareCaptureHost = '1';

    const captureNode = captureSource.cloneNode(true);
    const boardWidth = Math.max(Math.ceil(captureSource.getBoundingClientRect().width), 320);
    captureNode.style.width = `${boardWidth}px`;
    captureNode.style.maxWidth = 'none';
    captureNode.style.margin = '0';

    const scrollNode = captureNode.querySelector('.schedule-board-scroll');
    if (scrollNode) {
      scrollNode.style.maxHeight = 'none';
      scrollNode.style.height = 'auto';
      scrollNode.style.overflow = 'visible';
      scrollNode.style.overflowY = 'visible';
      scrollNode.style.overflowX = 'visible';
    }

    const boardNode = captureNode.querySelector('.schedule-board');
    if (boardNode) {
      boardNode.style.height = 'auto';
      boardNode.style.maxHeight = 'none';
      boardNode.style.overflow = 'visible';
    }

    captureHost.appendChild(captureNode);
    document.body.appendChild(captureHost);
    await new Promise(r => requestAnimationFrame(r));

    const captureWidth = Math.ceil(captureNode.scrollWidth || captureNode.getBoundingClientRect().width || boardWidth);
    const captureHeight = Math.ceil(captureNode.scrollHeight || captureNode.getBoundingClientRect().height);

    const canvas = await html2canvas(captureNode, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0
    });

    // 生成预览
    const imgDataUrl = canvas.toDataURL('image/png');
    openSharePreviewModal(imgDataUrl);

  } catch (error) {
    showToast(error.message || '生成分享图失败');
  } finally {
    captureHost?.remove();
    if (prevMode !== 'week') {
      state.scheduleViewMode = prevMode;
      renderSchedule();
      applyScheduleBoardBackground();
    }
  }
}

function openSharePreviewModal(dataUrl) {
  const modal = document.getElementById('share-preview-modal');
  const img = document.getElementById('share-preview-img');
  const saveBtn = document.getElementById('share-save-btn');
  if (!modal || !img) return;

  img.src = dataUrl;
  modal.classList.add('open');

  if (saveBtn) {
    saveBtn.onclick = () => saveShareImage(dataUrl);
  }
}

function closeSharePreviewModal() {
  const modal = document.getElementById('share-preview-modal');
  if (modal) modal.classList.remove('open');
}

async function saveShareImage(dataUrl) {
  const isNative = isNativeSyncAvailable ? isNativeSyncAvailable() : false;

  if (isNative && window.NJUSTNativeSync?.saveImageToGallery) {
    try {
      await window.NJUSTNativeSync.saveImageToGallery({ dataUrl });
      showToast('课表图已保存到相册！');
    } catch (error) {
      showToast(error.message || '保存到相册失败');
    }
    return;
  }

  // 浏览器端：触发下载
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `njust-schedule-week${getSelectedWeek()}.png`;
  a.click();
  showToast('课表图已下载');
  closeSharePreviewModal();
}

// ─────────────────────────────────────────────────────────────────────────────
// 初始化：在 app.js 的 initApp 之后调用
// ─────────────────────────────────────────────────────────────────────────────

function initFeatures() {
  // 启动倒计时定时器
  startCountdownTimer();
  // 加载持久化的课表壁纸（如有）并即时应用
  const savedBg = localStorage.getItem('njust-schedule-bg');
  if (savedBg) {
    featureState.scheduleBackground = savedBg;
    featureState.scheduleBackgroundOpacity = parseFloat(localStorage.getItem('njust-schedule-bg-opacity') || '0.65');
    const slider = document.getElementById('schedule-page-bg-opacity');
    if (slider) slider.value = featureState.scheduleBackgroundOpacity;
    const label = document.getElementById('bg-opacity-value');
    if (label) label.textContent = Math.round(featureState.scheduleBackgroundOpacity * 100) + '%';
    // 延迟一帧确保 DOM 已渲染
    requestAnimationFrame(() => applyScheduleBoardBackground());
  }
}

function saveScheduleBgPersist() {
  if (featureState.scheduleBackground) {
    try {
      localStorage.setItem('njust-schedule-bg', featureState.scheduleBackground);
      localStorage.setItem('njust-schedule-bg-opacity', String(featureState.scheduleBackgroundOpacity));
    } catch {
      // localStorage 可能超出容量，静默处理
    }
  } else {
    localStorage.removeItem('njust-schedule-bg');
    localStorage.removeItem('njust-schedule-bg-opacity');
  }
}
