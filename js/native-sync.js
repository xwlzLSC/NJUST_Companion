/** @maintenance
 * APK 本机联网与认证适配层：CapacitorHttp 获取学校页面，parser.js 解析结果，本机保存离线数据。
 * 账号密码走智慧理工 CAS；微信授权与账号密码登录共用学校 Cookie，但微信授权不能凭空产生可保存的密码。
 * Promise 单飞、人工验证码保护期和请求代次都是防竞争机制，维护时不要删掉；密码/Cookie 不得进入日志或普通 localStorage。
 */
(function initNativeSync(global) {
  const STORAGE_STATE_KEY = 'njust-native-sync-state';
  const STORAGE_DATA_KEY = 'njust-native-sync-data';
  const STORAGE_COOKIE_KEY = 'njust-native-sync-cookies';
  const STORAGE_WECHAT_ATTEMPT_KEY = 'njust-native-wechat-attempt';
  const APP_VERSION = '2026-10-02-library';
  const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;
  const WECHAT_TTL_MS = 180000;
  const WECHAT_VERIFY_GRACE_MS = 45000;
  // The school's CAS login hides QR login on its mobile page. Use the desktop
  // variant only when starting the WeChat authorization flow.
  const CAS_DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const PROFILE = {
    key: 'android-native',
    label: '智慧理工统一认证',
    entryOrigin: 'http://202.119.81.113:8080',
    entryOrigins: [
      'http://202.119.81.113:8080',
      'https://bkjw.njust.edu.cn',
      'http://202.119.81.112:8080'
    ],
    officialOrigin: 'https://bkjw.njust.edu.cn',
    officialBusinessBase: 'https://bkjw.njust.edu.cn/njlgdx/',
    casOrigin: 'https://ids.njust.edu.cn',
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

  function classicEntryPaths(origin) {
    if (String(origin || '').replace(/\/+$/, '') === PROFILE.officialOrigin) {
      return {
        loginPagePath: '/njlgdx/framework/main.jsp',
        captchaPath: '/njlgdx/verifycode.servlet',
        loginPath: '/njlgdx/xk/Verifyservlet'
      };
    }
    return PROFILE;
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

  function createInitialState() {
    return {
      loggedIn: false,
      syncing: false,
      autoSyncEnabled: true,
      username: '',
      accountKey: '',
      wechatLoginSelected: false,
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
      connectionUncertain: false,
      pendingCaptchaReady: false
    };
  }

  let nativeState = loadState();
  let wechatBeginPromise = null;
  let wechatPollPromise = null;
  let wechatImagePromise = null;
  let syncAllPromise = null;
  let verifyPromise = null;
  let keepAlivePromise = null;
  let recoveryPromise = null;
  let statusPromise = null;
  let statusChecksSession = false;
  let casCaptchaPromise = null;
  let academicReviewPromise = null;

  function isAllowedQrService(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.hostname === 'bkjw.njust.edu.cn'
        && !url.port && !url.username && !url.password && !url.hash && !url.search
        && url.pathname === '/njlgdx/indexsso.jsp';
    } catch { return false; }
  }

  function isValidWechatAttempt(value) {
    try {
      const action = new URL(value.actionUrl);
      const page = new URL(value.pageUrl);
      const age = Date.now() - value.createdAt;
      return /^[A-Za-z0-9_-]{16,64}$/.test(value.uuid) && Number.isFinite(value.createdAt)
        && age >= 0 && age < WECHAT_TTL_MS + (value.submitted ? WECHAT_VERIFY_GRACE_MS : 0)
        && action.origin === PROFILE.casOrigin && !action.username && !action.password
        && action.pathname === '/authserver/login' && !action.hash
        && page.origin === PROFILE.casOrigin && !page.username && !page.password
        && page.pathname === '/authserver/login' && !page.hash
        && isAllowedQrService(action.searchParams.get('service'))
        && action.searchParams.get('service') === page.searchParams.get('service')
        && typeof value.fields?.execution === 'string' && value.fields.execution.length > 0;
    } catch { return false; }
  }

  function loadWechatAttempt() {
    try {
      const value = JSON.parse(global.localStorage.getItem(STORAGE_WECHAT_ATTEMPT_KEY) || 'null');
      if (value && isValidWechatAttempt(value)) return value;
    } catch {}
    global.localStorage.removeItem(STORAGE_WECHAT_ATTEMPT_KEY);
    return null;
  }

  function setWechatAttempt(value) {
    wechatAttempt = value;
    if (value && value.uuid) global.localStorage.setItem(STORAGE_WECHAT_ATTEMPT_KEY, JSON.stringify(value));
    else global.localStorage.removeItem(STORAGE_WECHAT_ATTEMPT_KEY);
  }

  let wechatAttempt = loadWechatAttempt();
  let pendingCasLogin = null;

  function hasPendingWechatAttempt() {
    if (wechatAttempt?.uuid && !isValidWechatAttempt(wechatAttempt)) {
      setWechatAttempt(null);
    }
    return Boolean(wechatAttempt);
  }
  let secureCredentialsPlugin = null;
  let schoolSessionPlugin = null;

  function getCapacitorExports() {
    return global.capacitorExports || null;
  }

  function isSupported() {
    const cap = getCapacitorExports();
    return Boolean(cap?.Capacitor?.isNativePlatform?.() && cap?.CapacitorHttp
      && (cap?.registerPlugin || global.Capacitor?.registerPlugin));
  }

  function requirePlugins() {
    if (!isSupported()) {
      throw new Error('当前环境不是安卓原生容器，无法使用手机端直连同步');
    }
    const cap = getCapacitorExports();
    const registerPlugin = cap?.registerPlugin || global.Capacitor?.registerPlugin;
    schoolSessionPlugin = schoolSessionPlugin || registerPlugin?.('SchoolSession');
    if (!schoolSessionPlugin) throw new Error('学校会话组件不可用，请更新 APK');
    return {
      Capacitor: cap.Capacitor,
      Http: cap.CapacitorHttp,
      Cookies: schoolSessionPlugin
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
      // These flags describe live requests, not persisted work after a restart.
      nextState.syncing = false;
      nextState.recovering = false;
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

  /** @maintenance
   * 从 Android Keystore 加密凭据中读取，并兼容旧版本迁移。普通状态快照不保存明文密码；记住密码开启后必须确认保存成功。
   */
  async function loadSecureCredentials({ force = false } = {}) {
    if (nativeState.profile === 'academic-cas-wechat' || nativeState.wechatLoginSelected || hasPendingWechatAttempt()) return false;
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
    nativeState.accountKey = '';
    nativeState.connectionUncertain = false;
    nativeState.sessionSaveWarning = '';
    nativeState.autoLoginEnabled = clearCredentials ? false : nativeState.autoLoginEnabled;
    if (clearCredentials) {
      nativeState.profile = PROFILE.key;
      nativeState.wechatLoginSelected = false;
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
      accountKey: nativeState.accountKey || nativeState.username,
      loginMethod: nativeState.profile === 'academic-cas-wechat' ? 'wechat' : 'password',
      rememberPassword: !nativeState.wechatLoginSelected && nativeState.rememberPassword,
      credentialsSaved: !nativeState.wechatLoginSelected && nativeState.credentialsSaved,
      recovering: nativeState.recovering,
      profile: nativeState.profile,
      profileLabel: PROFILE.label,
      businessBase: nativeState.businessBase,
      lastSyncAt: nativeState.lastSyncAt,
      lastError: nativeState.lastError,
      sessionCheckedAt: nativeState.sessionCheckedAt,
      connectionUncertain: nativeState.connectionUncertain,
      sessionSaveWarning: nativeState.sessionSaveWarning || '',
      transport: 'native',
      casCaptchaRequired: Boolean(pendingCasLogin),
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
    // Capacitor's Android bridge parses application/json even when callers
    // request arraybuffer, and returns HTTP error bodies as plain text.
    if (getHeader(response.headers, 'content-type').toLowerCase().includes('application/json')) {
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? null);
    }
    if (response.error || Number(response.status) >= 400) {
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data ?? '');
    }
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
      disableRedirects: Boolean(options.disableRedirects),
      connectTimeout: options.connectTimeout || 20000,
      readTimeout: options.readTimeout || 20000
    });
  }

  async function fetchText(url, options = {}) {
    const response = await requestRaw(url, { ...options, responseType: 'arraybuffer' });
    if (Number(response.status) >= 400) {
      throw new Error(`教务系统返回 HTTP ${response.status}，请稍后重试`);
    }
    return {
      response,
      html: responseText(response)
    };
  }

  function isAllowedCasRedirect(url) {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    return (parsed.protocol === 'https:' && !parsed.port && ['bkjw.njust.edu.cn', 'ids.njust.edu.cn'].includes(parsed.hostname))
      || (parsed.protocol === 'http:' && parsed.hostname === 'bkjw.njust.edu.cn' && !parsed.port)
      || (parsed.protocol === 'http:' && /^202\.119\.81\.(112|113)$/.test(parsed.hostname)
        && ['8080', '9080'].includes(parsed.port));
  }

  async function fetchCasText(url, options = {}) {
    let target = url;
    let method = options.method || 'GET';
    let data = options.data;
    let headers = { ...(options.headers || {}) };
    for (let step = 0; step < 10; step += 1) {
      if (!isAllowedCasRedirect(target)) throw new Error('统一认证跳转到了未知地址，已停止请求');
      const response = await requestRaw(target, {
        ...options, method, data, headers, responseType: 'arraybuffer', disableRedirects: true
      });
      const status = Number(response.status || 0);
      const html = responseText(response);
      const location = getHeader(response.headers, 'location');
      const scriptRedirect = !location && method === 'GET' && !/name=["'](?:passwordText|userPassword)["']/i.test(html)
        ? html.match(/(?:window|top|self)\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i)
        : null;
      const nextLocation = location || (scriptRedirect && scriptRedirect[1]);
      if (status >= 300 && status < 400 && !nextLocation) {
        throw new Error(`统一认证返回 HTTP ${status}，但没有提供跳转地址`);
      }
      if (!nextLocation || (status < 300 || status >= 400) && !scriptRedirect) {
        if (status >= 400 && !(new URL(target).origin === PROFILE.casOrigin && isUnauthenticatedPage(html))) {
          throw new Error(`统一认证页面返回 HTTP ${status}，请稍后重试`);
        }
        return { response, html, url: target };
      }
      const nextUrl = new URL(nextLocation, target).toString();
      if (!isAllowedCasRedirect(nextUrl)) throw new Error('统一认证跳转到了未知地址，已停止请求');
      if (method !== 'GET' && [301, 302, 303].includes(status)) {
        method = 'GET';
        data = undefined;
        headers = { Referer: target };
      } else if (method !== 'GET' && new URL(nextUrl).origin !== PROFILE.casOrigin) {
        throw new Error('统一认证要求向其他站点重复提交密码，已停止请求');
      } else {
        headers = { ...headers, Referer: target };
      }
      target = nextUrl;
    }
    throw new Error('统一认证跳转次数过多，请稍后重试');
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
    return /登录个人中心|用户登录|verifycode\.servlet|Verifyservlet|name=["']USERNAME["']|请先登录系统|用户没有登录，请重新登录|出错页面|id=["']pwdFromId["']|name=["']passwordText["']|id=["']pwdEncryptSalt["']/i.test(html);
  }

  function isAcademicAuthenticatedPage(html) {
    return !isUnauthenticatedPage(html)
      && /学生个人中心|理论课表|xs_main\.jsp|个人中心/i.test(String(html || ''));
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

  function getEntryOriginCandidates(username = nativeState.username) {
    const primary = resolveBusinessBase(username).includes('202.119.81.112:9080')
      ? PROFILE.officialOrigin : PROFILE.entryOrigin;
    return uniqueUrls([primary, ...PROFILE.entryOrigins, nativeState.entryOrigin]);
  }

  function isValidCaptchaCode(value) {
    return /^[A-Za-z0-9]{4,6}$/.test(String(value || '').trim());
  }

  async function prepareCaptchaSession(entryOrigin = '') {
    const candidates = entryOrigin ? [entryOrigin] : getEntryOriginCandidates();
    let lastError = null;
    for (const candidate of candidates) {
      try {
        await requestRaw(buildUrl(candidate, classicEntryPaths(candidate).loginPagePath), {
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

  let captchaFetchPromise = null;
  let loginInFlight = null;
  let manualCaptchaUntil = 0;
  let captchaUsername = '';

  async function fetchCaptcha(username, options = {}) {
    if (hasPendingWechatAttempt() || wechatBeginPromise || wechatPollPromise || casCaptchaPromise) {
      throw new Error('正在处理统一认证授权，请完成后再刷新验证码');
    }
    if (loginInFlight && !options.forLogin) throw new Error('正在登录，请等待完成后再刷新验证码');
    if (captchaFetchPromise) return captchaFetchPromise;
    if (!options.forLogin) manualCaptchaUntil = Date.now() + 180000;
    captchaFetchPromise = (async () => {
      if (!options.forLogin && autoLoginPromise) await autoLoginPromise.catch(() => {});
      return fetchCaptchaInternal(username, options.preferredOrigin || '');
    })();
    try { return await captchaFetchPromise; }
    catch (error) { manualCaptchaUntil = 0; captchaUsername = ''; throw error; }
    finally { captchaFetchPromise = null; }
  }

  async function fetchCaptchaInternal(username, preferredOrigin = '') {
    if (!username) {
      throw new Error('请先输入学号，再刷新验证码');
    }
    let lastError = null;
    for (const candidate of uniqueUrls([preferredOrigin, ...getEntryOriginCandidates(username)])) {
      try {
        // Keep the image and login POST on the same entry host. The school
        // gateway can issue session cookies while serving the login page.
        await prepareCaptchaSession(candidate);
        const response = await requestRaw(
          `${buildUrl(candidate, classicEntryPaths(candidate).captchaPath)}?t=${Date.now()}`,
          { responseType: 'arraybuffer', connectTimeout: 8000, readTimeout: 10000 }
        );
        const imageBase64 = normalizeBase64(response.data);
        const imageBytes = decodeBase64ToBytes(imageBase64);
        const jpeg = imageBytes[0] === 255 && imageBytes[1] === 216 && imageBytes[2] === 255;
        const png = imageBytes[0] === 137 && imageBytes[1] === 80 && imageBytes[2] === 78 && imageBytes[3] === 71;
        if (Number(response.status) >= 400 || imageBytes.length < 32 || (!jpeg && !png)) {
          throw new Error('教务入口没有返回验证码图片，请稍后重试');
        }
        nativeState.entryOrigin = candidate;
        nativeState.pendingCaptchaReady = true;
        captchaUsername = username;
        manualCaptchaUntil = Date.now() + 180000;
        saveState();
        return {
          ok: true,
          imageDataUrl: `data:${jpeg ? 'image/jpeg' : 'image/png'};base64,${imageBase64}`
        };
      } catch (error) {
        lastError = error;
        nativeState.pendingCaptchaReady = false;
      }
    }
    saveState();
    throw new Error(`验证码获取失败：教务登录入口均不可达（${lastError?.message || '网络异常'}）`);
  }

  async function snapshotCookies() {
    const { Cookies } = requirePlugins();
    const owner = getSessionOwner();
    if (!owner) return false;
    // Cookie values (including CAS HttpOnly/TGC) stay in native encrypted
    // storage, not a plaintext copy in WebView localStorage.
    try {
      const result = await Cookies.saveSession({ owner });
      clearCookieSnapshot();
      nativeState.sessionSaveWarning = result?.saved ? '' : '学校会话未能保存，重启可能需要重新登录';
      return Boolean(result?.saved);
    } catch {
      nativeState.sessionSaveWarning = '学校会话安全保存失败，重启可能需要重新登录';
      return false;
    }
  }

  function getSessionOwner() {
    if (hasPendingWechatAttempt()) return `pending:${wechatAttempt.uuid}`;
    return nativeState.accountKey || (nativeState.profile === 'academic-cas' ? nativeState.username : '');
  }

  function canRestoreSchoolSession() {
    return Boolean(nativeState.username && (
      (nativeState.profile === 'academic-cas-wechat' && nativeState.accountKey?.startsWith('wechat:'))
      || (nativeState.profile === 'academic-cas' && (!nativeState.accountKey || nativeState.accountKey === nativeState.username))
    ));
  }

  async function restoreCookiesFromSnapshot() {
    if (loginInFlight || captchaFetchPromise || casCaptchaPromise || Date.now() < manualCaptchaUntil) return false;
    const { Cookies } = requirePlugins();
    // The old snapshot came from document.cookie at localhost. Never import
    // it into the school jar or a different account; discard that legacy copy.
    clearCookieSnapshot();
    const owner = getSessionOwner();
    if (!owner || (!hasPendingWechatAttempt() && !canRestoreSchoolSession())) return false;
    try {
      const result = await Cookies.restoreSession({ owner });
      return Boolean(result?.restored);
    } catch {
      nativeState.sessionSaveWarning = '学校会话未能读取，将尝试重新登录';
      return false;
    }
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

  /** @maintenance
   * 恢复的单飞入口，多次唤醒只复用一个恢复任务。真正恢复顺序在 Internal 方法中：现存 Cookie、快照、CAS 会话与可用密码。
   */
  async function tryRecoverSession() {
    if (recoveryPromise) return recoveryPromise;
    recoveryPromise = tryRecoverSessionInternal();
    try { return await recoveryPromise; }
    finally { recoveryPromise = null; }
  }

  async function tryRecoverSessionInternal() {
    if (pendingCasLogin || hasPendingWechatAttempt() || loginInFlight || captchaFetchPromise || Date.now() < manualCaptchaUntil) return false;
    await loadSecureCredentials({ force: true });
    if (!nativeState.username) return false;
    if (!canRestoreSchoolSession()) return triggerAutoLoginBackground();
    nativeState.connectionUncertain = false;
    nativeState.businessBase = nativeState.businessBase || PROFILE.officialBusinessBase;

    if (await hasRuntimeCookies(nativeState.businessBase)) {
      const okFirstTry = await verifySession();
      if (okFirstTry) return true;
      if (nativeState.connectionUncertain) return nativeState.loggedIn;
    }

    const restored = await restoreCookiesFromSnapshot();
    if (restored && await hasRuntimeCookies(nativeState.businessBase)) {
      const okSecondTry = await verifySession();
      if (okSecondTry) return true;
      if (nativeState.connectionUncertain) return nativeState.loggedIn;
    }

    if (canRestoreSchoolSession()) {
      const restoredSso = await restoreCasSession();
      if (restoredSso === 'restored') return true;
      if (restoredSso === 'uncertain') return nativeState.loggedIn;
    }
    const recovered = await triggerAutoLoginBackground();
    if (!recovered && !nativeState.connectionUncertain) {
      nativeState.loggedIn = false;
      if (!nativeState.lastError) nativeState.lastError = nativeState.profile === 'academic-cas-wechat'
        ? '未找到可恢复的学校会话，请重新获取微信授权；离线数据已保留'
        : '未找到可恢复的学校会话，请通过智慧理工重新登录；离线数据已保留';
      saveState();
    }
    return recovered;
  }

  async function restoreCasSession() {
    const { Cookies } = requirePlugins();
    const cookies = await Cookies.getCookies({ url: `${PROFILE.casOrigin}/authserver/` });
    if (!Object.keys(cookies || {}).length) return 'unavailable';
    nativeState.recovering = true;
    saveState();
    try {
      // A valid school SSO cookie may issue a NEW service ticket without a
      // password form or a new WeChat confirmation. Never replay an old ticket.
      const entry = await fetchCasText(buildUrl(PROFILE.officialBusinessBase, 'indexsso.jsp'), {
        headers: { 'User-Agent': CAS_DESKTOP_USER_AGENT }, connectTimeout: 8000, readTimeout: 10000
      });
      if (new URL(entry.url).hostname === 'bkjw.njust.edu.cn' && !isUnauthenticatedPage(entry.html)) {
        nativeState.businessBase = PROFILE.officialBusinessBase;
        if (await verifySession()) return 'restored';
        return nativeState.connectionUncertain ? 'uncertain' : 'expired';
      }
      const doc = createDocument(entry.html);
      if (new URL(entry.url).origin === PROFILE.casOrigin
        && doc.querySelector('form input[name="passwordText"], form input[name="userPassword"], #qrLoginForm')) {
        nativeState.loggedIn = false;
        nativeState.connectionUncertain = false;
        nativeState.lastError = nativeState.profile === 'academic-cas-wechat'
          ? '学校微信授权会话已到期，请重新获取二维码或链接并在微信确认；离线数据已保留'
          : canRecoverWithPassword() ? '学校登录会话已到期，正在尝试已保存的账号密码'
          : '学校登录会话已到期，请重新登录；离线数据已保留';
        await Cookies.clearSession();
        saveState();
        return 'expired';
      }
      throw new Error('学校暂未返回可确认的登录页面，请稍后重试');
    } catch (error) {
      nativeState.connectionUncertain = true;
      nativeState.lastError = `会话恢复待确认：${error.message}`;
      saveState();
      return 'uncertain';
    } finally {
      nativeState.recovering = false;
      saveState();
    }
  }

  function canRecoverWithPassword() {
    return Boolean(
      nativeState.rememberPassword
      && nativeState.profile !== 'academic-cas-wechat'
      && !nativeState.wechatLoginSelected
      && nativeState.autoLoginEnabled
      && nativeState.username
      && nativeState.password
    );
  }

  /** @maintenance
   * 先验证实际学校会话，再决定是否在线。超时属于连接未确认，不应自动等同于密码错误或立即清空缓存。
   */
  async function verifySession() {
    if (verifyPromise) return verifyPromise;
    verifyPromise = verifySessionInternal();
    try { return await verifyPromise; }
    finally { verifyPromise = null; }
  }

  async function verifySessionInternal() {
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
      const authenticated = isAcademicAuthenticatedPage(html);
      if (!authenticated && !isUnauthenticatedPage(html)) {
        throw new Error('教务系统暂未返回完整首页');
      }
      nativeState.loggedIn = authenticated;
      nativeState.connectionUncertain = false;
      if (!authenticated) {
        nativeState.lastError = '会话已失效，请通过智慧理工重新登录';
      } else {
        nativeState.lastError = '';
        // A new login has not yet bound its identity. Persist only after that
        // succeeds, so process death cannot label a new account with an old key.
        if (!loginInFlight && !wechatPollPromise) await snapshotCookies();
      }
      // A confirmed network response is not yet a durably saved new login.
      // Publish success only after binding credentials and the cookie snapshot.
      if (!authenticated || (!loginInFlight && !wechatPollPromise)) saveState();
      return nativeState.loggedIn;
    } catch (error) {
      // A timeout is not evidence of an expired session. Keep offline data and
      // the last confirmed login, but return false until verification succeeds.
      nativeState.connectionUncertain = true;
      nativeState.sessionCheckedAt = new Date().toISOString();
      nativeState.lastError = `会话检查失败：${error.message}`;
      saveState();
      return false;
    }
  }

  /** @maintenance
   * 后台保活入口。交互登录、待确认微信授权或人工验证码尚在使用时应暂停，不要刷新用户当前验证码。
   */
  async function keepAlive() {
    if (keepAlivePromise) return keepAlivePromise;
    keepAlivePromise = keepAliveInternal();
    try { return await keepAlivePromise; }
    finally { keepAlivePromise = null; }
  }

  async function keepAliveInternal() {
    if (hasPendingWechatAttempt() || loginInFlight || captchaFetchPromise || Date.now() < manualCaptchaUntil) {
      const data = loadData();
      return { ok: true, status: buildStatus(data), data };
    }
    if (!nativeState.loggedIn || !nativeState.businessBase) {
      if (nativeState.username) {
        await tryRecoverSession();
      }
      return {
        ok: true,
        status: buildStatus(loadData()),
        data: loadData()
      };
    }

    try {
      const { html } = await fetchText(buildUrl(nativeState.businessBase, PROFILE.keepAlivePath), {
        connectTimeout: 8000, readTimeout: 10000
      });
      nativeState.sessionCheckedAt = new Date().toISOString();
      nativeState.connectionUncertain = false;
      if (isUnauthenticatedPage(html)) {
        nativeState.loggedIn = false;
        nativeState.lastError = '会话已失效，请通过智慧理工重新登录';
        await tryRecoverSession();
      } else {
        nativeState.lastError = '';
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
        const ok = !nativeState.connectionUncertain && await tryRecoverSession();
        if (ok && !nativeState.connectionUncertain) return fetchSectionPage(section, targetPath);
        if (nativeState.connectionUncertain) throw new Error(`${section} 抓取失败：网络待确认，离线数据已保留`);
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
        const ok = !nativeState.connectionUncertain && await tryRecoverSession();
        if (ok && !nativeState.connectionUncertain) return fetchSectionPost(section, url, form, referer);
        if (nativeState.connectionUncertain) throw new Error(`${section} 抓取失败：网络待确认，离线数据已保留`);
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

  /** @maintenance
   * 只查询主修学业审查页面，不同步全部成绩。返回原始表格行交给共享解析器；保存前验证账号，避免迟到响应覆盖另一用户。
   */
  async function getAcademicReview() {
    if (academicReviewPromise) return academicReviewPromise;
    academicReviewPromise = (async () => {
      await ensureSessionForApi();
      const owner = nativeState.accountKey || nativeState.username;
      const entry = await fetchSectionPage('主修学业审查', 'xsxj/zxsc.do');
      if (owner !== (nativeState.accountKey || nativeState.username)) throw Error('登录账号已变化，未保存审查数据');
      const doc = createDocument(entry.html);
      const rows = [...doc.querySelectorAll('tr')].slice(0, 256).map(row =>
        [...row.children].filter(cell => /^(TD|TH)$/.test(cell.tagName)).map(cell => {
          const clone = cell.cloneNode(true);
          clone.querySelectorAll('script,style').forEach(node => node.remove());
          clone.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
          return String(clone.textContent || '').trim().slice(0, 12000);
        })).filter(row => row.length > 1 && row.length <= 16);
      const fetchedAt = new Date().toISOString();
      if (!global.NJUSTCampusCore) throw Error('学业审查解析器未加载，请重启应用');
      global.NJUSTCampusCore.checkOwner(global.NJUSTCampusCore.parseReviewRows(rows, fetchedAt), owner);
      return { ok: true, rows, fetchedAt, owner, status: buildStatus(loadData()) };
    })();
    try { return await academicReviewPromise; }
    finally { academicReviewPromise = null; }
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

  /** @maintenance
   * 同步的单飞入口。不同页面触发同步时复用同一个任务，避免多次并发刷新学校会话。
   */
  async function syncAll() {
    if (syncAllPromise) return syncAllPromise;
    syncAllPromise = syncAllInternal();
    try { return await syncAllPromise; }
    finally { syncAllPromise = null; }
  }

  async function syncAllInternal() {
    if (hasPendingWechatAttempt() || loginInFlight || wechatBeginPromise) {
      throw new Error('正在登录或确认微信授权，请完成后再同步');
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
      nativeState.connectionUncertain = false;
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
  let ocrWorkerPromise = null;
  let ocrQueue = Promise.resolve();

  async function getOcrWorker() {
    if (globalOcrWorker) return globalOcrWorker;
    if (!ocrWorkerPromise) ocrWorkerPromise = (async () => {
      if (!window.Tesseract) throw new Error('前端 OCR 引擎未能按时加载，请检查网络');
      const worker = await window.Tesseract.createWorker('eng', 1, {
        workerPath: './vendor/tesseract/worker.min.js',
        corePath: './vendor/tesseract-core/tesseract-core-lstm.wasm.js',
        langPath: './vendor/tesseract-data',
        gzip: false,
        workerBlobURL: false
      }, window.NJUSTCaptchaOCR.INIT);
      await worker.setParameters(window.NJUSTCaptchaOCR.PARAMETERS);
      globalOcrWorker = worker;
      return worker;
    })().catch(error => { ocrWorkerPromise = null; throw error; });
    return ocrWorkerPromise;
  }

  async function solveCaptchaOCR(imageDataUrl) {
    const task = ocrQueue.then(async () => {
      try {
        const text = await window.NJUSTDdddOCR.recognizeBrowser(imageDataUrl);
        if (text) return text;
      } catch (error) { console.warn('ddddocr unavailable; using local fallback'); }
      const worker = await getOcrWorker();
      const ocr = window.NJUSTCaptchaOCR;
      return ocr.recognize(worker, await ocr.browserVariants(imageDataUrl), ocr.browserEncode);
    });
    ocrQueue = task.catch(() => {});
    return task;
  }

  let autoLoginPromise = null;
  async function triggerAutoLoginBackground() {
    if (autoLoginPromise) return autoLoginPromise;
    if (pendingCasLogin || hasPendingWechatAttempt() || loginInFlight || Date.now() < manualCaptchaUntil) return false;
    autoLoginPromise = triggerAutoLoginInternal();
    try { return await autoLoginPromise; }
    finally { autoLoginPromise = null; }
  }

  async function triggerAutoLoginInternal() {
    await loadSecureCredentials({ force: true });
    if (!canRecoverWithPassword()) return false;
    nativeState.recovering = true;
    nativeState.lastError = '';
    saveState();
    try {
      await smartLogin({ username: nativeState.username, password: nativeState.password, autoRetry: true },
        { recoveringSync: nativeState.syncing, recoveringSession: true });
      return true;
    } catch (error) {
      nativeState.lastError = error.message || '自动恢复登录失败';
      saveState();
      return false;
    } finally {
      nativeState.recovering = false;
      saveState();
    }
  }

  /** @maintenance
   * 只接受学校 CAS 域名和预期登录路径，提取隐藏字段与密码加密盐。页面未找到表单时要检查真实重定向，不要把错误页当作登录表。
   */
  function parseCasLoginForm(html, pageUrl) {
    const doc = createDocument(html);
    const form = [...doc.querySelectorAll('form')]
      .find(node => node.querySelector('input[name="passwordText"], input[name="userPassword"]'));
    if (!form) throw new Error('学校暂未返回账号登录页面，可能正在维护或网络异常，请稍后重试');
    const action = new URL(form.getAttribute('action') || '/authserver/login', PROFILE.casOrigin);
    const source = new URL(pageUrl, PROFILE.casOrigin);
    const inlineService = String(html).match(/\bvar\s+service\s*=\s*['"]([^'"]+)['"]/i);
    const service = source.searchParams.get('service')
      || (inlineService ? inlineService[1].replace(/\\\//g, '/') : '');
    if (!action.searchParams.get('service') && service) action.searchParams.set('service', service);
    if (action.origin !== PROFILE.casOrigin || !action.pathname.startsWith('/authserver/login')) {
      throw new Error('统一认证登录地址异常，已停止提交账号密码');
    }
    const targetService = action.searchParams.get('service');
    if (targetService && new URL(targetService).hostname !== 'bkjw.njust.edu.cn') {
      throw new Error('统一认证目标地址异常，已停止提交账号密码');
    }
    const fields = {};
    form.querySelectorAll('input[name]').forEach(input => {
      fields[input.name] = input.value || '';
    });
    const salt = doc.querySelector('#pwdEncryptSalt')?.value || '';
    if (salt.length !== 16 || !fields.execution) {
      throw new Error('统一认证表单已变化，请更新应用');
    }
    return { actionUrl: action.toString(), fields, salt, pageUrl: source.toString() };
  }

  function casLoginError(html) {
    const doc = createDocument(html);
    for (const selector of ['#showErrorTip', '#formErrorTip', '#showWarnTip', '#pwdErrorTip', '#nameErrorTip', '#captchaErrorTip', '.item-error-tip', '.error-tip', '.alert-danger']) {
      for (const node of doc.querySelectorAll(selector)) {
        const message = String(node.textContent || '').replace(/\s+/g, ' ').trim();
        if (message) return message.slice(0, 240);
      }
    }
    return '智慧理工未接受登录，请检查账号密码或页面要求';
  }

  async function encryptCasPassword(password, salt) {
    const cryptoApi = global.crypto;
    if (!cryptoApi?.subtle || !cryptoApi.getRandomValues) {
      throw new Error('当前设备不支持统一认证所需的加密能力');
    }
    const alphabet = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    const random = length => Array.from(cryptoApi.getRandomValues(new Uint8Array(length)), value => alphabet[value % alphabet.length]).join('');
    const iv = new TextEncoder().encode(random(16));
    const key = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'AES-CBC' }, false, ['encrypt']);
    const encoded = await cryptoApi.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(random(64) + password));
    const bytes = new Uint8Array(encoded);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return global.btoa(binary);
  }

  async function getCasCaptcha() {
    if (loginInFlight || hasPendingWechatAttempt() || wechatBeginPromise || wechatPollPromise) {
      throw new Error('正在处理登录，请稍候再刷新验证码');
    }
    if (casCaptchaPromise) return casCaptchaPromise;
    casCaptchaPromise = getCasCaptchaInternal();
    try { return await casCaptchaPromise; }
    finally { casCaptchaPromise = null; }
  }

  async function getCasCaptchaInternal() {
    if (!pendingCasLogin || Date.now() - pendingCasLogin.createdAt > 180000) {
      pendingCasLogin = null;
      throw new Error('验证码会话已过期，请重新点击登录');
    }
    const response = await requestRaw(`${PROFILE.casOrigin}/authserver/getCaptcha.htl?t=${Date.now()}`, {
      headers: { Referer: pendingCasLogin.form.pageUrl }, responseType: 'arraybuffer',
      connectTimeout: 8000, readTimeout: 10000
    });
    const mime = getHeader(response.headers, 'content-type').split(';')[0];
    if (Number(response.status) !== 200 || !mime.startsWith('image/')) throw new Error('学校验证码图片加载失败，请重试');
    return { ok: true, imageDataUrl: `data:${mime};base64,${normalizeBase64(response.data)}` };
  }

  /** @maintenance
   * 使用同一 Cookie 会话获取表单、判断验证码、加密密码并提交。手工验证码必须复用当次表单，重取表单会令验证码失效。
   */
  async function loginThroughCas(username, password, rememberPassword, casCaptcha = '', { allowSessionReuse = false } = {}) {
    nativeState.lastError = '登录中... 正在连接智慧理工';
    saveState();
    let form;
    if (casCaptcha) {
      if (!pendingCasLogin || pendingCasLogin.username !== username || Date.now() - pendingCasLogin.createdAt > 180000) {
        pendingCasLogin = null;
        throw new Error('验证码会话已过期或账号已改变，请重新点击登录');
      }
      form = pendingCasLogin.form;
      pendingCasLogin = null;
    } else {
      pendingCasLogin = null;
      if (!allowSessionReuse) {
        // A user-entered password must actually be authenticated. Never accept
        // an existing SSO page and relabel a previous account as the new one.
        const { Cookies } = requirePlugins();
        await Cookies.clearAllCookies();
        clearCookieSnapshot();
      }
      const entryUrl = buildUrl(PROFILE.officialBusinessBase, 'indexsso.jsp');
      const entry = await fetchCasText(entryUrl, {
        headers: { 'User-Agent': CAS_DESKTOP_USER_AGENT }, connectTimeout: 8000, readTimeout: 10000
      });
      if (new URL(entry.url).hostname === 'bkjw.njust.edu.cn' && !isUnauthenticatedPage(entry.html)) {
        if (!allowSessionReuse || nativeState.profile !== 'academic-cas'
          || (nativeState.accountKey || nativeState.username) !== username) {
          throw new Error('学校返回了已有会话，无法确认其账号，请退出当前登录后重试');
        }
        nativeState.businessBase = PROFILE.officialBusinessBase;
        if (!await verifySession()) throw new Error(nativeState.lastError || '教务系统会话待确认，请稍后重试');
        await completePasswordLogin(username, password, rememberPassword);
        return;
      }
      form = parseCasLoginForm(entry.html, entry.url);
    }

    if (!casCaptcha) {
      if (!global.crypto?.getRandomValues) throw new Error('当前设备不支持统一认证所需的随机数能力');
      const randomBytes = global.crypto.getRandomValues(new Uint8Array(16));
      const fingerprint = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
      await fetchText(`${PROFILE.casOrigin}/authserver/bfp/info?bfp=${fingerprint}`, {
        headers: { Referer: form.pageUrl }, connectTimeout: 8000, readTimeout: 8000
      });
      const check = await fetchText(`${PROFILE.casOrigin}/authserver/checkNeedCaptcha.htl?username=${encodeURIComponent(username)}`, {
        headers: { Accept: 'application/json, text/plain, */*', Referer: form.pageUrl },
        connectTimeout: 8000, readTimeout: 8000
      });
      let captchaStatus;
      try { captchaStatus = JSON.parse(check.html); } catch { throw new Error('统一认证验证码状态无法确认，请稍后重试'); }
      if (typeof captchaStatus.isNeed !== 'boolean') throw new Error('统一认证验证码状态无法确认，请稍后重试');
      if (captchaStatus.isNeed) {
        pendingCasLogin = { form, username, createdAt: Date.now() };
        throw new Error('学校要求验证码，请填写下方图片中的字符后再次登录');
      }
    }

    const fields = {
      ...form.fields,
      username,
      password: await encryptCasPassword(password, form.salt),
      captcha: casCaptcha,
      _eventId: form.fields._eventId || 'submit',
      cllt: form.fields.cllt || 'userNameLogin',
      dllt: form.fields.dllt || 'generalLogin'
    };
    // Both CAS page variants disable their plaintext input before submitting.
    delete fields.passwordText;
    delete fields.userPassword;
    delete fields.rememberMe;
    const payload = new URLSearchParams(fields);
    const response = await fetchCasText(form.actionUrl, {
      method: 'POST', data: payload.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: PROFILE.casOrigin, Referer: form.pageUrl
      }, connectTimeout: 10000, readTimeout: 12000
    });
    if (isUnauthenticatedPage(response.html) || new URL(response.url).origin === PROFILE.casOrigin) {
      const message = casLoginError(response.html);
      if (/验证码/.test(message) || /needCaptcha\s*=\s*["']?true/i.test(response.html)) {
        try { pendingCasLogin = { form: parseCasLoginForm(response.html, response.url), username, createdAt: Date.now() }; } catch {}
      }
      throw new Error(message);
    }

    nativeState.businessBase = PROFILE.officialBusinessBase;
    if (!await verifySession()) throw new Error('智慧理工已响应，但教务系统会话未建立');
    await completePasswordLogin(username, password, rememberPassword);
  }

  async function completePasswordLogin(username, password, rememberPassword) {
    nativeState.loggedIn = true;
    nativeState.username = username;
    nativeState.password = rememberPassword ? password : '';
    nativeState.rememberPassword = Boolean(rememberPassword);
    nativeState.autoLoginEnabled = Boolean(rememberPassword);
    nativeState.profile = 'academic-cas';
    nativeState.accountKey = username;
    nativeState.connectionUncertain = false;
    nativeState.entryOrigin = PROFILE.officialOrigin;
    nativeState.lastError = '';
    nativeState.pendingCaptchaReady = false;
    if (nativeState.rememberPassword) await saveSecureCredentials(username, password);
    else await clearSecureCredentials();
    await snapshotCookies();
    saveState();
  }

  function parseCasQrForm(html, pageUrl) {
    const doc = createDocument(html);
    const form = doc.querySelector('#qrLoginForm');
    if (!form || new URL(pageUrl).origin !== PROFILE.casOrigin) {
      throw new Error('学校未返回微信授权入口；若已登录，请先退出当前会话');
    }
    const action = new URL(form.getAttribute('action') || '/authserver/login', pageUrl);
    action.searchParams.set('display', 'qrLogin');
    const service = new URL(pageUrl).searchParams.get('service');
    if (service && !action.searchParams.has('service')) action.searchParams.set('service', service);
    const targetService = action.searchParams.get('service');
    if (action.origin !== PROFILE.casOrigin || action.username || action.password || action.hash
      || action.pathname !== '/authserver/login' || !isAllowedQrService(service)
      || targetService !== service) {
      throw new Error('学校微信授权目标地址异常，已停止登录');
    }
    const fields = {};
    form.querySelectorAll('input[name]').forEach(input => { fields[input.name] = input.value || ''; });
    if (!fields.execution) throw new Error('学校微信登录表单已变化，请更新应用');
    return { actionUrl: action.toString(), pageUrl, fields };
  }

  function describeWechatAttempt(attempt = wechatAttempt) {
    if (!attempt?.uuid) return null;
    return {
      ok: true, uuid: attempt.uuid,
      expiresAt: attempt.createdAt + WECHAT_TTL_MS,
      verifyUntil: attempt.createdAt + WECHAT_TTL_MS + WECHAT_VERIFY_GRACE_MS,
      submitted: Boolean(attempt.submitted), imageDataUrl: attempt.imageDataUrl || '',
      url: `${PROFILE.casOrigin}/authserver/qrCode/qrCodeLogin.do?uuid=${encodeURIComponent(attempt.uuid)}`
    };
  }

  async function getWechatQrImage() {
    if (wechatImagePromise) return wechatImagePromise;
    wechatImagePromise = getWechatQrImageInternal();
    try { return await wechatImagePromise; }
    finally { wechatImagePromise = null; }
  }

  async function getWechatQrImageInternal() {
    if (!hasPendingWechatAttempt() || !wechatAttempt?.uuid) throw new Error('微信授权已过期，请重新获取');
    const attempt = wechatAttempt;
    if (attempt.imageDataUrl) return describeWechatAttempt(attempt);
    if (attempt.submitted || Date.now() >= attempt.createdAt + WECHAT_TTL_MS) {
      throw new Error('微信已确认，请等待会话检查，不要再次扫码');
    }
    const response = await requestRaw(`${PROFILE.casOrigin}/authserver/qrCode/getCode?uuid=${encodeURIComponent(attempt.uuid)}`, {
      responseType: 'arraybuffer', headers: { Referer: attempt.pageUrl, 'User-Agent': CAS_DESKTOP_USER_AGENT },
      connectTimeout: 8000, readTimeout: 10000
    });
    const base64 = normalizeBase64(response.data);
    if (base64.length > 160000) throw new Error('学校返回的二维码图片过大');
    const bytes = decodeBase64ToBytes(base64);
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (Number(response.status) >= 400 || bytes.length < 32 || (!png && !jpeg)) {
      throw new Error('二维码图片加载失败，可以先使用链接登录');
    }
    if (wechatAttempt?.uuid !== attempt.uuid) throw new Error('微信授权已取消');
    attempt.imageDataUrl = `data:${png ? 'image/png' : 'image/jpeg'};base64,${base64}`;
    setWechatAttempt(attempt);
    await snapshotCookies();
    return describeWechatAttempt(attempt);
  }

  /** @maintenance
   * 准备一次短时授权尝试；二维码与链接是同一次授权的两种显示方式。不要切换显示方式就再创建一套 Cookie。
   */
  async function beginWechatLogin(options = {}) {
    if (wechatBeginPromise) return wechatBeginPromise;
    wechatBeginPromise = beginWechatLoginInternal(options);
    try { return await wechatBeginPromise; }
    finally { wechatBeginPromise = null; }
  }

  async function beginWechatLoginInternal({ includeImage = false } = {}) {
    if (nativeState.loggedIn) throw new Error('当前已登录，请先退出当前账号再使用微信授权');
    if (loginInFlight) throw new Error('账号密码登录正在进行，请稍后再试');
    if (syncAllPromise || wechatPollPromise || wechatImagePromise || captchaFetchPromise || casCaptchaPromise
      || verifyPromise || keepAlivePromise || recoveryPromise || statusPromise) {
      throw new Error('正在处理会话或同步，请稍候再获取微信授权');
    }
    if (hasPendingWechatAttempt() && wechatAttempt?.uuid) {
      return includeImage ? getWechatQrImage() : describeWechatAttempt();
    }
    pendingCasLogin = null;
    manualCaptchaUntil = 0;
    nativeState.wechatLoginSelected = true;
    saveState();
    setWechatAttempt({ starting: true });
    try {
      const { Cookies } = requirePlugins();
      await Cookies.clearAllCookies();
      clearCookieSnapshot();
      const entryUrl = buildUrl(PROFILE.officialBusinessBase, 'indexsso.jsp');
      const entry = await fetchCasText(entryUrl, {
        headers: { 'User-Agent': CAS_DESKTOP_USER_AGENT },
        connectTimeout: 8000, readTimeout: 10000
      });
      const form = parseCasQrForm(entry.html, entry.url);
      const token = await fetchText(`${PROFILE.casOrigin}/authserver/qrCode/getToken?ts=${Date.now()}`, {
        headers: { Referer: form.pageUrl, 'User-Agent': CAS_DESKTOP_USER_AGENT }, connectTimeout: 8000, readTimeout: 10000
      });
      const uuid = token.html.trim().replace(/^['"]|['"]$/g, '');
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(uuid)) throw new Error('学校未返回有效微信授权码');
      setWechatAttempt({ ...form, uuid, createdAt: Date.now() });
      // Keep the same CAS cookie jar if Android reclaims the WebView in WeChat.
      await snapshotCookies();
      if (includeImage) {
        try { return await getWechatQrImage(); }
        catch (error) { return { ...describeWechatAttempt(), warning: error.message }; }
      }
      return describeWechatAttempt();
    } catch (error) {
      setWechatAttempt(null);
      throw error;
    }
  }

  function cancelWechatLogin() {
    if (wechatBeginPromise) throw new Error('正在获取授权，请稍候再取消');
    setWechatAttempt(null);
  }

  /** @maintenance
   * 检查当前授权尝试，确认后进入业务站点建立教务会话；只承认当前 uuid/代次，过期或取消后的响应必须丢弃。
   */
  async function pollWechatLogin() {
    if (wechatPollPromise) return wechatPollPromise;
    wechatPollPromise = pollWechatLoginInternal();
    try { return await wechatPollPromise; }
    finally { wechatPollPromise = null; }
  }

  async function pollWechatLoginInternal() {
    const attempt = wechatAttempt || loadWechatAttempt();
    if (!attempt || !isValidWechatAttempt(attempt)) {
      setWechatAttempt(null);
      throw new Error('微信授权链接已过期，请重新获取');
    }
    if (!await hasRuntimeCookies(`${PROFILE.casOrigin}/authserver/`)) await restoreCookiesFromSnapshot();
    if (wechatAttempt?.uuid !== attempt.uuid) throw new Error('微信授权已取消');
    if (!attempt.submitted) {
      const status = await fetchText(
        `${PROFILE.casOrigin}/authserver/qrCode/getStatus.htl?ts=${Date.now()}&uuid=${encodeURIComponent(attempt.uuid)}`,
        { headers: { Referer: attempt.pageUrl, 'User-Agent': CAS_DESKTOP_USER_AGENT }, connectTimeout: 8000, readTimeout: 10000 }
      );
      const value = status.html.trim().replace(/^['"]|['"]$/g, '');
      if (wechatAttempt?.uuid !== attempt.uuid) throw new Error('微信授权已取消');
      if (value === '0' || value === '2') return { ok: true, state: value === '2' ? 'confirming' : 'pending' };
      if (value === '3') {
        setWechatAttempt(null);
        throw new Error('学校微信授权已过期，请重新获取');
      }
      if (value !== '1') throw new Error('学校返回了未知的微信授权状态');
      if (Date.now() >= attempt.createdAt + WECHAT_TTL_MS) {
        setWechatAttempt(null);
        throw new Error('微信授权已过期，请重新获取');
      }
      // Persist consumption before submitting. On a timeout, only verify the
      // existing session; never replay a one-time school authorization token.
      attempt.submitted = true;
      setWechatAttempt(attempt);
      const fields = { ...attempt.fields, uuid: attempt.uuid, cllt: 'qrLogin',
        dllt: 'generalLogin', _eventId: 'submit' };
      try {
        const response = await fetchCasText(attempt.actionUrl, {
          method: 'POST', data: new URLSearchParams(fields).toString(),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded',
            Origin: PROFILE.casOrigin, Referer: attempt.pageUrl, 'User-Agent': CAS_DESKTOP_USER_AGENT },
          connectTimeout: 10000, readTimeout: 15000
        });
        if (isUnauthenticatedPage(response.html)) {
          setWechatAttempt(null);
          throw new Error(`微信授权未被学校接受：${casLoginError(response.html)}，请重新获取二维码`);
        }
      } catch (error) {
        if (!wechatAttempt) throw error;
        if (/HTTP 4\d\d|未知地址|重复提交/.test(String(error.message || ''))) {
          setWechatAttempt(null);
          throw error;
        }
        // A request can time out after the server consumes the token. Keep the
        // attempt in verification phase so returning to the app can finish it.
      }
      if (wechatAttempt?.uuid === attempt.uuid) await snapshotCookies();
    }
    if (wechatAttempt?.uuid !== attempt.uuid) throw new Error('微信授权已取消');
    nativeState.businessBase = PROFILE.officialBusinessBase;
    const sessionReady = await verifySession();
    if (wechatAttempt?.uuid !== attempt.uuid) {
      nativeState.loggedIn = false;
      saveState();
      throw new Error('微信授权已取消');
    }
    if (!sessionReady) return { ok: true, state: 'establishing' };
    nativeState.loggedIn = true;
    nativeState.username = '微信授权用户';
    // Separate generic WeChat display names without guessing a student ID.
    nativeState.accountKey = `wechat:${attempt.uuid}`;
    nativeState.password = '';
    nativeState.rememberPassword = false;
    nativeState.autoLoginEnabled = false;
    nativeState.credentialsSaved = false;
    nativeState.profile = 'academic-cas-wechat';
    nativeState.connectionUncertain = false;
    nativeState.entryOrigin = PROFILE.officialOrigin;
    nativeState.lastError = '';
    clearRemoteData();
    setWechatAttempt(null);
    await clearSecureCredentials();
    await snapshotCookies();
    saveState();
    let data = loadData();
    let warning = '';
    try { data = await syncAll(); } catch (error) { warning = error.message; }
    return { ok: true, state: 'authorized', status: buildStatus(data), data, warning };
  }

  async function smartLogin(options = {}, { recoveringSync = false, recoveringSession = false } = {}) {
    if (loginInFlight) throw new Error('登录正在进行，请勿重复提交');
    if (wechatBeginPromise || wechatPollPromise || wechatImagePromise || casCaptchaPromise
      || (nativeState.syncing && !recoveringSync) || verifyPromise
      || ((recoveryPromise || statusPromise || keepAlivePromise) && !recoveringSession)) {
      throw new Error('正在处理会话或同步，请稍候再切换登录方式');
    }
    nativeState.wechatLoginSelected = false;
    if (wechatAttempt) setWechatAttempt(null);
    loginInFlight = smartLoginInternal(options);
    try { return await loginInFlight; }
    finally { loginInFlight = null; manualCaptchaUntil = 0; }
  }

  async function smartLoginInternal(options = {}) {
    if (captchaFetchPromise) await captchaFetchPromise;
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
    const knownOwner = nativeState.accountKey || nativeState.username;
    const switchingUser = Boolean(knownOwner && (knownOwner !== normalizedUsername || nativeState.profile === 'academic-cas-wechat'));
    if (switchingUser) {
      const keepRemember = nativeState.rememberPassword;
      const pending = nativeState.pendingCaptchaReady && captchaUsername === normalizedUsername;
      const origin = nativeState.entryOrigin;
      resetRuntimeSession({ clearCredentials: true, clearData: true });
      nativeState.pendingCaptchaReady = pending;
      nativeState.entryOrigin = origin;
      nativeState.rememberPassword = keepRemember;
      saveState();
    }

    if (!captcha) {
      try {
        const allowSessionReuse = nativeState.recovering && nativeState.profile === 'academic-cas'
          && (nativeState.accountKey || nativeState.username) === username;
        await loginThroughCas(username, password, rememberPassword, String(options.casCaptcha || '').trim(), { allowSessionReuse });
        return;
      } catch (error) {
        nativeState.loggedIn = false;
        nativeState.lastError = error.message || '智慧理工登录失败';
        saveState();
        throw error;
      }
    }

    let attempt = 0;
    const maxAttempts = autoRetry ? 3 : 1;
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
        
        await window.NJUSTDdddOCR.browserEngine().catch(() => getOcrWorker());
        const candidateOrigins = getEntryOriginCandidates(username);
        const payload = await fetchCaptcha(username, {
          forLogin: true,
          preferredOrigin: candidateOrigins[(attempt - 1) % candidateOrigins.length]
        });
        const ocrText = await solveCaptchaOCR(payload.imageDataUrl);
        if (!isValidCaptchaCode(ocrText)) {
          nativeState.pendingCaptchaReady = false;
          nativeState.lastError = '验证码自动识别失败，请点击验证码图片刷新后手动输入';
          saveState();
          lastErrorMessage = nativeState.lastError;
          continue;
        }
        finalCaptcha = ocrText;
        
        nativeState.pendingCaptchaReady = true;
        saveState();
      }

      if (captcha && (captchaUsername !== username || Date.now() >= manualCaptchaUntil)) {
        throw new Error('验证码已过期或账号已改变，请刷新图片后重新输入');
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
        const paths = classicEntryPaths(loginOrigin);
        const response = await requestRaw(buildUrl(loginOrigin, paths.loginPath), {
          method: 'POST',
          data: form.toString(),
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: loginOrigin,
            Referer: buildUrl(loginOrigin, paths.loginPagePath)
          }
        });

        nativeState.pendingCaptchaReady = false;
        saveState();

        const loginHtml = responseText(response);
        const responseUrl = String(response.url || getHeader(response.headers, 'location') || '');
        const reachedMainPage = /(?:202\.119\.81\.(112|113):9080|bkjw\.njust\.edu\.cn)\/njlgdx\/framework\/main\.jsp/i.test(responseUrl)
          && !isUnauthenticatedPage(loginHtml);
        const directErrorMessage = reachedMainPage ? '' : extractLoginErrorMessage(loginHtml);
        if (directErrorMessage) {
          lastErrorMessage = directErrorMessage;
          if (directErrorMessage.includes('验证码') && autoRetry) {
             continue;
          }
          throw new Error(directErrorMessage);
        }

        nativeState.businessBase = /202\.119\.81\.(112|113):9080\/njlgdx\//.test(responseUrl)
          ? responseUrl.replace(/(http:\/\/202\.119\.81\.(112|113):9080\/njlgdx\/).*/, '$1')
          : loginOrigin === PROFILE.officialOrigin
            ? PROFILE.officialBusinessBase
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
        nativeState.accountKey = username;
        nativeState.connectionUncertain = false;
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
        if (!autoRetry || /密码|用户名|账号错误/.test(lastErrorMessage)) throw err;
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
    if (loginInFlight || wechatBeginPromise || wechatPollPromise || wechatImagePromise || captchaFetchPromise || casCaptchaPromise
      || syncAllPromise || verifyPromise || keepAlivePromise || recoveryPromise || statusPromise) {
      throw new Error('正在处理会话或同步，请完成后再退出');
    }
    pendingCasLogin = null;
    setWechatAttempt(null);
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
    if (nativeState.profile === 'academic-cas-wechat') {
      if (rememberPassword) throw new Error('微信授权不保存密码，请退出后使用账号密码登录');
      return { ok: true, status: buildStatus(), data: loadData() };
    }
    if (hasPendingWechatAttempt() || wechatPollPromise || loginInFlight) {
      throw new Error('正在登录，请完成或取消后再修改密码保存设置');
    }
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
    if (statusPromise) {
      const alreadyChecks = statusChecksSession;
      const result = await statusPromise;
      if (options.check && !alreadyChecks && nativeState.loggedIn && !hasPendingWechatAttempt() && !loginInFlight) {
        await verifySession();
        return { ok: true, status: buildStatus(), data: loadData() };
      }
      return result;
    }
    statusChecksSession = Boolean(options.check);
    statusPromise = getStatusInternal(options);
    try { return await statusPromise; }
    finally { statusPromise = null; }
  }

  async function getStatusInternal(options = {}) {
    if (pendingCasLogin || hasPendingWechatAttempt() || loginInFlight || captchaFetchPromise || Date.now() < manualCaptchaUntil) {
      const data = loadData();
      return { ok: true, status: buildStatus(data), data };
    }
    await loadSecureCredentials({ force: true });
    let recovered = false;
    if (nativeState.username) {
      nativeState.businessBase = nativeState.businessBase || PROFILE.officialBusinessBase;
      if (!nativeState.loggedIn || !canRestoreSchoolSession() || !await hasRuntimeCookies(nativeState.businessBase)) {
        recovered = await tryRecoverSession();
      }
    }
    if (options.check && nativeState.loggedIn && !recovered) {
      const verified = await verifySession();
      if (!verified && !nativeState.connectionUncertain) await tryRecoverSession();
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
    const data = await syncAll();
    return {
      ok: true,
      status: buildStatus(data),
      data
    };
  }

  global.NJUSTNativeSync = {
    isSupported,
    getPendingWechatLogin: () => {
      return hasPendingWechatAttempt() ? describeWechatAttempt() : null;
    },
    getStatus,
    fetchCaptcha,
    getClassroomOptions,
    getAcademicReview,
    queryClassrooms,
    keepAlive,
    keepAliveIntervalMs: KEEP_ALIVE_INTERVAL_MS,
    loginAndSync,
    beginWechatLogin,
    getWechatQrImage,
    pollWechatLogin,
    cancelWechatLogin,
    getCasCaptcha,
    syncNow,
    logout,
    saveSemesterStart,
    saveLoginPreference
  };
})(window);
