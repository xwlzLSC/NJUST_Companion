(function initNativeSync(global) {
  const STORAGE_STATE_KEY = 'njust-native-sync-state';
  const STORAGE_DATA_KEY = 'njust-native-sync-data';
  const STORAGE_COOKIE_KEY = 'njust-native-sync-cookies';
  const APP_VERSION = '2026-08-13-android-v9';
  const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;

  const PROFILE = {
    key: 'android-native',
    label: '安卓原生直连入口',
    entryOrigin: 'http://202.119.81.112:8080',
    entryOrigins: [
      'http://202.119.81.112:8080',
      'http://202.119.81.113:8080'
    ],
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

  function createInitialState() {
    return {
      loggedIn: false,
      syncing: false,
      autoSyncEnabled: true,
      username: '',
      password: '',
      rememberPassword: false,
      autoLoginEnabled: false,
      credentialsSaved: false,
      recovering: false,
      profile: PROFILE.key,
      entryOrigin: '',
      businessBase: '',
      lastSyncAt: '',
      lastError: '',
      sessionCheckedAt: '',
      pendingCaptchaReady: false
    };
  }

  let nativeState = loadState();
  let secureCredentialsPlugin = null;

  function getCapacitorExports() {
    return global.capacitorExports || null;
  }

  function isSupported() {
    const cap = getCapacitorExports();
    return Boolean(cap?.Capacitor?.isNativePlatform?.() && cap?.CapacitorHttp && cap?.CapacitorCookies);
  }

  function requirePlugins() {
    if (!isSupported()) {
      throw new Error('当前环境不是安卓原生容器，无法使用手机端直连同步');
    }
    const cap = getCapacitorExports();
    return {
      Capacitor: cap.Capacitor,
      Http: cap.CapacitorHttp,
      Cookies: cap.CapacitorCookies
    };
  }

  function getSecureCredentialsPlugin() {
    if (secureCredentialsPlugin) return secureCredentialsPlugin;
    const cap = getCapacitorExports();
    const registerPlugin = cap?.registerPlugin || global.Capacitor?.registerPlugin;
    if (!registerPlugin || !cap?.Capacitor?.isNativePlatform?.()) return null;
    secureCredentialsPlugin = registerPlugin('SecureCredentials');
    return secureCredentialsPlugin;
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_STATE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      const nextState = {
        ...createInitialState(),
        ...(parsed && typeof parsed === 'object' ? parsed : {})
      };
      if (!nextState.rememberPassword) {
        nextState.password = '';
        nextState.autoLoginEnabled = false;
      }
      return nextState;
    } catch {
      return createInitialState();
    }
  }

  function saveState() {
    const storedState = {
      ...nativeState,
      // Passwords are kept in Android Keystore by SecureCredentialsPlugin.
      // Never leave a second plaintext copy in WebView localStorage.
      password: '',
      autoLoginEnabled: nativeState.rememberPassword ? nativeState.autoLoginEnabled : false
    };
    global.localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(storedState));
    try {
      global.dispatchEvent(new CustomEvent('njust-native-status', { detail: buildStatus(loadData()) }));
    } catch {}
  }

  async function loadSecureCredentials({ force = false } = {}) {
    if (!force && !nativeState.rememberPassword) return false;
    // One-time migration for releases that stored the remembered password in
    // WebView localStorage. Persist it through Keystore before saveState scrubs
    // the legacy plaintext field.
    if (nativeState.rememberPassword && nativeState.password) {
      try {
        await saveSecureCredentials(nativeState.username, nativeState.password);
        saveState();
        return true;
      } catch {
        nativeState.credentialsSaved = false;
        saveState();
        return false;
      }
    }
    const plugin = getSecureCredentialsPlugin();
    if (!plugin) {
      nativeState.credentialsSaved = false;
      if (!nativeState.password) {
        nativeState.rememberPassword = false;
        nativeState.autoLoginEnabled = false;
      }
      saveState();
      return false;
    }
    try {
      const credentials = await plugin.load();
      const username = String(credentials?.username || '').trim();
      const password = String(credentials?.password || '');
      if (!username || !password) {
        nativeState.credentialsSaved = false;
        if (!nativeState.password) {
          nativeState.rememberPassword = false;
          nativeState.autoLoginEnabled = false;
        }
        saveState();
        return false;
      }
      nativeState.username = username;
      nativeState.password = password;
      nativeState.rememberPassword = true;
      nativeState.autoLoginEnabled = true;
      nativeState.credentialsSaved = true;
      saveState();
      return true;
    } catch {
      nativeState.credentialsSaved = false;
      if (!nativeState.password) {
        nativeState.rememberPassword = false;
        nativeState.autoLoginEnabled = false;
      }
      saveState();
      return false;
    }
  }

  async function saveSecureCredentials(username, password) {
    const plugin = getSecureCredentialsPlugin();
    if (!plugin) throw new Error('安全凭据组件不可用，无法记住密码');
    if (!username || !password) throw new Error('账号或密码为空，无法记住密码');
    await plugin.save({ username, password });
    const verified = await plugin.load();
    if (String(verified?.username || '').trim() !== String(username).trim() || String(verified?.password || '') !== String(password)) {
      throw new Error('密码安全保存校验失败');
    }
    nativeState.credentialsSaved = true;
    return true;
  }

  async function clearSecureCredentials() {
    const plugin = getSecureCredentialsPlugin();
    if (!plugin) return;
    await plugin.clear().catch(() => {});
    nativeState.credentialsSaved = false;
  }

  function loadData() {
    try {
      const raw = global.localStorage.getItem(STORAGE_DATA_KEY);
      if (!raw) return createEmptyData();
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : createEmptyData();
    } catch {
      return createEmptyData();
    }
  }

  function saveData(data) {
    global.localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(data));
  }

  function loadCookieSnapshot() {
    try {
      const raw = global.localStorage.getItem(STORAGE_COOKIE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCookieSnapshot(snapshot) {
    global.localStorage.setItem(STORAGE_COOKIE_KEY, JSON.stringify(snapshot || {}));
  }

  function clearCookieSnapshot() {
    global.localStorage.removeItem(STORAGE_COOKIE_KEY);
  }

  function clearRemoteData() {
    saveData(createEmptyData());
    nativeState.lastSyncAt = '';
  }

  function resetRuntimeSession({ clearCredentials = false, clearData = false } = {}) {
    nativeState.loggedIn = false;
    nativeState.recovering = false;
    nativeState.entryOrigin = '';
    nativeState.businessBase = '';
    nativeState.lastError = '';
    nativeState.pendingCaptchaReady = false;
    nativeState.autoLoginEnabled = clearCredentials ? false : nativeState.autoLoginEnabled;
    if (clearCredentials) {
      nativeState.username = '';
      nativeState.password = '';
      nativeState.rememberPassword = false;
      nativeState.credentialsSaved = false;
    }
    if (clearData) {
      clearRemoteData();
    }
  }

  function buildStatus(data = loadData()) {
    return {
      available: isSupported(),
      version: APP_VERSION,
      loggedIn: nativeState.loggedIn,
      syncing: nativeState.syncing,
      autoSyncEnabled: nativeState.autoSyncEnabled,
      username: nativeState.username,
      rememberPassword: nativeState.rememberPassword,
      credentialsSaved: nativeState.credentialsSaved,
      recovering: nativeState.recovering,
      profile: nativeState.profile,
      profileLabel: PROFILE.label,
      businessBase: nativeState.businessBase,
      lastSyncAt: nativeState.lastSyncAt,
      lastError: nativeState.lastError,
      sessionCheckedAt: nativeState.sessionCheckedAt,
      transport: 'native',
      counts: {
        schedule: Array.isArray(data.schedule) ? data.schedule.length : 0,
        grades: Array.isArray(data.grades) ? data.grades.length : 0,
        certs: Array.isArray(data.certs) ? data.certs.length : 0,
        exams: Array.isArray(data.exams) ? data.exams.length : 0
      }
    };
  }

  function buildUrl(base, pathName) {
    return new URL(pathName, base).toString();
  }

  function businessOrigin(base = nativeState.businessBase) {
    return base ? new URL(base).origin : (nativeState.entryOrigin || PROFILE.entryOrigin);
  }

  function uniqueUrls(urls) {
    return [...new Set(urls.filter(Boolean))];
  }

  function getCookieUrls() {
    return uniqueUrls([
      nativeState.entryOrigin,
      ...PROFILE.entryOrigins,
      nativeState.businessBase,
      resolveBusinessBase(nativeState.username),
      ...PROFILE.shardBases
    ]);
  }

  function getCookiePath(url) {
    return String(url || '').includes('/njlgdx/') ? '/njlgdx' : '/';
  }

  function normalizeBase64(value) {
    return String(value || '').replace(/\s+/g, '');
  }

  function decodeBase64ToBytes(base64) {
    const clean = normalizeBase64(base64);
    const binary = global.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function getHeader(headers, name) {
    const entries = headers && typeof headers === 'object' ? Object.entries(headers) : [];
    const found = entries.find(([key]) => String(key).toLowerCase() === String(name).toLowerCase());
    return found ? String(found[1] || '') : '';
  }

  function getCharset(headers) {
    const match = getHeader(headers, 'content-type').match(/charset=([^;]+)/i);
    return match ? match[1].trim().toLowerCase() : 'utf-8';
  }

  function decodeBytes(bytes, charset) {
    const candidates = [charset, 'gbk', 'gb18030', 'utf-8'].filter(Boolean);
    for (const candidate of candidates) {
      try {
        return new TextDecoder(candidate).decode(bytes);
      } catch {
        // continue
      }
    }
    return new TextDecoder().decode(bytes);
  }

  function responseText(response) {
    if (!response) return '';
    if (typeof response.data !== 'string') {
      return '';
    }
    try {
      return decodeBytes(decodeBase64ToBytes(response.data), getCharset(response.headers));
    } catch {
      return String(response.data || '');
    }
  }

  async function requestRaw(url, options = {}) {
    const { Http } = requirePlugins();
    return Http.request({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      data: options.data,
      responseType: options.responseType || 'arraybuffer',
      connectTimeout: options.connectTimeout || 20000,
      readTimeout: options.readTimeout || 20000
    });
  }

  async function fetchText(url, options = {}) {
    const response = await requestRaw(url, { ...options, responseType: 'arraybuffer' });
    return {
      response,
      html: responseText(response)
    };
  }

  async function postForm(url, form, headers = {}) {
    return fetchText(url, {
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

  function isUnauthenticatedPage(html) {
    return /登录个人中心|用户登录|verifycode\.servlet|Verifyservlet|name="USERNAME"|请先登录系统|用户没有登录，请重新登录|出错页面|强智科技教务系统概念版/.test(html);
  }

  function extractLoginErrorMessage(html) {
    const fontMatch = String(html || '').match(/<font[^>]*color=["']?red["']?[^>]*>(.*?)<\/font>/i);
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

    const requiredMatch = String(html || '').match(/>\s*(\*必填)\s*</);
    if (requiredMatch) return requiredMatch[1];

    const promptMatch = String(html || '').match(/<h3>\s*提示：([^<]+)<\/h3>/i);
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

  function resolveBusinessBase(username = nativeState.username) {
    const userText = String(username || '').trim();
    if (!userText || !/^\d+$/.test(userText)) return PROFILE.shardBases[0];
    const shardIndex = Number(BigInt(userText) % BigInt(PROFILE.shardBases.length));
    return PROFILE.shardBases[shardIndex];
  }

  function getEntryOriginCandidates() {
    return uniqueUrls([nativeState.entryOrigin, ...PROFILE.entryOrigins]);
  }

  async function prepareCaptchaSession(entryOrigin = '') {
    const candidates = entryOrigin ? [entryOrigin] : getEntryOriginCandidates();
    let lastError = null;
    for (const candidate of candidates) {
      try {
        await requestRaw(buildUrl(candidate, PROFILE.loginPagePath), {
          responseType: 'arraybuffer',
          connectTimeout: 8000,
          readTimeout: 10000
        });
        nativeState.entryOrigin = candidate;
        nativeState.pendingCaptchaReady = true;
        saveState();
        return candidate;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`教务登录入口暂不可达：${lastError?.message || '请检查网络后重试'}`);
  }

  async function fetchCaptcha(username) {
    if (!username) {
      throw new Error('请先输入学号，再刷新验证码');
    }
    let lastError = null;
    for (const candidate of getEntryOriginCandidates()) {
      try {
        await prepareCaptchaSession(candidate);
        const response = await requestRaw(
          `${buildUrl(candidate, PROFILE.captchaPath)}?t=${Date.now()}`,
          { responseType: 'arraybuffer', connectTimeout: 8000, readTimeout: 10000 }
        );
        nativeState.entryOrigin = candidate;
        nativeState.pendingCaptchaReady = true;
        saveState();
        return {
          ok: true,
          imageDataUrl: `data:image/png;base64,${normalizeBase64(response.data)}`
        };
      } catch (error) {
        lastError = error;
        nativeState.pendingCaptchaReady = false;
      }
    }
    saveState();
    throw new Error(`验证码获取失败：两个教务入口均不可达（${lastError?.message || '网络异常'}）`);
  }

  async function snapshotCookies() {
    const { Cookies } = requirePlugins();
    const snapshot = {};
    for (const url of getCookieUrls()) {
      try {
        const cookies = await Cookies.getCookies({ url });
        if (cookies && typeof cookies === 'object' && Object.keys(cookies).length) {
          snapshot[url] = cookies;
        }
      } catch {
        // ignore single-url snapshot failure
      }
    }
    if (Object.keys(snapshot).length) {
      saveCookieSnapshot(snapshot);
    }
    return snapshot;
  }

  async function restoreCookiesFromSnapshot() {
    const { Cookies } = requirePlugins();
    const snapshot = loadCookieSnapshot();
    const entries = Object.entries(snapshot);
    if (!entries.length) return false;

    for (const [url, cookieMap] of entries) {
      for (const [key, value] of Object.entries(cookieMap || {})) {
        if (!key) continue;
        try {
          await Cookies.setCookie({
            url,
            key,
            value: String(value ?? ''),
            path: getCookiePath(url)
          });
        } catch {
          // ignore single-cookie restore failure
        }
      }
    }
    return true;
  }

  async function hasRuntimeCookies(url) {
    const { Cookies } = requirePlugins();
    try {
      const cookieMap = await Cookies.getCookies({ url });
      if (!cookieMap || typeof cookieMap !== 'object') return false;
      const keys = Object.keys(cookieMap).map(k => k.toUpperCase());
      return keys.includes('JSESSIONID');
    } catch {
      return false;
    }
  }

  async function tryRecoverSession() {
    await loadSecureCredentials({ force: true });
    if (!nativeState.username) return false;
    nativeState.businessBase = nativeState.businessBase || resolveBusinessBase(nativeState.username);

    if (await hasRuntimeCookies(nativeState.businessBase)) {
      const okFirstTry = await verifySession();
      if (okFirstTry) return true;
    }

    const restored = await restoreCookiesFromSnapshot();
    if (restored && await hasRuntimeCookies(nativeState.businessBase)) {
      const okSecondTry = await verifySession();
      if (okSecondTry) return true;
    }

    return await triggerAutoLoginBackground();
  }

  function canRecoverWithPassword() {
    return Boolean(
      nativeState.rememberPassword
      && nativeState.autoLoginEnabled
      && nativeState.username
      && nativeState.password
    );
  }

  async function verifySession() {
    if (!nativeState.businessBase) {
      nativeState.loggedIn = false;
      saveState();
      return false;
    }

    try {
      const { html } = await fetchText(buildUrl(nativeState.businessBase, PROFILE.mainPath), {
        connectTimeout: 8000,
        readTimeout: 10000
      });
      nativeState.sessionCheckedAt = new Date().toISOString();
      nativeState.loggedIn = !isUnauthenticatedPage(html);
      if (!nativeState.loggedIn) {
        nativeState.lastError = '会话已失效，请重新输入验证码登录';
      } else {
        await snapshotCookies();
      }
      saveState();
      return nativeState.loggedIn;
    } catch (error) {
      nativeState.loggedIn = false;
      nativeState.sessionCheckedAt = new Date().toISOString();
      nativeState.lastError = `会话检查失败：${error.message}`;
      saveState();
      return false;
    }
  }

  async function keepAlive() {
    if (!nativeState.loggedIn || !nativeState.businessBase) {
      if (nativeState.rememberPassword || nativeState.credentialsSaved) {
        await tryRecoverSession();
      }
      return {
        ok: true,
        status: buildStatus(loadData()),
        data: loadData()
      };
    }

    try {
      const { html } = await fetchText(buildUrl(nativeState.businessBase, PROFILE.keepAlivePath));
      nativeState.sessionCheckedAt = new Date().toISOString();
      if (isUnauthenticatedPage(html)) {
        nativeState.loggedIn = false;
        nativeState.lastError = '会话已失效，请重新输入验证码登录';
      } else {
        await snapshotCookies();
      }
      saveState();
    } catch {
      // 保活失败时先不清空登录态，避免临时网络波动直接把状态打掉
    }

    return {
      ok: true,
      status: buildStatus(loadData()),
      data: loadData()
    };
  }

  function createDocument(html) {
    return new DOMParser().parseFromString(html, 'text/html');
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

  function parseSelectOptions(doc, selector) {
    return Array.from(doc.querySelectorAll(`${selector} option`))
      .map(option => ({
        value: cleanText(option.value),
        label: cleanText(option.textContent),
        selected: Boolean(option.selected || option.hasAttribute('selected'))
      }))
      .filter(option => option.value);
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

  function parseSection(section, html, url) {
    const parser = global.NJUSTParser;
    if (!parser) {
      throw new Error('解析器未加载，无法处理教务页面');
    }
    const doc = createDocument(html);
    if (section === 'schedule') return parser.parseSchedule(doc);
    if (section === 'grades') return parser.parseGrades(doc);
    if (section === 'certs') return parser.parseLevelExams(doc);
    if (section === 'exams') return parser.parseExams(doc);
    void url;
    return [];
  }

  async function fetchSectionPage(section, targetPath) {
    const url = buildUrl(nativeState.businessBase, targetPath);
    const { html } = await fetchText(url);
    if (isUnauthenticatedPage(html)) {
      const sessionStillValid = await verifySession();
      if (!sessionStillValid) {
        if (canRecoverWithPassword()) {
          const ok = await triggerAutoLoginBackground();
          if (ok) return fetchSectionPage(section, targetPath);
        }
        nativeState.loggedIn = false;
        nativeState.lastError = '会话已失效，请重新登录尝试手动抢救';
        saveState();
        throw new Error(`${section} 抓取失败：当前会话已失效`);
      }
      throw new Error(`${section} 抓取失败：登录已成功，但该页面返回了未登录错误页`);
    }
    const pageError = extractPageErrorMessage(html);
    if (pageError) {
      if (pageError === '*必填') {
        throw new Error(`${section} 抓取失败：页面返回“*必填”，说明必须先进入查询页再提交筛选参数`);
      }
      throw new Error(`${section} 抓取失败：${pageError}`);
    }
    return { html, url };
  }

  async function fetchSectionPost(section, url, form, referer = url) {
    const { html } = await postForm(url, form, { Referer: referer });
    if (isUnauthenticatedPage(html)) {
      const sessionStillValid = await verifySession();
      if (!sessionStillValid) {
        if (canRecoverWithPassword()) {
          const ok = await triggerAutoLoginBackground();
          if (ok) return fetchSectionPost(section, url, form, referer);
        }
        nativeState.loggedIn = false;
        nativeState.lastError = '会话已失效，请手动登录尝试抢救';
        saveState();
        throw new Error(`${section} 抓取失败：当前会话已失效`);
      }
      throw new Error(`${section} 抓取失败：提交查询后仍返回了未登录页`);
    }
    const pageError = extractPageErrorMessage(html);
    if (pageError) {
      throw new Error(`${section} 抓取失败：${pageError}`);
    }
    return html;
  }

  async function fetchScheduleData() {
    const entry = await fetchSectionPage('课表', PROFILE.scheduleQueryPath);
    const doc = createDocument(entry.html);
    return {
      items: parseSection('schedule', entry.html, entry.url),
      sourceUrl: entry.url,
      semester: selectedOptionText(doc, '#xnxq01id') || selectedOptionValue(doc, '#xnxq01id')
    };
  }

  async function fetchGradesData() {
    const entry = await fetchSectionPage('成绩', PROFILE.gradesQueryPath);
    const queryDoc = createDocument(entry.html);
    const semesters = optionValuesFromSelected(queryDoc, '#kksj');
    if (!semesters.length) {
      return { items: [], sourceUrl: entry.url, semester: '' };
    }

    const items = [];
    const listUrl = buildUrl(nativeState.businessBase, PROFILE.gradesListPath);
    for (const semester of semesters) {
      const form = new URLSearchParams();
      form.set('kksj', semester);
      form.set('kcxz', '');
      form.set('kcmc', '');
      form.set('xsfs', 'max');
      const listHtml = await fetchSectionPost('成绩', listUrl, form, entry.url);
      items.push(...parseSection('grades', listHtml, listUrl));
    }

    return {
      items: uniqueBy(
        items,
        item => `${item.semester}|${item.code || ''}|${item.name}|${item.credit}|${item.score}|${item.scoreText}|${item.attribute || ''}|${item.category || ''}`
      ),
      sourceUrl: entry.url,
      semester: selectedOptionValue(queryDoc, '#kksj')
    };
  }

  async function fetchCertsData() {
    const entry = await fetchSectionPage('等级考试', PROFILE.certsListPath);
    return {
      items: parseSection('certs', entry.html, entry.url),
      sourceUrl: entry.url
    };
  }

  async function fetchExamsData() {
    const entry = await fetchSectionPage('考试', PROFILE.examsQueryPath);
    const queryDoc = createDocument(entry.html);
    const semesters = buildNearbySemesterValues(queryDoc, '#xnxqid', 6);
    if (!semesters.length) {
      return { items: [], sourceUrl: entry.url, semester: '' };
    }

    const listUrl = buildUrl(nativeState.businessBase, PROFILE.examsListPath);
    const items = [];
    for (const semester of semesters) {
      const form = new URLSearchParams();
      form.set('xnxqid', semester);
      const listHtml = await fetchSectionPost('考试', listUrl, form, entry.url);
      const listDoc = createDocument(listHtml);
      if (!countDataRows(listDoc)) continue;
      items.push(
        ...parseSection('exams', listHtml, listUrl).map(item => ({
          ...item,
          semester
        }))
      );
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

  async function ensureSessionForApi() {
    if (nativeState.loggedIn) return true;
    const recovered = await tryRecoverSession();
    if (recovered) return true;
    throw new Error('当前未登录，请先登录教务系统');
  }

  async function fetchClassroomBuildings(campus) {
    const requestUrl = buildUrl(nativeState.businessBase, 'kbcx/getJxlByAjax');
    const form = new URLSearchParams();
    form.set('xqid', campus);
    const { html } = await fetchText(requestUrl, {
      method: 'POST',
      data: form.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Origin: businessOrigin(nativeState.businessBase),
        Referer: buildUrl(nativeState.businessBase, 'kbcx/kbxx_classroom'),
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    const parsed = JSON.parse(String(html || '').trim());
    return Array.isArray(parsed)
      ? parsed.map(item => ({
          value: cleanText(item.dm),
          label: cleanText(item.dmmc)
        })).filter(item => item.value)
      : [];
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

  function parseClassroomRows(html) {
    const doc = createDocument(html);
    const table = doc.querySelector('#dataList');
    const weekdayLabel = cleanText(table?.rows?.[0]?.cells?.[1]?.textContent || '');
    const periodLabel = cleanText(table?.rows?.[1]?.cells?.[1]?.textContent || '');
    const rows = Array.from(doc.querySelectorAll('tr[jsbh]')).map(row => {
      const room = parseClassroomLabel(row.cells?.[0]?.textContent || '');
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
    return new Promise(resolve => global.setTimeout(resolve, ms));
  }

  async function retryOnce(task) {
    try {
      return await task();
    } catch (error) {
      await wait(350);
      return task(error);
    }
  }

  async function getClassroomOptions(options = {}) {
    await ensureSessionForApi();
    const campus = cleanText(options.campus) || '01';
    const entry = await fetchSectionPage('空闲教室', 'kbxx/jsjy_query');
    const doc = createDocument(entry.html);
    const campuses = parseSelectOptions(doc, '#xqbh');
    const semesters = parseSelectOptions(doc, '#xnxqh');
    const selectedCampus = campus || campuses.find(item => item.selected)?.value || campuses[0]?.value || '01';
    const selectedSemester = semesters.find(item => item.selected)?.value || semesters[0]?.value || loadData().meta?.semester || '';
    const buildings = await retryOnce(() => fetchClassroomBuildings(selectedCampus));
    return {
      ok: true,
      options: {
        semester: selectedSemester,
        campus: selectedCampus,
        campuses,
        buildings
      },
      status: buildStatus(loadData()),
      data: loadData()
    };
  }

  async function queryClassrooms(options = {}) {
    await ensureSessionForApi();
    const campus = cleanText(options.campus) || '01';
    let semester = cleanText(options.semester);
    if (!semester) {
      const current = await getClassroomOptions({ campus });
      const available = current.options || {};
      semester = available.semester;
    }
    const building = cleanText(options.building);
    const week = Number.parseInt(options.week, 10) || 1;
    const weekday = Number.parseInt(options.weekday, 10) || 1;
    const startPeriodCode = cleanText(options.startPeriodCode);
    const endPeriodCode = cleanText(options.endPeriodCode);

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

    const queryUrl = buildUrl(nativeState.businessBase, 'kbxx/jsjy_query2');
    const referer = buildUrl(nativeState.businessBase, 'kbxx/jsjy_query');
    const html = await retryOnce(() => fetchSectionPost('空闲教室', queryUrl, form, referer));
    const parsed = parseClassroomRows(html);

    return {
      ok: true,
      result: {
        semester,
        campus,
        building,
        week,
        weekday,
        weekdayLabel: cleanText(options.dayLabel) || parsed.weekdayLabel || '',
        periodLabel: cleanText(options.periodLabel) || parsed.periodLabel || '',
        totalRooms: parsed.totalRooms,
        busyCount: parsed.busyCount,
        freeCount: parsed.freeRooms.length,
        rooms: parsed.freeRooms,
        rows: parsed.rows
      },
      status: buildStatus(loadData()),
      data: loadData()
    };
  }

  function applyImportedAt(data, section, count, sourceUrl, pageTitle) {
    const now = new Date().toISOString();
    data.meta.sources[section] = {
      importedAt: now,
      count,
      sourceUrl,
      pageTitle
    };
  }

  function buildDataFromSections(previousData, payload) {
    const now = new Date().toISOString();
    const previous = previousData && typeof previousData === 'object' ? previousData : createEmptyData();
    const previousSources = previous.meta && typeof previous.meta === 'object' && previous.meta.sources ? previous.meta.sources : {};
    const previousSemesterStart = previous.meta?.semesterStart || '';
    const derivedSemester = payload.semester
      || (payload.grades || [])
        .map(item => item.semester)
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left))[0]
      || previous.meta?.semester
      || '';

    return {
      schedule: payload.schedule || [],
      grades: payload.grades || [],
      certs: payload.certs || [],
      exams: payload.exams || [],
      meta: {
        semester: derivedSemester,
        semesterStart: previousSemesterStart,
        importedAt: now,
        sources: {
          schedule: previousSources.schedule || null,
          grades: previousSources.grades || null,
          certs: previousSources.certs || null,
          exams: previousSources.exams || null
        }
      }
    };
  }

  async function syncAll() {
    if (nativeState.syncing) {
      return loadData();
    }
    if (!nativeState.loggedIn) {
      const recovered = await tryRecoverSession();
      if (!recovered) {
        throw new Error('当前未登录，无法自动同步');
      }
    } else {
      nativeState.businessBase = nativeState.businessBase || resolveBusinessBase(nativeState.username);
      if (nativeState.businessBase) {
        const runtimeReady = await hasRuntimeCookies(nativeState.businessBase);
        if (!runtimeReady) {
          await restoreCookiesFromSnapshot();
        }
      }
    }

    nativeState.syncing = true;
    nativeState.lastError = '';
    saveState();

    try {
      const currentData = loadData();
      const scheduleData = await fetchScheduleData();
      const gradesData = await fetchGradesData();
      const certsData = await fetchCertsData();
      const examsData = await fetchExamsData();

      const nextData = buildDataFromSections(currentData, {
        schedule: scheduleData.items,
        grades: gradesData.items,
        certs: certsData.items,
        exams: examsData.items,
        semester: scheduleData.semester || gradesData.semester || examsData.semester
      });

      applyImportedAt(nextData, 'schedule', scheduleData.items.length, scheduleData.sourceUrl, '安卓直连同步课表');
      applyImportedAt(nextData, 'grades', gradesData.items.length, gradesData.sourceUrl, '安卓直连同步成绩');
      applyImportedAt(nextData, 'certs', certsData.items.length, certsData.sourceUrl, '安卓直连同步四六级');
      applyImportedAt(nextData, 'exams', examsData.items.length, examsData.sourceUrl, '安卓直连同步考试');
      saveData(nextData);

      nativeState.lastSyncAt = new Date().toISOString();
      nativeState.sessionCheckedAt = nativeState.lastSyncAt;
      nativeState.lastError = '';
      saveState();
      return nextData;
    } catch (error) {
      nativeState.lastError = error.message;
      saveState();
      throw error;
    } finally {
      nativeState.syncing = false;
      saveState();
    }
  }

  let globalOcrWorker = null;

  async function getOcrWorker() {
    if (!globalOcrWorker) {
      if (!window.Tesseract) throw new Error('前端 OCR 引擎未能按时加载，请检查网络');
      globalOcrWorker = await window.Tesseract.createWorker('eng', 1, {
        workerPath: './vendor/tesseract/worker.min.js',
        corePath: './vendor/tesseract-core/tesseract-core-lstm.wasm.js',
        langPath: './vendor/tesseract-data',
        gzip: false,
        workerBlobURL: false
      });
      await globalOcrWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      });
    }
    return globalOcrWorker;
  }

  async function solveCaptchaOCR(imageDataUrl) {
    const worker = await getOcrWorker();
    const ret = await worker.recognize(imageDataUrl);
    return ret.data.text.replace(/[^A-Za-z0-9]/g, '');
  }

  let autoLoginPromise = null;
  async function triggerAutoLoginBackground() {
    if (autoLoginPromise) return autoLoginPromise;
    await loadSecureCredentials({ force: true });
    if (!canRecoverWithPassword()) return false;
    autoLoginPromise = (async () => {
      nativeState.recovering = true;
      nativeState.lastError = '';
      saveState();
      try {
        await smartLogin({ username: nativeState.username, password: nativeState.password, autoRetry: true });
        return true;
      } catch (error) {
        nativeState.lastError = error.message || '自动恢复登录失败';
        saveState();
        return false;
      } finally {
        nativeState.recovering = false;
        saveState();
        autoLoginPromise = null;
      }
    })();
    return autoLoginPromise;
  }

  async function smartLogin(options = {}) {
    let username = String(options.username || '').trim();
    let password = String(options.password || '');
    const captcha = options.captcha;
    const autoRetry = options.autoRetry !== false;
    const rememberPassword = options.rememberPassword ?? nativeState.rememberPassword;
    if (!username || !password) {
      await loadSecureCredentials({ force: true });
      username = username || nativeState.username;
      if (!password && username === nativeState.username) password = nativeState.password;
    }
    if (!username || !password) {
      throw new Error('用户名、密码不能为空');
    }

    const normalizedUsername = String(username).trim();
    const switchingUser = Boolean(nativeState.username && nativeState.username !== normalizedUsername);
    if (switchingUser) {
      const keepRemember = nativeState.rememberPassword;
      resetRuntimeSession({ clearCredentials: true, clearData: true });
      nativeState.rememberPassword = keepRemember;
      saveState();
    }

    let attempt = 0;
    const maxAttempts = autoRetry ? 4 : 1;
    let lastErrorMessage = '';

    while (attempt < maxAttempts) {
      attempt++;
      nativeState.loggedIn = false;
      nativeState.businessBase = '';
      nativeState.lastError = `登录中...`;
      saveState();

      let finalCaptcha = captcha;
      if (!finalCaptcha || (autoRetry && attempt > 1)) {
        nativeState.lastError = `登录中... 正在智能识别验证码 (尝试 ${attempt}/${maxAttempts})`;
        saveState();
        
        let ocrText = '';
        let strictAttempts = 0;
        while (ocrText.length !== 4 && strictAttempts < 3) {
          strictAttempts++;
          const payload = await fetchCaptcha(username);
          ocrText = await solveCaptchaOCR(payload.imageDataUrl);
        }
        finalCaptcha = ocrText || '1234';
        
        nativeState.pendingCaptchaReady = true;
        saveState();
      }

      const form = new URLSearchParams();
      form.set('USERNAME', username);
      form.set('PASSWORD', password);
      form.set('RANDOMCODE', finalCaptcha);
      form.set('useDogCode', '');

      if (!nativeState.pendingCaptchaReady) {
        if (!autoRetry) throw new Error('请先刷新验证码');
        await prepareCaptchaSession();
      }

      try {
        const loginOrigin = nativeState.entryOrigin || PROFILE.entryOrigin;
        const response = await requestRaw(buildUrl(loginOrigin, PROFILE.loginPath), {
          method: 'POST',
          data: form.toString(),
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: loginOrigin,
            Referer: buildUrl(loginOrigin, PROFILE.loginPagePath)
          }
        });

        nativeState.pendingCaptchaReady = false;
        saveState();

        const loginHtml = responseText(response);
        const directErrorMessage = extractLoginErrorMessage(loginHtml);
        if (directErrorMessage) {
          lastErrorMessage = directErrorMessage;
          if (directErrorMessage.includes('验证码') && autoRetry) {
             continue;
          }
          throw new Error(directErrorMessage);
        }

        const responseUrl = String(response.url || getHeader(response.headers, 'location') || '');
        nativeState.businessBase = /202\.119\.81\.(112|113):9080\/njlgdx\//.test(responseUrl)
          ? responseUrl.replace(/(http:\/\/202\.119\.81\.(112|113):9080\/njlgdx\/).*/, '$1')
          : resolveBusinessBase(username);

        const success = await verifySession();
        if (!success) {
          lastErrorMessage = '登录失败，可能是当前不在可访问教务系统的网络环境';
          continue;
        }

        nativeState.loggedIn = true;
        nativeState.username = username;
        nativeState.password = rememberPassword ? password : '';
        nativeState.rememberPassword = Boolean(rememberPassword);
        nativeState.autoLoginEnabled = Boolean(rememberPassword);
        nativeState.profile = PROFILE.key;
        nativeState.lastError = '';
        if (nativeState.rememberPassword) {
          await saveSecureCredentials(username, password);
        } else {
          await clearSecureCredentials();
        }
        saveState();
        await snapshotCookies();
        return;
      } catch (err) {
        lastErrorMessage = err.message || '网络异常';
        if (!autoRetry) throw err;
        await wait(500);
      }
    }
    
    nativeState.loggedIn = false;
    nativeState.lastError = lastErrorMessage || '尝试自动登录次数超限，请检查学号密码';
    saveState();
    throw new Error(nativeState.lastError);
  }

  async function login(options) {
    return smartLogin({ ...options, autoRetry: !options.captcha });
  }

  async function loginAndSync(options) {
    await login(options);
    let data = loadData();
    let warning = '';
    try {
      data = await syncAll();
    } catch (error) {
      warning = error.message;
    }
    return {
      ok: true,
      status: buildStatus(data),
      data,
      warning
    };
  }

  async function logout() {
    const { Cookies } = requirePlugins();
    await Cookies.clearAllCookies();
    clearCookieSnapshot();
    await clearSecureCredentials();
    resetRuntimeSession({ clearCredentials: true, clearData: true });
    saveState();
    return {
      ok: true,
      status: buildStatus(loadData()),
      data: loadData()
    };
  }

  async function saveLoginPreference({ username = '', password = '', rememberPassword = false } = {}) {
    nativeState.username = String(username || nativeState.username || '').trim();
    nativeState.rememberPassword = Boolean(rememberPassword);
    nativeState.password = nativeState.rememberPassword ? String(password || nativeState.password || '') : '';
    nativeState.autoLoginEnabled = nativeState.rememberPassword && Boolean(nativeState.username && nativeState.password);
    if (nativeState.rememberPassword && nativeState.username && nativeState.password) {
      await saveSecureCredentials(nativeState.username, nativeState.password);
    } else if (nativeState.rememberPassword) {
      const restored = await loadSecureCredentials({ force: true });
      if (!restored) throw new Error('请先输入账号密码，再开启记住密码');
    } else if (!nativeState.rememberPassword) {
      await clearSecureCredentials();
    }
    saveState();
    return {
      ok: true,
      status: buildStatus(loadData()),
      data: loadData()
    };
  }

  async function getStatus(options = {}) {
    await loadSecureCredentials({ force: true });
    if (nativeState.username && nativeState.loggedIn) {
      nativeState.businessBase = nativeState.businessBase || resolveBusinessBase(nativeState.username);
      if (nativeState.businessBase) {
        const runtimeReady = await hasRuntimeCookies(nativeState.businessBase);
        if (!runtimeReady) {
          await restoreCookiesFromSnapshot();
        }
        const restoredReady = await hasRuntimeCookies(nativeState.businessBase);
        if (!restoredReady) nativeState.loggedIn = false;
      }
    }
    if (nativeState.username && !nativeState.loggedIn) {
      await tryRecoverSession();
    }
    if (options.check && nativeState.loggedIn) {
      await verifySession();
    }
    const data = loadData();
    return {
      ok: true,
      status: buildStatus(data),
      data
    };
  }

  async function saveSemesterStart(semesterStart) {
    const data = loadData();
    if (!data.meta || typeof data.meta !== 'object') {
      data.meta = createEmptyData().meta;
    }
    data.meta.semesterStart = String(semesterStart || '').trim();
    saveData(data);
    return {
      ok: true,
      status: buildStatus(data),
      data
    };
  }

  async function syncNow() {
    if (!nativeState.loggedIn) {
      await tryRecoverSession();
    }
    const data = await syncAll();
    return {
      ok: true,
      status: buildStatus(data),
      data
    };
  }

  global.NJUSTNativeSync = {
    isSupported,
    getStatus,
    fetchCaptcha,
    getClassroomOptions,
    queryClassrooms,
    keepAlive,
    keepAliveIntervalMs: KEEP_ALIVE_INTERVAL_MS,
    loginAndSync,
    syncNow,
    logout,
    saveSemesterStart,
    saveLoginPreference
  };
})(window);
