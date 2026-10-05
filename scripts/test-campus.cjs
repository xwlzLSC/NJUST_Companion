const projectPaths = require('./fixtures/project-paths.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { harness, defer } = require('./fixtures/native-harness.cjs');
const core = require('../js/campus-core');
const root = path.join(__dirname, '..');
const miniRoot = projectPaths.mini("miniprogram");
const cloudRoot = projectPaths.mini("cloudfunctions/njustSync2");
const html = fs.readFileSync(path.join(__dirname, 'fixtures/academic-review.html'), 'utf8');
function extract(raw = html) {
  const doc = new JSDOM(raw).window.document;
  return [...doc.querySelectorAll('tr')].map(row => [...row.children].map(cell => {
    const clone = cell.cloneNode(true); clone.querySelectorAll('br').forEach(br => br.replaceWith('\n')); return clone.textContent;
  }));
}
const rows = extract(), fetchedAt = '2026-10-03T00:00:00.000Z';
const payload = (owner = '209900000001') => ({ ok: true, owner, rows, fetchedAt });
test('all transports share identical original review parser and calendar configuration', () => {
  for (const name of ['campus-core.js', 'campus-config.js']) {
    const expected = fs.readFileSync(path.join(root, 'js', name), 'utf8');
    assert.equal(fs.readFileSync(path.join(miniRoot, 'utils', name), 'utf8'), expected);
    assert.equal(fs.readFileSync(path.join(cloudRoot, 'lib', name), 'utf8'), expected);
  }
});
test('only calendar and actual major review remain; no manual data editors or copied-link launch', () => {
  assert.deepEqual(core.config.services.map(s => s.id), ['review', 'calendar']);
  for (const file of [path.join(root, 'js/campus.js'), path.join(root, 'index.html'), path.join(miniRoot, 'pages/campus/index.wxml'), path.join(miniRoot, 'pages/dashboard/index.wxml')]) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /毕业学分进度|我的借阅|第二课堂|校园生活查询|添加本地停课|copyOfficial|data-campus-form|复制官方网址/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/features.js'), 'utf8'), /NJUSTCampus.*getRecords/);
  assert.doesNotMatch(fs.readFileSync(path.join(miniRoot, 'utils/derive.js'), 'utf8'), /campusStore|campusCore/);
});
test('calendar never updates the semester date, custom values remain higher priority', () => {
  assert.equal(core.resolveStart({}).value, '2026-08-24');
  assert.equal(core.resolveStart({ userSet: false, lastAutoValue: '2027-02-22' }).value, '2026-08-24');
  assert.equal(core.resolveStart({ userSet: true, value: '2026-09-21' }).value, '2026-09-21');
  assert.equal(core.resolveStart({}, '2027-08-23').value, '2027-08-23');
  assert.equal(core.dateKey('2027-02-29'), ''); assert.equal(core.dateKey('2028年2月29日'), '2028-02-29');
});
test('school totals, GPA, identity and duplicate labels are preserved instead of recomputed', () => {
  const review = core.parseReviewRows(rows, fetchedAt);
  assert.equal(review.totalCredit, '148.1'); assert.equal(review.averageGpa, '3.24');
  assert.equal(review.student.major, '通信工程');
  assert.equal(review.metrics.filter(m => m.label === '已获专业基础课学分').length, 3);
  assert.equal(new Set(review.metrics.map(m => m.id)).size, review.metrics.length);
  assert.equal(review.discipline, '否'); assert.equal(review.conclusion, '学校未提供审查结论');
});
test('missing courses preserve decimal shorthand and Roman numeral course names', () => {
  const review = core.parseReviewRows(rows, fetchedAt);
  assert.equal(review.missing[0].credits, 19.9);
  assert.equal(review.missing[0].courses[1].credit, .5);
  assert.equal(review.missing[0].courses[2].name, '形势与政策(Ⅶ)');
  assert.equal(review.missing[0].courses[2].credit, .2);
  assert.equal(review.missing[1].credits, 22); assert.equal(review.missing[1].courses.length, 0);
});
test('unknown or changed missing-course formats preserve original text, not invented credits', () => {
  const result = core.missingDetails('按学院通知处理，课程替代尚待审核');
  assert.equal(result[0].credits, null); assert.equal(result[0].courses.length, 0);
  assert.match(result[0].text, /课程替代/);
  assert.equal(core.parseReviewRows(rows.filter(r => r[0] !== '未获得课程明细')).hasMissing, false);
});
test('error/login/empty tables and non-numeric total credit are rejected', () => {
  for (const input of [[], [['用户名', '请登录']], rows.map(r => r[0] === '已获课程总学分' ? [r[0], '--'] : r)]) {
    assert.throws(() => core.parseReviewRows(input), /未读取到/);
  }
  assert.throws(() => core.parseReviewRows(Array.from({length:257},()=>[])), /格式/);
  assert.throws(() => core.checkOwner(core.parseReviewRows(rows), '209900000002'), /其他账号/);
});
test('mini custom semester preferences survive remote sync and old adjustment records are inactive', () => {
  const memory = new Map(); global.wx = { getStorageSync: k => memory.get(k), setStorageSync: (k,v) => memory.set(k,v) };
  const store = require(path.join(miniRoot, 'utils/store')), derive = require(path.join(miniRoot, 'utils/derive'));
  store.updateSemesterStart('2026-09-21'); store.mergeRemoteData({ meta: { semesterStart: '2027-09-13' }, schedule: [] });
  assert.equal(store.loadAppData().meta.semesterStart, '2026-09-21');
  store.updateSemesterStart(''); assert.equal(store.loadAppData().meta.semesterStart, '2026-08-24');
  memory.set('njust-campus-records-v1', { accounts:[{ owner:'local', adjustments:[{date:'2026-09-29',type:'off'}] }] });
  const data = { schedule:[{name:'测试课',weekday:2,startWeek:3,endWeek:3,weeks:[3],periods:[4,5]}], meta:{semesterStart:'2026-09-14'},grades:[] };
  assert.equal(derive.getCoursesForDay(data,2,3).length,1);
});
test('mini review caches are account-separated; late responses and failed parsing never overwrite them', () => {
  const memory = new Map(); global.wx = { getStorageSync:k=>memory.get(k), setStorageSync:(k,v)=>memory.set(k,v) };
  const store = require(path.join(miniRoot, 'utils/store')), records = require(path.join(miniRoot, 'utils/campus-store'));
  store.saveCloudSession({username:'209900000001'}); records.saveRows(payload(), records.owner());
  assert.equal(records.load().totalCredit, '148.1');
  assert.throws(()=>records.saveRows({...payload(),rows:[]},records.owner()),/未读取到/);
  assert.equal(records.load().totalCredit,'148.1');
  store.saveCloudSession({username:'209900000002'}); assert.equal(records.load(),null);
  assert.throws(()=>records.saveRows(payload(),'209900000001'),/变化/);
  store.saveCloudSession({username:'209900000001'}); assert.equal(records.load().totalCredit,'148.1');
});
test('native request uses authenticated academic session and the exact review path, not an external browser', async () => {
  const h = harness({state:{loggedIn:true,username:'209900000001',accountKey:'209900000001',businessBase:'https://bkjw.njust.edu.cn/njlgdx/'},control:{ready:true}});
  h.context.NJUSTCampusCore = core;
  h.control.onRequest = async request => request.url.endsWith('/xsxj/zxsc.do') ? h.textResponse(html) : undefined;
  const result = await h.api.getAcademicReview();
  assert.equal(core.parseReviewRows(result.rows).totalCredit,'148.1');
  assert.equal(result.owner,'209900000001');
  assert.ok(h.requests.some(r=>r.url==='https://bkjw.njust.edu.cn/njlgdx/xsxj/zxsc.do'));
  assert.equal(h.control.postCount,0);
});
test('cloud action reads school HTML with Cheerio and persists the existing session, not school records', async () => {
  const source = fs.readFileSync(path.join(cloudRoot,'index.js'),'utf8'), start = source.indexOf('async function actionGetAcademicReview()');
  const end = source.indexOf('\nasync function',start+10), cheerio = require(path.join(cloudRoot,'node_modules/cheerio'));
  let requested = '', persisted = 0;
  const context = vm.createContext({Date, require:()=>core,
    getActiveSessionOrThrow:async()=>({record:{},session:{username:'209900000001'}}),
    buildStatus:()=>({accountKey:'209900000001'}),
    fetchSectionPage:async(_session,_title,target)=>{requested=target;return {html};},
    createDocument:raw=>cheerio.load(raw),
    persistActiveSession:async record=>{persisted++;return record;}
  });
  vm.runInContext(source.slice(start,end),context);
  const result = await context.actionGetAcademicReview();
  assert.equal(core.parseReviewRows(result.rows).totalCredit,'148.1');
  assert.equal(requested,'xsxj/zxsc.do'); assert.equal(persisted,1);
  assert.match(source,/action === 'getAcademicReview'/);
});
function uiHarness(request = async()=>payload(), cached = true) {
  const dom = new JSDOM('<div id="page-home" class="page"></div><div id="page-settings" class="page"></div><div id="page-campus" class="page"><div id="campus-content"></div></div><div id="semester-start-source"></div>');
  const memory = new Map(cached ? [['campusReviewV1',{accounts:[{...payload(),owner:'209900000001'}]}]]:[]);
  const state = {currentPage:'campus',server:{accountKey:'209900000001',loggedIn:false},loginPrefs:{},data:{meta:{semesterStart:'2026-08-24'}}};
  const context = vm.createContext({document:dom.window.document,state,Date,AbortController,console,setTimeout,clearTimeout,
    escapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    dbGet:async key=>memory.get(key),dbSet:async(key,value)=>memory.set(key,value),apiRequest:request,
    MAIN_PAGES:['home','schedule','grades','exams','settings'],SUB_PAGES:['campus'],PAGE_TITLES:{campus:'校园助手'},
    renderCurrentPage:()=>{},refreshCurrentPage:()=>{},renderHome:()=>{},clampSelectedWeek:v=>v,getCurrentWeek:()=>1,
    scheduleNotifications:async()=>{},updateNativeWidgetData:async()=>{},showToast:()=>{},confirm:()=>true,NJUSTCampusCore:core});
  context.window=context;
  const appSource=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
  vm.runInContext(appSource.slice(appSource.indexOf('function isSubPage('),appSource.indexOf('function getClassroomPeriodGroup(')),context);
  vm.runInContext(appSource.slice(appSource.indexOf('function navigate(page)'),appSource.indexOf('async function refreshCurrentPage()')),context);
  vm.runInContext(fs.readFileSync(path.join(root,'js/campus.js'),'utf8'),context);
  return {api:context.NJUSTCampus,state,memory,doc:dom.window.document,dom};
}
async function settle(check) { for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,2));}throw Error('UI did not settle');}

