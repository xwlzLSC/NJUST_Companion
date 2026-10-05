const crypto = require('crypto');
const REVISION = '2026-09-30-mini-wechat-1';
const ORIGIN = 'https://ids.njust.edu.cn';
const SERVICE = 'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp';
const TTL_MS = 180000;
const LEASE_MS = 45000;
const token = () => crypto.randomBytes(16).toString('hex');
const text = value => String(value == null ? '' : value).trim().replace(/^['"]|['"]$/g, '');

function parseQrForm(html, pageUrl, createDocument) {
  const page = new URL(pageUrl);
  const $ = createDocument(html), form = $('#qrLoginForm');
  if (page.origin !== ORIGIN || !form.length) throw new Error('学校未返回微信授权入口，请稍后重试');
  const action = new URL(form.attr('action') || '/authserver/login', page);
  const service = page.searchParams.get('service');
  const target = service ? new URL(service) : null;
  if (!action.searchParams.has('service') && service) action.searchParams.set('service', service);
  if (action.origin !== ORIGIN || action.pathname !== '/authserver/login'
    // The school's HTTPS entry currently issues an HTTP academic service. Keep
    // its exact value (CAS ticket binding), restricted to the known host/path.
    || !target || !['http:', 'https:'].includes(target.protocol) || target.hostname !== 'bkjw.njust.edu.cn'
    || target.port || target.username || target.password || target.pathname !== '/njlgdx/indexsso.jsp'
    || action.searchParams.get('service') !== service) throw new Error('学校微信授权目标地址异常，已停止登录');
  action.searchParams.set('display', 'qrLogin');
  const fields = {};
  form.find('input[name]').each((_i, node) => { fields[$(node).attr('name')] = String($(node).val() || ''); });
  if (!fields.execution) throw new Error('学校微信登录表单已变化，请更新应用');
  return { pageUrl, actionUrl: action.toString(), fields };
}

// A private document per OPENID plus transactional leases serializes calls across
// cloud containers. A cancelled/replaced challenge can never commit a session.
function createRepository(db, collectionName = 'njust_sessions', now = () => Date.now()) {
  const missing = error => /not\s+(?:found|exist)|does not exist|DOCUMENT_NOT_EXIST|不存在/i.test(String(error.message || error.errMsg || ''));
  async function read(doc) {
    try { const result = await doc.get(); return result.data || null; }
    catch (error) { if (missing(error)) return null; throw error; }
  }
  function ids(openid) {
    if (typeof openid !== 'string' || !openid || openid.length > 128) throw new Error('无法确认当前微信用户，请重新打开小程序');
    return { user: openid, attempt: 'wechat-' + openid };
  }
  function refs(transaction, openid) {
    const names = ids(openid), collection = transaction.collection(collectionName);
    return { user: collection.doc(names.user), attempt: collection.doc(names.attempt) };
  }
  async function begin(openid) {
    return db.runTransaction(async tx => {
      const docs = refs(tx, openid), user = await read(docs.user), old = await read(docs.attempt);
      if (user && user.active) throw new Error('当前已登录，请先退出当前账号再使用微信授权');
      if (old && old.expiresAt > now() && !['cancelled', 'failed', 'expired', 'authorized'].includes(old.state)) {
        if (old.state !== 'preparing') return { ...old, reused: true };
        if (old.leaseUntil > now()) throw new Error('微信授权入口正在准备，请稍后检查');
      }
      const attempt = { openid, attemptId: token(), state: 'preparing', submitted: false,
        createdAt: now(), expiresAt: now() + TTL_MS, leaseOwner: token(), leaseUntil: now() + LEASE_MS };
      await docs.attempt.set({ data: attempt });
      return attempt;
    });
  }
  async function get(openid, attemptId) {
    const record = await read(db.collection(collectionName).doc(ids(openid).attempt));
    return record && record.attemptId === attemptId ? record : null;
  }
  async function claim(openid, attemptId) {
    return db.runTransaction(async tx => {
      const docs = refs(tx, openid), attempt = await read(docs.attempt);
      if (!attempt || attempt.attemptId !== attemptId) return { state: 'expired' };
      if (attempt.state === 'authorized') {
        const user = await read(docs.user);
        return user && user.active && user.active.wechatAttemptId === attemptId
          ? { ...attempt, active: user.active } : { state: 'cancelled' };
      }
      if (['cancelled', 'failed', 'expired'].includes(attempt.state)) return attempt;
      if (attempt.expiresAt <= now()) return { state: 'expired' };
      if (attempt.leaseUntil > now()) return { state: attempt.submitted ? 'establishing' : 'pending', busy: true };
      const claimed = { ...attempt, leaseOwner: token(), leaseUntil: now() + LEASE_MS };
      const { _id, ...data } = claimed;
      await docs.attempt.set({ data });
      return claimed;
    });
  }
  async function save(openid, attempt, patch) {
    const result = await db.collection(collectionName).where({ _id: ids(openid).attempt,
      attemptId: attempt.attemptId, leaseOwner: attempt.leaseOwner }).update({ data: patch });
    if (!result.stats || result.stats.updated !== 1) throw new Error('微信授权已取消或已刷新，请使用新的授权入口');
  }
  async function cancel(openid, attemptId) {
    await db.runTransaction(async tx => {
      const docs = refs(tx, openid), old = await read(docs.attempt);
      if (!old || (attemptId && old.attemptId !== attemptId) || old.state === 'authorized') return;
      await docs.attempt.set({ data: { openid, attemptId: old.attemptId, state: 'cancelled', expiresAt: now(), leaseOwner: '', leaseUntil: 0 } });
    });
  }
  async function complete(openid, attempt, active) {
    return db.runTransaction(async tx => {
      const docs = refs(tx, openid), old = await read(docs.attempt), user = await read(docs.user);
      if (!old || old.attemptId !== attempt.attemptId || old.leaseOwner !== attempt.leaseOwner
        || old.expiresAt <= now()) throw new Error('微信授权已取消或已过期，请重新获取');
      const { _id, ...previous } = user || {};
      const record = { ...previous, openid, pending: null, active, gradeSnapshot: [], lastSyncAt: '' };
      await docs.user.set({ data: record });
      // Scrub QR tokens, CAS fields and cookies once the session is established.
      await docs.attempt.set({ data: { openid, attemptId: old.attemptId, state: 'authorized', expiresAt: now() + TTL_MS } });
      return { ...record, _id: openid };
    });
  }
  return { begin, get, claim, save, cancel, complete };
}

function createService(deps) {
  const { repository, createDocument, createSession, fetchText, fetchImage,
    requestTextNoRedirect, followResponseRedirects, serializeSession, verify, isUnauthenticatedPage } = deps;
  const now = deps.now || (() => Date.now());
  function publicAttempt(attempt) {
    return { ok: true, wechatRevision: REVISION, state: 'pending', attemptId: attempt.attemptId,
      expiresAt: attempt.expiresAt, url: `${ORIGIN}/authserver/qrCode/qrCodeLogin.do?uuid=${encodeURIComponent(attempt.uuid)}`,
      imageDataUrl: attempt.imageDataUrl };
  }
  async function begin(openid) {
    const attempt = await repository.begin(openid);
    if (attempt.reused) return publicAttempt(attempt);
    const session = createSession(null, '', '', 'https://bkjw.njust.edu.cn');
    session.authDeadline = now() + 40000;
    try {
      const entry = await fetchText(session, SERVICE, { timeout: 10000 });
      const pageUrl = deps.responseUrl(entry.response, SERVICE);
      const form = parseQrForm(entry.html, pageUrl, createDocument);
      const result = await fetchText(session, `${ORIGIN}/authserver/qrCode/getToken?ts=${now()}`, { timeout: 8000, headers: { Referer: pageUrl } });
      const uuid = text(result.html);
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(uuid)) throw new Error('学校未返回有效微信授权码');
      const expiresAt = now() + TTL_MS;
      // Use the school's QR bytes for the same UUID; no third-party QR service.
      const image = await fetchImage(session, `${ORIGIN}/authserver/qrCode/getCode?uuid=${encodeURIComponent(uuid)}`, { timeout: 8000, headers: { Referer: pageUrl } });
      const mime = String(image.headers['content-type'] || '').split(';')[0].toLowerCase();
      const bytes = Buffer.from(image.data);
      if (image.status !== 200 || !['image/png', 'image/jpeg', 'image/gif'].includes(mime) || !bytes.length || bytes.length > 120000) {
        throw new Error('学校二维码图片加载失败，请重新获取');
      }
      const ready = { ...form, uuid, jar: await serializeSession(session), state: 'pending',
        imageDataUrl: `data:${mime};base64,${bytes.toString('base64')}`, expiresAt,
        leaseOwner: '', leaseUntil: 0 };
      await repository.save(openid, attempt, ready);
      return publicAttempt({ ...attempt, ...ready });
    } catch (error) {
      await repository.cancel(openid, attempt.attemptId);
      throw error;
    }
  }
  function stateResult(state, message = '') { return { ok: true, wechatRevision: REVISION, state, message }; }
  async function check(openid, attemptId) {
    if (!/^[a-f0-9]{32}$/.test(String(attemptId || ''))) throw new Error('微信授权参数无效，请重新获取');
    const attempt = await repository.claim(openid, attemptId);
    if (attempt.state === 'authorized') return { ...stateResult('authorized'), status: deps.status({ active: attempt.active }) };
    if (attempt.busy) return stateResult(attempt.state);
    if (['expired', 'cancelled', 'failed'].includes(attempt.state)) return stateResult(attempt.state, attempt.message || '微信授权已失效，请重新获取');
    const session = createSession(attempt.jar, '', '', 'https://bkjw.njust.edu.cn');
    session.authDeadline = now() + 40000;
    try {
      if (!attempt.submitted) {
        const response = await fetchText(session, `${ORIGIN}/authserver/qrCode/getStatus.htl?uuid=${encodeURIComponent(attempt.uuid)}&ts=${now()}`, { timeout: 6000, headers: { Referer: attempt.pageUrl } });
        const state = text(response.html);
        if (state === '0' || state === '2') {
          await repository.save(openid, attempt, { jar: await serializeSession(session), state: state === '2' ? 'confirming' : 'pending', leaseOwner: '', leaseUntil: 0 });
          return stateResult(state === '2' ? 'confirming' : 'pending');
        }
        if (state === '3') {
          await repository.save(openid, attempt, { state: 'expired', jar: null, fields: {}, uuid: '', imageDataUrl: '', leaseOwner: '', leaseUntil: 0 });
          return stateResult('expired', '学校微信授权已过期，请重新获取');
        }
        if (state !== '1') throw new Error('学校返回了未知的微信授权状态，请稍后检查');
        // Persist before the POST: never replay a one-use token after a timeout,
        // a container restart, or duplicate client calls.
        await repository.save(openid, attempt, { submitted: true, state: 'establishing', jar: await serializeSession(session) });
        attempt.submitted = true;
        const fields = { ...attempt.fields, uuid: attempt.uuid, cllt: 'qrLogin', dllt: 'generalLogin', _eventId: 'submit' };
        let rejected = false;
        try {
          let reply = await requestTextNoRedirect(session, attempt.actionUrl, { method: 'POST', timeout: 10000,
            data: new URLSearchParams(fields).toString(), headers: {
              'Content-Type': 'application/x-www-form-urlencoded', Origin: ORIGIN, Referer: attempt.pageUrl
            } });
          if (reply.response.status >= 300 && reply.response.status < 400) reply = await followResponseRedirects(session, reply.response, attempt.actionUrl);
          if (reply.response.status === 401 || isUnauthenticatedPage(reply.html) || /id=["']qrLoginForm/.test(reply.html)) {
            rejected = true;
          }
        } catch (error) {
          if (!deps.isTimeout(error)) throw error;
          // Verification below can finish when the server consumed the token.
        } finally {
          await repository.save(openid, attempt, { jar: await serializeSession(session) });
        }
        if (rejected) {
          const message = '学校未接受本次微信授权，请重新获取并确认';
          await repository.save(openid, attempt, { state: 'failed', message, jar: null, fields: {}, uuid: '', imageDataUrl: '', leaseOwner: '', leaseUntil: 0 });
          return stateResult('failed', message);
        }
      }
      const verified = await verify(session);
      if (!verified) {
        await repository.save(openid, attempt, { state: 'establishing', jar: await serializeSession(session), leaseOwner: '', leaseUntil: 0 });
        return stateResult('establishing', '学校已确认授权，正在建立教务会话');
      }
      const active = { username: verified.username || '微信授权用户', businessBase: verified.businessBase,
        updatedAt: new Date(now()).toISOString(), jar: await serializeSession(session), authType: 'cas',
        loginMethod: 'wechat', accountKey: verified.username || 'wechat:' + attempt.attemptId,
        semesterStart: '', entryOrigin: 'https://bkjw.njust.edu.cn', wechatAttemptId: attempt.attemptId };
      const record = await repository.complete(openid, attempt, active);
      if (deps.onComplete) deps.onComplete(openid, record);
      return { ...stateResult('authorized'), status: deps.status(record) };
    } catch (error) {
      // Preserve cookies and consumption state but relinquish the lease. A
      // transport failure is retryable by verification, not by another POST.
      await repository.save(openid, attempt, { jar: await serializeSession(session), leaseOwner: '', leaseUntil: 0 }).catch(() => {});
      if (deps.isTimeout(error)) return stateResult(attempt.submitted ? 'establishing' : 'pending', '学校连接较慢，请稍后检查授权结果');
      throw error;
    }
  }
  async function cancel(openid, attemptId) { await repository.cancel(openid, attemptId); return stateResult('cancelled'); }
  return { begin, check, cancel };
}
module.exports = { createService, createRepository, parseQrForm, REVISION, TTL_MS };
