const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { JSDOM } = require('jsdom');
const iconv = require('iconv-lite');
const Tesseract = require('tesseract.js');
const parser = require('./js/parser.js');

const ROOT_DIR = __dirname;
loadEnvFile(path.join(ROOT_DIR, '.env'));

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3030);
const PUBLIC_ORIGIN = String(
  process.env.PUBLIC_ORIGIN
  || process.env.RENDER_EXTERNAL_URL
  || ''
).trim();
const TRUST_PROXY = /^(1|true|yes)$/i.test(String(process.env.TRUST_PROXY || ''));
const STORAGE_DIR = path.resolve(process.env.APP_STORAGE_DIR || path.join(ROOT_DIR, 'storage'));
const STATE_FILE = path.join(STORAGE_DIR, 'server-state.json');
const AUTO_SYNC_INTERVAL_MS = Number(process.env.AUTO_SYNC_INTERVAL_MS || 10 * 60 * 1000);
const KEEP_ALIVE_INTERVAL_MS = Number(process.env.KEEP_ALIVE_INTERVAL_MS || 8 * 60 * 1000);
const APP_VERSION = '2026-04-08-sync-v10';

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;
  const lines = fsSync.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] || '';
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

const PROFILE = {
  key: 'web8080',
  label: '202.119.81.113:8080 互联网入口',
  entryOrigin: 'http://202.119.81.113:8080',
  loginPagePath: '/',
  captchaPath: '/verifycode.servlet',
  shardBases: [
    'http://202.119.81.113:9080/njlgdx/',
    'http://202.119.81.112:9080/njlgdx/'
  ],
  loginPath: '/Logon.do?method=logon',
  mainPath: 'framework/main.jsp',
  keepAlivePath: 'framework/blankPage.jsp',
  scheduleQueryPath: 'xskb/xskb_list.do?Ves632DSdyV=NEW_XSD_PYGL',
  gradesQueryPath: 'kscj/cjcx_query?Ves632DSdyV=NEW_XSD_XJCJ',
  gradesListPath: 'kscj/cjcx_list',
  certsListPath: 'kscj/djkscj_list',
  examsQueryPath: 'xsks/xsksap_query?Ves632DSdyV=NEW_XSD_KSBM',
  examsListPath: 'xsks/xsksap_list'
};

const appState = {
  loggedIn: false,
  syncing: false,
  autoSyncEnabled: true,
  username: '',
  password: '', // 保存密码以供自动重登
  profile: PROFILE.key,
  businessBase: '',
  lastSyncAt: '',
  lastError: '',
  sessionCheckedAt: '',
  data: createEmptyData()
};

let syncTimer = null;
let keepAliveTimer = null;
let jar = new CookieJar();
let client = createHttpClient(jar);
let pendingCaptchaReady = false;

let globalOcrWorker = null;

async function getOcrWorker() {
  if (!globalOcrWorker) {
    globalOcrWorker = await Tesseract.createWorker('eng');
    await globalOcrWorker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    });
  }
  return globalOcrWorker;
}

async function solveCaptchaOCR(buffer) {
  const worker = await getOcrWorker();
  const ret = await worker.recognize(buffer);
  return ret.data.text.replace(/[^A-Za-z0-9]/g, '');
}

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
      sources: {}
    }
  };
}

function clearRemoteData() {
  appState.data = createEmptyData();
  appState.lastSyncAt = '';
}

function resetRuntimeSession({ clearCredentials = false, clearData = false } = {}) {
  stopAutoSync();
  jar = new CookieJar();
  client = createHttpClient(jar);
  pendingCaptchaReady = false;
  appState.loggedIn = false;
  appState.businessBase = '';
  appState.lastError = '';
  appState.sessionCheckedAt = '';
  if (clearCredentials) {
    appState.username = '';
    appState.password = '';
  }
  if (clearData) {
    clearRemoteData();
  }
}

function createHttpClient(cookieJar) {
  return wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true,
    timeout: 20000,
    validateStatus: status => status >= 200 && status < 400,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }
  }));
}

function getCharsetFromHeaders(headers = {}) {
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  const match = String(contentType).match(/charset=([^;]+)/i);
  return match ? match[1].trim().toLowerCase() : 'utf-8';
}

function asText(buffer, headers = {}) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const charset = getCharsetFromHeaders(headers);
  if (charset.includes('gbk') || charset.includes('gb2312') || charset.includes('gb18030')) {
    return iconv.decode(source, 'gbk');
  }
  return source.toString('utf8');
}

function createDom(html, url) {
  return new JSDOM(html, { url });
}

function isUnauthenticatedPage(html) {
  return /登录个人中心|用户登录|verifycode\.servlet|Verifyservlet|name="USERNAME"|请先登录系统|用户没有登录，请重新登录|出错页面|强智科技教务系统概念版/.test(html);
}