test('calendar instruction text is removed in both clients, while image preview and back remain', async () => {
  const h=uiHarness(); await h.api.load(h.state.data); h.api.open('calendar'); await h.api.render();
  assert.ok(h.doc.querySelector('[data-campus-action="preview-calendar"] img'));
  assert.equal(h.doc.querySelector('[data-campus-action="back"]').textContent,'← 返回');
  for(const file of ['js/campus.js',path.join(miniRoot,'pages/campus/index.wxml')]) {
    const source=fs.readFileSync(path.isAbsolute(file)?file:path.join(root,file),'utf8');
    assert.doesNotMatch(source,/点图片放大查看、双指缩放|只用于看图|不生成调课|不会修改开学日期/);
  }
  assert.match(fs.readFileSync(path.join(miniRoot,'pages/campus/index.wxml'),'utf8'),/bindtap="goBack"[^>]*>← 返回/);
});

test('web/APK back returns to the originating home or settings page even after switching modules', async () => {
  for(const origin of ['home','settings']) {
    const h=uiHarness(); await h.api.load(h.state.data); h.state.currentPage=origin;
    h.api.open('calendar'); await h.api.render();
    assert.equal(h.state.pageBackTarget,origin);
    h.doc.querySelector('[data-campus-action="tab"][data-id="review"]').click();
    await settle(()=>h.doc.querySelector('[data-id="review"]').getAttribute('aria-selected')==='true');
    assert.equal(h.state.pageBackTarget,origin);
    h.doc.querySelector('[data-campus-action="back"]').click(); assert.equal(h.state.currentPage,origin);
    assert.ok(h.doc.querySelector('#page-'+origin).classList.contains('active'));
  }
});

