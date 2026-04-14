/**
 * 南理教务助手
 * 本地优先、可安装、按模块同步的教务数据查看器
 */

const DB_NAME = 'njust-kb';
const DB_VERSION = 1;
const STORE_NAME = 'data';

const SECTION_KEYS = ['schedule', 'grades', 'certs', 'exams'];
const SECTION_META = {
  schedule: { label: '课表', icon: '📅' },
  grades: { label: '成绩', icon: '📊' },
  certs: { label: '四六级', icon: '🎓' },
  exams: { label: '考试', icon: '📝' }
};

const WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const EXAM_FILTERS = [
  { key: 'upcoming', label: '待考' },
  { key: 'all', label: '全部' },
  { key: 'past', label: '已结束' }
];
const MAIN_PAGES = ['home', 'schedule', 'grades', 'exams', 'settings'];
const SUB_PAGES = ['classrooms', 'sites', 'todos'];
const PAGE_TITLES = {
  home: '南理教务助手',
  schedule: '课表查询',
  grades: '成绩统计',
  exams: '考试安排',
  classrooms: '空闲教室',
  sites: '常用网站',
  todos: '待办事件',
  settings: '设置'
};
const COMMON_SITES = [
  { title: '南京理工大学', url: 'http://www.njust.edu.cn/', desc: '学校官网' },
  { title: '综合教务管理系统', url: 'http://202.119.81.113:8080/', desc: '教务登录入口' },
  { title: '教务处', url: 'http://jwc.njust.edu.cn/', desc: '通知与培养方案' },
  { title: '智慧理工服务门户', url: 'http://ehall.njust.edu.cn/new/index.html', desc: '统一办事大厅' },
  { title: '图书馆', url: 'http://lib.njust.edu.cn/', desc: '馆藏与借阅' },
  { title: '四六级报名', url: 'http://cet-bm.neea.edu.cn/', desc: 'CET 报名入口' },
  { title: '四六级准考证', url: 'http://cet-bm.neea.edu.cn/Home/QueryTestTicket', desc: '准考证查询' },
  { title: '四六级成绩', url: 'http://cet.neea.edu.cn/cet/', desc: 'CET 成绩查询' },
  { title: '计算机等级考试报名&准考证', url: 'http://www.sdzk.cn/floadup/ncrebm/ncrebm.htm', desc: 'NCRE 报名与准考证' },
  { title: '计算机等级考试成绩', url: 'http://cjcx.neea.edu.cn/html1/folder/1508/206-1.htm?sid=300', desc: 'NCRE 成绩查询' },
  { title: 'CCF', url: 'http://cspro.org/', desc: 'CCF CSP / 认证' },
  { title: '超星学习通', url: 'http://i.mooc.chaoxing.com/space/index', desc: '课程学习入口' },
  { title: '普通话成绩', url: 'http://www.cltt.org/studentscore', desc: '普通话成绩查询' }
];
const CLASSROOM_PERIOD_GROUPS = [
  { key: '1', label: '1大节', name: '第一大节', startCode: '01', endCode: '03' },
  { key: '2', label: '2大节', name: '第二大节', startCode: '04', endCode: '05' },
  { key: '3', label: '3大节', name: '第三大节', startCode: '06', endCode: '07' },
  { key: '4', label: '4大节', name: '第四大节', startCode: '08', endCode: '10' },
  { key: '5', label: '5大节', name: '第五大节', startCode: '11', endCode: '12' }
];
const CLASSROOM_DAY_OPTIONS = [
  { value: 0, label: '今天' },
  { value: 1, label: '明天' },
  { value: 2, label: '后天' },
  { value: 3, label: '大后天' }
];
const CLASSROOM_BUILDING_PRIORITY = ['1', '2', '6', '9', '8'];

const PERIOD_TIMES = [
  null,
  { start: '08:00', end: '08:45' },
  { start: '08:50', end: '09:35' },
  { start: '09:40', end: '10:25' },
  { start: '10:40', end: '11:25' },
  { start: '11:30', end: '12:15' },
  { start: '14:00', end: '14:45' },
  { start: '14:50', end: '15:35' },
  { start: '15:50', end: '16:35' },
  { start: '16:40', end: '17:25' },
  { start: '17:30', end: '18:15' },
  { start: '19:00', end: '19:45' },
  { start: '19:50', end: '20:35' },
  { start: '20:40', end: '21:25' },
  { start: '12:15', end: '13:00' }
];

const PERIOD_SEQUENCE = [1, 2, 3, 4, 5, 14, 6, 7, 8, 9, 10, 11, 12, 13];
const PERIOD_POSITION_MAP = PERIOD_SEQUENCE.reduce((map, period, index) => {
  map[period] = index;
  return map;
}, {});

const SCHEDULE_SLOT_HEIGHT = 44;
const SCHEDULE_SLOT_GAP = 3;
const SCHEDULE_BLOCK_PALETTE = [
  { start: '#6d8df7', end: '#88b5ff', text: '#ffffff' },
  { start: '#8b73f0', end: '#baa2ff', text: '#ffffff' },
  { start: '#ef7a74', end: '#ff9e97', text: '#ffffff' },
  { start: '#f4b64b', end: '#ffd67f', text: '#ffffff' },
  { start: '#69b4ff', end: '#8bd1ff', text: '#ffffff' },
  { start: '#76c56f', end: '#a3df87', text: '#ffffff' },
  { start: '#4c73d9', end: '#6f8df0', text: '#ffffff' },
  { start: '#4f92c8', end: '#76c3d2', text: '#ffffff' }
];

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  courseReminders: true,
  todoReminders: true,
  gradeReminders: true,
  leadMinutes: 30,
  permissionState: 'unknown',
  exactAlarmState: 'unknown',
  lastNotificationCheckAt: '',
  lastNotificationError: '',
  lastGradeSignature: '',
  scheduledIds: []
};

const APP_UPDATE_CONFIG = {
  versionManifestUrl: 'https://github.com/xwlzLSC/NJUST_Companion/releases/latest/download/version.json',
  stableApkUrl: 'https://github.com/xwlzLSC/NJUST_Companion/releases/latest/download/NJUST_Companion-release.apk',
  releasesPage: 'https://github.com/xwlzLSC/NJUST_Companion/releases',
  cacheWindowMs: 30 * 60 * 1000
};

const DEFAULT_APP_UPDATE_STATE = {
  supported: false,
  checking: false,
  currentVersionName: '',
  currentVersionCode: 0,
  latestTag: '',
  latestVersionName: '',
  latestVersionCode: 0,
  latestPublishedAt: '',
  latestNotes: '',
  downloadUrl: '',
  releaseUrl: '',
  canInstallPackages: null,
  updateAvailable: false,
  lastCheckedAt: '',
  error: ''
};

const CLASSROOM_LEAD_STATUS_TTL_MS = 20 * 60 * 1000;
const CLASSROOM_LEAD_ERROR_TTL_MS = 2 * 60 * 1000;

let db = null;
let toastTimer = null;
let scheduleSwipeStart = null;
let localNotificationsPlugin = null;
let widgetPlugin = null;
let appUpdatePlugin = null;
const classroomLeadStatusCache = new Map();
const classroomLeadStatusRequests = new Map();

const state = {
  data: createEmptyData(),
  currentPage: 'home',
  pageBackTarget: 'home',
  currentWeekday: null,
  selectedWeek: 1,
  scheduleViewMode: 'week',
  scheduleDetailMap: {},
  activeScheduleDetailId: '',
  customCourses: [],
  editingCustomCourseId: '',
  todos: [],
  editingTodoId: '',
  notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
  appUpdate: { ...DEFAULT_APP_UPDATE_STATE },
  gradeSelections: {},
  gradeSearch: '',
  gradeSemester: 'all',
  examFilter: 'upcoming',
  classrooms: {
    optionsLoaded: false,
    loadingOptions: false,
    querying: false,
    campus: '01',
    semester: '',
    campuses: [],
    buildings: [],
    building: '',
    dayOffset: 0,
    periodGroup: '3',
    result: null,
    error: '',
    updatedAt: ''
  },
  isStandalone: false,
  server: {
    available: false,
    loggedIn: false,
    syncing: false,
    autoSyncEnabled: false,
    username: '',
    profile: '',
    profileLabel: '',
    lastSyncAt: '',
    lastError: '',
    sessionCheckedAt: '',
    transport: '',
    counts: { schedule: 0, grades: 0, certs: 0, exams: 0 }
  }
};

function createEmptyData() {
  return {
    schedule: [],
    grades: [],
    certs: [],
    exams: [],
    meta: {
      semester: '',
      semesterStart: '',
      importedAt: '',
      fullExport: false,
      type: '',
      sections: [],
      sourceUrl: '',
      pageTitle: '',
      sources: {}
    }
  };
}

function createLocalId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAllScheduleCourses() {
  return [
    ...(Array.isArray(state.data.schedule) ? state.data.schedule : []),
    ...(Array.isArray(state.customCourses) ? state.customCourses : [])
  ];
}

function getScheduleCourseCount() {
  return getAllScheduleCourses().length;
}

function hasScheduleCourses() {
  return getScheduleCourseCount() > 0;
}

function getNotificationSettings() {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(state.notificationSettings || {})
  };
}

function getAppUpdateState() {
  return {
    ...DEFAULT_APP_UPDATE_STATE,
    ...(state.appUpdate || {})
  };
}

function isNativeAppPlatform() {
  const cap = window.capacitorExports || {};
  return Boolean(cap.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNativePlatform?.());
}

function normalizeVersionName(value) {
  return cleanText(value).replace(/^v/i, '');
}

function compareVersionNames(left, right) {
  const parse = value => normalizeVersionName(value)
    .split(/[^\d]+/)
    .filter(Boolean)
    .map(item => Number.parseInt(item, 10))
    .filter(Number.isFinite);

  const leftParts = parse(left);
  const rightParts = parse(right);
  const length = Math.max(leftParts.length, rightParts.length, 1);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
}

function buildAppUpdateManifestUrl(force = false) {
  if (!force) return APP_UPDATE_CONFIG.versionManifestUrl;
  const separator = APP_UPDATE_CONFIG.versionManifestUrl.includes('?') ? '&' : '?';
  return `${APP_UPDATE_CONFIG.versionManifestUrl}${separator}t=${Date.now()}`;
}

function buildAppUpdateStatusText(update = getAppUpdateState()) {
  if (!update.supported) {
    return '当前不是安卓安装包环境，浏览器模式不支持覆盖更新。';
  }
  if (update.checking) {
    return '正在检查最新版本清单...';
  }
  if (update.error) {
    return `检查更新失败：${update.error}`;
  }
  if (!update.currentVersionName) {
    return '正在读取当前应用版本...';
  }

  const parts = [`当前版本 ${update.currentVersionName}${update.currentVersionCode ? ` (${update.currentVersionCode})` : ''}`];
  if (update.latestVersionName) {
    parts.push(`最新版本 ${update.latestVersionName}${update.latestVersionCode ? ` (${update.latestVersionCode})` : ''}`);
  }
  if (update.updateAvailable) {
    parts.push('发现可用更新');
  } else if (update.latestVersionName) {
    parts.push('已是最新版本');
  }
  if (update.lastCheckedAt) {
    parts.push(`最近检查 ${formatRelativeImportTime(update.lastCheckedAt)}`);
  }
  return parts.join(' · ');
}

function renderAppUpdateCard() {
  const statusEl = document.getElementById('app-update-status');
  const notesEl = document.getElementById('app-update-notes');
  const actionBtn = document.getElementById('app-update-action-btn');
  const releaseBtn = document.getElementById('app-update-release-btn');
  if (!statusEl || !notesEl || !actionBtn || !releaseBtn) return;

  const update = getAppUpdateState();
  statusEl.textContent = buildAppUpdateStatusText(update);

  const notesParts = [];
  if (update.latestVersionName) {
    notesParts.push(`<div class="update-notes-title">最新版本 ${escapeHtml(update.latestVersionName)}</div>`);
  }
  if (update.latestPublishedAt) {
    notesParts.push(`<div class="update-notes-meta">发布时间：${escapeHtml(formatDateTime(update.latestPublishedAt))}</div>`);
  }
  if (update.latestNotes) {
    const preview = update.latestNotes.trim().slice(0, 320);
    notesParts.push(`<div class="update-notes-body">${escapeHtml(preview)}${update.latestNotes.length > 320 ? '…' : ''}</div>`);
  }
  notesEl.hidden = notesParts.length === 0;
  notesEl.innerHTML = notesParts.join('');

  releaseBtn.disabled = !update.releaseUrl;

  if (!update.supported) {
    actionBtn.textContent = '仅安卓支持';
    actionBtn.disabled = true;
    return;
  }
  if (update.canInstallPackages === false) {
    actionBtn.textContent = '开启安装权限';
    actionBtn.disabled = false;
    return;
  }
  if (update.updateAvailable && update.downloadUrl) {
    actionBtn.textContent = '立即更新';
    actionBtn.disabled = false;
    return;
  }
  actionBtn.textContent = update.checking ? '检查中' : '已是最新版';
  actionBtn.disabled = true;
}

async function fetchLatestAppRelease() {
  const response = await fetch(buildAppUpdateManifestUrl(true), {
    cache: 'no-store'
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('版本清单尚未发布，请先重新发一版正式版 APK');
    }
    throw new Error(`版本清单返回 ${response.status}`);
  }
  return response.json();
}

function updateNotificationRuntimeState(nextState = {}) {
  const settings = getNotificationSettings();
  let changed = false;
  ['permissionState', 'exactAlarmState', 'lastNotificationCheckAt', 'lastNotificationError'].forEach(key => {
    if (nextState[key] === undefined) return;
    if (settings[key] === nextState[key]) return;
    settings[key] = nextState[key];
    changed = true;
  });
  state.notificationSettings = settings;
  return changed;
}

function getNotificationStatusText(settings = getNotificationSettings()) {
  if (!settings.enabled) {
    return '通知已关闭，开启后会自动安排本地提醒';
  }

  const parts = ['通知已开启'];
  const permissionState = settings.permissionState || 'unknown';
  const exactAlarmState = settings.exactAlarmState || 'unknown';

  if (permissionState === 'granted') {
    parts.push('系统通知已授权');
  } else if (permissionState === 'denied') {
    parts.push('系统通知未开启');
  } else if (permissionState === 'unavailable') {
    parts.push('当前环境不支持系统通知');
  } else {
    parts.push('系统通知待检查');
  }

  if (exactAlarmState === 'granted') {
    parts.push('精确闹钟已开启');
  } else if (exactAlarmState === 'denied') {
    parts.push('精确闹钟未开启');
  } else if (exactAlarmState === 'unavailable') {
    parts.push('精确闹钟不可用');
  }

  if (settings.lastNotificationCheckAt) {
    parts.push(`最近检查 ${formatRelativeImportTime(settings.lastNotificationCheckAt)}`);
  }
  if (settings.lastNotificationError) {
    parts.push(`错误：${settings.lastNotificationError}`);
  }

  return parts.join(' · ');
}

function renderNotificationStatus() {
  const el = document.getElementById('notify-status-text');
  if (!el) return;
  el.textContent = getNotificationStatusText();
}

function normalizeStoredCustomCourses(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => normalizeScheduleItem({ ...item, isCustom: true }))
    .filter(Boolean)
    .map(course => ({
      ...course,
      id: course.id || createLocalId('course'),
      isCustom: true
    }));
}

function normalizeTodoItem(item) {
  if (!item || typeof item !== 'object') return null;
  const title = cleanText(item.title);
  if (!title) return null;
  return {
    id: cleanText(item.id) || createLocalId('todo'),
    title,
    date: normalizeDateString(item.date) || formatDateKey(new Date()),
    time: cleanText(item.time),
    note: cleanText(item.note),
    remindMinutes: Math.max(0, Number.parseInt(item.remindMinutes, 10) || 0),
    linkedCourseName: cleanText(item.linkedCourseName),
    done: Boolean(item.done),
    createdAt: normalizeIsoTime(item.createdAt) || new Date().toISOString(),
    updatedAt: normalizeIsoTime(item.updatedAt) || new Date().toISOString()
  };
}

function normalizeStoredTodos(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeTodoItem)
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = getTodoDateTime(left)?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightTime = getTodoDateTime(right)?.getTime() || Number.MAX_SAFE_INTEGER;
      return left.done - right.done || leftTime - rightTime || left.createdAt.localeCompare(right.createdAt);
    });
}