function extractLoginErrorMessage(html) {
  const fontMatch = html.match(/<font[^>]*color=["']?red["']?[^>]*>(.*?)<\/font>/i);
  if (fontMatch && fontMatch[1]) {
    const text = fontMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text && (/[\u4e00-\u9fff]/.test(text) || /(captcha|password|username|login|error|invalid)/i.test(text))) {
      return text;
    }
  }
  if (/验证码/.test(html)) return '验证码错误或已过期';
  if (/密码/.test(html)) return '用户名或密码错误';
  return '';
}

function extractPageErrorMessage(html) {
  const loginError = extractLoginErrorMessage(html);
  if (loginError) return loginError;

  const requiredMatch = html.match(/>\s*(\*必填)\s*</);
  if (requiredMatch) return requiredMatch[1];

  const promptMatch = html.match(/<h3>\s*提示：([^<]+)<\/h3>/i);
  if (promptMatch && promptMatch[1]) {
    return `提示：${promptMatch[1].trim()}`;
  }

  if (/非法访问/.test(html)) return '提示：非法访问！';
  return '';
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSelectOptions(doc, selector) {
  return Array.from(doc.querySelectorAll(`${selector} option`))
    .map(option => ({
      value: cleanText(option.value),
      label: cleanText(option.textContent),
      selected: Boolean(option.selected || option.hasAttribute('selected'))
    }))
    .filter(option => option.value);
}

function parseClassroomLabel(rawLabel) {
  const normalized = cleanText(rawLabel);
  const match = normalized.match(/^(.*?)(?:\(([^()]*)\))?$/);
  return {
    label: normalized,
    name: cleanText(match?.[1] || normalized),
    capacityText: cleanText(match?.[2] || '')
  };
}

function parseClassroomRows(html, url) {
  const doc = createDocument(html, url);
  const table = doc.querySelector('#dataList');
  const weekdayLabel = cleanText(table?.rows?.[0]?.cells?.[1]?.textContent || '');
  const periodLabel = cleanText(table?.rows?.[1]?.cells?.[1]?.textContent || '');

  const rows = Array.from(doc.querySelectorAll('tr[jsbh]')).map(row => {
    const firstCell = row.cells?.[0];
    const room = parseClassroomLabel(firstCell?.textContent || '');
    const markers = Array.from(row.cells || [])
      .slice(1)
      .map(cell => cleanText(cell.textContent))
      .filter(Boolean);
    return {
      id: cleanText(row.getAttribute('jsbh')),
      ...room,
      markers
    };
  }).filter(item => item.name);

  const freeRooms = rows.filter(item => item.markers.length === 0);
  return {
    weekdayLabel,
    periodLabel,
    totalRooms: rows.length,
    busyCount: rows.length - freeRooms.length,
    freeRooms,
    rows
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryOnce(task) {
  try {
    return await task();
  } catch (error) {
    await wait(350);
    return task(error);
  }
}

function buildStatus() {
  return {
    available: true,
    version: APP_VERSION,
    loggedIn: appState.loggedIn,
    syncing: appState.syncing,
    autoSyncEnabled: appState.autoSyncEnabled,
    username: appState.username,
    profile: appState.profile,
    profileLabel: PROFILE.label,
    businessBase: appState.businessBase,
    lastSyncAt: appState.lastSyncAt,
    lastError: appState.lastError,
    sessionCheckedAt: appState.sessionCheckedAt,
    counts: {
      schedule: appState.data.schedule.length,
      grades: appState.data.grades.length,
      certs: appState.data.certs.length,
      exams: appState.data.exams.length
    }
  };
}

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function writeDebugHtml(fileName, html) {
  await ensureStorageDir();
  await fs.writeFile(path.join(STORAGE_DIR, fileName), String(html || ''), 'utf8');
}

async function saveState() {
  await ensureStorageDir();
  const serializedJar = await jar.serialize();
  const payload = {
    appState,
    cookieJar: serializedJar
  };
  await fs.writeFile(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    Object.assign(appState, parsed.appState || {});
    let shouldSave = false;
    if (appState.profile !== PROFILE.key) {
      appState.loggedIn = false;
      appState.username = '';
      appState.profile = PROFILE.key;
      appState.lastSyncAt = '';
      appState.sessionCheckedAt = '';
      appState.lastError = `入口已切换到 ${PROFILE.label}，请重新获取验证码并登录`;
      jar = new CookieJar();
      client = createHttpClient(jar);
      shouldSave = true;
    } else if (parsed.cookieJar) {
      jar = await CookieJar.deserialize(parsed.cookieJar);
      client = createHttpClient(jar);
    }

    const legacySources = Object.values(appState.data?.meta?.sources || {})
      .some(source => /\/xszx\/.*(xskbcx|xscjcx|xsksapcx)\.do/i.test(String(source?.sourceUrl || '')));
    const emptyCounts = !appState.data?.schedule?.length && !appState.data?.grades?.length && !appState.data?.exams?.length;
    if (legacySources && emptyCounts) {
      appState.lastSyncAt = '';
      appState.lastError = '';
      appState.data = createEmptyData();
      shouldSave = true;
    }

    if (appState.lastError === '*必填' && emptyCounts) {
      appState.lastError = '';
      shouldSave = true;
    }

    if (shouldSave) {
      await saveState();
    }
  } catch {
    await ensureStorageDir();
  }
}

function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function startAutoSync() {
  stopAutoSync();
  if (!appState.autoSyncEnabled || !appState.loggedIn) return;
  keepAliveTimer = setInterval(() => {
    keepAliveSession().catch(() => {});
  }, KEEP_ALIVE_INTERVAL_MS);
  syncTimer = setInterval(() => {
    syncAll().catch(() => {});
  }, AUTO_SYNC_INTERVAL_MS);
}

function applyImportedAt(section, count, sourceUrl, pageTitle) {
  const now = new Date().toISOString();
  appState.data.meta.sources[section] = {
    importedAt: now,
    count,
    sourceUrl,
    pageTitle
  };
}

function resolveBusinessBase(username = appState.username) {
  const userText = String(username || '').trim();
  if (!userText) return PROFILE.shardBases[0];
  if (!/^\d+$/.test(userText)) return PROFILE.shardBases[0];
  const shardIndex = Number(BigInt(userText) % BigInt(PROFILE.shardBases.length));
  return PROFILE.shardBases[shardIndex];
}

function buildUrl(base, pathName) {
  return new URL(pathName, base).toString();
}

function businessOrigin(base = appState.businessBase) {
  return base ? new URL(base).origin : PROFILE.entryOrigin;
}

async function resolveBusinessBaseFromJar(username) {
  const serializedJar = await jar.serialize();
  const shardCookie = (serializedJar.cookies || [])
    .filter(cookie => cookie.path === '/njlgdx' && /^202\.119\.81\.(112|113)$/.test(cookie.domain))
    .sort((left, right) => new Date(right.lastAccessed || 0).getTime() - new Date(left.lastAccessed || 0).getTime())[0];

  if (shardCookie) {
    return `http://${shardCookie.domain}:9080/njlgdx/`;
  }
  return resolveBusinessBase(username);
}

async function requestText(url, options = {}) {
  const response = await client.request({
    url,
    method: options.method || 'GET',
    responseType: 'arraybuffer',
    ...options
  });
  return {
    response,
    html: asText(response.data, response.headers)
  };
}

async function fetchText(url, options = {}) {
  return requestText(url, { method: 'GET', ...options });
}

async function postForm(url, form, headers = {}) {
  return requestText(url, {
    method: 'POST',
    data: form.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: businessOrigin(url),
      Referer: url,
      ...headers
    }
  });
}

async function prepareCaptchaSession(base) {
  await client.get(new URL(PROFILE.loginPagePath, PROFILE.entryOrigin).toString());
  pendingCaptchaReady = true;
}

async function fetchCaptcha(username = '') {
  void username;
  await prepareCaptchaSession(PROFILE.entryOrigin);
  const response = await client.get(new URL(`${PROFILE.captchaPath}?t=${Date.now()}`, PROFILE.entryOrigin).toString());
  return Buffer.from(response.data);
}

async function verifySession() {
  if (!appState.businessBase) {
    appState.loggedIn = false;
    return false;
  }
  try {
    const { html } = await fetchText(buildUrl(appState.businessBase, PROFILE.mainPath));
    appState.sessionCheckedAt = new Date().toISOString();
    appState.loggedIn = !isUnauthenticatedPage(html);
    if (!appState.loggedIn) {
      appState.lastError = '会话已失效，请重新输入验证码登录';
      stopAutoSync();
    }
    await saveState();
    return appState.loggedIn;
  } catch (error) {
    appState.loggedIn = false;
    appState.sessionCheckedAt = new Date().toISOString();
    appState.lastError = `会话检查失败：${error.message}`;
    stopAutoSync();
    await saveState();
    return false;
  }
}

async function keepAliveSession() {
  if (!appState.loggedIn || !appState.businessBase) {
    return false;
  }

  try {
    const { html } = await fetchText(buildUrl(appState.businessBase, PROFILE.keepAlivePath));
    appState.sessionCheckedAt = new Date().toISOString();
    if (isUnauthenticatedPage(html)) {
      appState.loggedIn = false;
      appState.lastError = '会话已失效，请重新输入验证码登录';
      stopAutoSync();
      await saveState();
      return false;
    }
    await saveState();
    return true;
  } catch {
    return false;
  }
}

async function ensureApiSession() {
  if (appState.loggedIn) return true;
  if (appState.businessBase) {
    const ok = await verifySession();
    if (ok) return true;
  }
  throw new Error('当前未登录，请先登录教务系统');
}

let autoLoginPromise = null;
async function triggerAutoLoginBackground() {
  if (autoLoginPromise) return autoLoginPromise;
  if (!appState.username || !appState.password) return false;
  autoLoginPromise = (async () => {
    try {
      await smartLogin({ username: appState.username, password: appState.password, autoRetry: true });
      return true;
    } catch {
      return false;
    } finally {
      autoLoginPromise = null;
    }
  })();
  return autoLoginPromise;
}

async function smartLogin({ username, password, captcha, autoRetry = true }) {
  if (!username || !password) {
    throw new Error('用户名、密码不能为空');
  }

  const normalizedUsername = String(username).trim();
  const switchingUser = Boolean(appState.username && appState.username !== normalizedUsername);
  if (switchingUser) {
    resetRuntimeSession({ clearCredentials: true, clearData: true });
    await saveState();
  }

  let attempt = 0;
  const maxAttempts = autoRetry ? 15 : 1;
  let lastErrorMessage = '';

  while (attempt < maxAttempts) {
    attempt++;
    appState.loggedIn = false;
    appState.businessBase = '';
    appState.lastError = '登录中...';

    let finalCaptcha = captcha;
    if (!finalCaptcha || (autoRetry && attempt > 1)) {
      appState.lastError = `登录中... 正在智能识别验证码 (尝试 ${attempt}/${maxAttempts})`;
      
      let ocrText = '';
      let strictAttempts = 0;
      while (ocrText.length !== 4 && strictAttempts < 10) {
        strictAttempts++;
        const buf = await fetchCaptcha(username);
        ocrText = await solveCaptchaOCR(buf);
      }
      finalCaptcha = ocrText || '1234';
      
      pendingCaptchaReady = true;
    }

    const form = new URLSearchParams();
    form.set('USERNAME', username);
    form.set('PASSWORD', password);
    form.set('RANDOMCODE', finalCaptcha);
    form.set('useDogCode', '');

    if (!pendingCaptchaReady) {
      if (!autoRetry) throw new Error('请先刷新验证码');
      await prepareCaptchaSession(PROFILE.entryOrigin);
    }

    try {
      const loginResponse = await requestText(
        new URL(PROFILE.loginPath, PROFILE.entryOrigin).toString(),
        {
          method: 'POST',
          data: form.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: PROFILE.entryOrigin,
            Referer: new URL(PROFILE.loginPagePath, PROFILE.entryOrigin).toString()
          }
        }
      );

      pendingCaptchaReady = false;
      const loginHtml = loginResponse.html;
      const directErrorMessage = extractLoginErrorMessage(loginHtml);
      if (directErrorMessage) {
        lastErrorMessage = directErrorMessage;
        if (directErrorMessage.includes('验证码') && autoRetry) {
          continue; // retry
        }
        throw new Error(directErrorMessage);
      }

      const responseUrl = loginResponse.response?.request?.res?.responseUrl || '';
      const derivedBusinessBase = /202\.119\.81\.(112|113):9080\/njlgdx\//.test(responseUrl)
        ? responseUrl.replace(/(http:\/\/202\.119\.81\.(112|113):9080\/njlgdx\/).*/, '$1')
        : await resolveBusinessBaseFromJar(username);

      appState.businessBase = derivedBusinessBase;
      const success = await verifySession();
      if (!success) {
        lastErrorMessage = '登录失败，可能是当前不在可访问教务系统的网络环境';
        continue;
      }

      appState.loggedIn = true;
      appState.username = username;
      appState.password = password;
      appState.profile = PROFILE.key;
      appState.lastError = '';
      await saveState();
      startAutoSync();
      return appState.data;
    } catch (err) {
      lastErrorMessage = err.message || '网络异常';
      if (!autoRetry) throw err;
      await wait(500);
    }
  }

  appState.loggedIn = false;
  appState.lastError = lastErrorMessage || '尝试自动登录次数超限，请检查学号密码';
  await saveState();
  throw new Error(appState.lastError);
}

async function login(opts) {
  return smartLogin({ ...opts, autoRetry: !opts.captcha });
}

async function fetchSectionPage(section, targetPath, debugName = section) {
  const url = buildUrl(appState.businessBase, targetPath);
  const html = (await fetchText(url)).html;
  if (isUnauthenticatedPage(html)) {
    const sessionStillValid = await verifySession();
    if (!sessionStillValid) {
      if (appState.username && appState.password) {
         const ok = await triggerAutoLoginBackground();
         if (ok) return fetchSectionPage(section, targetPath, debugName);
      }
      appState.loggedIn = false;
      appState.lastError = '会话已失效，请手动登录系统重试';
      await saveState();
      throw new Error(`${section} 抓取失败：当前会话已失效`);
    }
    await writeDebugHtml(`debug-${debugName}.html`, html);
    throw new Error(`${section} 抓取失败：登录已成功，但该页面返回了未登录错误页，调试页已保存到 storage/debug-${debugName}.html`);
  }
  const pageError = extractPageErrorMessage(html);
  if (pageError) {
    await writeDebugHtml(`debug-${debugName}.html`, html);
    if (pageError === '*必填') {
      throw new Error(`${section} 抓取失败：页面返回“*必填”，说明必须先进入查询页再提交筛选参数。调试页已保存到 storage/debug-${debugName}.html`);
    }
    throw new Error(`${section} 抓取失败：${pageError} 调试页已保存到 storage/debug-${debugName}.html`);
  }
  return { html, url };
}

function parseSection(section, html, url) {
  const dom = createDom(html, url);
  const doc = dom.window.document;
  if (section === 'schedule') return parser.parseSchedule(doc);
  if (section === 'grades') return parser.parseGrades(doc);
  if (section === 'certs') return parser.parseLevelExams(doc);
  if (section === 'exams') return parser.parseExams(doc);
  return [];
}

function createDocument(html, url) {
  return createDom(html, url).window.document;
}

function selectedOptionValue(doc, selector) {
  const selected = doc.querySelector(`${selector} option:checked`) || doc.querySelector(`${selector} option[selected]`);
  if (selected && selected.value) return String(selected.value).trim();
  const first = doc.querySelector(`${selector} option[value]`);
  return first ? String(first.value).trim() : '';
}

function selectedOptionText(doc, selector) {
  const selected = doc.querySelector(`${selector} option:checked`) || doc.querySelector(`${selector} option[selected]`);
  return selected ? String(selected.textContent || '').trim() : '';
}

function optionValuesFromSelected(doc, selector) {
  const options = Array.from(doc.querySelectorAll(`${selector} option`))
    .map(option => String(option.value || '').trim())
    .filter(Boolean);
  if (!options.length) return [];

  const selectedValue = selectedOptionValue(doc, selector);
  const selectedIndex = selectedValue ? options.findIndex(value => value === selectedValue) : 0;
  return options.slice(selectedIndex >= 0 ? selectedIndex : 0);
}

function parseSemesterValue(value) {
  const normalized = cleanText(value);
  const match = normalized.match(/^(\d{4})-(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const startYear = Number.parseInt(match[1], 10);
  const endYear = Number.parseInt(match[2], 10);
  const term = Number.parseInt(match[3], 10);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || !Number.isFinite(term)) return null;
  return {
    value: normalized,
    startYear,
    endYear,
    term,
    rank: startYear * 10 + term
  };
}

function buildNearbySemesterValues(doc, selector, limit = 6) {
  const options = parseSelectOptions(doc, selector);
  if (!options.length) return [];

  const selectedValue = options.find(option => option.selected)?.value || options[0].value;
  const selectedMeta = parseSemesterValue(selectedValue);
  const values = [];
  const pushUnique = value => {
    if (value && !values.includes(value)) values.push(value);
  };

  pushUnique(selectedValue);
  if (!selectedMeta) {
    options.forEach(option => pushUnique(option.value));
    return values.slice(0, limit);
  }

  options
    .map((option, index) => ({
      value: option.value,
      index,
      meta: parseSemesterValue(option.value)
    }))
    .filter(option => option.value !== selectedValue)
    .sort((left, right) => {
      if (left.meta && right.meta) {
        const diffLeft = Math.abs(left.meta.rank - selectedMeta.rank);
        const diffRight = Math.abs(right.meta.rank - selectedMeta.rank);
        if (diffLeft !== diffRight) return diffLeft - diffRight;

        const leftOlder = left.meta.rank < selectedMeta.rank ? 1 : 0;
        const rightOlder = right.meta.rank < selectedMeta.rank ? 1 : 0;
        if (leftOlder !== rightOlder) return leftOlder - rightOlder;

        if (left.meta.rank !== right.meta.rank) return right.meta.rank - left.meta.rank;
      } else if (left.meta || right.meta) {
        return left.meta ? -1 : 1;
      }
      return left.index - right.index;
    })
    .forEach(option => pushUnique(option.value));

  return values.slice(0, limit);
}

function countDataRows(doc, selector = '#dataList') {
  const table = doc.querySelector(selector);
  if (!table) return 0;
  return Math.max(table.rows.length - 1, 0);
}

function uniqueBy(items, buildKey) {
  const seen = new Set();
  return items.filter(item => {
    const key = buildKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchSectionPost(section, url, form, debugName, referer = url) {
  const { html } = await postForm(url, form, { Referer: referer });
  if (isUnauthenticatedPage(html)) {
    const sessionStillValid = await verifySession();
    if (!sessionStillValid) {
      if (appState.username && appState.password) {
         const ok = await triggerAutoLoginBackground();
         if (ok) return fetchSectionPost(section, url, form, debugName, referer);
      }
      appState.loggedIn = false;
      appState.lastError = '会话已失效，请手动登录系统重试';
      await saveState();
      throw new Error(`${section} 抓取失败：当前会话已失效`);
    }
    await writeDebugHtml(`debug-${debugName}.html`, html);
    throw new Error(`${section} 抓取失败：登录已成功，但提交查询后仍返回了未登录页，调试页已保存到 storage/debug-${debugName}.html`);
  }
  const pageError = extractPageErrorMessage(html);
  if (pageError) {
    await writeDebugHtml(`debug-${debugName}.html`, html);
    throw new Error(`${section} 抓取失败：${pageError} 调试页已保存到 storage/debug-${debugName}.html`);
  }
  return html;
}

async function fetchScheduleData() {
  const entry = await fetchSectionPage('课表', PROFILE.scheduleQueryPath, 'schedule-query');
  const doc = createDocument(entry.html, entry.url);
  return {
    items: parseSection('schedule', entry.html, entry.url),
    sourceUrl: entry.url,
    semester: selectedOptionText(doc, '#xnxq01id') || selectedOptionValue(doc, '#xnxq01id')
  };
}

async function fetchGradesData() {
  const entry = await fetchSectionPage('成绩', PROFILE.gradesQueryPath, 'grades-query');
  const queryDoc = createDocument(entry.html, entry.url);
  const semesters = optionValuesFromSelected(queryDoc, '#kksj');
  if (!semesters.length) {
    return {
      items: [],
      sourceUrl: entry.url,
      semester: ''
    };
  }

  const items = [];
  const listUrl = buildUrl(appState.businessBase, PROFILE.gradesListPath);
  for (const semester of semesters) {
    const form = new URLSearchParams();
    form.set('kksj', semester);
    form.set('kcxz', '');
    form.set('kcmc', '');
    form.set('xsfs', 'max');

    const listHtml = await fetchSectionPost('成绩', listUrl, form, `grades-${semester}`, entry.url);
    const parsed = parseSection('grades', listHtml, listUrl);
    items.push(...parsed);
  }

  return {
    items: uniqueBy(items, item => `${item.semester}|${item.code || ''}|${item.name}|${item.credit}|${item.score}|${item.scoreText}|${item.attribute || ''}|${item.category || ''}`),
    sourceUrl: entry.url,
    semester: selectedOptionValue(queryDoc, '#kksj')
  };
}

async function fetchCertsData() {
  const entry = await fetchSectionPage('等级考试', PROFILE.certsListPath, 'certs-list');
  return {
    items: parseSection('certs', entry.html, entry.url),
    sourceUrl: entry.url
  };
}

async function fetchExamsData() {
  const entry = await fetchSectionPage('考试', PROFILE.examsQueryPath, 'exams-query');
  const queryDoc = createDocument(entry.html, entry.url);
  const semesters = buildNearbySemesterValues(queryDoc, '#xnxqid', 6);
  if (!semesters.length) {
    return {
      items: [],
      sourceUrl: entry.url,
      semester: ''
    };
  }

  const listUrl = buildUrl(appState.businessBase, PROFILE.examsListPath);
  const items = [];
  for (const semester of semesters) {
    const form = new URLSearchParams();
    form.set('xnxqid', semester);
    const listHtml = await fetchSectionPost('考试', listUrl, form, `exams-${semester}`, entry.url);
    const listDoc = createDocument(listHtml, listUrl);
    if (!countDataRows(listDoc)) continue;
    const parsed = parseSection('exams', listHtml, listUrl).map(item => ({
      ...item,
      semester
    }));
    items.push(...parsed);
  }

  return {
    items: uniqueBy(
      items,
      item => `${item.semester || ''}|${item.name}|${item.date}|${item.time}|${item.room}|${item.seat}`
    ),
    sourceUrl: entry.url,
    semester: selectedOptionValue(queryDoc, '#xnxqid') || semesters[0]
  };
}

async function fetchClassroomBuildings(campus) {
  return retryOnce(async () => {
    const requestUrl = buildUrl(appState.businessBase, 'kbcx/getJxlByAjax');
    const form = new URLSearchParams();
    form.set('xqid', campus);
    const { html } = await requestText(requestUrl, {
      method: 'POST',
      data: form.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Origin: businessOrigin(appState.businessBase),
        Referer: buildUrl(appState.businessBase, 'kbcx/kbxx_classroom'),
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    try {
      const parsed = JSON.parse(String(html || '').trim());
      return Array.isArray(parsed)
        ? parsed.map(item => ({
            value: cleanText(item.dm),
            label: cleanText(item.dmmc)
          })).filter(item => item.value)
        : [];
    } catch (error) {
      await writeDebugHtml('debug-classrooms-buildings.txt', html);
      throw new Error(`空闲教室楼栋读取失败：${error.message}`);
    }
  });
}

async function fetchClassroomOptions(campus = '01') {
  await ensureApiSession();
  const entry = await fetchSectionPage('空闲教室', 'kbxx/jsjy_query', 'classrooms-query');
  const doc = createDocument(entry.html, entry.url);
  const campuses = parseSelectOptions(doc, '#xqbh');
  const semesters = parseSelectOptions(doc, '#xnxqh');
  const selectedCampus = campus || campuses.find(item => item.selected)?.value || campuses[0]?.value || '01';
  const selectedSemester = semesters.find(item => item.selected)?.value || semesters[0]?.value || appState.data.meta.semester || '';
  const buildings = await fetchClassroomBuildings(selectedCampus);

  return {
    semester: selectedSemester,
    campus: selectedCampus,
    campuses,
    buildings
  };
}

async function queryClassrooms(params = {}) {
  await ensureApiSession();
  const campus = cleanText(params.campus) || '01';
  let semester = cleanText(params.semester);
  if (!semester) {
    const options = await fetchClassroomOptions(campus);
    semester = options.semester;
  }
  const building = cleanText(params.building);
  const week = Number.parseInt(params.week, 10) || 1;
  const weekday = Number.parseInt(params.weekday, 10) || 1;
  const startPeriodCode = cleanText(params.startPeriodCode);
  const endPeriodCode = cleanText(params.endPeriodCode);

  if (!semester) throw new Error('未读取到学期信息，请先刷新空闲教室页');
  if (!building) throw new Error('请选择楼栋后再查询');
  if (!startPeriodCode || !endPeriodCode) throw new Error('请选择节次后再查询');

  const form = new URLSearchParams();
  form.set('typewhere', 'jszq');
  form.set('xnxqh', semester);
  form.set('xqbh', campus);
  form.set('jxqbh', '');
  form.set('jxlbh', building);
  form.set('jsbh', '');
  form.set('bjfh', '');
  form.set('rnrs', '');
  form.set('jszt', '');
  form.set('zc', String(week));
  form.set('zc2', String(week));
  form.set('xq', String(weekday));
  form.set('xq2', String(weekday));
  form.set('jc', startPeriodCode);
  form.set('jc2', endPeriodCode);

  const queryUrl = buildUrl(appState.businessBase, 'kbxx/jsjy_query2');
  const referer = buildUrl(appState.businessBase, 'kbxx/jsjy_query');
  const html = await retryOnce(() => fetchSectionPost(
    '空闲教室',
    queryUrl,
    form,
    `classrooms-${campus}-${building}-${week}-${weekday}-${startPeriodCode}-${endPeriodCode}`,
    referer
  ));
  const parsed = parseClassroomRows(html, queryUrl);

  return {
    semester,
    campus,
    building,
    week,
    weekday,
    weekdayLabel: cleanText(params.dayLabel) || parsed.weekdayLabel || '',
    periodLabel: cleanText(params.periodLabel) || parsed.periodLabel || '',
    totalRooms: parsed.totalRooms,
    busyCount: parsed.busyCount,
    freeCount: parsed.freeRooms.length,
    rooms: parsed.freeRooms,
    rows: parsed.rows
  };
}

function buildDataFromSections(payload) {
  const now = new Date().toISOString();
  const previousSemesterStart = appState.data.meta.semesterStart || '';
  const derivedSemester = payload.semester
    || payload.grades
      .map(item => item.semester)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0]
    || appState.data.meta.semester
    || '';

  return {
    schedule: payload.schedule,
    grades: payload.grades,
    certs: payload.certs || [],
    exams: payload.exams,
    meta: {
      semester: derivedSemester,
      semesterStart: previousSemesterStart,
      importedAt: now,
      sources: {
        schedule: appState.data.meta.sources.schedule || null,
        grades: appState.data.meta.sources.grades || null,
        certs: appState.data.meta.sources.certs || null,
        exams: appState.data.meta.sources.exams || null
      }
    }
  };
}

async function syncAll() {
  if (appState.syncing) {
    return appState.data;
  }
  if (!appState.loggedIn) {
    throw new Error('当前未登录，无法自动同步');
  }

  appState.syncing = true;
  appState.lastError = '';
  await saveState();

  try {
    if (!appState.loggedIn) {
      const re = await triggerAutoLoginBackground();
      if (!re) throw new Error('当前未登录，且自动重连失败，无法自动同步');
    }
    
    const scheduleData = await fetchScheduleData();
    const gradesData = await fetchGradesData();
    const certsData = await fetchCertsData();
    const examsData = await fetchExamsData();

    appState.data = buildDataFromSections({
      schedule: scheduleData.items,
      grades: gradesData.items,
      certs: certsData.items,
      exams: examsData.items,
      semester: scheduleData.semester || gradesData.semester || examsData.semester
    });
    applyImportedAt('schedule', scheduleData.items.length, scheduleData.sourceUrl, '自动同步课表');
    applyImportedAt('grades', gradesData.items.length, gradesData.sourceUrl, '自动同步成绩');
    applyImportedAt('exams', examsData.items.length, examsData.sourceUrl, '自动同步考试');
    appState.lastSyncAt = new Date().toISOString();
    appState.sessionCheckedAt = appState.lastSyncAt;
    appState.lastError = '';
    await saveState();
    return appState.data;
  } catch (error) {
    appState.lastError = error.message;
    await saveState();
    throw error;
  } finally {
    appState.syncing = false;
    await saveState();
  }
}

async function logout() {
  resetRuntimeSession({ clearCredentials: true, clearData: true });
  appState.sessionCheckedAt = new Date().toISOString();
  await saveState();
}

function requireJsonBody(req, res, next) {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({ ok: false, error: '请求体必须是 JSON' });
  }
  next();
}

async function bootstrap() {
  await loadState();
  if (appState.loggedIn) {
    const ok = await verifySession();
    if (!ok && appState.username && appState.password) {
      await triggerAutoLoginBackground();
    }
    startAutoSync();
  } else if (appState.username && appState.password) {
    await triggerAutoLoginBackground();
    startAutoSync();
  }
}

const app = express();
app.disable('x-powered-by');
if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}
app.use(express.json({ limit: '1mb' }));
app.use(requireJsonBody);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    host: HOST,
    port: PORT,
    publicOrigin: PUBLIC_ORIGIN || '',
    storageDir: STORAGE_DIR,
    uptimeSeconds: Math.round(process.uptime()),
    status: buildStatus()
  });
});

app.get('/api/status', async (req, res) => {
  if (req.query.check === '1') {
    if (appState.loggedIn) {
      const ok = await verifySession();
      if (!ok && appState.username && appState.password) {
        await triggerAutoLoginBackground();
      }
    } else if (appState.username && appState.password) {
      await triggerAutoLoginBackground();
    }
  }
  res.json({
    ok: true,
    status: buildStatus(),
    data: appState.data
  });
});

app.get('/api/auth/captcha', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ ok: false, error: '请先输入学号，再刷新验证码' });
    }
    const image = await fetchCaptcha(username);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.end(image);
  } catch (error) {
    res.status(500).json({ ok: false, error: `获取验证码失败：${error.message}` });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await login(req.body || {});
    let data = appState.data;
    let warning = '';
    try {
      data = await syncAll();
    } catch (error) {
      warning = error.message;
    }
    res.json({
      ok: true,
      status: buildStatus(),
      data,
      warning
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message, status: buildStatus() });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  await logout();
  res.json({ ok: true, status: buildStatus(), data: appState.data });
});

app.post('/api/sync/now', async (req, res) => {
  try {
    const data = await syncAll();
    res.json({ ok: true, status: buildStatus(), data });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message, status: buildStatus(), data: appState.data });
  }
});

app.post('/api/settings/semester-start', async (req, res) => {
  const value = String(req.body?.semesterStart || '').trim();
  appState.data.meta.semesterStart = value;
  await saveState();
  res.json({ ok: true, status: buildStatus(), data: appState.data });
});

app.get('/api/classrooms/options', async (req, res) => {
  try {
    const options = await fetchClassroomOptions(String(req.query.campus || '01').trim());
    res.json({ ok: true, options, status: buildStatus() });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message, status: buildStatus() });
  }
});

app.post('/api/classrooms/query', async (req, res) => {
  try {
    const result = await queryClassrooms(req.body || {});
    res.json({ ok: true, result, status: buildStatus() });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message, status: buildStatus() });
  }
});

app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

bootstrap()
  .then(() => {
    app.listen(PORT, HOST, () => {
      const displayOrigin = PUBLIC_ORIGIN || `http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`;
      console.log(`NJUST Companion server listening on ${displayOrigin}`);
    });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