test('web/APK back still works while academic review is loading and falls back to home', async () => {
  const gate=defer(),h=uiHarness(()=>gate.promise); await h.api.load(h.state.data); await h.api.render();
  h.doc.querySelector('[data-campus-action="refresh-review"]').click();
  await settle(()=>h.doc.querySelector('[data-campus-action="refresh-review"]').disabled);
  assert.equal(h.doc.querySelector('[data-campus-action="back"]').disabled,false);
  h.doc.querySelector('[data-campus-action="back"]').click(); assert.equal(h.state.currentPage,'home');
  gate.resolve(payload()); await new Promise(r=>setTimeout(r,10)); assert.equal(h.state.currentPage,'home');
});

function miniPageHarness(pageCount, failBack=false) {
  let page; const navigation=[];
  const context=vm.createContext({Page:value=>{page=value;},getCurrentPages:()=>Array.from({length:pageCount},()=>({})),
    require:name=>name.endsWith('/campus-core')?core:{},
    wx:{navigateBack:options=>{navigation.push({kind:'back',delta:options.delta});if(failBack)options.fail();},
      switchTab:options=>navigation.push({kind:'home',url:options.url})}});
  vm.runInContext(fs.readFileSync(path.join(miniRoot,'pages/campus/index.js'),'utf8'),context);
  page.setData=values=>Object.assign(page.data,values); return {page,navigation};
}

