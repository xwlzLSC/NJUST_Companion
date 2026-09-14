const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const parser = require('../js/parser');
const miniRoot = process.env.NJUST_MINI_ROOT;
const parsers = [
  ['app', html => parser.parseSchedule(new JSDOM(html).window.document)]
];
if (miniRoot) {
  const path = require('node:path');
  const legacy = require(path.join(miniRoot, 'cloudfunctions/njustSync/lib/parser'));
  const modern = require(path.join(miniRoot, 'cloudfunctions/njustSync2/lib/parser'));
  const cheerio = require(path.join(miniRoot, 'cloudfunctions/njustSync2/node_modules/cheerio'));
  parsers.push(['mini legacy', html => legacy.parseSchedule(new JSDOM(html).window.document)]);
  parsers.push(['mini current', html => modern.parseSchedule(cheerio.load(html))]);
}
function fixture(weeks) {
  return `<table id="kbtable"><tr><th>课表</th></tr>
    <tr><th>第一大节</th><td><div class="kbcontent">科技论文写作<br>
    <font title="周次">${weeks}</font><br><font title="老师">郭璐</font><br>
    <font title="教室">IV-C105</font></div></td></tr></table>`;
}
for (const [label, parse] of parsers) {
  for (const [text, expected] of [
    ['4-5,8-12(周)', [[4, 5], [8, 12]]],
    ['5,7-11(周)', [[5, 5], [7, 11]]],
    ['5-6,8-11(周)', [[5, 6], [8, 11]]],
    ['4－5，8～12（周）', [[4, 5], [8, 12]]],
    ['13(周)', [[13, 13]]],
    ['1-16(单周)', [[1, 16]]]
  ]) {
    const items = parse(fixture(text));
    assert.deepEqual(items.map(c => [c.startWeek, c.endWeek]), expected, label + ': ' + text);
    assert(items.every(c => c.room === 'IV-C105' && c.teacher === '郭璐'));
    if (text.includes('单')) assert(items.every(c => c.oddEven === '单'));
  }
  const split = parse(fixture('4-5,8-12(周)'));
  const detail = '<table id="dataList"><tr><th>课程名称</th><th>教师</th><th>时间</th><th>地点</th><th>学分</th></tr>' +
    '<tr><td>科技论文写作</td><td>郭璐</td><td>星期一(01-03小节)</td><td>IV-C105</td><td>1</td></tr></table>';
  const merged = parse(fixture('4-5,8-12(周)') + detail);
  assert.deepEqual(merged.map(c => [c.startWeek, c.endWeek]), [[4, 5], [8, 12]], label + ': detail merge');
  assert(merged.every(c => c.credit === 1), label + ': detail credit');
  const active = week => split.some(c => week >= c.startWeek && week <= c.endWeek);
  for (const week of [4, 5, 8, 9, 10, 11, 12]) assert(active(week), label + ': missing ' + week);
  for (const week of [3, 6, 7, 13]) assert(!active(week), label + ': extra ' + week);
  if (miniRoot && label.startsWith('mini')) {
    const path = require('node:path');
    const format = require(path.join(miniRoot, 'miniprogram/utils/format'));
    const normalized = split.map(format.normalizeScheduleItem);
    for (const week of [4, 5, 8, 9, 10, 11, 12]) {
      assert(normalized.some(c => format.isCourseActiveInWeek(c, week)), label + ': normalized missing ' + week);
    }
    for (const week of [6, 7]) {
      assert(!normalized.some(c => format.isCourseActiveInWeek(c, week)), label + ': normalized gap ' + week);
    }
  }
  console.log(label + ': segmented weeks passed');
}
