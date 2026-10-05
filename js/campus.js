/** @maintenance
 * 校历与主修学业审查的网页/APK 界面控制器，依赖 app.js 的状态、导航与存储接口。
 * 按账号保存原始审查表缓存；请求失败保留旧数据，切换账号后丢弃迟到响应。校历仅用于看图，不改变学期设置。
 */
/* Only two campus services: school academic review and the calendar image. */
(function() {
  'use strict';
  const core = window.NJUSTCampusCore, config = core.config;
  let kind = 'review', ownerId = '', cached = null, review = null, preference = {}, ready = false;
  let readRequest = null, requestSequence = 0, attemptedOwner = '', busy = false, error = '';
  const esc = value => escapeHtml(value);
  const owner = () => core.text(state.server.accountKey || state.server.username || state.loginPrefs.username || 'local');
  const button = (label, action, id = '', extra = '') => '<button type="button" class="btn btn-soft" data-campus-action="' + action + '" data-id="' + esc(id) + '" ' + extra + '>' + esc(label) + '</button>';
  /** @maintenance
   * 读取当前账号的审查缓存，并共享同一账号正在进行的读取。异步结束时再次核对 owner，避免用户切换账号后加载旧缓存。
   */
  function loadOwner() {
    const requested = owner();
    if (ownerId === requested) return Promise.resolve(false);
    if (readRequest && readRequest.owner === requested) return readRequest.promise;
    const promise = (async () => {
      const cache = await dbGet('campusReviewV1');
      if (owner() !== requested) return false;
      ++requestSequence; busy = false; error = ''; attemptedOwner = '';
      cached = cache?.accounts?.find(a => a.owner === requested) || null;
      try { review = cached ? core.checkOwner(core.parseReviewRows(cached.rows, cached.fetchedAt), requested) : null; }
      catch (_) { cached = null; review = null; }
      ownerId = requested;
      return true;
    })().finally(() => { if (readRequest?.promise === promise) readRequest = null; });
    readRequest = { owner: requested, promise };
    return promise;
  }
  async function load(data) {
    const stored = await dbGet('semesterStartPreference');
    const legacy = core.dateKey(data?.meta?.semesterStart);
    preference = stored && typeof stored === 'object' ? stored : { value: legacy, userSet: Boolean(legacy) };
    await dbSet('semesterStartPreference', preference);
    ready = true; await loadOwner();
  }
  function startFor(meta = {}) { return ready ? core.resolveStart(preference).value : meta.semesterStart || ''; }
  /** @maintenance
   * 唯一的用户开学日期写入入口之一：写入明确的自定义偏好，并刷新周次、提醒和桌面组件；校历预览不应调用它。
   */
  async function setDate(value) {
    const valid = core.dateKey(value);
    if (value && !valid) throw Error('无效的开学日期');
    preference = { value: valid, userSet: Boolean(valid) };
    await dbSet('semesterStartPreference', preference);
    state.data.meta.semesterStart = startFor();
    await dbSet('main', state.data);
    state.selectedWeek = clampSelectedWeek(getCurrentWeek(startFor()) || 1);
    renderCurrentPage(); renderHome();
    await scheduleNotifications({ silent: true }); await updateNativeWidgetData({ silent: true });
  }
  async function resetDate() {
    if (preference.userSet && !confirm('取消自定义日期，恢复默认 ' + config.fallbackStart + '？')) return;
    try { await setDate(''); showToast('已恢复默认日期'); }
    catch (e) { showToast(e.message || '日期更新失败'); }
  }
  function renderSettings() {
    const element = document.getElementById('semester-start-source');
    if (element) element.textContent = core.resolveStart(preference).label;
  }
  async function syncOwner() { if (await loadOwner()) renderCurrentPage(); }
  /** @maintenance
   * 带超时与请求代次检查的审查查询。先验证 payload，再保存；任何网络或解析异常都不以空表覆盖上次成功结果。
   */
  async function refreshReview() {
    await loadOwner();
    if (busy) return;
    const requested = owner(), seq = ++requestSequence;
    attemptedOwner = requested; busy = true; error = ''; void render();
    let timer;
    const controller = new AbortController();
    try {
      const payload = await Promise.race([
        apiRequest('/api/academic-review', { method: 'GET', signal: controller.signal }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('学业审查查询超时，请稍后重试；旧数据已保留')); }, 25000); })
      ]);
      if (seq !== requestSequence || owner() !== requested || ownerId !== requested) return;
      if (payload.owner && payload.owner !== requested) throw Error('登录账号已变化，请重新打开学业审查');
      const next = core.checkOwner(core.parseReviewRows(payload.rows, payload.fetchedAt), requested);
      const cache = await dbGet('campusReviewV1') || {};
      if (seq !== requestSequence || owner() !== requested) return;
      const entry = { owner: requested, rows: payload.rows, fetchedAt: next.fetchedAt };
      await dbSet('campusReviewV1', { accounts: [...(Array.isArray(cache.accounts) ? cache.accounts.filter(a => a.owner !== requested) : []), entry] });
      if (seq !== requestSequence || owner() !== requested) return;
      review = next; cached = entry;
    } catch (e) {
      if (seq === requestSequence && owner() === requested) error = /<(?:!doctype|html|head)/i.test(e.message || '') ? '网页后端尚未更新，请重启本地服务后重试' : e.message || '学业审查查询失败';
    } finally {
      clearTimeout(timer);
      if (seq === requestSequence) { busy = false; void render(); }
    }
  }
  const stat = (value, label) => '<div class="campus-stat"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  function reviewHtml() {
    let html = '<div class="card"><div class="campus-row"><strong>主修学业审查</strong>'
      + button(busy ? '正在读取…' : '刷新审查数据', 'refresh-review', '', busy ? 'disabled aria-busy="true"' : '') + '</div>'
      + '<p class="campus-note">直接读取教务系统“主修学业审查”，不是用成绩自行估算。需先在设置页登录智慧理工。</p>'
      + (review ? '<p class="campus-note">上次读取：' + esc(review.fetchedAt ? new Date(review.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '时间未记录') + '（本机缓存；点击刷新获取学校最新结果）</p>' : '')
      + (error ? '<p class="campus-error" role="alert">' + esc(error) + '</p>' : '') + '</div>';
    if (!review) return html + '<div class="card campus-note">' + (busy ? '正在读取学校审查表…' : '尚未读取审查数据。登录后点击“刷新审查数据”。') + '</div>';
    html += '<div class="card"><strong>' + esc(review.student.name || '学校审查数据') + '</strong><p class="campus-note">'
      + esc([review.student.number, review.student.major, review.student.className].filter(Boolean).join(' · ')) + '</p><div class="campus-stats">'
      + stat(review.totalCredit, '已获课程总学分') + stat(review.averageGpa, '学位课程平均绩点') + '</div><p class="campus-note">'
      + esc(review.conclusion) + '；处分信息：' + esc(review.discipline) + '。毕业资格以学校审核为准。</p></div>';
    html += '<div class="card"><strong>学校分类学分与指标</strong><div class="campus-metrics">'
      + review.metrics.map(m => '<div class="campus-metric"><span>' + esc(m.label) + '</span><strong>' + esc(m.value) + '</strong></div>').join('')
      + '</div><p class="campus-note">同名指标按学校原表逐行保留，不合并、不另行求和。</p></div>';
    html += '<div class="section-title">未获得课程明细</div>';
    if (!review.missing.length) html += '<div class="card campus-note">' + (review.hasMissing ? '学校该栏为空；不据此认定已满足毕业要求。' : '学校未提供课程明细。') + '</div>';
    for (const group of review.missing) {
      html += '<div class="card"><div class="campus-row"><strong>' + esc(group.title) + '</strong><span>'
        + (group.credits === null ? '' : '学校标注 ' + esc(group.credits) + ' 学分') + '</span></div>'
        + (group.courses.length ? group.courses.map(c => '<div class="campus-metric"><div><strong>' + esc(c.name) + '</strong><small class="campus-note">' + esc(c.category) + '</small></div><span>' + (c.credit === null ? '' : esc(c.credit) + ' 学分') + '</span></div>').join('') : '<p class="campus-note">' + esc(group.text || '学校未列出具体课程名单。') + '</p>') + '</div>';
    }
    return html + (review.other.length ? '<div class="card">' + review.other.map(i => '<p>' + esc(i.label) + '：' + esc(i.value) + '</p>').join('') + '</div>' : '');
  }
  function calendarHtml() {
    return '<div class="card"><strong>' + esc(config.calendar.academicYear) + ' 官方校历</strong>'
      + '<button class="campus-calendar-preview" data-campus-action="preview-calendar" aria-label="放大官方校历"><img src="' + esc(config.calendar.imageUrl) + '" alt="官方校历图片" loading="lazy" referrerpolicy="no-referrer" onerror="NJUSTCampus.calendarImageFailed(this)"></button>'
      + '<p class="campus-error" id="calendar-image-message" hidden>图片加载失败，请检查网络后点击重试。</p>' + button('重新加载图片', 'reload-calendar') + '</div>';
  }
  async function render() {
    const host = document.getElementById('campus-content');
    if (!host || state.currentPage !== 'campus') return;
    if (ownerId !== owner()) host.innerHTML = '<div class="card campus-note">正在读取当前账号…</div>';
    try { await loadOwner(); } catch (_) { host.innerHTML = '<div class="card campus-error">本地缓存读取失败，请重试。</div>'; return; }
    if (state.currentPage !== 'campus' || ownerId !== owner()) return;
    host.innerHTML = '<div class="campus-navigation">' + button('← 返回', 'back', '', 'aria-label="返回上一页"')
      + '<div class="campus-tabs" role="tablist">' + config.services.map(s => button(s.title, 'tab', s.id, 'role="tab" aria-selected="' + (kind === s.id) + '"')).join('') + '</div></div>' + (kind === 'calendar' ? calendarHtml() : reviewHtml());
    if (kind === 'review' && state.server.loggedIn && !attemptedOwner && !busy) void refreshReview();
  }
  /** @maintenance
   * 决定展示哪个模块。已在校园助手时只重绘，保持最初的返回目标；从主页面进入时才调用 navigate。
   */
  function open(id = 'review') {
    kind = id === 'calendar' ? 'calendar' : 'review';
    if (state.currentPage === 'campus') void render();
    else navigate('campus');
  }
  function calendarImageFailed(image) { image.hidden = true; const message = document.getElementById('calendar-image-message'); if (message) message.hidden = false; }
  /** @maintenance
   * 使用只读原图对话框预览，关闭后移除 DOM。不要从图片推断开学日或自动生成调课规则。
   */
  function previewCalendar() {
    const dialog = document.createElement('dialog'); dialog.className = 'campus-calendar-dialog';
    dialog.innerHTML = '<button type="button" class="btn btn-soft campus-calendar-close">关闭</button><div class="campus-calendar-scroll"><img src="' + esc(config.calendar.imageUrl) + '" alt="官方校历原图" referrerpolicy="no-referrer"></div>';
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    document.body.appendChild(dialog); dialog.showModal();
  }
  document.addEventListener('click', event => {
    const node = event.target.closest('[data-campus-action]'); if (!node) return;
    const action = node.dataset.campusAction;
    if (action === 'back') handleHeaderLeftAction();
    if (action === 'tab') open(node.dataset.id);
    if (action === 'refresh-review') void refreshReview();
    if (action === 'preview-calendar') previewCalendar();
    if (action === 'reload-calendar') void render();
  });
  async function refreshRecords() { if (kind === 'review') await refreshReview(); else await render(); }
  window.NJUSTCampus = { load, startFor, setDate, resetDate, syncOwner, open, render, renderSettings, refreshRecords, calendarImageFailed };
})();