test('mini back navigates to the previous page for either module, including while loading', () => {
  for(const kind of ['calendar','review']) {
    const h=miniPageHarness(2); h.page.onLoad({kind}); h.page.data.busy=true; h.page.goBack();
    assert.equal(h.page.data.kind,kind); assert.deepEqual(h.navigation,[{kind:'back',delta:1}]);
  }
});

test('mini direct entry or a failed back navigation falls back to the home tab', () => {
  const direct=miniPageHarness(1); direct.page.goBack();
  assert.deepEqual(direct.navigation,[{kind:'home',url:'/pages/dashboard/index'}]);
  const failed=miniPageHarness(2,true); failed.page.goBack();
  assert.deepEqual(failed.navigation,[{kind:'back',delta:1},{kind:'home',url:'/pages/dashboard/index'}]);
});
test('web UI queries school data in place and preserves safe cache on failed refresh', async () => {
  const h=uiHarness(async()=>{throw Error('网络超时');});
  await h.api.load(h.state.data); await h.api.render();
  h.doc.querySelector('[data-campus-action="refresh-review"]').click();
  await settle(()=>h.doc.querySelector('.campus-error'));
  assert.match(h.doc.body.textContent,/148.1/); assert.match(h.doc.body.textContent,/网络超时/);
  assert.equal(h.memory.get('campusReviewV1').accounts[0].fetchedAt,fetchedAt);
});
test('web UI ignores an old account response after the active account changes', async () => {
  const gate=defer(), h=uiHarness(()=>gate.promise,false);
  await h.api.load(h.state.data); await h.api.render();
  h.doc.querySelector('[data-campus-action="refresh-review"]').click(); await new Promise(r=>setImmediate(r));
  h.state.server.accountKey='209900000002'; await h.api.syncOwner(); await h.api.render();
  gate.resolve(payload()); await new Promise(r=>setTimeout(r,10));
  assert.doesNotMatch(h.doc.body.textContent,/测试学生|148.1/);
  assert.equal(h.memory.has('campusReviewV1'),false);
});
test('school HTML is displayed as text and cannot inject executable markup', async () => {
  const unsafe = rows.map(r=>r[0]==='学号'?r.map(v=>v==='测试学生'?'<img src=x onerror=evil()>':v):r);
  const h=uiHarness(async()=>({...payload(),rows:unsafe}),false);
  await h.api.load(h.state.data); await h.api.render(); h.doc.querySelector('[data-campus-action="refresh-review"]').click();
  await settle(()=>h.doc.body.textContent.includes('148.1'));
  assert.equal(h.doc.querySelector('img'),null); assert.match(h.doc.body.textContent,/<img/);
});
