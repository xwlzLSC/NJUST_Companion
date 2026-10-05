/** @maintenance
 * 三端共享的主修学业审查解析器；只接受文本表格行，不读取密码、不联网、不计算毕业资格。
 * F 工程 js、微信 utils、njustSync2/lib 的这份文件必须保持一致；测试会核对共享副本。
 * 学校缺少字段时保留原文或报错，绝不把缺少数据当作 0 学分或已满足毕业要求。
 */
/* Shared, original parser for the school's 主修学业审查 table, not a grade estimate. */
(function(root, factory) {
  const value = factory(typeof module === 'object' && module.exports ? require('./campus-config') : root.NJUSTCampusConfig);
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.NJUSTCampusCore = value;
})(typeof window === 'object' ? window : globalThis, function(config) {
  'use strict';
  const text = value => String(value == null ? '' : value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 12000);
  const label = value => text(value).replace(/\s/g, '').replace(/[:：]$/, '');
  /** @maintenance
   * 严格验证年月日，不依赖手机对字符串日期的自动解析。用 UTC 校验避免时区影响，返回 YYYY-MM-DD 或空字符串。
   */
  function dateKey(value) {
    const match = String(value || '').trim().match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?$/);
    if (!match) return '';
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (year < 2000 || year > 2100 || utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return '';
    return match[1] + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  /** @maintenance
   * 已确认的用户自定义日期优先；其余情况使用配置默认值。旧的自动校历字段不参与选择，防止历史记录覆盖用户设置。
   */
  function resolveStart(preference = {}, fallbackStart = config.fallbackStart) {
    const custom = dateKey(preference.value);
    if (preference.userSet && custom) return { value: custom, userSet: true, source: 'custom', label: '用户自定义日期', term: null };
    return { value: dateKey(fallbackStart) || config.fallbackStart, userSet: false, source: 'fallback', label: '软件默认日期（校历图片不会修改设置）', term: null };
  }
  function numeric(value) {
    const raw = text(value).replace(/学分|分/g, '').trim();
    return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw) ? Number(raw) : null;
  }
  /** @maintenance
   * 先定位必修、限选等分组，再在括号深度为零时拆课程。课程名可能含罗马数字和括号，不能直接按所有逗号分割。
   */
  function missingDetails(raw) {
    const source = String(raw || '').replace(/\r/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')').slice(0, 12000);
    const markers = [...source.matchAll(/(必修|限选|选修|任选|实践|其他)\s*[:：]\s*(\d+(?:\.\d+)?)/g)];
    if (!markers.length) return [{ id: 'missing-0', title: '学校原文', credits: null, text: text(source), courses: [] }];
    return markers.map((match, index) => {
      const detail = source.slice(match.index + match[0].length, markers[index + 1]?.index ?? source.length).replace(/^[\s,，、;；]+/, '').trim();
      const courses = [];
      let start = 0, depth = 0;
      const pieces = [];
      for (let i = 0; i < detail.length; i++) {
        if (detail[i] === '(') depth++;
        if (detail[i] === ')') depth = Math.max(0, depth - 1);
        if (!depth && /[,，、;；\n]/.test(detail[i])) { pieces.push(detail.slice(start, i)); start = i + 1; }
      }
      pieces.push(detail.slice(start));
      for (const piece of pieces.filter(p => text(p))) {
        const course = piece.trim().match(/^(.*)\(([^()]*)[,，]\s*(\d+(?:\.\d+)?|\.\d+)\s*学分\)\s*$/);
        courses.push({ id: 'course-' + courses.length, name: text(course ? course[1] : piece), category: text(course ? course[2] : ''), credit: course ? Number(course[3]) : null });
      }
      return { id: 'missing-' + index, title: match[1], credits: Number(match[2]), text: text(detail), courses: courses.slice(0, 300) };
    });
  }
  /** @maintenance
   * 输入 rows 为二维单元格文本数组，返回学生信息、学校原始指标、未获得课程分组与读取时间。同名指标逐行保留，不另行合计；校验失败由调用方保留旧缓存。
   */
  function parseReviewRows(rows, fetchedAt = '') {
    if (!Array.isArray(rows) || rows.length > 256) throw Error('学业审查数据格式无效');
    const student = { number: '', name: '', className: '', major: '' }, metrics = [], other = [];
    let missingText = '', hasMissing = false, discipline = '', conclusion = '';
    const fields = { 学号: 'number', 姓名: 'name', 班级: 'className', 专业: 'major', 专业名称: 'major' };
    for (const row of rows) {
      if (!Array.isArray(row) || row.length > 16) continue;
      const cells = row.map(v => String(v == null ? '' : v).slice(0, 12000));
      for (let i = 0; i + 1 < cells.length; i++) { const key = fields[label(cells[i])]; if (key) student[key] = text(cells[i + 1]); }
      if (cells.length !== 2) continue;
      const title = label(cells[0]), value = text(cells[1]);
      if (/^(已获|已修|已取得).*(学分|绩点)$/.test(title) || /^目前已修.*平均.*绩点$/.test(title)) {
        metrics.push({ id: 'metric-' + metrics.length, label: title, value, number: numeric(value), unit: /绩点$/.test(title) ? '' : '学分' });
      } else if (/^(未获得|未获|未修).*(课程明细|课程详情)$/.test(title)) {
        hasMissing = true; missingText = cells[1];
      } else if (/^是否有.*处分$/.test(title)) discipline = value;
      else if (/^(审查结论|审查结果|审核结论|是否满足毕业要求|是否符合毕业条件)$/.test(title)) conclusion = value;
      else if (/^(学业|毕业|审核|审查)/.test(title) && value) other.push({ id: 'other-' + other.length, label: title, value });
    }
    const total = metrics.find(m => /^(已获|已修|已取得)(课程)?总学分$/.test(m.label));
    const gpa = metrics.find(m => /平均.*绩点$/.test(m.label));
    if (!total || total.number === null || metrics.length < 2 || (!hasMissing && !gpa)) throw Error('未读取到主修学业审查表，可能是登录失效、页面无权限或页面结构变化；旧数据已保留');
    return { student, metrics, totalCredit: total.value, averageGpa: gpa?.value ?? '未提供',
      missing: hasMissing && text(missingText) ? missingDetails(missingText) : [], missingText: text(missingText), hasMissing,
      discipline: discipline || '未提供', conclusion: conclusion || '学校未提供审查结论', other: other.slice(0, 30),
      fetchedAt: /^\d{4}-\d\d-\d\dT/.test(String(fetchedAt)) && Number.isFinite(Date.parse(fetchedAt)) ? String(fetchedAt) : '' };
  }
  /** @maintenance
   * 当会话账号是学号时，核对学校表格返回的学号。微信授权的非学号账户键不能直接拿来作学号比较。
   */
  function checkOwner(review, expectedOwner) {
    if (/^\d{6,20}$/.test(String(expectedOwner)) && review.student.number && review.student.number !== String(expectedOwner)) throw Error('学业审查返回了其他账号的数据，未保存，请重新登录');
    return review;
  }
  return { config, text, dateKey, resolveStart, parseReviewRows, missingDetails, checkOwner };
});