function getTodoDateTime(todo) {
  if (!todo?.date) return null;
  const time = todo.time || '23:59';
  const [year, month, day] = todo.date.split('-').map(Number);
  if (!year || !month || !day) return null;
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTodoDueText(todo) {
  const date = getTodoDateTime(todo);
  if (!date) return '未设置时间';
  const dateText = `${formatShortDate(date)} ${WEEKDAY_NAMES[getTodayWeekday(date)]}`;
  return todo.time ? `${dateText} ${todo.time}` : `${dateText} 全天`;
}

function getUpcomingTodos(limit = 5) {
  const now = Date.now();
  return normalizeStoredTodos(state.todos)
    .filter(todo => !todo.done)
    .map(todo => ({ todo, dueAt: getTodoDateTime(todo) }))
    .filter(item => item.dueAt && item.dueAt.getTime() >= now - 60000)
    .sort((left, right) => left.dueAt - right.dueAt)
    .slice(0, limit);
}

function getTimeValue(value) {
  const iso = normalizeIsoTime(value);
  if (!iso) return 0;
  const timestamp = new Date(iso).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getNewestIsoTime(...values) {
  let newestIso = '';
  let newestValue = 0;

  const collect = value => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const iso = normalizeIsoTime(value);
    if (!iso) return;
    const timestamp = getTimeValue(iso);
    if (!timestamp) return;
    if (!newestIso || timestamp > newestValue) {
      newestIso = iso;
      newestValue = timestamp;
    }
  };

  values.forEach(collect);
  return newestIso;
}

function getLatestImportedAt(data = state.data) {
  return getNewestIsoTime(
    data?.meta?.importedAt,
    Object.values(data?.meta?.sources || {}).map(source => source.importedAt)
  );
}

function getDisplaySyncAt(data = state.data) {
  return getNewestIsoTime(state.server.lastSyncAt, getLatestImportedAt(data));
}

function stampDataImportedAt(syncAt) {
  const importedAt = normalizeIsoTime(syncAt);
  if (!importedAt) return;
  state.data.meta.importedAt = importedAt;
  ensureSourceMetadata(state.data);
  SECTION_KEYS.forEach(section => {
    const source = state.data.meta.sources?.[section];
    if (!source) return;
    source.importedAt = importedAt;
    source.count = Array.isArray(state.data[section]) ? state.data[section].length : source.count;
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = event => {
      const upgradeDb = event.target.result;
      if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
        upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = event => {
      db = event.target.result;
      resolve(db);
    };
    req.onerror = event => reject(event.target.error);
  });
}

function dbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put({ key, value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function toPositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return isPositiveInt(parsed) ? parsed : null;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDateString(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const directMatch = raw.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (directMatch) {
    return `${directMatch[1]}-${pad(directMatch[2])}-${pad(directMatch[3])}`;
  }
  const cleaned = raw.replace(/[年月]/g, '-').replace(/日/g, '').replace(/\//g, '-');
  const match = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  }
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return formatDateKey(date);
  }
  return '';
}

function normalizeIsoTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizePeriods(value) {
  const list = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(/[^\d]+/)
        .map(item => item.trim())
        .filter(Boolean);
  return [...new Set(list.map(item => Number.parseInt(item, 10)).filter(item => item >= 1 && item <= 14))]
    .sort((left, right) => getPeriodPosition(left) - getPeriodPosition(right) || left - right);
}

function normalizeScheduleItem(item) {
  if (!item || typeof item !== 'object') return null;
  const weekday = toPositiveInt(item.weekday);
  const periods = normalizePeriods(item.periods);
  if (!weekday || weekday > 7 || periods.length === 0) return null;

  const startWeek = toPositiveInt(item.startWeek) || 1;
  const endWeekRaw = toPositiveInt(item.endWeek);
  const endWeek = endWeekRaw && endWeekRaw >= startWeek ? endWeekRaw : Math.max(startWeek, 20);
  const oddEven = String(item.oddEven ?? '').includes('单')
    ? '单'
    : String(item.oddEven ?? '').includes('双')
      ? '双'
      : '';

  return {
    id: cleanText(item.id),
    isCustom: Boolean(item.isCustom),
    name: cleanText(item.name) || '未命名课程',
    teacher: cleanText(item.teacher),
    room: cleanText(item.room),
    credit: Number.isFinite(Number.parseFloat(item.credit)) ? Number.parseFloat(item.credit) : 0,
    code: cleanText(item.code),
    sequence: cleanText(item.sequence),
    attribute: cleanText(item.attribute),
    stage: cleanText(item.stage),
    groupName: cleanText(item.groupName),
    semester: cleanText(item.semester),
    weekday,
    periods,
    startWeek,
    endWeek,
    oddEven
  };
}

function normalizeCertItem(item) {
  if (!item || typeof item !== 'object') return null;
  const total = Number.parseFloat(item.totalScore ?? item.score ?? item.total);
  const written = Number.parseFloat(item.writtenScore ?? item.written);
  const computer = Number.parseFloat(item.computerScore ?? item.computer);
  return {
    name: cleanText(item.name) || '未命名等级考试',
    kind: cleanText(item.kind || item.level),
    totalScore: Number.isFinite(total) ? total : null,
    writtenScore: Number.isFinite(written) ? written : null,
    computerScore: Number.isFinite(computer) ? computer : null,
    date: normalizeDateString(item.date),
    rawLabel: cleanText(item.rawLabel)
  };
}

function normalizeGradeItem(item) {
  if (!item || typeof item !== 'object') return null;
  const rawScore = item.score;
  const numericScore = Number.parseFloat(rawScore);
  const score = Number.isFinite(numericScore) ? numericScore : null;
  const rawGpa = item.gpa ?? item.gradePoint ?? item.point;
  const numericGpa = Number.parseFloat(rawGpa);
  return {
    name: cleanText(item.name) || '未命名课程',
    code: cleanText(item.code || item.courseCode),
    credit: Number.isFinite(Number.parseFloat(item.credit)) ? Number.parseFloat(item.credit) : 0,
    hours: Number.isFinite(Number.parseFloat(item.hours)) ? Number.parseFloat(item.hours) : 0,
    score,
    scoreText: score === null ? cleanText(item.scoreText || rawScore) : '',
    semester: cleanText(item.semester),
    flag: cleanText(item.flag || item.scoreFlag),
    assessment: cleanText(item.assessment || item.examType),
    attribute: cleanText(item.attribute || item.courseAttribute),
    category: cleanText(item.category || item.type || item.courseType),
    type: cleanText(item.type || item.courseType || item.category),
    gpa: Number.isFinite(numericGpa) ? numericGpa : null
  };
}

function normalizeExamItem(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    name: cleanText(item.name) || '未命名考试',
    date: normalizeDateString(item.date),
    time: cleanText(item.time),
    room: cleanText(item.room),
    seat: cleanText(item.seat)
  };
}

function normalizeSources(meta, raw) {
  const result = {};
  const rawSources = meta && typeof meta.sources === 'object' ? meta.sources : {};
  SECTION_KEYS.forEach(section => {
    const source = rawSources[section];
    if (!source || typeof source !== 'object') return;
    result[section] = {
      importedAt: normalizeIsoTime(source.importedAt) || '',
      count: Number.isFinite(Number(source.count))
        ? Number(source.count)
        : Array.isArray(raw?.[section]) ? raw[section].length : 0,
      sourceUrl: cleanText(source.sourceUrl),
      pageTitle: cleanText(source.pageTitle)
    };
  });
  return result;
}

function normalizeMeta(meta, raw) {
  const sourceMeta = meta && typeof meta === 'object' ? meta : {};
  return {
    semester: cleanText(sourceMeta.semester),
    semesterStart: normalizeDateString(sourceMeta.semesterStart),
    importedAt: normalizeIsoTime(sourceMeta.importedAt),
    fullExport: Boolean(sourceMeta.fullExport),
    type: cleanText(sourceMeta.type),
    sections: Array.isArray(sourceMeta.sections)
      ? [...new Set(sourceMeta.sections.filter(section => SECTION_KEYS.includes(section)))]
      : [],
    sourceUrl: cleanText(sourceMeta.sourceUrl),
    pageTitle: cleanText(sourceMeta.pageTitle),
    sources: normalizeSources(sourceMeta, raw)
  };
}

function normalizeData(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const data = createEmptyData();
  data.schedule = Array.isArray(input.schedule) ? input.schedule.map(normalizeScheduleItem).filter(Boolean) : [];
  data.grades = Array.isArray(input.grades) ? input.grades.map(normalizeGradeItem).filter(Boolean) : [];
  data.certs = Array.isArray(input.certs) ? input.certs.map(normalizeCertItem).filter(Boolean) : [];
  data.exams = Array.isArray(input.exams) ? input.exams.map(normalizeExamItem).filter(Boolean) : [];
  data.meta = normalizeMeta(input.meta, input);
  ensureSourceMetadata(data);
  if (!data.meta.semester) {
    data.meta.semester = deriveSemesterLabel(data);
  }
  return data;
}

function ensureSourceMetadata(data) {
  if (!data.meta.sources || typeof data.meta.sources !== 'object') {
    data.meta.sources = {};
  }
  SECTION_KEYS.forEach(section => {
    if (data.meta.sources[section]) return;
    if (!Array.isArray(data[section])) return;
    if (data[section].length === 0 && !data.meta.importedAt) return;
    data.meta.sources[section] = {
      importedAt: data.meta.importedAt || '',
      count: data[section].length,
      sourceUrl: '',
      pageTitle: ''
    };
  });
}

function deriveSemesterLabel(data) {
  const semesters = [...new Set((data.grades || []).map(item => item.semester).filter(Boolean))];
  return semesters.length > 0 ? semesters.sort((a, b) => b.localeCompare(a))[0] : '';
}

function inferSectionsFromImport(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  if (Array.isArray(meta.sections)) {
    const explicitSections = [...new Set(meta.sections.filter(section => SECTION_KEYS.includes(section)))];
    if (explicitSections.length > 0) return explicitSections;
  }
  if (SECTION_KEYS.includes(meta.type)) {
    return [meta.type];
  }
  const present = SECTION_KEYS.filter(section => Array.isArray(raw[section]));
  if (present.length === 0 && Array.isArray(raw.certs)) return ['certs'];
  if (meta.fullExport) return present.length > 0 ? present : SECTION_KEYS.slice();
  const nonEmpty = present.filter(section => raw[section].length > 0);
  if (nonEmpty.length === 1) return nonEmpty;
  if (present.length === 1) return present;
  return present;
}

function mergeImportedData(currentData, incomingRaw) {
  const sections = inferSectionsFromImport(incomingRaw);
  if (sections.length === 0) {
    throw new Error('未识别到可导入的数据模块');
  }

  const merged = normalizeData(currentData);
  const incoming = normalizeData(incomingRaw);
  const now = new Date().toISOString();

  sections.forEach(section => {
    merged[section] = incoming[section];
    merged.meta.sources[section] = {
      importedAt: now,
      count: incoming[section].length,
      sourceUrl: incoming.meta.sourceUrl,
      pageTitle: incoming.meta.pageTitle
    };
  });

  if (Array.isArray(incomingRaw.certs)) {
    merged.certs = incoming.certs;
  }

  if (incoming.meta.semester) {
    merged.meta.semester = incoming.meta.semester;
  }
  if (incoming.meta.semesterStart) {
    merged.meta.semesterStart = incoming.meta.semesterStart;
  }

  merged.meta.importedAt = now;
  merged.meta.fullExport = false;
  merged.meta.type = '';
  merged.meta.sections = sections;
  merged.meta.sourceUrl = '';
  merged.meta.pageTitle = '';
  ensureSourceMetadata(merged);

  return { merged, sections };
}

function hasAnyData(data = state.data) {
  const remoteHasData = SECTION_KEYS.some(section => {
    const source = data.meta.sources?.[section];
    return Boolean(source) || (Array.isArray(data[section]) && data[section].length > 0);
  });
  if (data !== state.data) return remoteHasData;
  return remoteHasData || state.customCourses.length > 0 || state.todos.length > 0;
}

function getMaxWeek() {
  const courses = getAllScheduleCourses();
  if (!courses.length) return 20;
  return courses.reduce((max, course) => Math.max(max, course.endWeek || 0), 1);
}

function getTodayWeekday(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, offset) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function getCurrentWeek(semesterStart, referenceDate = new Date()) {
  if (!semesterStart) return null;
  const start = startOfDay(new Date(semesterStart));
  if (Number.isNaN(start.getTime())) return null;
  const target = startOfDay(referenceDate);
  const diffDays = Math.floor((target - start) / 86400000);
  return diffDays >= 0 ? Math.floor(diffDays / 7) + 1 : 1;
}

function getWeekForDate(semesterStart, targetDate) {
  return getCurrentWeek(semesterStart, targetDate);
}

function formatHumanDate(date = new Date()) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatClockTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelativeImportTime(value) {
  if (!value) return '未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未同步';
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / 60000);
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSemesterLabel(semester) {
  if (!semester) return '未标注学期';
  const normalized = semester.replace(/~/g, '-');
  const shortMatch = normalized.match(/^(\d{4})[-/](\d)$/);
  if (shortMatch) {
    return `${shortMatch[1]} 学年 ${shortMatch[2] === '1' ? '第一学期' : '第二学期'}`;
  }
  const fullMatch = normalized.match(/^(\d{4}-\d{4})[-/](\d)$/);
  if (fullMatch) {
    return `${fullMatch[1]} 学年 ${fullMatch[2] === '1' ? '第一学期' : '第二学期'}`;
  }
  return semester;
}

function timeToMinutes(value) {
  if (!value) return 0;
  const [hour, minute] = String(value).split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function getPeriodPosition(period) {
  const normalized = Number.parseInt(period, 10);
  return Number.isInteger(PERIOD_POSITION_MAP[normalized]) ? PERIOD_POSITION_MAP[normalized] : 0;
}

function sortPeriodsByDisplay(periods) {
  return [...(Array.isArray(periods) ? periods : [])]
    .map(item => Number.parseInt(item, 10))
    .filter(item => item >= 1 && item <= 14)
    .sort((left, right) => getPeriodPosition(left) - getPeriodPosition(right) || left - right);
}

function getPeriodRange(periods) {
  const sorted = sortPeriodsByDisplay(periods);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return {
    min,
    max,
    start: PERIOD_TIMES[min]?.start || '',
    end: PERIOD_TIMES[max]?.end || '',
    startPosition: getPeriodPosition(min),
    endPosition: getPeriodPosition(max),
    span: getPeriodPosition(max) - getPeriodPosition(min) + 1
  };
}

function getPeriodText(periods) {
  if (!periods || periods.length === 0) return '';
  const range = getPeriodRange(periods);
  const periodLabel = range.min === range.max
    ? `第${range.min}节`
    : `第${range.min}-${range.max}节`;
  return `${periodLabel} · ${range.start}-${range.end}`;
}

function getCourseWeekText(course) {
  const base = `第${course.startWeek}-${course.endWeek}周`;
  return course.oddEven ? `${base}${course.oddEven}` : base;
}

function hashString(value) {
  return Array.from(String(value || '')).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function getScheduleBlockTheme(course) {
  return SCHEDULE_BLOCK_PALETTE[hashString(course.name) % SCHEDULE_BLOCK_PALETTE.length];
}

function splitContiguousPeriods(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return [];
  const sorted = sortPeriodsByDisplay(periods);
  const groups = [[sorted[0]]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const group = groups[groups.length - 1];
    if (getPeriodPosition(current) === getPeriodPosition(group[group.length - 1]) + 1) {
      group.push(current);
    } else {
      groups.push([current]);
    }
  }
  return groups;
}

function buildScheduleEntriesForWeek(week) {
  const entriesByDay = {};

  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const rawEntries = getCoursesForDay(weekday, week).flatMap(course =>
      splitContiguousPeriods(course.periods).map(periodGroup => {
        const range = getPeriodRange(periodGroup);
        return {
          course,
          weekday,
          periods: periodGroup,
          rangeMin: range.min,
          rangeMax: range.max,
          rangeStartPosition: range.startPosition,
          rangeEndPosition: range.endPosition
        };
      })
    );

    const sortedEntries = rawEntries.sort((left, right) =>
      left.rangeStartPosition - right.rangeStartPosition
      || left.rangeEndPosition - right.rangeEndPosition
      || left.course.name.localeCompare(right.course.name)
    );

    const clusters = [];
    sortedEntries.forEach(entry => {
      const cluster = clusters[clusters.length - 1];
      if (!cluster || entry.rangeStartPosition > cluster.maxPosition) {
        clusters.push({ maxPosition: entry.rangeEndPosition, items: [entry] });
      } else {
        cluster.items.push(entry);
        cluster.maxPosition = Math.max(cluster.maxPosition, entry.rangeEndPosition);
      }
    });

    entriesByDay[weekday] = clusters.flatMap(cluster => {
      const laneMax = [];
      cluster.items.forEach(entry => {
        let lane = laneMax.findIndex(lastMax => lastMax < entry.rangeStartPosition);
        if (lane === -1) {
          lane = laneMax.length;
          laneMax.push(entry.rangeEndPosition);
        } else {
          laneMax[lane] = entry.rangeEndPosition;
        }
        entry.lane = lane;
      });

      const laneCount = Math.max(laneMax.length, 1);
      return cluster.items.map(entry => ({ ...entry, laneCount }));
    });
  }

  return entriesByDay;
}

function isCourseActiveInWeek(course, week) {
  if (week === null) return true;
  if (week < course.startWeek || week > course.endWeek) return false;
  if (course.oddEven === '单' && week % 2 === 0) return false;
  if (course.oddEven === '双' && week % 2 !== 0) return false;
  return true;
}

function getCoursesForDay(weekday, week) {
  return getAllScheduleCourses()
    .filter(course => course.weekday === weekday && isCourseActiveInWeek(course, week))
    .sort((left, right) => getPeriodPosition(left.periods[0]) - getPeriodPosition(right.periods[0]));
}

function getSelectedWeek() {
  const currentWeek = getCurrentWeek(state.data.meta.semesterStart);
  if (state.selectedWeek) return state.selectedWeek;
  return currentWeek || 1;
}

function clampSelectedWeek(week) {
  const maxWeek = getMaxWeek();
  return Math.max(1, Math.min(maxWeek, week));
}

function getDateForWeekday(week, weekday) {
  if (!state.data.meta.semesterStart) return null;
  const semesterStart = new Date(state.data.meta.semesterStart);
  if (Number.isNaN(semesterStart.getTime())) return null;
  const date = addDays(semesterStart, (week - 1) * 7 + (weekday - 1));
  return startOfDay(date);
}

function formatScheduleMonth(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月`;
}

function formatScheduleDayNumber(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--';
  return String(date.getDate());
}

function getSectionStatus(section) {
  if (section === 'schedule' && state.customCourses.length > 0) {
    const source = state.data.meta.sources?.schedule;
    return {
      synced: true,
      count: getScheduleCourseCount(),
      importedAt: source?.importedAt || getLatestImportedAt() || ''
    };
  }
  const source = state.data.meta.sources?.[section];
  const count = source ? source.count : state.data[section].length;
  const importedAt = source?.importedAt || '';
  return {
    synced: Boolean(source),
    count,
    importedAt
  };
}

function buildStatusGridHtml() {
  return SECTION_KEYS.map(section => {
    const status = getSectionStatus(section);
    const cardClass = status.synced ? 'status-card synced' : 'status-card pending';
    return `
      <div class="${cardClass}">
        <div class="status-title">${escapeHtml(SECTION_META[section].label)}</div>
        <div class="status-value">${status.synced ? escapeHtml(String(status.count)) : '--'}</div>
        <div class="status-note">${status.synced ? `上次 ${escapeHtml(formatRelativeImportTime(status.importedAt))}` : '等待同步'}</div>
      </div>
    `;
  }).join('');
}

async function apiRequest(path, options = {}) {
  if (isNativeSyncAvailable()) {
    return nativeApiRequest(path, options);
  }

  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { ok: false, error: await response.text() };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `请求失败：${response.status}`);
  }
  return payload;
}

function isNativeSyncAvailable() {
  return Boolean(window.NJUSTNativeSync?.isSupported?.());
}

async function nativeApiRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  let body = {};

  if (typeof options.body === 'string' && options.body) {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = {};
    }
  }

  if (path.startsWith('/api/status')) {
    const check = /[?&]check=1(?:&|$)/.test(path);
    return window.NJUSTNativeSync.getStatus({ check });
  }
  if (path === '/api/auth/login' && method === 'POST') {
    return window.NJUSTNativeSync.loginAndSync(body);
  }
  if (path === '/api/sync/now' && method === 'POST') {
    return window.NJUSTNativeSync.syncNow();
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    return window.NJUSTNativeSync.logout();
  }
  if (path === '/api/settings/semester-start' && method === 'POST') {
    return window.NJUSTNativeSync.saveSemesterStart(body.semesterStart || '');
  }
  if (path.startsWith('/api/classrooms/options') && method === 'GET') {
    const url = new URL(path, window.location.origin);
    return window.NJUSTNativeSync.getClassroomOptions({
      campus: url.searchParams.get('campus') || ''
    });
  }
  if (path === '/api/classrooms/query' && method === 'POST') {
    return window.NJUSTNativeSync.queryClassrooms(body);
  }

  throw new Error(`安卓原生模式暂不支持请求：${method} ${path}`);
}

async function keepAliveNativeSession() {
  if (!isNativeSyncAvailable() || !window.NJUSTNativeSync.keepAlive) return null;
  const payload = await window.NJUSTNativeSync.keepAlive();
  state.server = {
    ...state.server,
    ...payload.status
  };
  renderServerStatus();
  return payload;
}

async function persistCurrentData() {
  await dbSet('main', state.data);
}

function applyRemoteData(data, status = {}) {
  if (!data) return;
  state.data = normalizeData(data);
  stampDataImportedAt(status.lastSyncAt || state.server.lastSyncAt || state.data.meta.importedAt);
  state.selectedWeek = clampSelectedWeek(getCurrentWeek(state.data.meta.semesterStart) || state.selectedWeek || 1);
}

function renderServerStatus() {
  const statusText = document.getElementById('server-status-text');
  if (!statusText) return;

  if (!state.server.available) {
    statusText.textContent = '同步服务未连接。浏览器模式需要先在项目目录执行 npm install && npm start；安卓安装包则会自动切换到手机原生同步。';
    return;
  }

  if (state.server.loggedIn) {
    const nodeText = state.server.businessBase ? ` · 节点 ${state.server.businessBase}` : '';
    statusText.textContent = `已登录 ${state.server.username || ''}${nodeText} · 最近自动同步 ${formatRelativeImportTime(getDisplaySyncAt())}`;
  } else if (state.server.lastError) {
    statusText.textContent = `服务在线，但当前未登录。${state.server.lastError}`;
  } else {
    statusText.textContent = `服务在线，当前未登录。入口：${state.server.profileLabel || '教务系统'}`;
  }
}

function buildSettingsLoginGuideHtml() {
  if (state.server.loggedIn) return '';
  return `
    <div class="card guide-inline-card">
      <div class="guide-inline-head">
        <div>
          <div class="setting-label">新手提示</div>
          <div class="setting-desc">
            账号一般填学号或教务系统用户名，密码填教务处密码，初始密码常见为学号。登录成功后，这个提示会自动隐藏。
          </div>
        </div>
        <button class="btn btn-soft btn-sm" type="button" onclick="openUsageGuide()">查看完整说明</button>
      </div>
      <div class="guide-inline-grid mt-12">
        <div class="guide-inline-step">
          <span>🪪</span>
          <strong>账号</strong>
          <small>输入学号 / 教务系统账号</small>
        </div>
        <div class="guide-inline-step">
          <span>🔑</span>
          <strong>密码</strong>
          <small>输入教务处密码，默认常为学号</small>
        </div>
        <div class="guide-inline-step">
          <span>📅</span>
          <strong>学期开始日</strong>
          <small>登录后去设置页填写</small>
        </div>
      </div>
    </div>
  `;
}

function openUsageGuide() {
  document.getElementById('usage-guide-modal')?.classList.add('open');
}

function closeUsageGuide() {
  document.getElementById('usage-guide-modal')?.classList.remove('open');
}

async function refreshServerStatus({ silent = false, check = false } = {}) {
  try {
    const previousImportedAt = state.data.meta.importedAt;
    const payload = await apiRequest(`/api/status${check ? '?check=1' : ''}`, { method: 'GET' });
    state.server.available = true;
    const mergedStatus = {
      ...state.server,
      ...payload.status
    };
    const incomingSyncAt = normalizeIsoTime(payload.status?.lastSyncAt);
    mergedStatus.lastSyncAt = getNewestIsoTime(
      incomingSyncAt,
      mergedStatus.lastSyncAt,
      state.server.lastSyncAt,
      previousImportedAt
    );
    state.server = mergedStatus;
    const normalizedRemoteData = payload.data ? normalizeData(payload.data) : null;
    if (normalizedRemoteData && (hasAnyData(normalizedRemoteData) || mergedStatus.lastSyncAt)) {
      applyRemoteData(normalizedRemoteData, mergedStatus);
      await persistCurrentData();
    }
    renderServerStatus();
    if (!silent || previousImportedAt !== state.data.meta.importedAt) {
      renderCurrentPage();
      if (state.currentPage !== 'home') renderHome();
    }
    return payload;
  } catch (error) {
    state.server.available = false;
    state.server.loggedIn = false;
    state.server.lastError = error.message;
    renderServerStatus();
    if (!silent) showToast('本地同步服务未启动，已回退到手动导入模式');
    return null;
  }
}

async function refreshCaptcha({ silent = false } = {}) {
  const image = document.getElementById('login-captcha-image');
  if (!image) return;
  const username = document.getElementById('login-username')?.value.trim() || state.server.username || '';
  if (!username) {
    image.removeAttribute('src');
    image.alt = '请先输入学号';
    if (!silent) showToast('请先输入学号，再刷新验证码');
    return;
  }
  image.alt = '验证码';

  if (isNativeSyncAvailable()) {
    try {
      const payload = await window.NJUSTNativeSync.fetchCaptcha(username);
      image.src = payload.imageDataUrl;
    } catch (error) {
      image.removeAttribute('src');
      image.alt = '验证码获取失败';
      if (!silent) showToast(error.message || '获取验证码失败');
    }
    return;
  }

  image.src = `/api/auth/captcha?username=${encodeURIComponent(username)}&t=${Date.now()}`;
}

async function loginAndSync() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const captcha = document.getElementById('login-captcha').value.trim();

  if (!username || !password) {
    showToast('请输入用户名和密码');
    return;
  }

  try {
    const previousGradeSignature = buildGradeSignature();
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, captcha })
    });
    state.server.available = true;
    const syncedAt = getNewestIsoTime(payload.status?.lastSyncAt, new Date().toISOString());
    state.server = { ...state.server, ...payload.status, lastSyncAt: syncedAt };
    applyRemoteData(payload.data, { ...payload.status, lastSyncAt: syncedAt });
    await persistCurrentData();
    await afterDataChanged({ previousGradeSignature });
    renderCurrentPage();
    if (state.currentPage !== 'home') renderHome();
    renderServerStatus();
    document.getElementById('login-captcha').value = '';
    refreshCaptcha();
    showToast(payload.warning ? `登录成功，但同步失败：${payload.warning}` : '登录成功，数据已同步');
  } catch (error) {
    refreshCaptcha();
    showToast(error.message || '登录失败');
    await refreshServerStatus({ silent: true });
  }
}

async function syncNow({ silent = false } = {}) {
  if (!state.server.available) {
    if (!silent) {
      openImportModal();
      showToast('同步服务未启动，已切换到手动导入');
    }
    return;
  }
  try {
    const previousGradeSignature = buildGradeSignature();
    const payload = await apiRequest('/api/sync/now', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const syncedAt = getNewestIsoTime(payload.status?.lastSyncAt, new Date().toISOString());
    state.server = { ...state.server, ...payload.status, lastSyncAt: syncedAt };
    applyRemoteData(payload.data, { ...payload.status, lastSyncAt: syncedAt });
    await persistCurrentData();
    await afterDataChanged({ previousGradeSignature });
    renderCurrentPage();
    if (state.currentPage !== 'home') renderHome();
    renderServerStatus();
    if (!silent) showToast('已完成一次同步');
  } catch (error) {
    if (!silent) showToast(error.message || '同步失败');
    await refreshServerStatus({ silent: true });
  }
}

async function logoutServer() {
  if (!state.server.available) {
    showToast('本地同步服务未启动');
    return;
  }
  try {
    const payload = await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    });
    state.server = { ...state.server, ...payload.status };
    renderServerStatus();
    refreshCaptcha();
    showToast('已退出登录');
  } catch (error) {
    showToast(error.message || '退出失败');
  }
}

function getLocalNotificationsPlugin() {
  if (localNotificationsPlugin) return localNotificationsPlugin;
  const cap = window.capacitorExports || {};
  const native = Boolean(cap.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNativePlatform?.());
  if (!native) return null;
  const registerPlugin = cap.registerPlugin || window.Capacitor?.registerPlugin;
  if (!registerPlugin) return null;
  localNotificationsPlugin = registerPlugin('LocalNotifications');
  return localNotificationsPlugin;
}

function getWidgetPlugin() {
  if (widgetPlugin) return widgetPlugin;
  const cap = window.capacitorExports || {};
  const native = Boolean(cap.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNativePlatform?.());
  if (!native) return null;
  const registerPlugin = cap.registerPlugin || window.Capacitor?.registerPlugin;
  if (!registerPlugin) return null;
  widgetPlugin = registerPlugin('NJUSTWidget');
  return widgetPlugin;
}

function getAppUpdatePlugin() {
  if (appUpdatePlugin) return appUpdatePlugin;
  const cap = window.capacitorExports || {};
  const native = Boolean(cap.Capacitor?.isNativePlatform?.() || window.Capacitor?.isNativePlatform?.());
  if (!native) return null;
  const registerPlugin = cap.registerPlugin || window.Capacitor?.registerPlugin;
  if (!registerPlugin) return null;
  appUpdatePlugin = registerPlugin('NJUSTAppUpdate');
  return appUpdatePlugin;
}

async function refreshAppUpdateState({ silent = true, force = false } = {}) {
  const previous = getAppUpdateState();
  state.appUpdate = {
    ...previous,
    supported: isNativeAppPlatform(),
    checking: true,
    error: ''
  };
  renderAppUpdateCard();

  try {
    const plugin = getAppUpdatePlugin();
    if (!plugin) {
      state.appUpdate = {
        ...DEFAULT_APP_UPDATE_STATE,
        supported: false,
        checking: false,
        releaseUrl: APP_UPDATE_CONFIG.releasesPage
      };
      renderAppUpdateCard();
      return state.appUpdate;
    }
    const appInfo = plugin?.getAppInfo ? await plugin.getAppInfo() : null;
    const lastCheckedAt = normalizeIsoTime(previous.lastCheckedAt);
    const shouldFetchLatest = force
      || !previous.latestVersionName
      || !lastCheckedAt
      || (Date.now() - new Date(lastCheckedAt).getTime()) > APP_UPDATE_CONFIG.cacheWindowMs;

    let latestTag = previous.latestTag || '';
    let latestVersionName = previous.latestVersionName || '';
    let latestVersionCode = Number(previous.latestVersionCode || 0);
    let latestPublishedAt = previous.latestPublishedAt || '';
    let latestNotes = previous.latestNotes || '';
    let downloadUrl = previous.downloadUrl || '';
    let releaseUrl = previous.releaseUrl || '';

    if (shouldFetchLatest) {
      const manifest = await fetchLatestAppRelease();
      latestTag = cleanText(manifest.tag);
      latestVersionName = normalizeVersionName(manifest.versionName || latestTag);
      latestVersionCode = Number.parseInt(manifest.versionCode, 10) || 0;
      latestPublishedAt = normalizeIsoTime(manifest.publishedAt);
      latestNotes = String(manifest.notes || '').trim();
      downloadUrl = cleanText(manifest.downloadUrl) || APP_UPDATE_CONFIG.stableApkUrl;
      releaseUrl = cleanText(manifest.releaseUrl) || APP_UPDATE_CONFIG.releasesPage;
    }

    const currentVersionName = cleanText(appInfo?.versionName);
    const currentVersionCode = Number(appInfo?.versionCode || 0);
    const canInstallPackages = appInfo?.canRequestPackageInstalls === undefined
      ? null
      : Boolean(appInfo.canRequestPackageInstalls);

    let updateAvailable = false;
    if (downloadUrl && latestVersionName && currentVersionName) {
      const versionCompare = compareVersionNames(latestVersionName, currentVersionName);
      updateAvailable = versionCompare > 0;
      if (!updateAvailable && versionCompare === 0 && latestVersionCode && currentVersionCode) {
        updateAvailable = latestVersionCode > currentVersionCode;
      }
    }

    state.appUpdate = {
      supported: Boolean(plugin),
      checking: false,
      currentVersionName,
      currentVersionCode,
      latestTag,
      latestVersionName,
      latestVersionCode,
      latestPublishedAt,
      latestNotes,
      downloadUrl,
      releaseUrl: releaseUrl || APP_UPDATE_CONFIG.releasesPage,
      canInstallPackages,
      updateAvailable,
      lastCheckedAt: shouldFetchLatest ? new Date().toISOString() : previous.lastCheckedAt,
      error: ''
    };
  } catch (error) {
    state.appUpdate = {
      ...getAppUpdateState(),
      supported: isNativeAppPlatform(),
      checking: false,
      error: error.message || '检查更新失败'
    };
    if (!silent) {
      showToast(state.appUpdate.error);
    }
  }

  renderAppUpdateCard();
  return state.appUpdate;
}

async function checkAppUpdate() {
  const update = await refreshAppUpdateState({ silent: false, force: true });
  if (update.error) return;
  if (update.updateAvailable) {
    showToast(`发现新版本 ${update.latestVersionName}`);
    return;
  }
  showToast(`当前已是最新版本 ${update.currentVersionName || ''}`.trim());
}

async function startAppUpdate() {
  let update = getAppUpdateState();
  const plugin = getAppUpdatePlugin();
  if (!plugin) {
    showToast('仅安卓安装包支持应用内更新');
    return;
  }

  if (update.canInstallPackages === false) {
    try {
      await plugin.openInstallSettings();
      showToast('请先允许本应用安装 APK，返回后再点一次更新');
    } catch (error) {
      showToast(error.message || '打开安装权限设置失败');
    }
    return;
  }

  if (!update.downloadUrl) {
    update = await refreshAppUpdateState({ silent: false, force: true });
    if (!update.downloadUrl) {
      showToast('没有找到可用的安装包下载地址');
      return;
    }
  }

  try {
    await plugin.downloadAndInstall({
      url: update.downloadUrl,
      fileName: `NJUST_Companion-v${update.latestVersionName || 'release'}.apk`
    });
    showToast('开始下载更新，下载完成后系统会弹出安装');
  } catch (error) {
    if (error?.code === 'INSTALL_PERMISSION_REQUIRED' || /安装更新包/.test(error?.message || '')) {
      try {
        await plugin.openInstallSettings();
        showToast('请先允许本应用安装更新包');
      } catch (openError) {
        showToast(openError.message || '打开安装权限设置失败');
      }
      return;
    }
    showToast(error.message || '开始更新失败');
  }
}

function openLatestReleasePage() {
  const target = getAppUpdateState().releaseUrl || APP_UPDATE_CONFIG.releasesPage;
  void openSiteLink(target);
}

function getNotificationId(seed) {
  return (hashString(seed) % 2000000000) + 10000;
}

function buildGradeSignature(grades = state.data.grades) {
  return [...grades]
    .map(grade => [
      grade.semester || '',
      grade.code || '',
      grade.name || '',
      grade.credit || 0,
      getGradeScoreLabel(grade),
      formatGradePoint(grade)
    ].join('|'))
    .sort()
    .join('||');
}

function getCourseInstanceStart(instance) {
  if (!instance?.date || !instance?.course) return null;
  const range = getPeriodRange(instance.course.periods);
  if (!range.start) return null;
  const date = new Date(instance.date);
  if (Number.isNaN(date.getTime())) return null;
  const [hour, minute] = range.start.split(':').map(Number);
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date;
}

async function probeNotificationRuntime({ prompt = false, openExactAlarm = false } = {}) {
  const plugin = getLocalNotificationsPlugin();
  const status = {
    permissionState: 'unavailable',
    exactAlarmState: 'unavailable',
    lastNotificationCheckAt: new Date().toISOString(),
    lastNotificationError: ''
  };

  if (!plugin) {
    return status;
  }

  try {
    let permission = null;
    try {
      permission = await plugin.checkPermissions();
    } catch {
      permission = null;
    }

    if (prompt && permission?.display !== 'granted') {
      try {
        permission = await plugin.requestPermissions();
      } catch (error) {
        status.lastNotificationError = error.message || '通知权限请求失败';
      }
    }

    status.permissionState = permission?.display || 'unknown';

    if (status.permissionState !== 'granted') {
      return status;
    }

    if (typeof plugin.checkExactNotificationSetting === 'function') {
      let exact = null;
      try {
        exact = await plugin.checkExactNotificationSetting();
      } catch {
        exact = null;
      }

      status.exactAlarmState = exact?.exact_alarm || 'unknown';

      if (openExactAlarm && status.exactAlarmState !== 'granted' && typeof plugin.changeExactNotificationSetting === 'function') {
        try {
          exact = await plugin.changeExactNotificationSetting();
          status.exactAlarmState = exact?.exact_alarm || status.exactAlarmState;
        } catch (error) {
          if (!status.lastNotificationError) {
            status.lastNotificationError = error.message || '精确闹钟设置失败';
          }
        }
      }
    } else {
      status.exactAlarmState = 'granted';
    }
  } catch (error) {
    status.lastNotificationError = error.message || '通知权限检查失败';
  }

  return status;
}

async function refreshNotificationStatus({ prompt = false, openExactAlarm = false, persist = false, silent = true } = {}) {
  const status = await probeNotificationRuntime({ prompt, openExactAlarm });
  const changed = updateNotificationRuntimeState(status);
  if (persist && changed) {
    await persistNotificationSettings();
  }
  renderNotificationStatus();

  if (!silent && status.lastNotificationError && (prompt || status.permissionState !== 'granted')) {
    showToast(status.lastNotificationError);
  }

  return status;
}

function buildScheduledNotifications() {
  const settings = getNotificationSettings();
  const now = Date.now();
  const notifications = [];

  if (settings.courseReminders && hasScheduleCourses()) {
    getUpcomingCourseInstances(24, 14).forEach(instance => {
      const startAt = getCourseInstanceStart(instance);
      if (!startAt) return;
      const notifyAt = new Date(startAt.getTime() - settings.leadMinutes * 60000);
      if (notifyAt.getTime() <= now + 30000) return;
      const range = getPeriodRange(instance.course.periods);
      notifications.push({
        id: getNotificationId(`course:${instance.week}:${instance.weekday}:${instance.course.name}:${range.start}`),
        title: `下节课：${instance.course.name}`,
        body: `${getRelativeDayLabel(instance.date, instance)} ${range.start}-${range.end} · ${instance.course.room || '地点待定'}${instance.course.teacher ? ` · ${instance.course.teacher}` : ''}`,
        schedule: { at: notifyAt },
        extra: { type: 'course', courseName: instance.course.name }
      });
    });
  }

  if (settings.todoReminders) {
    state.todos
      .filter(todo => !todo.done)
      .forEach(todo => {
        const dueAt = getTodoDateTime(todo);
        if (!dueAt) return;
        const notifyAt = new Date(dueAt.getTime() - todo.remindMinutes * 60000);
        if (notifyAt.getTime() <= now + 30000) return;
        notifications.push({
          id: getNotificationId(`todo:${todo.id}`),
          title: `待办：${todo.title}`,
          body: todo.note || formatTodoDueText(todo),
          schedule: { at: notifyAt },
          extra: { type: 'todo', todoId: todo.id }
        });
      });
  }

  return notifications.slice(0, 64);
}

async function cancelScheduledNotifications(ids = getNotificationSettings().scheduledIds) {
  const plugin = getLocalNotificationsPlugin();
  const notifications = Array.isArray(ids)
    ? ids.map(id => Number.parseInt(id, 10)).filter(Number.isInteger).map(id => ({ id }))
    : [];
  if (!plugin || notifications.length === 0) return;
  try {
    await plugin.cancel({ notifications });
  } catch {
    // 取消旧通知失败不影响后续重新调度
  }
}

async function persistNotificationSettings() {
  state.notificationSettings = getNotificationSettings();
  await dbSet('notificationSettings', state.notificationSettings);
}

async function scheduleNotifications({ silent = false } = {}) {
  state.notificationSettings = getNotificationSettings();
  const settings = state.notificationSettings;

  if (!settings.enabled) {
    await cancelScheduledNotifications(settings.scheduledIds);
    state.notificationSettings.scheduledIds = [];
    await persistNotificationSettings();
    return;
  }

  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    if (!silent) showToast('当前环境不支持系统通知，安卓安装包内可用');
    return;
  }

  try {
    const readiness = await refreshNotificationStatus({
      prompt: !silent,
      openExactAlarm: !silent,
      persist: true,
      silent
    });

    if (readiness.permissionState !== 'granted') {
      await cancelScheduledNotifications(settings.scheduledIds);
      state.notificationSettings.scheduledIds = [];
      state.notificationSettings.lastNotificationError = readiness.lastNotificationError || '系统通知权限未开启';
      await persistNotificationSettings();
      if (!silent) showToast('系统通知权限未开启');
      return;
    }

    await cancelScheduledNotifications(settings.scheduledIds);
    const notifications = buildScheduledNotifications();
    if (notifications.length) {
      await plugin.schedule({ notifications });
    }
    state.notificationSettings.scheduledIds = notifications.map(item => item.id);
    state.notificationSettings.lastNotificationError = '';
    await persistNotificationSettings();
    if (readiness.exactAlarmState === 'denied' && !silent) {
      showToast('精确闹钟未开启，提醒可能存在延迟');
    }
    if (!silent) showToast(`已安排 ${notifications.length} 条提醒`);
  } catch (error) {
    state.notificationSettings.lastNotificationError = error.message || '通知设置失败';
    await persistNotificationSettings();
    if (!silent) showToast(error.message || '通知设置失败');
  }
}

async function sendImmediateNotification(title, body) {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.gradeReminders) return;
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) return;
  try {
    const readiness = await refreshNotificationStatus({
      prompt: false,
      openExactAlarm: false,
      persist: true,
      silent: true
    });
    if (readiness.permissionState !== 'granted') return;
    await plugin.schedule({
      notifications: [{
        id: getNotificationId(`grade:${Date.now()}`),
        title,
        body,
        schedule: { at: new Date(Date.now() + 1000) },
        extra: { type: 'grade' }
      }]
    });
  } catch {
    // 成绩通知只是增强能力，失败时不打断同步
  }
}

async function afterDataChanged({ previousGradeSignature = '' } = {}) {
  const settings = getNotificationSettings();
  const currentGradeSignature = buildGradeSignature();

  if (!settings.lastGradeSignature) {
    state.notificationSettings.lastGradeSignature = currentGradeSignature;
    await persistNotificationSettings();
  } else if (
    settings.gradeReminders
    && previousGradeSignature
    && currentGradeSignature
    && currentGradeSignature !== previousGradeSignature
    && currentGradeSignature !== settings.lastGradeSignature
  ) {
    state.notificationSettings.lastGradeSignature = currentGradeSignature;
    await persistNotificationSettings();
    await sendImmediateNotification('成绩有更新', '检测到教务成绩数据发生变化，请打开成绩页查看。');
  } else if (currentGradeSignature !== settings.lastGradeSignature) {
    state.notificationSettings.lastGradeSignature = currentGradeSignature;
    await persistNotificationSettings();
  }

  await scheduleNotifications({ silent: true });
  await updateNativeWidgetData({ silent: true });
}

function buildWidgetPayload() {
  const now = new Date();
  const widgetUpdatedAt = now.toISOString();
  const currentWeek = getCurrentWeek(state.data.meta.semesterStart, now);
  const todayWeekday = getTodayWeekday(now);
  const todayCourses = getCoursesForDay(todayWeekday, currentWeek)
    .slice(0, 4)
    .map(course => ({
      name: course.name,
      room: course.room || '',
      teacher: course.teacher || '',
      time: getPeriodText(course.periods)
    }));
  const nextCourse = getNextCourseInstance();
  const todoItems = getUpcomingTodos(4).map(item => ({
    title: item.todo.title,
    due: formatTodoDueText(item.todo),
    note: item.todo.note || ''
  }));
  const upcomingExams = state.data.exams
    .map(exam => ({ ...exam, countdown: calcExamCountdown(exam.date) }))
    .filter(exam => exam.countdown !== null && exam.countdown >= 0)
    .sort((left, right) => left.countdown - right.countdown)
    .slice(0, 4)
    .map(exam => ({
      name: exam.name,
      date: exam.date || '',
      time: exam.time || '',
      room: exam.room || '',
      countdown: exam.countdown
    }));

  return {
    updatedAt: widgetUpdatedAt,
    updatedAtText: formatClockTime(now),
    semester: state.data.meta.semester || '',
    currentWeek,
    counts: {
      courses: getScheduleCourseCount(),
      todos: state.todos.filter(todo => !todo.done).length,
      exams: upcomingExams.length
    },
    nextCourse: nextCourse ? {
      name: nextCourse.course.name,
      when: `${getRelativeDayLabel(nextCourse.date, nextCourse)} · ${getPeriodText(nextCourse.course.periods)}`,
      room: nextCourse.course.room || '',
      teacher: nextCourse.course.teacher || ''
    } : null,
    todayCourses,
    todos: todoItems,
    exams: upcomingExams
  };
}

async function updateNativeWidgetData({ silent = false } = {}) {
  const plugin = getWidgetPlugin();
  if (!plugin) return;
  try {
    await plugin.save({ payload: JSON.stringify(buildWidgetPayload()) });
    if (!silent) showToast('桌面组件数据已刷新');
  } catch (error) {
    if (!silent) showToast(error.message || '刷新桌面组件失败');
  }
}

async function pinHomeWidget(type) {
  const plugin = getWidgetPlugin();
  if (!plugin) {
    showToast('桌面组件仅 Android 安装包支持');
    return;
  }
  try {
    await updateNativeWidgetData({ silent: true });
    const result = await plugin.pin({ type });
    showToast(result.pinned ? '已请求添加桌面组件' : '当前桌面不支持一键添加，请长按桌面从小组件中选择');
  } catch (error) {
    showToast(error.message || '添加桌面组件失败');
  }
}

function getUpcomingCourseInstances(limit = 6, daysAhead = 10) {
  if (!hasScheduleCourses()) return [];
  const result = [];
  const today = startOfDay(new Date());
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const date = addDays(today, offset);
    const week = getWeekForDate(state.data.meta.semesterStart, date);
    const weekday = getTodayWeekday(date);
    const courses = getCoursesForDay(weekday, week);
    courses.forEach(course => {
      const range = getPeriodRange(course.periods);
      const endMinutes = timeToMinutes(range.end);
      if (offset === 0 && currentMinutes > endMinutes) return;
      result.push({
        course,
        date,
        weekday,
        week,
        isToday: offset === 0,
        isTomorrow: offset === 1
      });
    });
  }

  return result
    .sort((a, b) => {
      const dayDiff = a.date - b.date;
      if (dayDiff !== 0) return dayDiff;
      return getPeriodPosition(a.course.periods[0]) - getPeriodPosition(b.course.periods[0]);
    })
    .slice(0, limit);
}

function getNextCourseInstance() {
  const instances = getUpcomingCourseInstances(1, 14);
  return instances[0] || null;
}

function isCourseLive(course, weekday, week) {
  const today = getTodayWeekday();
  const currentWeek = getCurrentWeek(state.data.meta.semesterStart);
  if (weekday !== today || week !== currentWeek) return false;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const range = getPeriodRange(course.periods);
  return nowMinutes >= timeToMinutes(range.start) && nowMinutes <= timeToMinutes(range.end);
}

function getRelativeDayLabel(date, flags = {}) {
  if (flags.isToday) return '今日';
  if (flags.isTomorrow) return '明日';
  return `${WEEKDAY_NAMES[getTodayWeekday(date)]}`;
}

function calcExamCountdown(dateString) {
  const normalized = normalizeDateString(dateString);
  if (!normalized) return null;
  const examDate = startOfDay(new Date(normalized));
  if (Number.isNaN(examDate.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.round((examDate - today) / 86400000);
}

function scoreToGpa(score) {
  if (typeof score !== 'number') return '--';
  if (score >= 90) return '4.0';
  if (score >= 85) return '3.7';
  if (score >= 82) return '3.3';
  if (score >= 78) return '3.0';
  if (score >= 75) return '2.7';
  if (score >= 72) return '2.3';
  if (score >= 68) return '2.0';
  if (score >= 64) return '1.5';
  if (score >= 60) return '1.0';
  return '0.0';
}

function normalizeScoreText(value) {
  return cleanText(value).replace(/\s+/g, '').replace(/＋/g, '+').replace(/－/g, '-');
}

function scoreTextToNumeric(scoreText) {
  const normalized = normalizeScoreText(scoreText);
  if (!normalized) return null;

  const direct = Number.parseFloat(normalized);
  if (Number.isFinite(direct)) return direct;

  const scoreMap = {
    '优秀': 90,
    '优+': 93,
    '优': 90,
    '优-': 87,
    '良好': 80,
    '良+': 83,
    '良': 80,
    '良-': 77,
    '中等': 70,
    '中+': 73,
    '中': 70,
    '中-': 67,
    '及格': 60,
    '合格': 60,
    '通过': 60,
    '不及格': 0,
    '不合格': 0,
    '未通过': 0,
    '未及格': 0,
    '缺考': 0,
    '旷考': 0,
    '作弊': 0
  };

  return Object.prototype.hasOwnProperty.call(scoreMap, normalized) ? scoreMap[normalized] : null;
}

function getGradeNumericScore(grade) {
  if (!grade) return null;
  if (typeof grade.score === 'number') return grade.score;
  return scoreTextToNumeric(grade.scoreText);
}

function formatScoreValue(value) {
  if (!Number.isFinite(value)) return '--';
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function formatCreditValue(value) {
  if (!Number.isFinite(value)) return '--';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getGradeScoreLabel(grade) {
  if (!grade) return '--';
  if (typeof grade.score === 'number') return formatScoreValue(grade.score);
  return cleanText(grade.scoreText) || '--';
}

function getGradeDisplayType(grade) {
  const attribute = cleanText(grade?.attribute);
  if (attribute) return attribute;
  const legacy = cleanText(grade?.type || grade?.category);
  if (/选修|任选/.test(legacy)) return '任选';
  if (legacy) return '必修';
  return '--';
}

function getGradeCategoryLabel(grade) {
  return cleanText(grade?.category || grade?.type);
}

function getGradePointValue(grade) {
  if (!grade) return null;
  if (Number.isFinite(grade.gpa)) return grade.gpa;
  const derived = Number.parseFloat(scoreToGpa(getGradeNumericScore(grade)));
  return Number.isFinite(derived) ? derived : null;
}

function formatGradePoint(grade) {
  const value = getGradePointValue(grade);
  return value === null ? '--' : value.toFixed(1);
}

function formatStatValue(value, digits = 1) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '--';
}

function computeGradeStats(grades) {
  const credited = grades.filter(item => item.credit > 0);
  const scored = credited
    .map(item => ({ item, numericScore: getGradeNumericScore(item) }))
    .filter(entry => Number.isFinite(entry.numericScore));
  const gpaItems = credited
    .map(item => ({ credit: item.credit, gpa: getGradePointValue(item) }))
    .filter(item => Number.isFinite(item.gpa));

  const totalCredit = credited.reduce((sum, item) => sum + item.credit, 0);
  const weightedScoreCredit = scored.reduce((sum, entry) => sum + entry.item.credit, 0);
  const weightedAverage = weightedScoreCredit
    ? scored.reduce((sum, entry) => sum + entry.numericScore * entry.item.credit, 0) / weightedScoreCredit
    : null;
  const gpaCredit = gpaItems.reduce((sum, item) => sum + item.credit, 0);
  const gpa = gpaCredit
    ? gpaItems.reduce((sum, item) => sum + item.gpa * item.credit, 0) / gpaCredit
    : null;
  const passRate = scored.length
    ? Math.round((scored.filter(entry => entry.numericScore >= 60).length / scored.length) * 100)
    : null;

  return {
    totalCredit,
    weightedAverage,
    gpa,
    passRate,
    countedScoreCredit: weightedScoreCredit,
    scoredCount: scored.length
  };
}

function normalizeCourseMatchName(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[（）()\[\]【】《》]/g, '')
    .replace(/[\s·•,，\-—_]/g, '');
}

function findRelatedGrade(courseName, preferredSemester = state.data.meta.semester) {
  const key = normalizeCourseMatchName(courseName);
  if (!key) return null;

  const matches = state.data.grades
    .filter(grade => normalizeCourseMatchName(grade.name) === key)
    .sort((left, right) => {
      const rightPreferred = preferredSemester && right.semester === preferredSemester ? 1 : 0;
      const leftPreferred = preferredSemester && left.semester === preferredSemester ? 1 : 0;
      if (rightPreferred !== leftPreferred) return rightPreferred - leftPreferred;

      const semesterCompare = (right.semester || '').localeCompare(left.semester || '');
      if (semesterCompare !== 0) return semesterCompare;

      const rightScored = typeof right.score === 'number' ? 1 : 0;
      const leftScored = typeof left.score === 'number' ? 1 : 0;
      if (rightScored !== leftScored) return rightScored - leftScored;

      return (right.credit || 0) - (left.credit || 0);
    });

  return matches[0] || null;
}

function getGradeKey(grade) {
  return [
    grade.semester || '',
    grade.code || '',
    grade.name || '',
    grade.credit || 0,
    grade.score ?? '',
    grade.scoreText || '',
    grade.attribute || '',
    grade.category || ''
  ].join('|');
}

function isEnglishCourseGrade(grade) {
  const source = `${grade.name || ''} ${grade.code || ''}`;
  return /英语|english/i.test(source);
}

function isLikelyElectiveGrade(grade) {
  const bucket = `${grade.attribute || ''} ${grade.category || ''} ${grade.type || ''}`;
  return /选修|任选/.test(bucket);
}

function getDefaultGradeSelection(grade) {
  if (isEnglishCourseGrade(grade)) return false;
  if (isLikelyElectiveGrade(grade)) return false;
  return true;
}

function ensureGradeSelectionState(grades = state.data.grades) {
  let changed = false;
  grades.forEach(grade => {
    const key = getGradeKey(grade);
    if (typeof state.gradeSelections[key] === 'boolean') return;
    state.gradeSelections[key] = getDefaultGradeSelection(grade);
    changed = true;
  });
  return changed;
}

async function persistGradeSelections() {
  try {
    await dbSet('gradeSelections', state.gradeSelections);
  } catch {
    // 选择状态仅作为本地体验增强，写入失败时不阻断使用
  }
}

function isGradeSelected(grade) {
  ensureGradeSelectionState([grade]);
  return Boolean(state.gradeSelections[getGradeKey(grade)]);
}

async function setGradeSelection(key, checked) {
  state.gradeSelections[key] = Boolean(checked);
  await persistGradeSelections();
  renderGrades();
}

async function toggleSemesterGradeSelection(semester, checked) {
  state.data.grades
    .filter(grade => (grade.semester || '未标注学期') === semester)
    .forEach(grade => {
      state.gradeSelections[getGradeKey(grade)] = Boolean(checked);
    });
  await persistGradeSelections();
  renderGrades();
}

function getBestCetRecord(certs = state.data.certs) {
  return [...certs]
    .filter(item => item && Number.isFinite(item.totalScore) && /(CET4|CET6|四级|六级)/i.test(item.kind || item.name))
    .sort((left, right) => {
      if ((right.totalScore || 0) !== (left.totalScore || 0)) return (right.totalScore || 0) - (left.totalScore || 0);
      return (right.date || '').localeCompare(left.date || '');
    })[0] || null;
}

function convertCetToGrade(cert) {
  if (!cert || !Number.isFinite(cert.totalScore)) return null;
  return {
    name: cert.name,
    credit: 8,
    score: (cert.totalScore / 710) * 100,
    scoreText: '',
    attribute: '等级考试',
    category: '等级考试',
    semester: '',
    gpa: null
  };
}

function buildGradeSummaryRows(allGrades, selectedGrades) {
  const bestCet = getBestCetRecord();
  const allStats = computeGradeStats(allGrades);
  const selectedStats = computeGradeStats(selectedGrades);
  const cetGrade = convertCetToGrade(bestCet);
  const selectedWithCetStats = computeGradeStats(cetGrade ? [...selectedGrades, cetGrade] : selectedGrades);
  return {
    bestCet,
    rows: [
      { label: '全部课程', stats: allStats },
      { label: '已选课程', stats: selectedStats },
      { label: '已选+四六级', stats: selectedWithCetStats, cert: bestCet }
    ]
  };
}

function buildGradeSummaryTable(rows, options = {}) {
  const title = options.title ? `<div class="grade-summary-title">${escapeHtml(options.title)}</div>` : '';
  const lastHeader = options.lastHeader || 'GPA / 四六级';
  return `
    <div class="grade-summary-card">
      ${title}
      <div class="grade-summary-table">
        <div class="grade-summary-row grade-summary-head">
          <div>课程类型</div>
          <div>总学分</div>
          <div>加权平均分</div>
          <div>${escapeHtml(lastHeader)}</div>
        </div>
        ${rows.map(row => `
          <div class="grade-summary-row">
            <div>${escapeHtml(row.label)}</div>
            <div>${escapeHtml(formatCreditValue(row.stats.totalCredit))}</div>
            <div>${escapeHtml(formatStatValue(row.stats.weightedAverage, 3))}</div>
            <div>
              <div>${escapeHtml(formatStatValue(row.stats.gpa, 3))}</div>
              ${row.cert ? `<div class="grade-summary-note">${escapeHtml(String(row.cert.totalScore))} 分</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function closeGradeHelp() {
  const modal = document.getElementById('grade-help-modal');
  if (!modal) return;
  modal.classList.remove('open');
}

function openGradeHelp() {
  const modal = document.getElementById('grade-help-modal');
  if (!modal) return;
  modal.classList.add('open');
}

function getScoreClass(score) {
  const numericScore = typeof score === 'number' ? score : scoreTextToNumeric(score);
  if (!Number.isFinite(numericScore)) return 'good';
  if (numericScore >= 90) return '';
  if (numericScore >= 75) return 'good';
  if (numericScore >= 60) return 'pass';
  return 'fail';
}

function buildEmptyState(icon, title, desc) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${escapeHtml(icon)}</div>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-desc">${escapeHtml(desc)}</div>
    </div>
  `;
}

function renderStatusGrid(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = buildStatusGridHtml();
}

function renderHome() {
  const now = new Date();
  const currentWeek = getCurrentWeek(state.data.meta.semesterStart, now);
  const syncedSections = SECTION_KEYS.filter(section => getSectionStatus(section).synced);

  document.getElementById('hero-week').textContent = currentWeek
    ? `第 ${currentWeek} 周${state.data.meta.semester ? ` · ${state.data.meta.semester}` : ''}`
    : '准备同步教务数据';
  document.getElementById('hero-date').textContent = formatHumanDate(now);
  document.getElementById('hero-sub').textContent = hasAnyData()
    ? `${state.server.loggedIn ? '自动同步在线' : '本地缓存模式'} · 最近同步 ${formatRelativeImportTime(getDisplaySyncAt())}`
    : state.server.available
      ? '可直接登录教务系统并自动同步'
      : '启动本地服务后可直接登录，否则继续使用手动导入';
  const nextCourse = getNextCourseInstance();
  const nextCourseLeadStatus = nextCourse ? getCachedClassroomLeadStatus(nextCourse) : null;
  if (nextCourse) {
    void ensureClassroomLeadStatus(nextCourse);
  }
  const upcomingExams = state.data.exams
    .map(exam => ({ ...exam, countdown: calcExamCountdown(exam.date) }))
    .filter(exam => exam.countdown !== null && exam.countdown >= 0)
    .sort((a, b) => a.countdown - b.countdown);

  const heroHighlight = document.getElementById('hero-highlight');
  if (!hasAnyData()) {
    heroHighlight.innerHTML = `
      <strong>${state.server.available ? '本地同步服务已就绪。' : '当前是空白安装态。'}</strong><br>
      ${state.server.available ? '在设置页输入账号、密码和验证码即可直接登录，后续由本地服务自动同步。' : '如果还没启动本地服务，先执行 npm install && npm start；也可以继续使用书签脚本手动导入。'}
    `;
  } else if (nextCourse) {
    heroHighlight.innerHTML = `
      <strong>下节课：${escapeHtml(nextCourse.course.name)}</strong><br>
      ${escapeHtml(getRelativeDayLabel(nextCourse.date, nextCourse))} · ${escapeHtml(getPeriodText(nextCourse.course.periods))} · ${escapeHtml(nextCourse.course.room || '地点待定')}
      ${nextCourseLeadStatus?.text ? `<br><span class="hero-room-hint ${escapeHtml(nextCourseLeadStatus.tone || 'neutral')}">${escapeHtml(nextCourseLeadStatus.text)}</span>` : ''}
    `;
  } else if (upcomingExams[0]) {
    heroHighlight.innerHTML = `
      <strong>最近考试：${escapeHtml(upcomingExams[0].name)}</strong><br>
      ${escapeHtml(upcomingExams[0].date)} · ${escapeHtml(upcomingExams[0].time || '时间待定')} · 还剩 ${escapeHtml(String(upcomingExams[0].countdown))} 天
    `;
  } else {
    heroHighlight.innerHTML = `
      <strong>${escapeHtml(String(syncedSections.length))} 个模块已就绪。</strong><br>
      你可以离线查看已经缓存到本机的课表、成绩和考试安排。
    `;
  }

  const nextCourseCard = document.getElementById('next-course-card');
  if (!hasAnyData()) {
    nextCourseCard.innerHTML = buildEmptyState('☁️', '还没有同步数据', '打开设置页，复制书签脚本并导入当前页面 JSON。');
  } else if (!nextCourse) {
    nextCourseCard.innerHTML = `
      <div class="next-card-state">
        <div class="next-card-icon">🌤️</div>
        <div class="next-card-copy">
          <div class="next-card-title">近期没有可显示的课程</div>
          <div class="next-card-meta">如果课表为空，先同步课表页面；如果已经放假，可以手动切换周次查看历史课程。</div>
        </div>
      </div>
    `;
  } else {
    const range = getPeriodRange(nextCourse.course.periods);
    nextCourseCard.innerHTML = `
      <div class="next-card-state">
        <div class="next-card-icon">${isCourseLive(nextCourse.course, nextCourse.weekday, nextCourse.week) ? '⏱️' : '🎒'}</div>
        <div class="next-card-copy">
          <div class="next-card-title">${escapeHtml(nextCourse.course.name)}</div>
          <div class="next-card-meta">
            ${escapeHtml(getRelativeDayLabel(nextCourse.date, nextCourse))} · ${escapeHtml(range.start)}-${escapeHtml(range.end)}<br>
            ${escapeHtml(nextCourse.course.room || '地点待定')} · ${escapeHtml(nextCourse.course.teacher || '教师未标注')}
          </div>
          ${nextCourseLeadStatus?.text ? `<div class="next-card-hint ${escapeHtml(nextCourseLeadStatus.tone || 'neutral')}">${escapeHtml(nextCourseLeadStatus.text)}</div>` : ''}
        </div>
      </div>
    `;
  }

  const lessonList = document.getElementById('home-lesson-list');
  const upcomingLessons = getUpcomingCourseInstances(5, 14);
  if (upcomingLessons.length === 0) {
    lessonList.innerHTML = buildEmptyState('🗓️', '没有找到最近课程', '请确认已经同步课表，并在设置页填写学期开始日期。');
  } else {
    lessonList.innerHTML = upcomingLessons.map(instance => `
      <div class="lesson-row">
        <div class="lesson-badge ${instance.isToday ? 'today' : instance.isTomorrow ? 'tomorrow' : 'future'}">${escapeHtml(getRelativeDayLabel(instance.date, instance))}</div>
        <div class="lesson-main">
          <div class="lesson-title">${escapeHtml(instance.course.name)}</div>
          <div class="lesson-meta">${escapeHtml(getPeriodText(instance.course.periods))} · ${escapeHtml(getCourseWeekText(instance.course))}</div>
        </div>
        <div class="lesson-room">${escapeHtml(instance.course.room || '地点待定')}</div>
      </div>
    `).join('');
  }

  const homeExamList = document.getElementById('home-exam-list');
  if (upcomingExams.length === 0) {
    homeExamList.innerHTML = `<div class="card">${buildEmptyState('📝', '近期没有考试安排', '同步考试页面后，这里会显示倒计时和考场信息。')}</div>`;
  } else {
    homeExamList.innerHTML = upcomingExams.slice(0, 3).map(exam => `
      <div class="card exam-card">
        <div class="exam-head">
          <div>
            <div class="exam-title">${escapeHtml(exam.name)}</div>
            <div class="exam-meta">${escapeHtml(exam.date)} · ${escapeHtml(exam.time || '时间待定')}<br>${escapeHtml(exam.room || '考场待定')} ${exam.seat ? `· ${escapeHtml(exam.seat)}` : ''}</div>
          </div>
          <div class="count-chip">${exam.countdown === 0 ? '今天' : `${escapeHtml(String(exam.countdown))} 天`}</div>
        </div>
      </div>
    `).join('');
  }

  const recentGrades = [...state.data.grades]
    .sort((a, b) => `${b.semester}|${b.name}`.localeCompare(`${a.semester}|${a.name}`))
    .slice(0, 4);

  const homeGradeList = document.getElementById('home-grade-list');
  if (recentGrades.length === 0) {
    homeGradeList.innerHTML = buildEmptyState('📊', '还没有成绩数据', '同步成绩页面后，这里会显示最近课程和分数。');
  } else {
    homeGradeList.innerHTML = recentGrades.map(grade => `
      <div class="grade-row">
        <div class="grade-score ${escapeHtml(getScoreClass(getGradeNumericScore(grade)))}">${escapeHtml(getGradeScoreLabel(grade))}</div>
        <div class="grade-main">
          <div class="grade-title">${escapeHtml(grade.name)}</div>
          <div class="grade-meta">${escapeHtml(formatSemesterLabel(grade.semester))} · ${escapeHtml(formatCreditValue(grade.credit || 0))} 学分${getGradeDisplayType(grade) !== '--' ? ` · ${escapeHtml(getGradeDisplayType(grade))}` : ''}</div>
        </div>
        <div class="grade-side">GPA<br>${escapeHtml(formatGradePoint(grade))}</div>
      </div>
    `).join('');
  }
}

function getScheduleNowLineTop() {
  return getScheduleNowLineTopWithMetrics(SCHEDULE_SLOT_HEIGHT, SCHEDULE_SLOT_GAP);
}

function getScheduleNowLineTopWithMetrics(slotHeight, slotGap) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slotSize = slotHeight + slotGap;

  for (let index = 0; index < PERIOD_SEQUENCE.length; index += 1) {
    const period = PERIOD_SEQUENCE[index];
    const periodTime = PERIOD_TIMES[period];
    if (!periodTime) continue;
    const start = timeToMinutes(periodTime.start);
    const end = timeToMinutes(periodTime.end);
    if (nowMinutes >= start && nowMinutes <= end) {
      const progress = (nowMinutes - start) / Math.max(1, end - start);
      return index * slotSize + progress * slotHeight;
    }
    if (nowMinutes < start) {
      return index === 0 ? null : index * slotSize - slotGap / 2;
    }
  }

  return null;
}

function getScheduleLayoutMetrics() {
  const compact = window.innerWidth <= 480;
  return {
    compact,
    slotHeight: compact ? 34 : SCHEDULE_SLOT_HEIGHT,
    slotGap: compact ? 2 : SCHEDULE_SLOT_GAP
  };
}

function renderSchedule(weekday = state.currentWeekday || getTodayWeekday()) {
  state.currentWeekday = weekday;
  state.scheduleDetailMap = {};
  const viewMode = state.scheduleViewMode || 'week';
  const layout = getScheduleLayoutMetrics();
  const selectedWeek = getSelectedWeek();
  const currentWeek = getCurrentWeek(state.data.meta.semesterStart);
  const currentDay = getTodayWeekday();
  const isCurrentWeek = Boolean(currentWeek) && selectedWeek === currentWeek;
  const effectiveWeek = viewMode === 'week' ? selectedWeek : null;
  const weekSwitcher = document.getElementById('schedule-week-switcher');

  document.getElementById('selected-week-label').textContent = viewMode === 'week' ? `第 ${selectedWeek} 周` : '总课表';
  document.getElementById('schedule-week-hint').textContent = viewMode === 'week'
    ? (
        currentWeek
          ? `当前推算第 ${currentWeek} 周，左右滑动切换`
          : '左右滑动切换周次'
      )
    : `显示 ${state.data.meta.semester || '当前学期'} 全部课程`;
  if (weekSwitcher) {
    weekSwitcher.hidden = viewMode !== 'week';
  }

  const summary = document.getElementById('schedule-summary');
  const board = document.getElementById('schedule-board');
  renderScheduleFooterBar();

  if (!hasScheduleCourses()) {
    summary.innerHTML = `
      <div class="summary-title">课表尚未同步</div>
      <div class="summary-meta">完成登录同步后，这里会展示类似手机课程表的整周视图。</div>
    `;
    board.innerHTML = `<div class="card">${buildEmptyState('📅', '当前没有课程可显示', '同步课表后可以按周次查看整周排课。')}</div>`;
    return;
  }

  const weeklyEntries = buildScheduleEntriesForWeek(effectiveWeek);
  const weekDates = viewMode === 'week'
    ? Array.from({ length: 7 }, (_, index) => getDateForWeekday(selectedWeek, index + 1))
    : Array.from({ length: 7 }, () => null);
  const allCourses = getAllScheduleCourses();
  const activeCourses = viewMode === 'week'
    ? allCourses.filter(course => isCourseActiveInWeek(course, selectedWeek))
    : [...allCourses];
  const focusDay = viewMode === 'week' && isCurrentWeek ? currentDay : weekday;
  const focusCourses = weeklyEntries[focusDay] || [];
  const busiestDay = [1, 2, 3, 4, 5, 6, 7]
    .map(day => ({ day, count: (weeklyEntries[day] || []).length }))
    .sort((left, right) => right.count - left.count || left.day - right.day)[0];

  summary.innerHTML = `
    <div class="schedule-stats">
      <div class="schedule-stat-card">
        <span>学期</span>
        <strong>${escapeHtml(formatSemesterLabel(state.data.meta.semester || '当前周'))}</strong>
      </div>
      <div class="schedule-stat-card">
        <span>${escapeHtml(viewMode === 'week' ? '本周课程' : '总课程数')}</span>
        <strong>${escapeHtml(String(activeCourses.length))}</strong>
      </div>
      <div class="schedule-stat-card">
        <span>${escapeHtml(viewMode === 'week' ? (isCurrentWeek ? '今日课程' : `${WEEKDAY_NAMES[focusDay]}课程`) : `${WEEKDAY_NAMES[focusDay]}排课`)}</span>
        <strong>${escapeHtml(String(focusCourses.length))}</strong>
      </div>
      <div class="schedule-stat-card">
        <span>${escapeHtml(viewMode === 'week' ? '最忙一天' : '课表跨度')}</span>
        <strong>${escapeHtml(viewMode === 'week'
          ? (busiestDay && busiestDay.count ? WEEKDAY_NAMES[busiestDay.day] : '暂无')
          : `1-${getMaxWeek()}周`)}</strong>
      </div>
    </div>
  `;

  if (activeCourses.length === 0) {
    board.innerHTML = `<div class="card">${buildEmptyState('☕', viewMode === 'week' ? '这一周没有排课' : '当前学期没有课程', viewMode === 'week' ? '你可以切换其他周次，或检查课表是否同步完整。' : '请检查课表是否同步完整，或切回周视图查看当前周。')}</div>`;
    return;
  }

  const totalPeriods = PERIOD_SEQUENCE.length;
  const boardHeight = totalPeriods * layout.slotHeight + (totalPeriods - 1) * layout.slotGap;
  const firstDate = weekDates.find(Boolean);
  const boardClass = `schedule-board ${viewMode === 'semester' ? 'semester-mode' : 'week-mode'} ${layout.compact ? 'compact-mode' : ''}`;

  board.innerHTML = `
    <div class="schedule-board-card ${viewMode === 'semester' ? 'semester-mode' : 'week-mode'}">
      <div class="schedule-bg-layer" aria-hidden="true"></div>
      <div class="schedule-board-scroll">
        <div class="${boardClass}" style="--schedule-slot-height:${layout.slotHeight}px;--schedule-slot-gap:${layout.slotGap}px;--schedule-board-height:${boardHeight}px;--schedule-slot-count:${totalPeriods};">
          <div class="schedule-board-head">
            <div class="schedule-board-corner">
              <div class="schedule-board-month">${escapeHtml(viewMode === 'week' ? formatScheduleMonth(firstDate || new Date()) : '总课')}</div>
              <div class="schedule-board-sub">${escapeHtml(state.data.meta.semester || (viewMode === 'week' ? `第 ${selectedWeek} 周` : '当前学期'))}</div>
            </div>
            ${[1, 2, 3, 4, 5, 6, 7].map(day => {
              const date = weekDates[day - 1];
              const headerClass = [
                'schedule-day-head',
                day === focusDay ? 'focus' : '',
                isCurrentWeek && day === currentDay ? 'today' : '',
                day >= 6 ? 'weekend' : ''
              ].filter(Boolean).join(' ');
              return `
                <button type="button" class="${headerClass}" onclick="setScheduleFocusDay(${day})">
                  ${viewMode === 'week' ? `<div class="schedule-day-date">${escapeHtml(formatScheduleDayNumber(date))}</div>` : ''}
                  <div class="schedule-day-name">${escapeHtml(WEEKDAY_NAMES[day])}</div>
                </button>
              `;
            }).join('')}
          </div>
          <div class="schedule-board-body">
            <div class="schedule-time-column">
              ${PERIOD_SEQUENCE.map(period => {
                return `
                  <div class="schedule-time-slot">
                    <div class="schedule-time-index">${escapeHtml(String(period))}</div>
                    <div class="schedule-time-start">${escapeHtml(PERIOD_TIMES[period]?.start || '')}</div>
                    <div class="schedule-time-end">${escapeHtml(PERIOD_TIMES[period]?.end || '')}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="schedule-days-grid">
              ${[1, 2, 3, 4, 5, 6, 7].map(day => {
                const dayEntries = weeklyEntries[day] || [];
                const columnClass = [
                  'schedule-day-column',
                  day === focusDay ? 'focus' : '',
                  isCurrentWeek && day === currentDay ? 'today' : '',
                  day >= 6 ? 'weekend' : ''
                ].filter(Boolean).join(' ');

                const blocks = dayEntries.map((entry, index) => {
                  const range = getPeriodRange(entry.periods);
                  const span = range.span;
                  const top = range.startPosition * (layout.slotHeight + layout.slotGap);
                  const height = span * layout.slotHeight + (span - 1) * layout.slotGap;
                  const leftPercent = (100 / entry.laneCount) * entry.lane;
                  const widthPercent = 100 / entry.laneCount;
                  const theme = getScheduleBlockTheme(entry.course);
                  const liveWeek = viewMode === 'week' ? selectedWeek : currentWeek;
                  const isLive = Boolean(liveWeek) && isCourseLive(entry.course, day, liveWeek);
                  const showTeacher = height >= 116 && entry.course.teacher;
                  const badgeText = entry.course.oddEven
                    ? `${entry.course.oddEven}周`
                    : viewMode === 'semester' && height >= 116
                      ? `${entry.course.startWeek}-${entry.course.endWeek}周`
                      : '';
                  const showBadge = height >= 116 && badgeText;
                  const title = `${entry.course.name} | ${getPeriodText(entry.periods)} | ${entry.course.room || '地点待定'}${entry.course.teacher ? ` | ${entry.course.teacher}` : ''}${viewMode === 'semester' ? ` | ${getCourseWeekText(entry.course)}` : ''}`;
                  const detailId = `${viewMode}-${selectedWeek || 'all'}-d${day}-i${index}`;
                  state.scheduleDetailMap[detailId] = {
                    ...entry,
                    viewMode,
                    selectedWeek,
                    weekday: day,
                    date: weekDates[day - 1] ? formatDateKey(weekDates[day - 1]) : '',
                    isLive
                  };

                  return `
                    <button
                      class="schedule-block ${isLive ? 'live' : ''} ${entry.course.isCustom ? 'custom' : ''}"
                      type="button"
                      style="top:${top}px;height:${height}px;left:calc(${leftPercent}% + 3px);width:calc(${widthPercent}% - 6px);--schedule-block-start:${theme.start};--schedule-block-end:${theme.end};--schedule-block-text:${theme.text};"
                      title="${escapeHtml(title)}"
                      onclick="openScheduleDetail('${detailId}')"
                    >
                      <div class="schedule-block-time">${escapeHtml(range.start)}</div>
                      <div class="schedule-block-room">${escapeHtml(entry.course.room || '地点待定')}</div>
                      <div class="schedule-block-title">${escapeHtml(entry.course.name)}</div>
                      ${showTeacher ? `<div class="schedule-block-teacher">${escapeHtml(entry.course.teacher)}</div>` : ''}
                      ${showBadge ? `<div class="schedule-block-badge">${escapeHtml(badgeText)}</div>` : ''}
                    </button>
                  `;
                }).join('');
                const nowLineTop = viewMode === 'week' && isCurrentWeek && day === currentDay
                  ? getScheduleNowLineTopWithMetrics(layout.slotHeight, layout.slotGap)
                  : null;

                return `
                  <div class="${columnClass}" onclick="handleScheduleColumnClick(event, ${day})">
                    ${Array.from({ length: totalPeriods }, () => '<div class="schedule-grid-slot"></div>').join('')}
                    ${nowLineTop === null ? '' : `<div class="schedule-now-line" style="top:${nowLineTop}px;"><span>现在</span></div>`}
                    ${blocks}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (typeof applyScheduleBoardBackground === 'function') {
    requestAnimationFrame(() => applyScheduleBoardBackground());
  }
}

function renderScheduleFooterBar() {
  const footer = document.getElementById('schedule-footer-bar');
  if (!footer) return;

  const modeLabel = state.scheduleViewMode === 'week' ? `第 ${getSelectedWeek()} 周` : '总课表';
  const modeHint = state.scheduleViewMode === 'week' ? '左右滑动切换' : '当前学期总览';

  footer.innerHTML = `
    <div class="schedule-footer-shell">
      <div class="schedule-footer-copy">
        <div class="schedule-footer-mode">${escapeHtml(modeLabel)}</div>
        <div class="schedule-footer-hint">${escapeHtml(modeHint)}</div>
      </div>
      <div class="schedule-footer-semester">${escapeHtml(state.data.meta.semester || '当前学期')}</div>
      <div class="schedule-footer-actions">
        <button
          type="button"
          class="schedule-footer-btn ${state.scheduleViewMode === 'week' ? 'active' : ''}"
          title="切换到周视图"
          onclick="setScheduleViewMode('week')"
        >周</button>
        <button
          type="button"
          class="schedule-footer-btn ${state.scheduleViewMode === 'semester' ? 'active' : ''}"
          title="切换到总课表"
          onclick="setScheduleViewMode('semester')"
        >期</button>
      </div>
    </div>
  `;
}

function closeScheduleDetail() {
  const modal = document.getElementById('course-detail-modal');
  if (!modal) return;
  state.activeScheduleDetailId = '';
  modal.classList.remove('open');
}

function openScheduleDetail(detailId, rerenderOnly = false) {
  const detail = state.scheduleDetailMap[detailId];
  if (!detail) {
    showToast('课程详情不可用');
    return;
  }

  const modal = document.getElementById('course-detail-modal');
  const content = document.getElementById('course-detail-content');
  if (!modal || !content) return;
  state.activeScheduleDetailId = detailId;

  const grade = findRelatedGrade(detail.course.name);
  const courseCredit = detail.course.credit > 0 ? detail.course.credit : (grade?.credit || 0);
  const range = getPeriodRange(detail.periods);
  const detailDate = detail.date ? new Date(`${detail.date}T00:00:00`) : null;
  const detailLeadStatus = getScheduleDetailLeadStatus(detail);
  const topMeta = detail.viewMode === 'semester'
    ? `总课表 · ${WEEKDAY_NAMES[detail.weekday]}`
    : `第 ${detail.selectedWeek} 周 · ${WEEKDAY_NAMES[detail.weekday]}${detailDate ? ` · ${escapeHtml(formatShortDate(detailDate))}` : ''}`;
  const detailItems = [
    { label: '上课时间', value: getPeriodText(detail.periods) },
    { label: '任课教师', value: detail.course.teacher || '未标注' },
    { label: '上课地点', value: detail.course.room || '未标注' },
    { label: '上课周次', value: getCourseWeekText(detail.course) },
    { label: '课程学分', value: courseCredit ? `${formatCreditValue(courseCredit)} 学分` : '未标注' },
    { label: detail.viewMode === 'semester' ? '当前状态' : '本周状态', value: detail.isLive ? '正在上课' : (detail.viewMode === 'semester' ? '当前学期排课' : '本周有课') }
  ];

  if (detail.course.groupName) {
    detailItems.splice(2, 0, { label: '教学分组', value: detail.course.groupName });
  }
  if (detail.course.code) {
    detailItems.push({ label: '课程编号', value: detail.course.code });
  }
  if (detail.course.sequence) {
    detailItems.push({ label: '课序号', value: detail.course.sequence });
  }
  if (detail.course.attribute) {
    detailItems.push({ label: '课程属性', value: detail.course.attribute });
  }
  if (detail.course.stage) {
    detailItems.push({ label: '选课阶段', value: detail.course.stage });
  }
  if (detail.course.semester) {
    detailItems.push({ label: '所属学期', value: formatSemesterLabel(detail.course.semester) });
  }

  if (grade) {
    detailItems.push(
      { label: '关联成绩', value: getGradeScoreLabel(grade) },
      { label: '关联绩点', value: formatGradePoint(grade) },
      { label: '成绩学期', value: formatSemesterLabel(grade.semester) }
    );
    if (grade.type) {
      detailItems.splice(7, 0, { label: '课程类型', value: grade.type });
    }
  }

  const detailLeadStatusHtml = detailLeadStatus?.text ? `
    <div class="course-detail-callout ${escapeHtml(detailLeadStatus.tone || 'neutral')}">
      <div class="course-detail-callout-title">教室空闲提示</div>
      <div class="course-detail-callout-text">${escapeHtml(detailLeadStatus.text)}</div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="course-detail-hero">
      <div class="course-detail-kicker">${topMeta}</div>
      <div class="course-detail-time">${escapeHtml(range.start)} - ${escapeHtml(range.end)}</div>
      <div class="course-detail-title">${escapeHtml(detail.course.name)}</div>
      <div class="tag-row course-detail-tags">
        <span class="pill highlight">${escapeHtml(range.min === range.max ? `第${range.min}节` : `${range.min}-${range.max}节`)}</span>
        ${detail.course.oddEven ? `<span class="pill">${escapeHtml(detail.course.oddEven)}周</span>` : ''}
        ${courseCredit ? `<span class="pill">${escapeHtml(formatCreditValue(courseCredit))} 学分</span>` : ''}
        ${detail.course.attribute ? `<span class="pill">${escapeHtml(detail.course.attribute)}</span>` : ''}
      </div>
    </div>

    <div class="course-detail-section">
      <div class="course-detail-section-title">课程信息</div>
      <div class="course-detail-list">
        ${detailItems.map(item => `
          <div class="course-detail-row">
            <span class="course-detail-key">${escapeHtml(item.label)}</span>
            <span class="course-detail-value">${escapeHtml(item.value)}</span>
          </div>
        `).join('')}
      </div>
      ${detailLeadStatusHtml}
    </div>

    <div class="course-detail-section">
      <div class="course-detail-section-title">成绩联动</div>
      ${grade ? `
        <div class="course-grade-summary">
          <div class="course-grade-card">
            <span>成绩</span>
            <strong>${escapeHtml(getGradeScoreLabel(grade))}</strong>
          </div>
          <div class="course-grade-card">
            <span>绩点</span>
            <strong>${escapeHtml(formatGradePoint(grade))}</strong>
          </div>
          <div class="course-grade-card">
            <span>学分</span>
            <strong>${escapeHtml(formatCreditValue(courseCredit || grade.credit || 0))}</strong>
          </div>
        </div>
      ` : `
        <div class="course-detail-empty">当前还没在已同步成绩里匹配到这门课。课表里的学分和选课信息已经直接来自教务处，出分后重新同步即可自动补上成绩和绩点。</div>
      `}
    </div>

    ${typeof buildCourseLinkedTodosHtml === 'function' ? buildCourseLinkedTodosHtml(detail.course.name) : ''}

    <div class="action-row mt-12">
      ${detail.course.isCustom ? `
        <button class="btn btn-outline" onclick="openCustomCourseModal({ id: '${escapeJsString(detail.course.id)}' })">编辑课程</button>
        <button class="btn btn-danger" onclick="deleteCustomCourse('${escapeJsString(detail.course.id)}')">删除课程</button>
      ` : ''}
      <button class="btn btn-primary btn-block" onclick="closeScheduleDetail()">收起详情</button>
    </div>
  `;

  modal.classList.add('open');

  if (!rerenderOnly) {
    const detailInstance = buildScheduleDetailLeadInstance(detail);
    if (detailInstance && (!detailLeadStatus || detailLeadStatus.status === 'loading')) {
      Promise.resolve(ensureClassroomLeadStatus(detailInstance)).then(() => {
        const currentModal = document.getElementById('course-detail-modal');
        if (state.activeScheduleDetailId === detailId && currentModal?.classList.contains('open')) {
          openScheduleDetail(detailId, true);
        }
      }).catch(() => {});
    }
  }
}

function renderGradeFilters() {
  const target = document.getElementById('grades-semester-filters');
  if (!target) return;
  const semesters = [...new Set(state.data.grades.map(item => item.semester).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));

  target.innerHTML = `
    <button class="filter-chip ${state.gradeSemester === 'all' ? 'active' : ''}" onclick="setGradeSemesterFilter('all')">全部学期</button>
    ${semesters.map(semester => `
      <button class="filter-chip ${state.gradeSemester === semester ? 'active' : ''}" onclick="setGradeSemesterFilter('${escapeHtml(semester)}')">
        ${escapeHtml(formatSemesterLabel(semester))}
      </button>
    `).join('')}
  `;
}

function getFilteredGrades() {
  const search = state.gradeSearch.trim().toLowerCase();
  return state.data.grades.filter(grade => {
    if (state.gradeSemester !== 'all' && grade.semester !== state.gradeSemester) return false;
    if (!search) return true;
    const bucket = `${grade.name} ${grade.code || ''} ${grade.semester} ${grade.attribute || ''} ${grade.category || ''} ${grade.type || ''} ${grade.scoreText} ${grade.score ?? ''}`.toLowerCase();
    return bucket.includes(search);
  });
}

function renderGrades() {
  renderGradeFilters();
  const container = document.getElementById('grades-content');

  if (!getSectionStatus('grades').synced) {
    container.innerHTML = `<div class="card">${buildEmptyState('📊', '成绩尚未同步', '进入教务系统成绩页运行书签脚本后导入即可。')}</div>`;
    return;
  }

  const grades = getFilteredGrades();
  if (grades.length === 0) {
    container.innerHTML = `<div class="card">${buildEmptyState('🔎', '没有匹配结果', '试试清空搜索词，或者切换到其他学期。')}</div>`;
    return;
  }

  if (ensureGradeSelectionState()) {
    void persistGradeSelections();
  }

  const bySemester = {};
  grades.forEach(grade => {
    const key = grade.semester || '未标注学期';
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(grade);
  });

  const selectedGrades = grades.filter(grade => isGradeSelected(grade));
  const topSummary = buildGradeSummaryRows(grades, selectedGrades);
  const overviewTitle = state.gradeSemester === 'all' && !state.gradeSearch.trim()
    ? '全部已修课程'
    : '当前筛选结果';

  let html = `
    <div class="card grade-overview-card">
      <div class="grade-overview-head">
        <div>
          <div class="grade-overview-title">${escapeHtml(overviewTitle)}</div>
          <div class="grade-overview-sub">
            ${topSummary.bestCet
              ? `四六级最高分：${escapeHtml(topSummary.bestCet.kind || topSummary.bestCet.name)} ${escapeHtml(String(topSummary.bestCet.totalScore))} 分`
              : '尚未同步四六级成绩'}
          </div>
        </div>
        <button class="grade-help-btn" type="button" onclick="openGradeHelp()">帮助</button>
      </div>
      ${buildGradeSummaryTable(topSummary.rows)}
    </div>
  `;

  Object.keys(bySemester)
    .sort((a, b) => b.localeCompare(a))
    .forEach(semester => {
      const semesterGrades = bySemester[semester];
      const semesterSelected = semesterGrades.filter(grade => isGradeSelected(grade));
      const semesterStats = buildGradeSummaryRows(semesterGrades, semesterSelected);
      const selectAllChecked = semesterGrades.length > 0 && semesterSelected.length === semesterGrades.length;
      html += `
        <div class="semester-section">
          <div class="card grade-semester-card">
            <div class="semester-header-row">
              <div>
                <div class="semester-header">${escapeHtml(semester)}</div>
                <div class="semester-subheader">${escapeHtml(formatSemesterLabel(semester))}</div>
              </div>
            </div>
            <div class="grade-table">
              <div class="grade-table-row grade-table-head">
                <label class="grade-select-cell">
                  <input
                    class="grade-checkbox"
                    type="checkbox"
                    ${selectAllChecked ? 'checked' : ''}
                    onchange="toggleSemesterGradeSelection('${escapeJsString(semester)}', this.checked)"
                  >
                </label>
                <div class="grade-table-cell course">课程</div>
                <div class="grade-table-cell score">成绩</div>
                <div class="grade-table-cell credit">学分</div>
                <div class="grade-table-cell type">类型</div>
                <div class="grade-table-cell gpa">绩点</div>
              </div>
              ${semesterGrades.map(grade => {
                const key = getGradeKey(grade);
                const checked = isGradeSelected(grade);
                return `
                  <div class="grade-table-row ${checked ? 'selected' : ''}">
                    <label class="grade-select-cell">
                      <input
                        class="grade-checkbox"
                        type="checkbox"
                        ${checked ? 'checked' : ''}
                        onchange="setGradeSelection('${escapeJsString(key)}', this.checked)"
                      >
                    </label>
                    <div class="grade-table-cell course">
                      <div class="grade-course-name">${escapeHtml(grade.name)}</div>
                      <div class="grade-course-meta">${grade.code ? `${escapeHtml(grade.code)} · ` : ''}${escapeHtml(getGradeCategoryLabel(grade) || '课程成绩')}</div>
                    </div>
                    <div class="grade-table-cell score">${escapeHtml(getGradeScoreLabel(grade))}</div>
                    <div class="grade-table-cell credit">${escapeHtml(formatCreditValue(grade.credit || 0))}</div>
                    <div class="grade-table-cell type">${escapeHtml(getGradeDisplayType(grade))}</div>
                    <div class="grade-table-cell gpa">${escapeHtml(formatGradePoint(grade))}</div>
                  </div>
                `;
              }).join('')}
            </div>
            ${buildGradeSummaryTable(semesterStats.rows.slice(0, 2), { title: '本学期统计', lastHeader: 'GPA' })}
          </div>
        </div>
      `;
    });

  container.innerHTML = html;
}

function renderExamFilters() {
  const target = document.getElementById('exam-filters');
  if (!target) return;
  target.innerHTML = EXAM_FILTERS.map(filter => `
    <button class="filter-chip ${state.examFilter === filter.key ? 'active' : ''}" onclick="setExamFilter('${filter.key}')">
      ${escapeHtml(filter.label)}
    </button>
  `).join('');
}

function getFilteredExams() {
  return state.data.exams
    .map(exam => ({ ...exam, countdown: calcExamCountdown(exam.date) }))
    .filter(exam => {
      if (state.examFilter === 'upcoming') return exam.countdown !== null && exam.countdown >= 0;
      if (state.examFilter === 'past') return exam.countdown !== null && exam.countdown < 0;
      return true;
    })
    .sort((a, b) => {
      const left = a.countdown === null ? Number.MAX_SAFE_INTEGER : a.countdown;
      const right = b.countdown === null ? Number.MAX_SAFE_INTEGER : b.countdown;
      return left - right;
    });
}

function renderExams() {
  renderExamFilters();
  const container = document.getElementById('exams-content');

  if (!getSectionStatus('exams').synced) {
    container.innerHTML = `<div class="card">${buildEmptyState('📝', '考试安排尚未同步', '进入教务系统考试页运行书签脚本后导入即可。')}</div>`;
    return;
  }

  const exams = getFilteredExams();
  if (exams.length === 0) {
    container.innerHTML = `<div class="card">${buildEmptyState('😌', '当前筛选下没有考试', '试试切换到“全部”或重新同步考试页面。')}</div>`;
    return;
  }

  const nearest = exams.find(exam => exam.countdown !== null && exam.countdown >= 0) || exams[0];
  let html = `
    <div class="stats-banner">
      <div class="stats-label">最近一场考试</div>
      <div class="stats-value">${escapeHtml(nearest.name)}</div>
      <div class="stats-label" style="margin-top:8px;">
        ${escapeHtml(nearest.date || '日期待定')} · ${escapeHtml(nearest.time || '时间待定')} · ${nearest.countdown === null ? '未提供日期' : nearest.countdown === 0 ? '今天' : `还有 ${nearest.countdown} 天`}
      </div>
    </div>
  `;

  html += exams.map(exam => `
    <div class="card exam-card">
      <div class="exam-head">
        <div>
          <div class="exam-title">${escapeHtml(exam.name)}</div>
          <div class="exam-meta">
            ${escapeHtml(exam.date || '日期待定')} · ${escapeHtml(exam.time || '时间待定')}<br>
            ${escapeHtml(exam.room || '考场待定')}${exam.seat ? ` · ${escapeHtml(exam.seat)}` : ''}
          </div>
        </div>
        <div class="count-chip ${exam.countdown !== null && exam.countdown < 0 ? 'past' : ''}">
          ${exam.countdown === null ? '待定' : exam.countdown === 0 ? '今天' : exam.countdown > 0 ? `${escapeHtml(String(exam.countdown))} 天` : `已过 ${escapeHtml(String(Math.abs(exam.countdown)))} 天`}
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function isSubPage(page = state.currentPage) {
  return SUB_PAGES.includes(page);
}

function updateHeaderForPage(page = state.currentPage) {
  const title = document.getElementById('header-title');
  const leftButton = document.getElementById('header-left-btn');
  if (title) {
    title.textContent = PAGE_TITLES[page] || PAGE_TITLES.home;
  }
  if (leftButton) {
    leftButton.textContent = isSubPage(page) ? '←' : '⟳';
    leftButton.title = isSubPage(page) ? '返回上一页' : '刷新当前页面';
  }
}

function handleHeaderLeftAction() {
  if (isSubPage()) {
    navigate(state.pageBackTarget || 'home');
    return;
  }
  refreshCurrentPage();
}

function getClassroomPeriodGroup(key = state.classrooms.periodGroup) {
  return CLASSROOM_PERIOD_GROUPS.find(item => item.key === String(key)) || CLASSROOM_PERIOD_GROUPS[2];
}

function getClassroomTargetDate(dayOffset = state.classrooms.dayOffset) {
  return startOfDay(addDays(new Date(), Number(dayOffset) || 0));
}

function getClassroomQueryMeta(dayOffset = state.classrooms.dayOffset) {
  const date = getClassroomTargetDate(dayOffset);
  return {
    date,
    week: getWeekForDate(state.data.meta.semesterStart, date) || getSelectedWeek() || 1,
    weekday: getTodayWeekday(date),
    weekdayLabel: WEEKDAY_NAMES[getTodayWeekday(date)],
    dateLabel: formatShortDate(date)
  };
}

function getClassroomCampusLabel(campus) {
  const current = state.classrooms.campuses.find(item => item.value === campus);
  if (current?.label) return current.label;
  if (campus === '4y') return '江阴校区';
  if (campus === '01') return '孝陵卫';
  return campus || '校区';
}

function getClassroomBuildingShortLabel(building) {
  const label = cleanText(building?.shortLabel || building?.label || '');
  const value = cleanText(building?.value);
  if (value === '1' || /Ⅰ教学楼|I教学楼|一工/.test(label)) return '一工';
  if (value === '2' || /Ⅱ教学楼|II教学楼|二工/.test(label)) return '二工';
  if (value === '6' || /Ⅳ教学楼|IV教学楼|四工/.test(label)) return '四工';
  if (value === '9' || /艺文馆/.test(label)) return '艺文馆';
  if (value === '8' || /其他|其它/.test(label)) return '其他';
  return label
    .replace(/教学楼/g, '')
    .replace(/校区/g, '')
    .replace(/\s+/g, '')
    .slice(0, 6) || value || '楼栋';
}

function normalizeRoomReference(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[－—–]/g, '-')
    .replace(/^Ⅰ/, 'I')
    .replace(/^Ⅱ/, 'II')
    .replace(/^Ⅲ/, 'III')
    .replace(/^Ⅳ/, 'IV');
}

function getRoomMatchKey(value) {
  return normalizeRoomReference(value)
    .replace(/一工/g, 'I')
    .replace(/二工/g, 'II')
    .replace(/四工/g, 'IV')
    .replace(/艺文馆/g, 'YIWEN')
    .replace(/其他|其它/g, 'OTHER')
    .toLowerCase()
    .replace(/[（）()\[\]【】《》]/g, '')
    .replace(/[\s·•,，\-—_]/g, '');
}

function getRoomMatchAliases(value) {
  const normalized = normalizeRoomReference(value)
    .replace(/一工/g, 'I')
    .replace(/二工/g, 'II')
    .replace(/四工/g, 'IV');
  const aliases = new Set();
  const primary = getRoomMatchKey(normalized);
  if (primary) aliases.add(primary);

  const noPrefix = normalized.replace(/^(IV|III|II|I)-?/i, '');
  const noPrefixKey = getRoomMatchKey(noPrefix);
  if (noPrefixKey) aliases.add(noPrefixKey);

  const tailMatch = normalized.match(/([A-Z]+-?\d+[A-Z0-9]*)$/i);
  if (tailMatch?.[1]) {
    const tailKey = getRoomMatchKey(tailMatch[1]);
    if (tailKey) aliases.add(tailKey);
  }

  return aliases;
}

function getCoursePrimaryPeriodGroup(course) {
  const periods = Array.isArray(course?.periods) ? course.periods.map(Number).filter(Number.isFinite) : [];
  const firstPeriod = periods
    .filter(period => period !== 14 && period >= 1 && period <= 12)
    .sort((left, right) => getPeriodPosition(left) - getPeriodPosition(right))[0];
  if (!firstPeriod) return null;
  return CLASSROOM_PERIOD_GROUPS.find(group => {
    const start = Number.parseInt(group.startCode, 10);
    const end = Number.parseInt(group.endCode, 10);
    return firstPeriod >= start && firstPeriod <= end;
  }) || null;
}

function getClassroomGroupIndexByKey(key) {
  return CLASSROOM_PERIOD_GROUPS.findIndex(item => item.key === String(key));
}

function getPreviousClassroomPeriodGroup(course) {
  const currentGroup = getCoursePrimaryPeriodGroup(course);
  if (!currentGroup) return null;
  if (!['2', '4'].includes(currentGroup.key)) return null;
  const currentIndex = getClassroomGroupIndexByKey(currentGroup.key);
  if (currentIndex <= 0) return null;
  return {
    currentGroup,
    previousGroup: CLASSROOM_PERIOD_GROUPS[currentIndex - 1]
  };
}

function inferBuildingValueFromRoom(roomText, buildings = state.classrooms.buildings) {
  const raw = cleanText(roomText);
  const normalized = normalizeRoomReference(roomText);
  if (!normalized || /线上|网课|篮球场|操场|田径场|体育馆|游泳馆|实验平台/.test(raw)) return '';

  const knownMappings = [
    { value: '6', patterns: [/^IV-/, /^Ⅳ-/, /四工/, /Ⅳ教学楼/, /IV教学楼/] },
    { value: '2', patterns: [/^II-/, /^Ⅱ-/, /二工/, /Ⅱ教学楼/, /II教学楼/] },
    { value: '1', patterns: [/^I-/, /^Ⅰ-/, /一工/, /Ⅰ教学楼/, /I教学楼/] },
    { value: '9', patterns: [/艺文馆/, /^艺文/] },
    { value: '8', patterns: [/^其他/, /^其它/] }
  ];

  for (const mapping of knownMappings) {
    if (mapping.patterns.some(pattern => pattern.test(normalized) || pattern.test(raw))) {
      return mapping.value;
    }
  }

  const availableBuildings = Array.isArray(buildings) ? buildings : [];
  for (const building of availableBuildings) {
    const label = normalizeRoomReference(building.label);
    const shortLabel = normalizeRoomReference(getClassroomBuildingShortLabel(building));
    if ((label && normalized.startsWith(label)) || (shortLabel && normalized.startsWith(shortLabel))) {
      return cleanText(building.value);
    }
  }

  return '';
}

function findRoomRow(rows, roomText) {
  const roomAliases = getRoomMatchAliases(roomText);
  if (!roomAliases.size) return null;
  return (Array.isArray(rows) ? rows : []).find(row =>
    Array.from(getRoomMatchAliases(row?.id || row?.name || row?.label || row?.room || ''))
      .some(alias => roomAliases.has(alias))
  ) || null;
}

function buildClassroomLeadStatusContext(instance) {
  if (!instance?.course?.room) return null;
  const periodInfo = getPreviousClassroomPeriodGroup(instance.course);
  if (!periodInfo?.previousGroup) return null;
  const building = inferBuildingValueFromRoom(instance.course.room);
  return {
    campus: state.classrooms.campus || '01',
    building,
    week: Number(instance.week) || getWeekForDate(state.data.meta.semesterStart, instance.date) || 1,
    weekday: Number(instance.weekday) || getTodayWeekday(instance.date),
    room: cleanText(instance.course.room),
    roomKey: getRoomMatchKey(instance.course.room),
    currentGroup: periodInfo.currentGroup,
    previousGroup: periodInfo.previousGroup,
    cacheKey: [
      state.classrooms.campus || '01',
      building,
      Number(instance.week) || 0,
      Number(instance.weekday) || 0,
      periodInfo.previousGroup.key,
      getRoomMatchKey(instance.course.room)
    ].join('|')
  };
}

function getCachedClassroomLeadStatus(instance) {
  const context = buildClassroomLeadStatusContext(instance);
  if (!context) return null;
  const cached = classroomLeadStatusCache.get(context.cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (classroomLeadStatusRequests.has(context.cacheKey)) {
    return {
      status: 'loading',
      tone: 'neutral',
      text: `正在检查${context.previousGroup.name}这间教室是否空闲...`
    };
  }
  return null;
}

async function ensureClassroomLeadStatus(instance) {
  const context = buildClassroomLeadStatusContext(instance);
  if (!context || !state.server.available || !state.server.loggedIn) return null;

  const cached = classroomLeadStatusCache.get(context.cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (classroomLeadStatusRequests.has(context.cacheKey)) {
    return classroomLeadStatusRequests.get(context.cacheKey);
  }

  const request = (async () => {
    try {
      await ensureClassroomOptions();
      const knownBuilding = inferBuildingValueFromRoom(context.room, state.classrooms.buildings) || context.building;
      const candidateBuildings = [
        knownBuilding,
        ...state.classrooms.buildings
          .map(item => cleanText(item?.value))
          .filter(Boolean)
      ].filter((value, index, array) => value && array.indexOf(value) === index);

      if (!candidateBuildings.length) {
        const unsupported = {
          status: 'unsupported',
          tone: 'neutral',
          text: ''
        };
        classroomLeadStatusCache.set(context.cacheKey, { ...unsupported, expiresAt: Date.now() + CLASSROOM_LEAD_ERROR_TTL_MS });
        return unsupported;
      }

      let row = null;
      for (const buildingValue of candidateBuildings) {
        const payload = await apiRequest('/api/classrooms/query', {
          method: 'POST',
          body: JSON.stringify({
            semester: state.classrooms.semester || state.data.meta.semester || '',
            campus: context.campus,
            building: buildingValue,
            week: context.week,
            weekday: context.weekday,
            startPeriodCode: context.previousGroup.startCode,
            endPeriodCode: context.previousGroup.endCode,
            dayLabel: WEEKDAY_NAMES[context.weekday] || '',
            periodLabel: context.previousGroup.name
          })
        });

        const result = payload?.result || payload?.data || payload || {};
        row = findRoomRow(result.rows, context.room);
        if (row) break;
      }

      let nextState;
      if (!row) {
        nextState = {
          status: 'unknown',
          tone: 'neutral',
          text: `${context.previousGroup.name}未查到这间教室，建议手动确认`
        };
      } else if ((row.markers || []).length === 0) {
        nextState = {
          status: 'free',
          tone: 'good',
          text: `${context.previousGroup.name}这间教室空闲，可提前过去自习`
        };
      } else {
        nextState = {
          status: 'busy',
          tone: 'warn',
          text: `${context.previousGroup.name}这间教室有课，建议临近上课再去`
        };
      }

      classroomLeadStatusCache.set(context.cacheKey, {
        ...nextState,
        expiresAt: Date.now() + CLASSROOM_LEAD_STATUS_TTL_MS
      });
      return nextState;
    } catch {
      const fallback = {
        status: 'error',
        tone: 'neutral',
        text: ''
      };
      classroomLeadStatusCache.set(context.cacheKey, { ...fallback, expiresAt: Date.now() + CLASSROOM_LEAD_ERROR_TTL_MS });
      return fallback;
    } finally {
      classroomLeadStatusRequests.delete(context.cacheKey);
      if (state.currentPage === 'home') renderHome();
    }
  })();

  classroomLeadStatusRequests.set(context.cacheKey, request);
  return request;
}

function buildScheduleDetailLeadInstance(detail) {
  if (!detail?.course) return null;
  return {
    course: {
      ...detail.course,
      periods: Array.isArray(detail.periods) && detail.periods.length ? detail.periods : detail.course.periods
    },
    week: Number(detail.selectedWeek) || Number(detail.week) || 0,
    weekday: Number(detail.weekday) || 0,
    date: detail.date || ''
  };
}

function getScheduleDetailLeadStatus(detail) {
  const instance = buildScheduleDetailLeadInstance(detail);
  if (!instance) return null;
  return getCachedClassroomLeadStatus(instance);
}

function getVisibleClassroomBuildings() {
  const buildings = Array.isArray(state.classrooms.buildings) ? state.classrooms.buildings : [];
  if (!buildings.length) return [];
  if (state.classrooms.campus !== '01') {
    return buildings.slice(0, 6);
  }

  const selected = new Set();
  const visible = [];
  CLASSROOM_BUILDING_PRIORITY.forEach(value => {
    const found = buildings.find(item => item.value === value);
    if (found) {
      visible.push(found);
      selected.add(found.value);
    }
  });
  if (state.classrooms.building && !selected.has(state.classrooms.building)) {
    const current = buildings.find(item => item.value === state.classrooms.building);
    if (current) {
      visible.push(current);
      selected.add(current.value);
    }
  }
  return visible.length ? visible : buildings.slice(0, 6);
}

function getDefaultClassroomBuilding(buildings, fallback = '') {
  for (const priority of CLASSROOM_BUILDING_PRIORITY) {
    const found = buildings.find(item => item.value === priority);
    if (found) return found.value;
  }
  return fallback || buildings[0]?.value || '';
}

async function loadClassroomOptions({ campus = state.classrooms.campus, force = false, silent = false } = {}) {
  if (state.classrooms.loadingOptions && !force) return null;
  if (state.classrooms.optionsLoaded && state.classrooms.campus === campus && !force) return state.classrooms;

  state.classrooms.loadingOptions = true;
  state.classrooms.error = '';
  if (!silent && state.currentPage === 'classrooms') renderClassrooms();

  try {
    const payload = await apiRequest(`/api/classrooms/options?campus=${encodeURIComponent(campus)}`, { method: 'GET' });
    const options = payload.options || payload.data || payload.result || payload;
    const campuses = Array.isArray(options.campuses) ? options.campuses : [];
    const buildings = Array.isArray(options.buildings) ? options.buildings : [];
    const nextBuilding = buildings.some(item => item.value === state.classrooms.building)
      ? state.classrooms.building
      : getDefaultClassroomBuilding(buildings, state.classrooms.building);

    state.classrooms = {
      ...state.classrooms,
      optionsLoaded: true,
      loadingOptions: false,
      campus: options.campus || campus,
      semester: options.semester || state.classrooms.semester || state.data.meta.semester || '',
      campuses,
      buildings,
      building: nextBuilding,
      error: ''
    };
    if (state.currentPage === 'classrooms') renderClassrooms();
    return state.classrooms;
  } catch (error) {
    state.classrooms.loadingOptions = false;
    state.classrooms.error = error.message || '加载空闲教室选项失败';
    if (state.currentPage === 'classrooms') renderClassrooms();
    throw error;
  }
}

async function ensureClassroomOptions() {
  if (state.classrooms.optionsLoaded && state.classrooms.buildings.length) return state.classrooms;
  return loadClassroomOptions({ campus: state.classrooms.campus, silent: true });
}

async function setClassroomCampus(campus) {
  if (!campus || campus === state.classrooms.campus) return;
  state.classrooms = {
    ...state.classrooms,
    campus,
    optionsLoaded: false,
    buildings: [],
    building: '',
    result: null,
    error: ''
  };
  renderClassrooms();
  try {
    await loadClassroomOptions({ campus, force: true });
  } catch {
    // 错误状态已写入 state
  }
}

function setClassroomBuilding(building) {
  if (!building || building === state.classrooms.building) return;
  state.classrooms.building = building;
  state.classrooms.result = null;
  state.classrooms.error = '';
  renderClassrooms();
}

function setClassroomDayOffset(dayOffset) {
  const value = Number(dayOffset);
  if (!Number.isInteger(value) || value < 0 || value > 3) return;
  state.classrooms.dayOffset = value;
  state.classrooms.result = null;
  state.classrooms.error = '';
  renderClassrooms();
}

function setClassroomPeriodGroup(periodGroup) {
  if (!CLASSROOM_PERIOD_GROUPS.some(item => item.key === String(periodGroup))) return;
  state.classrooms.periodGroup = String(periodGroup);
  state.classrooms.result = null;
  state.classrooms.error = '';
  renderClassrooms();
}

async function queryClassrooms() {
  if (typeof queryClassroomsMulti === 'function') {
    return queryClassroomsMulti();
  }
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

  const meta = getClassroomQueryMeta();
  const periodGroup = getClassroomPeriodGroup();
  state.classrooms.querying = true;
  state.classrooms.error = '';
  renderClassrooms();

  try {
    const payload = await apiRequest('/api/classrooms/query', {
      method: 'POST',
      body: JSON.stringify({
        semester: state.classrooms.semester || state.data.meta.semester || '',
        campus: state.classrooms.campus,
        building: state.classrooms.building,
        week: meta.week,
        weekday: meta.weekday,
        startPeriodCode: periodGroup.startCode,
        endPeriodCode: periodGroup.endCode,
        dayLabel: `${meta.weekdayLabel} ${meta.dateLabel}`,
        periodLabel: periodGroup.name
      })
    });
    state.classrooms.querying = false;
    state.classrooms.updatedAt = new Date().toISOString();
    state.classrooms.result = payload.result || payload.data || payload;
    renderClassrooms();
  } catch (error) {
    state.classrooms.querying = false;
    state.classrooms.error = error.message || '空闲教室查询失败';
    state.classrooms.result = null;
    renderClassrooms();
    showToast(state.classrooms.error);
  }
}

function renderClassroomResults() {
  if (state.classrooms.querying) {
    return `<div class="card">${buildEmptyState('⏳', '正在查询空闲教室', '正在从教务处拉取教室占用情况，请稍候。')}</div>`;
  }
  if (state.classrooms.error) {
    return `<div class="card">${buildEmptyState('⚠️', '查询失败', state.classrooms.error)}</div>`;
  }
  if (!state.classrooms.result) {
    return `<div class="card">${buildEmptyState('🏫', '请查询', '选择楼栋、大节和日期后，点击“开始查询”。')}</div>`;
  }

  const result = state.classrooms.result;
  const rooms = Array.isArray(result.rooms) ? result.rooms : [];
  const summaryText = `${result.semester || state.classrooms.semester} · 第${result.week}周 ${result.weekdayLabel || ''} · ${result.periodLabel || ''}`;
  const selectedPeriodCount = Array.isArray(result.selectedPeriods) && result.selectedPeriods.length
    ? result.selectedPeriods.length
    : Array.isArray(result.selectedPeriodNames) && result.selectedPeriodNames.length
      ? result.selectedPeriodNames.length
      : 1;
  const recommendationHtml = typeof renderStudyRecommendations === 'function'
    ? renderStudyRecommendations(result)
    : '';
  const emptyNote = selectedPeriodCount > 1
    ? '当前所选节次没有同时空闲的教室。可以减少勾选的节次后再查，或换一个楼栋。'
    : '当前条件下没有检索到空闲教室，可能是该楼栋该时段已满，或教务处返回为空。';

  if (!rooms.length) {
    return `
      ${recommendationHtml}
      <div class="card classroom-result-card">
        <div class="classroom-result-head">
          <div>
            <div class="setting-label">查询结果</div>
            <div class="setting-desc">${escapeHtml(summaryText)}</div>
          </div>
          <div class="count-chip">0 间</div>
        </div>
        <div class="classroom-result-note">${escapeHtml(emptyNote)}</div>
      </div>
    `;
  }

  return `
    ${recommendationHtml}
    <div class="card classroom-result-card">
      <div class="classroom-result-head">
        <div>
          <div class="setting-label">查询结果</div>
          <div class="setting-desc">${escapeHtml(summaryText)}</div>
        </div>
        <div class="count-chip">${escapeHtml(String(result.freeCount || rooms.length))} 间</div>
      </div>
      <div class="classroom-result-note">
        ${escapeHtml(getClassroomBuildingShortLabel(state.classrooms.buildings.find(item => item.value === state.classrooms.building) || {}))}
        · 共检索 ${escapeHtml(String(result.totalRooms || rooms.length))} 间教室
        ${selectedPeriodCount > 1 ? ' · 已按所选节次取交集并自动推荐' : ''}
        · 最近更新 ${escapeHtml(formatRelativeImportTime(state.classrooms.updatedAt))}
      </div>
      <div class="classroom-room-list">
        ${rooms.map(room => `
          <button
            class="classroom-room-item compact"
            type="button"
            onclick="copyClassroomName('${escapeJsString(room.room?.name || room.room?.label || room.name || room.label)}')"
            title="点击复制教室名"
          >
            <div class="classroom-room-title">${escapeHtml(room.room?.name || room.room?.label || room.name || room.label)}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderClassrooms() {
  const container = document.getElementById('classrooms-content');
  if (!container) return;

  const meta = getClassroomQueryMeta();
  const visibleBuildings = getVisibleClassroomBuildings();
  const periodGroup = getClassroomPeriodGroup();
  const building = state.classrooms.buildings.find(item => item.value === state.classrooms.building);
  const selectedPeriodGroups = typeof featureState !== 'undefined' && featureState.classroomSelectedPeriods instanceof Set
    ? CLASSROOM_PERIOD_GROUPS.filter(item => featureState.classroomSelectedPeriods.has(item.key))
    : [periodGroup];
  const selectedPeriodLabel = selectedPeriodGroups.map(item => item.name).join('、') || periodGroup.name;
  const classroomChipHtml = typeof buildMultiPeriodChips === 'function'
    ? buildMultiPeriodChips()
    : CLASSROOM_PERIOD_GROUPS.map(item => `
      <button
        class="filter-chip ${state.classrooms.periodGroup === item.key ? 'active' : ''}"
        type="button"
        onclick="setClassroomPeriodGroup('${escapeJsString(item.key)}')"
      >${escapeHtml(item.label)}</button>
    `).join('');

  if (!state.classrooms.optionsLoaded && !state.classrooms.loadingOptions && state.server.available && state.server.loggedIn) {
    void ensureClassroomOptions().catch(() => {});
  }

  container.innerHTML = `
    <div class="subpage-stack">
      <div class="control-card">
          <div class="control-row">
            <div>
            <div class="control-label">空闲教室查询</div>
            <div class="control-value">${escapeHtml(meta.dateLabel)}</div>
            <div class="control-hint">第 ${escapeHtml(String(meta.week))} 周 · ${escapeHtml(meta.weekdayLabel)} · 节次：${escapeHtml(selectedPeriodLabel)}</div>
          </div>
          <button class="btn btn-primary btn-sm" type="button" onclick="queryClassrooms()">${state.classrooms.querying ? '查询中' : '开始查询'}</button>
        </div>
        <div class="setting-desc mt-12">可同时勾选多个大节，系统会返回这些节次都空闲的教室，并自动推荐连续空闲且更安静的房间。</div>
      </div>

      <div class="card">
        <div class="setting-label">校区</div>
        <div class="filter-row mt-12">
          ${(state.classrooms.campuses.length ? state.classrooms.campuses : [
            { value: '01', label: '孝陵卫' },
            { value: '4y', label: '江阴校区' }
          ]).map(item => `
            <button
              class="filter-chip ${state.classrooms.campus === item.value ? 'active' : ''}"
              type="button"
              onclick="setClassroomCampus('${escapeJsString(item.value)}')"
            >${escapeHtml(item.label)}</button>
          `).join('')}
        </div>

        <div class="setting-label mt-12">楼栋</div>
        <div class="filter-row mt-12">
          ${visibleBuildings.length
            ? visibleBuildings.map(item => `
              <button
                class="filter-chip ${state.classrooms.building === item.value ? 'active' : ''}"
                type="button"
                onclick="setClassroomBuilding('${escapeJsString(item.value)}')"
              >${escapeHtml(getClassroomBuildingShortLabel(item))}</button>
            `).join('')
            : '<span class="setting-desc">登录后会从教务处读取可查询楼栋</span>'}
        </div>

        <div class="setting-label mt-12">日期</div>
        <div class="filter-row mt-12">
          ${CLASSROOM_DAY_OPTIONS.map(item => `
            <button
              class="filter-chip ${state.classrooms.dayOffset === item.value ? 'active' : ''}"
              type="button"
              onclick="setClassroomDayOffset(${item.value})"
            >${escapeHtml(item.label)}</button>
          `).join('')}
        </div>

        <div class="setting-label mt-12">节次（可多选）</div>
        <div class="filter-row mt-12">
          ${classroomChipHtml}
        </div>

        <div class="install-tip mt-12">
          当前校区：${escapeHtml(getClassroomCampusLabel(state.classrooms.campus))}
          ${building ? ` · 当前楼栋：${escapeHtml(building.label || getClassroomBuildingShortLabel(building))}` : ''}
          ${state.classrooms.semester ? ` · 学期：${escapeHtml(state.classrooms.semester)}` : ''}
        </div>
      </div>

      ${renderClassroomResults()}
    </div>
  `;
}

async function openSiteLink(url) {
  const target = String(url || '').trim();
  if (!target) return;
  const browserPlugin = window.Capacitor?.Plugins?.Browser;
  if (browserPlugin?.open) {
    try {
      await browserPlugin.open({ url: target });
      return;
    } catch {
      // fallback below
    }
  }
  const popup = window.open(target, '_blank', 'noopener,noreferrer');
  if (popup) return;
  const anchor = document.createElement('a');
  anchor.href = target;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    if (document.visibilityState === 'visible') {
      window.location.href = target;
    }
  }, 120);
}

function copySiteUrl(url) {
  copyTextToClipboard(String(url || ''))
    .then(() => showToast('链接已复制'))
    .catch(() => showToast('复制失败'));
}

function copyClassroomName(name) {
  copyTextToClipboard(String(name || ''))
    .then(() => showToast('教室名已复制'))
    .catch(() => showToast('复制失败'));
}

function renderSites() {
  const container = document.getElementById('sites-content');
  if (!container) return;

  container.innerHTML = `
    <div class="subpage-stack">
      ${COMMON_SITES.map(site => `
        <div class="card site-card">
          <button class="site-main" type="button" onclick="openSiteLink('${escapeJsString(site.url)}')">
            <div class="site-title">${escapeHtml(site.title)}</div>
            <div class="site-url">${escapeHtml(site.url)}</div>
            <div class="site-desc">${escapeHtml(site.desc)}</div>
          </button>
          <div class="site-actions">
            <button class="btn btn-primary btn-sm" type="button" onclick="openSiteLink('${escapeJsString(site.url)}')">打开</button>
            <button class="btn btn-outline btn-sm" type="button" onclick="copySiteUrl('${escapeJsString(site.url)}')">复制链接</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSettings() {
  const loginGuide = document.getElementById('settings-login-guide');
  if (loginGuide) {
    loginGuide.innerHTML = buildSettingsLoginGuideHtml();
  }

  const usernameInput = document.getElementById('login-username');
  if (usernameInput && !usernameInput.value && state.server.username) {
    usernameInput.value = state.server.username;
  }
  const semesterStartInput = document.getElementById('setting-semester-start');
  if (semesterStartInput) {
    semesterStartInput.value = state.data.meta.semesterStart || '';
  }
  const settings = getNotificationSettings();
  const notifyEnabled = document.getElementById('notify-enabled');
  const notifyCourses = document.getElementById('notify-courses');
  const notifyTodos = document.getElementById('notify-todos');
  const notifyGrades = document.getElementById('notify-grades');
  const notifyLeadMinutes = document.getElementById('notify-lead-minutes');
  if (notifyEnabled) notifyEnabled.checked = Boolean(settings.enabled);
  if (notifyCourses) notifyCourses.checked = Boolean(settings.courseReminders);
  if (notifyTodos) notifyTodos.checked = Boolean(settings.todoReminders);
  if (notifyGrades) notifyGrades.checked = Boolean(settings.gradeReminders);
  if (notifyLeadMinutes) notifyLeadMinutes.value = String(settings.leadMinutes || DEFAULT_NOTIFICATION_SETTINGS.leadMinutes);
  renderNotificationStatus();
  renderAppUpdateCard();
  if (state.currentPage === 'settings') {
    void refreshNotificationStatus({ silent: true, persist: false });
    void refreshAppUpdateState({ silent: true });
  }
  renderServerStatus();
}

function renderCurrentPage() {
  if (state.currentPage === 'home') renderHome();
  if (state.currentPage === 'schedule') renderSchedule(state.currentWeekday || getTodayWeekday());
  if (state.currentPage === 'grades') renderGrades();
  if (state.currentPage === 'exams') renderExams();
  if (state.currentPage === 'classrooms') renderClassrooms();
  if (state.currentPage === 'sites') renderSites();
  if (state.currentPage === 'todos') renderTodos();
  if (state.currentPage === 'settings') renderSettings();
}

function navigate(page) {
  if (SUB_PAGES.includes(page)) {
    state.pageBackTarget = MAIN_PAGES.includes(state.currentPage) ? state.currentPage : 'home';
  }
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(element => element.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(element => element.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  updateHeaderForPage(page);
  if (page === 'classrooms' && state.server.available && state.server.loggedIn) {
    void ensureClassroomOptions().catch(() => {});
  }
  renderCurrentPage();
}

function openCampusAuthShortcut() {
  navigate('settings');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('settings-wifi-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

async function refreshCurrentPage() {
  if (state.currentPage === 'classrooms') {
    try {
      await loadClassroomOptions({ campus: state.classrooms.campus, force: true, silent: true });
    } catch {
      // 错误状态已在页面中展示
    }
  }
  renderCurrentPage();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function openImportModal() {
  document.getElementById('import-modal').classList.add('open');
  document.getElementById('import-textarea').value = '';
  document.getElementById('import-textarea').focus();
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('open');
}

async function pasteIntoImportArea() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      showToast('剪贴板里没有可用内容');
      return;
    }
    document.getElementById('import-textarea').value = text;
    showToast('已读取剪贴板内容');
  } catch (error) {
    showToast('当前浏览器不允许读取剪贴板');
  }
}

async function pasteFromClipboard() {
  openImportModal();
  await pasteIntoImportArea();
}

async function importData() {
  const raw = document.getElementById('import-textarea').value.trim();
  if (!raw) {
    showToast('请先粘贴 JSON 数据');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    showToast('JSON 格式错误，请重新复制');
    return;
  }

  try {
    const previousGradeSignature = buildGradeSignature();
    const { merged, sections } = mergeImportedData(state.data, parsed);
    state.data = merged;
    if (Array.isArray(parsed.customCourses)) {
      state.customCourses = normalizeStoredCustomCourses(parsed.customCourses);
      await dbSet('customCourses', state.customCourses);
    }
    if (Array.isArray(parsed.todos)) {
      state.todos = normalizeStoredTodos(parsed.todos);
      await dbSet('todos', state.todos);
    }
    state.selectedWeek = clampSelectedWeek(getCurrentWeek(state.data.meta.semesterStart) || state.selectedWeek || 1);
    await dbSet('main', state.data);
    await afterDataChanged({ previousGradeSignature });
    closeImportModal();
    renderCurrentPage();
    if (state.currentPage !== 'home') renderHome();
    showToast(`已同步：${sections.map(section => SECTION_META[section].label).join('、')}`);
  } catch (error) {
    showToast(error.message || '导入失败');
  }
}

async function saveSemesterStart() {
  const input = document.getElementById('setting-semester-start').value;
  if (!input) {
    showToast('请选择学期开始日期');
    return;
  }
  state.data.meta.semesterStart = normalizeDateString(input);
  state.selectedWeek = clampSelectedWeek(getCurrentWeek(state.data.meta.semesterStart) || 1);
  await dbSet('main', state.data);
  if (state.server.available) {
    try {
      await apiRequest('/api/settings/semester-start', {
        method: 'POST',
        body: JSON.stringify({ semesterStart: state.data.meta.semesterStart })
      });
    } catch {
      // 本地缓存已保存，服务端写入失败时不阻断前端
    }
  }
  renderCurrentPage();
  if (state.currentPage !== 'home') renderHome();
  await scheduleNotifications({ silent: true });
  await updateNativeWidgetData({ silent: true });
  showToast('学期开始日期已保存');
}

async function updateNotificationSetting(key, value) {
  const settings = getNotificationSettings();
  if (['enabled', 'courseReminders', 'todoReminders', 'gradeReminders'].includes(key)) {
    settings[key] = Boolean(value);
  } else if (key === 'leadMinutes') {
    settings.leadMinutes = Math.max(1, Number.parseInt(value, 10) || DEFAULT_NOTIFICATION_SETTINGS.leadMinutes);
  } else {
    return;
  }

  state.notificationSettings = settings;
  await persistNotificationSettings();
  renderSettings();
  await scheduleNotifications({ silent: false });
}

async function clearData() {
  if (!window.confirm('确认清除本地缓存的课表、成绩和考试数据？')) return;
  state.data = createEmptyData();
  state.selectedWeek = 1;
  state.gradeSelections = {};
  state.customCourses = [];
  state.todos = [];
  await cancelScheduledNotifications();
  state.notificationSettings = {
    ...getNotificationSettings(),
    scheduledIds: [],
    lastGradeSignature: ''
  };
  await dbSet('main', null);
  await dbSet('gradeSelections', {});
  await dbSet('customCourses', []);
  await dbSet('todos', []);
  await persistNotificationSettings();
  await updateNativeWidgetData({ silent: true });
  renderCurrentPage();
  if (state.currentPage !== 'home') renderHome();
  showToast('本地数据已清除');
}

function buildBackupPayload() {
  const payload = normalizeData(state.data);
  payload.customCourses = normalizeStoredCustomCourses(state.customCourses);
  payload.todos = normalizeStoredTodos(state.todos);
  payload.meta.fullExport = true;
  payload.meta.sections = SECTION_KEYS.slice();
  payload.meta.exportedAt = new Date().toISOString();
  return payload;
}

function exportBackup() {
  if (!hasAnyData()) {
    showToast('当前没有可导出的数据');
    return;
  }

  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `njust-backup-${formatDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast('备份文件已导出');
}

async function loadSampleData() {
  const today = startOfDay(new Date());
  const previousGradeSignature = buildGradeSignature();
  const sample = normalizeData({
    schedule: [
      { name: '信号与系统', teacher: '李老师', room: '四教 C102', weekday: 1, periods: [1, 2], startWeek: 1, endWeek: 16, oddEven: '' },
      { name: '数字电路', teacher: '王老师', room: '二教 204', weekday: 1, periods: [5, 6], startWeek: 1, endWeek: 16, oddEven: '单' },
      { name: '线性代数', teacher: '赵老师', room: '三教 101', weekday: 2, periods: [3, 4], startWeek: 1, endWeek: 16, oddEven: '' },
      { name: '就业指导', teacher: '张老师', room: '四教 C102', weekday: 3, periods: [7, 8], startWeek: 1, endWeek: 16, oddEven: '' },
      { name: '体育（VI）', teacher: '周老师', room: '二运篮球场', weekday: 4, periods: [3, 4], startWeek: 1, endWeek: 16, oddEven: '' },
      { name: '英语强化', teacher: '陈老师', room: '六教 302', weekday: 5, periods: [9, 10], startWeek: 1, endWeek: 8, oddEven: '' }
    ],
    grades: [
      { name: '高等数学 A', credit: 5, score: 92, semester: '2024-1', type: '必修', gpa: 4.0 },
      { name: '大学英语 II', credit: 3, score: 85, semester: '2024-1', type: '必修', gpa: 3.7 },
      { name: '程序设计基础', credit: 3, score: 96, semester: '2024-1', type: '必修', gpa: 4.0 },
      { name: '线性代数', credit: 3, score: 88, semester: '2024-2', type: '必修', gpa: 3.7 },
      { name: '大学物理 A', credit: 4, score: 78, semester: '2024-2', type: '必修', gpa: 3.0 }
    ],
    certs: [
      { name: '全国大学英语四六级（CET4）', kind: 'CET4', totalScore: 512, date: '2024-06-15' },
      { name: '全国大学英语四六级（CET6）', kind: 'CET6', totalScore: 422, date: '2024-12-14' }
    ],
    exams: [
      { name: '信号与系统', date: formatDateKey(addDays(today, 10)), time: '08:00-10:00', room: '二教 A201', seat: '15' },
      { name: '线性代数', date: formatDateKey(addDays(today, 16)), time: '14:00-16:00', room: '三教 B102', seat: '23' }
    ],
    meta: {
      semester: '2024-2',
      semesterStart: '2026-02-24',
      importedAt: new Date().toISOString(),
      sources: {
        schedule: { importedAt: new Date().toISOString(), count: 6, sourceUrl: 'sample://schedule', pageTitle: '示例课表' },
        grades: { importedAt: new Date().toISOString(), count: 5, sourceUrl: 'sample://grades', pageTitle: '示例成绩' },
        exams: { importedAt: new Date().toISOString(), count: 2, sourceUrl: 'sample://exams', pageTitle: '示例考试' }
      }
    }
  });

  state.data = sample;
  state.selectedWeek = clampSelectedWeek(getCurrentWeek(state.data.meta.semesterStart) || 1);
  await dbSet('main', state.data);
  await afterDataChanged({ previousGradeSignature });
  renderCurrentPage();
  if (state.currentPage !== 'home') renderHome();
  showToast('示例数据已加载');
}

function changeSelectedWeek(offset) {
  if (!getSectionStatus('schedule').synced) {
    showToast('请先同步课表数据');
    return;
  }
  state.selectedWeek = clampSelectedWeek(getSelectedWeek() + offset);
  renderSchedule(state.currentWeekday || getTodayWeekday());
}

function resetSelectedWeek() {
  state.selectedWeek = clampSelectedWeek(getCurrentWeek(state.data.meta.semesterStart) || 1);
  renderSchedule(state.currentWeekday || getTodayWeekday());
}

function setScheduleViewMode(mode) {
  if (!['week', 'semester'].includes(mode)) return;
  state.scheduleViewMode = mode;
  renderSchedule(state.currentWeekday || getTodayWeekday());
}

function setScheduleFocusDay(day) {
  const value = Number(day);
  if (!Number.isInteger(value) || value < 1 || value > 7) return;
  state.currentWeekday = value;
  renderSchedule(value);
}

function handleScheduleTouchStart(event) {
  if (state.currentPage !== 'schedule' || state.scheduleViewMode !== 'week') return;
  if (!event.touches || event.touches.length !== 1) return;
  const touch = event.touches[0];
  scheduleSwipeStart = {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now()
  };
}

function handleScheduleTouchEnd(event) {
  if (!scheduleSwipeStart) return;
  if (state.currentPage !== 'schedule' || state.scheduleViewMode !== 'week') {
    scheduleSwipeStart = null;
    return;
  }

  const touch = event.changedTouches?.[0];
  if (!touch) {
    scheduleSwipeStart = null;
    return;
  }

  const deltaX = touch.clientX - scheduleSwipeStart.x;
  const deltaY = touch.clientY - scheduleSwipeStart.y;
  const duration = Date.now() - scheduleSwipeStart.time;
  scheduleSwipeStart = null;

  if (duration > 600) return;
  if (Math.abs(deltaX) < 56) return;
  if (Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;

  changeSelectedWeek(deltaX < 0 ? 1 : -1);
}

function handleScheduleTouchCancel() {
  scheduleSwipeStart = null;
}

function handleScheduleColumnClick(event, weekday) {
  if (event.target.closest('.schedule-block')) return;
  if (!event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const y = Math.max(0, event.clientY - rect.top);
  const layout = getScheduleLayoutMetrics();
  const slotSize = layout.slotHeight + layout.slotGap;
  const slotIndex = Math.max(0, Math.min(PERIOD_SEQUENCE.length - 1, Math.floor(y / slotSize)));
  const period = PERIOD_SEQUENCE[slotIndex] || 1;
  openCustomCourseModal({
    weekday,
    startPeriod: period,
    endPeriod: period,
    startWeek: state.scheduleViewMode === 'week' ? getSelectedWeek() : 1,
    endWeek: state.scheduleViewMode === 'week' ? getSelectedWeek() : getMaxWeek()
  });
}

async function persistCustomCourses() {
  state.customCourses = normalizeStoredCustomCourses(state.customCourses);
  await dbSet('customCourses', state.customCourses);
  await scheduleNotifications({ silent: true });
  await updateNativeWidgetData({ silent: true });
}

function getCustomCourseById(id) {
  return state.customCourses.find(course => course.id === id) || null;
}

function setInputValue(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value ?? '';
}

function openCustomCourseModal(prefill = {}) {
  const source = prefill.id ? getCustomCourseById(prefill.id) : null;
  const course = source || {};
  const selectedWeek = getSelectedWeek();
  const periods = sortPeriodsByDisplay(course.periods || []);
  state.editingCustomCourseId = source?.id || '';

  const modal = document.getElementById('custom-course-modal');
  if (!modal) return;
  const title = modal.querySelector('.modal-title');
  if (title) title.textContent = source ? '编辑自定义课程' : '添加自定义课程';

  setInputValue('custom-course-name', course.name || prefill.name || '');
  setInputValue('custom-course-room', course.room || prefill.room || '');
  setInputValue('custom-course-teacher', course.teacher || prefill.teacher || '');
  setInputValue('custom-course-credit', course.credit || prefill.credit || '');
  setInputValue('custom-course-weekday', course.weekday || prefill.weekday || state.currentWeekday || getTodayWeekday());
  setInputValue('custom-course-odd-even', course.oddEven || prefill.oddEven || '');
  setInputValue('custom-course-start-period', periods[0] || prefill.startPeriod || 1);
  setInputValue('custom-course-end-period', periods[periods.length - 1] || prefill.endPeriod || prefill.startPeriod || 2);
  setInputValue('custom-course-start-week', course.startWeek || prefill.startWeek || selectedWeek || 1);
  setInputValue('custom-course-end-week', course.endWeek || prefill.endWeek || selectedWeek || getMaxWeek());

  modal.classList.add('open');
  document.getElementById('custom-course-name')?.focus();
}

function closeCustomCourseModal() {
  const modal = document.getElementById('custom-course-modal');
  if (!modal) return;
  modal.classList.remove('open');
  state.editingCustomCourseId = '';
}

function buildPeriodRangeFromInputs(startPeriod, endPeriod) {
  const startPosition = getPeriodPosition(startPeriod);
  const endPosition = getPeriodPosition(endPeriod);
  if (startPosition > endPosition) return [];
  return PERIOD_SEQUENCE.slice(startPosition, endPosition + 1);
}

async function saveCustomCourse() {
  const name = document.getElementById('custom-course-name')?.value.trim() || '';
  const weekday = Number.parseInt(document.getElementById('custom-course-weekday')?.value, 10);
  const startPeriod = Number.parseInt(document.getElementById('custom-course-start-period')?.value, 10);
  const endPeriod = Number.parseInt(document.getElementById('custom-course-end-period')?.value, 10);
  const startWeek = Number.parseInt(document.getElementById('custom-course-start-week')?.value, 10);
  const endWeek = Number.parseInt(document.getElementById('custom-course-end-week')?.value, 10);

  if (!name) {
    showToast('请输入课程名称');
    return;
  }
  if (!weekday || weekday < 1 || weekday > 7) {
    showToast('请选择正确的星期');
    return;
  }
  if (!startPeriod || !endPeriod || startPeriod < 1 || endPeriod > 14) {
    showToast('请输入 1-14 范围内的节次');
    return;
  }
  const periods = buildPeriodRangeFromInputs(startPeriod, endPeriod);
  if (!periods.length) {
    showToast('结束节次不能早于开始节次');
    return;
  }
  if (!startWeek || !endWeek || endWeek < startWeek) {
    showToast('请填写正确的周次范围');
    return;
  }

  const existing = state.editingCustomCourseId ? getCustomCourseById(state.editingCustomCourseId) : null;
  const course = normalizeScheduleItem({
    id: existing?.id || createLocalId('course'),
    isCustom: true,
    name,
    room: document.getElementById('custom-course-room')?.value || '',
    teacher: document.getElementById('custom-course-teacher')?.value || '',
    credit: document.getElementById('custom-course-credit')?.value || 0,
    weekday,
    periods,
    startWeek,
    endWeek,
    oddEven: document.getElementById('custom-course-odd-even')?.value || '',
    semester: state.data.meta.semester || '',
    attribute: '自定义'
  });

  if (!course) {
    showToast('课程信息无效');
    return;
  }

  if (existing) {
    state.customCourses = state.customCourses.map(item => item.id === existing.id ? course : item);
  } else {
    state.customCourses = [...state.customCourses, course];
  }

  await persistCustomCourses();
  closeCustomCourseModal();
  renderCurrentPage();
  if (state.currentPage !== 'home') renderHome();
  showToast(existing ? '课程已更新' : '课程已添加');
}

async function deleteCustomCourse(id) {
  if (!id) return;
  if (!window.confirm('确认删除这门自定义课程？')) return;
  state.customCourses = state.customCourses.filter(course => course.id !== id);
  await persistCustomCourses();
  closeScheduleDetail();
  renderCurrentPage();
  if (state.currentPage !== 'home') renderHome();
  showToast('自定义课程已删除');
}

async function persistTodos() {
  state.todos = normalizeStoredTodos(state.todos);
  await dbSet('todos', state.todos);
  await scheduleNotifications({ silent: true });
  await updateNativeWidgetData({ silent: true });
}

function getTodoById(id) {
  return state.todos.find(todo => todo.id === id) || null;
}

function populateTodoLinkedCourseSelect(selectedCourse = '') {
  const select = document.getElementById('todo-linked-course');
  if (!select) return;
  const courseNames = [...new Set(getAllScheduleCourses().map(course => cleanText(course.name)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  select.innerHTML = '<option value="">不关联课程</option>'
    + courseNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  select.value = courseNames.includes(selectedCourse) ? selectedCourse : '';
}

function openTodoModal(todoId = '', linkedCourseName = '') {
  const todo = typeof todoId === 'string' ? getTodoById(todoId) : null;
  state.editingTodoId = todo?.id || '';
  const modal = document.getElementById('todo-modal');
  if (!modal) return;
  const title = modal.querySelector('.modal-title');
  if (title) title.textContent = todo ? '编辑待办事件' : '新建待办事件';

  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  setInputValue('todo-title', todo?.title || '');
  setInputValue('todo-date', todo?.date || formatDateKey(now));
  setInputValue('todo-time', todo?.time || `${pad(now.getHours())}:${pad(now.getMinutes())}`);
  setInputValue('todo-remind-minutes', todo?.remindMinutes ?? 30);
  setInputValue('todo-note', todo?.note || '');
  populateTodoLinkedCourseSelect(todo?.linkedCourseName || linkedCourseName || '');
  modal.classList.add('open');
  document.getElementById('todo-title')?.focus();
}

function closeTodoModal() {
  const modal = document.getElementById('todo-modal');
  if (!modal) return;
  modal.classList.remove('open');
  state.editingTodoId = '';
}

async function saveTodo() {
  const title = document.getElementById('todo-title')?.value.trim() || '';
  const date = document.getElementById('todo-date')?.value || '';
  if (!title) {
    showToast('请输入待办标题');
    return;
  }
  if (!date) {
    showToast('请选择待办日期');
    return;
  }

  const existing = state.editingTodoId ? getTodoById(state.editingTodoId) : null;
  const linkedCourseName = document.getElementById('todo-linked-course')?.value || '';
  const todo = normalizeTodoItem({
    id: existing?.id || createLocalId('todo'),
    title,
    date,
    time: document.getElementById('todo-time')?.value || '',
    remindMinutes: document.getElementById('todo-remind-minutes')?.value || 0,
    note: document.getElementById('todo-note')?.value || '',
    linkedCourseName,
    done: existing?.done || false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!todo) {
    showToast('待办信息无效');
    return;
  }

  if (existing) {
    state.todos = state.todos.map(item => item.id === existing.id ? todo : item);
  } else {
    state.todos = [...state.todos, todo];
  }

  await persistTodos();
  closeTodoModal();
  renderCurrentPage();
  if (state.currentPage !== 'home') renderHome();
  showToast(existing ? '待办已更新' : '待办已创建');
}

async function toggleTodoDone(id, checked) {
  state.todos = state.todos.map(todo => todo.id === id
    ? { ...todo, done: Boolean(checked), updatedAt: new Date().toISOString() }
    : todo);
  await persistTodos();
  renderTodos();
  if (state.currentPage !== 'home') renderHome();
}

async function deleteTodo(id) {
  if (!id) return;
  if (!window.confirm('确认删除这个待办？')) return;
  state.todos = state.todos.filter(todo => todo.id !== id);
  await persistTodos();
  renderTodos();
  if (state.currentPage !== 'home') renderHome();
  showToast('待办已删除');
}

function renderTodos() {
  const container = document.getElementById('todos-content');
  if (!container) return;
  const todos = normalizeStoredTodos(state.todos);
  const pending = todos.filter(todo => !todo.done);
  const done = todos.filter(todo => todo.done);

  const buildTodoCard = todo => `
    <div class="todo-card ${todo.done ? 'done' : ''}">
      <label class="todo-check">
        <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleTodoDone('${escapeJsString(todo.id)}', this.checked)">
        <span></span>
      </label>
      <button class="todo-main" type="button" onclick="openTodoModal('${escapeJsString(todo.id)}')">
        <div class="todo-title">${escapeHtml(todo.title)}</div>
        <div class="todo-meta">${escapeHtml(formatTodoDueText(todo))} · 提前 ${escapeHtml(String(todo.remindMinutes))} 分钟提醒${todo.linkedCourseName ? ` · ${escapeHtml(todo.linkedCourseName)}` : ''}</div>
        ${todo.note ? `<div class="todo-note">${escapeHtml(todo.note)}</div>` : ''}
      </button>
      <button class="todo-delete" type="button" onclick="deleteTodo('${escapeJsString(todo.id)}')" title="删除">×</button>
    </div>
  `;

  container.innerHTML = `
    <div class="subpage-stack">
      <div class="control-card todo-control-card">
        <div class="control-row">
          <div>
            <div class="control-label">待办事件</div>
            <div class="control-value">${escapeHtml(String(pending.length))} 件待处理</div>
            <div class="control-hint">可设置本地通知提醒；数据只保存在本机。</div>
          </div>
          <button class="btn btn-primary btn-sm" type="button" onclick="openTodoModal()">新建</button>
        </div>
      </div>
      ${pending.length
        ? `<div class="todo-list">${pending.map(buildTodoCard).join('')}</div>`
        : `<div class="card">${buildEmptyState('✅', '暂无待办', '点击右上角“新建”添加自己的任务提醒。')}</div>`}
      ${done.length ? `
        <div class="section-title">已完成</div>
        <div class="todo-list done-list">${done.map(buildTodoCard).join('')}</div>
      ` : ''}
    </div>
  `;
}

function setGradeSemesterFilter(value) {
  state.gradeSemester = value;
  renderGrades();
}

function setExamFilter(value) {
  state.examFilter = value;
  renderExams();
}

function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    if (ok) resolve();
    else reject(new Error('复制失败'));
  });
}

const BOOKMARKLET_CODE = [
  'javascript:(function(){',
  "function textOf(node){return (node&&((node.innerText||node.textContent)||'')||'').replace(/\\u00a0/g,' ').trim();}",
  "function linesOf(node){return textOf(node).split(/[\\r\\n]+/).map(function(item){return item.trim();}).filter(Boolean);}",
  "function pickTable(test){var tables=Array.from(document.querySelectorAll('table'));return tables.sort(function(a,b){return test(b)-test(a);})[0]||null;}",
  "function detectPageType(){var url=location.href.toLowerCase();var body=textOf(document.body).slice(0,800);if(/xskbcx|kbcx|课表/.test(url+body))return 'schedule';if(/xscjcx|cjcx|成绩/.test(url+body))return 'grades';if(/xsksap|ksap|考试/.test(url+body))return 'exams';return '';}",
  "function readSemesterHint(){var selected=document.querySelector('select option:checked');return selected?textOf(selected):'';}",
  "function parseSchedule(){var periodMap={1:[1,2],2:[3,4],3:[5,6],4:[7,8],5:[9,10,11]};var table=pickTable(function(t){return t.rows.length*(t.rows[0]?t.rows[0].cells.length:0);});if(!table)return [];return Array.from(table.rows).slice(1).flatMap(function(row,rowIndex){return Array.from(row.cells).slice(1,8).map(function(cell,colIndex){var lines=linesOf(cell);if(!lines.length)return null;var course={name:lines[0]||'未命名课程',teacher:'',room:'',weekday:colIndex+1,periods:periodMap[rowIndex+1]||[rowIndex*2+1,rowIndex*2+2],startWeek:1,endWeek:20,oddEven:''};lines.slice(1).forEach(function(line){var weekMatch=line.match(/(\\d+)\\s*[-~]\\s*(\\d+)\\s*周/);if(weekMatch){course.startWeek=parseInt(weekMatch[1],10)||1;course.endWeek=parseInt(weekMatch[2],10)||20;}if(/单周/.test(line))course.oddEven='单';if(/双周/.test(line))course.oddEven='双';if(!course.room&&(/[教楼室馆场]|[A-Z]-?[A-Z]?\\d{2,4}|\\d{3,4}/.test(line)))course.room=line;if(!course.teacher&&/^[\\u4e00-\\u9fa5·]{2,12}$/.test(line))course.teacher=line;});return course;}).filter(Boolean);});}",
  "function parseGrades(){var table=pickTable(function(t){return t.rows.length*(t.rows[0]?t.rows[0].cells.length:0);});if(!table||!table.rows.length)return [];var headers=Array.from(table.rows[0].cells).map(function(cell){return textOf(cell);});function idx(){for(var i=0;i<arguments.length;i+=1){var key=arguments[i];var found=headers.findIndex(function(item){return item.indexOf(key)!==-1;});if(found!==-1)return found;}return -1;}var nameIdx=idx('课程名','课程');var creditIdx=idx('学分');var scoreIdx=idx('成绩','期末');var typeIdx=idx('课程类型','课程性质','类型');var gpaIdx=idx('绩点','学分绩点');var semIdx=idx('学年','学期');return Array.from(table.rows).slice(1).map(function(row){var cells=Array.from(row.cells).map(function(cell){return textOf(cell);});if(!cells.length)return null;var scoreRaw=scoreIdx>=0?cells[scoreIdx]:'';var scoreNum=parseFloat(scoreRaw);var gpaRaw=gpaIdx>=0?cells[gpaIdx]:'';var gpaNum=parseFloat(gpaRaw);return {name:nameIdx>=0?cells[nameIdx]:cells[0],credit:parseFloat(creditIdx>=0?cells[creditIdx]:'')||0,score:isNaN(scoreNum)?null:scoreNum,scoreText:isNaN(scoreNum)?scoreRaw:'',type:typeIdx>=0?cells[typeIdx]:'',gpa:isNaN(gpaNum)?null:gpaNum,semester:semIdx>=0?(cells[semIdx]||'').replace('~','-'):readSemesterHint()};}).filter(function(item){return item&&item.name;});}",
  "function parseExams(){var table=pickTable(function(t){return t.rows.length*(t.rows[0]?t.rows[0].cells.length:0);});if(!table||!table.rows.length)return [];var headers=Array.from(table.rows[0].cells).map(function(cell){return textOf(cell);});function idx(){for(var i=0;i<arguments.length;i+=1){var key=arguments[i];var found=headers.findIndex(function(item){return item.indexOf(key)!==-1;});if(found!==-1)return found;}return -1;}var nameIdx=idx('课程名','课程');var dateIdx=idx('考试日期','日期');var timeIdx=idx('考试时间','时间');var roomIdx=idx('考场','地点','教室');var seatIdx=idx('座位','位号');return Array.from(table.rows).slice(1).map(function(row){var cells=Array.from(row.cells).map(function(cell){return textOf(cell);});if(!cells.length)return null;var date=(dateIdx>=0?cells[dateIdx]:'').replace(/[年月]/g,'-').replace(/日/g,'');return {name:nameIdx>=0?cells[nameIdx]:cells[0],date:date,time:timeIdx>=0?cells[timeIdx]:'',room:roomIdx>=0?cells[roomIdx]:'',seat:seatIdx>=0?cells[seatIdx]:''};}).filter(function(item){return item&&item.name;});}",
  "var type=detectPageType();if(!type){alert('请先打开教务系统中的课表、成绩或考试安排页面');return;}var data={schedule:[],grades:[],exams:[],meta:{type:type,sections:[type],semester:readSemesterHint(),sourceUrl:location.href,pageTitle:document.title,exportedAt:new Date().toISOString()}};if(type==='schedule')data.schedule=parseSchedule();if(type==='grades')data.grades=parseGrades();if(type==='exams')data.exams=parseExams();var json=JSON.stringify(data,null,2);var wrap=document.createElement('div');wrap.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(10,18,36,0.82);display:flex;align-items:center;justify-content:center;padding:16px;';var panel=document.createElement('div');panel.style.cssText='width:min(100%,720px);background:#fff;border-radius:16px;padding:16px;box-shadow:0 16px 40px rgba(0,0,0,0.25);font-family:system-ui,sans-serif;';var title=document.createElement('div');title.textContent='已生成 '+type+' JSON，复制后回到南理教务助手导入';title.style.cssText='font-weight:700;font-size:16px;margin-bottom:12px;color:#1d2c45;';var area=document.createElement('textarea');area.value=json;area.style.cssText='width:100%;min-height:260px;border:1px solid #d6dfef;border-radius:12px;padding:12px;font:12px/1.6 monospace;';var row=document.createElement('div');row.style.cssText='display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;';function makeBtn(label,bg,color){var btn=document.createElement('button');btn.textContent=label;btn.style.cssText='padding:10px 14px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;background:'+bg+';color:'+color+';';return btn;}var copyBtn=makeBtn('复制 JSON','#2b6fd6','#fff');copyBtn.onclick=function(){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(json).then(function(){copyBtn.textContent='已复制';}).catch(function(){area.select();document.execCommand('copy');copyBtn.textContent='已复制';});}else{area.select();document.execCommand('copy');copyBtn.textContent='已复制';}};var closeBtn=makeBtn('关闭','#eef4ff','#1f4ca2');closeBtn.onclick=function(){wrap.remove();};row.appendChild(copyBtn);row.appendChild(closeBtn);panel.appendChild(title);panel.appendChild(area);panel.appendChild(row);wrap.appendChild(panel);document.body.appendChild(wrap);area.select();})();"
].join('');

function showBookmarklet() {
  const preview = document.getElementById('bookmarklet-preview');
  preview.textContent = `${BOOKMARKLET_CODE.slice(0, 320)}...（共 ${BOOKMARKLET_CODE.length} 字符）`;
}

function copyBookmarklet() {
  copyTextToClipboard(BOOKMARKLET_CODE)
    .then(() => showToast('书签脚本已复制'))
    .catch(() => showToast('复制失败，请手动复制脚本内容'));
}

function bindStaticEvents() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  const gradeSearch = document.getElementById('grades-search');
  gradeSearch.addEventListener('input', event => {
    state.gradeSearch = event.target.value;
    renderGrades();
  });

  ['login-username', 'login-password', 'login-captcha'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        loginAndSync();
      }
    });
  });

  const loginUsername = document.getElementById('login-username');
  if (loginUsername) {
    loginUsername.addEventListener('change', () => {
      const captchaInput = document.getElementById('login-captcha');
      if (captchaInput) captchaInput.value = '';
      refreshCaptcha({ silent: true });
    });
  }

  const scheduleBoard = document.getElementById('schedule-board');
  if (scheduleBoard) {
    scheduleBoard.addEventListener('touchstart', handleScheduleTouchStart, { passive: true });
    scheduleBoard.addEventListener('touchend', handleScheduleTouchEnd, { passive: true });
    scheduleBoard.addEventListener('touchcancel', handleScheduleTouchCancel, { passive: true });
  }

  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeImportModal();
    closeScheduleDetail();
    closeCustomCourseModal();
    closeTodoModal();
    closeGradeHelp();
    closeUsageGuide();
  });
}

async function init() {
  state.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  state.currentWeekday = getTodayWeekday();
  bindStaticEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  await openDB();
  const cached = await dbGet('main');
  state.gradeSelections = (await dbGet('gradeSelections')) || {};
  state.customCourses = normalizeStoredCustomCourses(await dbGet('customCourses'));
  state.todos = normalizeStoredTodos(await dbGet('todos'));
  state.notificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...((await dbGet('notificationSettings')) || {})
  };
  state.data = normalizeData(cached);
  if (!state.notificationSettings.lastGradeSignature) {
    state.notificationSettings.lastGradeSignature = buildGradeSignature();
    await persistNotificationSettings();
  }
  state.selectedWeek = clampSelectedWeek(getCurrentWeek(state.data.meta.semesterStart) || 1);
  await refreshServerStatus({ silent: true });
  void refreshAppUpdateState({ silent: true, force: true });
  if (state.server.available) {
    refreshCaptcha({ silent: true });
    if (isNativeSyncAvailable()) {
      window.setInterval(() => {
        if (!state.server.loggedIn) return;
        keepAliveNativeSession().catch(() => {});
      }, window.NJUSTNativeSync.keepAliveIntervalMs || 8 * 60 * 1000);

      window.setInterval(() => {
        if (document.hidden || !state.server.loggedIn) return;
        syncNow({ silent: true });
      }, 10 * 60 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden || !state.server.loggedIn) return;
        keepAliveNativeSession().catch(() => {});
        refreshServerStatus({ silent: true, check: true });
        syncNow({ silent: true });
      });
    } else {
      window.setInterval(() => {
        refreshServerStatus({ silent: true, check: false });
      }, 60000);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || state.currentPage !== 'settings') return;
    void refreshAppUpdateState({ silent: true, force: true });
  });
  window.setInterval(() => {
    if (state.currentPage === 'schedule') {
      renderSchedule(state.currentWeekday || getTodayWeekday());
    }
  }, 60000);

  if (isNativeSyncAvailable()) {
    try {
      const cap = window.capacitorExports || {};
      const appPlugin = cap.registerPlugin?.('App') || window.Capacitor?.registerPlugin?.('App');
      if (appPlugin) {
        appPlugin.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            scheduleNotifications({ silent: true }).catch(() => {});
          }
        });
      }
    } catch {}
  }

  await scheduleNotifications({ silent: true });
  await updateNativeWidgetData({ silent: true });
  renderSettings();
  navigate('home');
}

document.addEventListener('DOMContentLoaded', init);

// features.js 集成 hook：app 初始化完成后调用
const _origNavigate = typeof navigate === 'function' ? navigate : null;

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof initFeatures === 'function') {
      initFeatures();
    }
    // 成绩页打开时渲染预测面板
    const originalRenderGrades = window.renderGrades;
    if (typeof originalRenderGrades === 'function') {
      window.renderGrades = function(...args) {
        originalRenderGrades.apply(this, args);
        if (typeof renderPredictPanel === 'function') renderPredictPanel();
      };
    }
    // 待办弹窗打开时补齐关联课程选项，保留 app.js 已选中的课程
    const originalOpenTodoModal = window.openTodoModal;
    if (typeof originalOpenTodoModal === 'function') {
      window.openTodoModal = function(id, linkedCourse) {
        originalOpenTodoModal.call(this, id);
        const select = document.getElementById('todo-linked-course');
        if (select) {
          const currentValue = select.value;
          const courses = getAllScheduleCourses ? getAllScheduleCourses() : [];
          const unique = [...new Set(courses.map(c => c.name))].sort();
          select.innerHTML = '<option value="">不关联课程</option>'
            + unique.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
          if (linkedCourse) select.value = linkedCourse;
          else if (currentValue) select.value = currentValue;
        }
      };
    }
  }, 200);
});
