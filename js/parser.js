/**
 * 南理教务助手解析器
 * 供书签脚本、浏览器环境和后续原生壳复用
 */

function textOf(node) {
  return (node && (node.innerText || node.textContent || '') || '')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function linesOf(node) {
  return textOf(node)
    .split(/[\r\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function linesFromHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/[\r\n]+/)
    .map(item => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function pickTable(doc) {
  return Array.from(doc.querySelectorAll('table'))
    .sort((left, right) => {
      const leftScore = left.rows.length * (left.rows[0] ? left.rows[0].cells.length : 0);
      const rightScore = right.rows.length * (right.rows[0] ? right.rows[0].cells.length : 0);
      return rightScore - leftScore;
    })[0] || null;
}

function detectPageType(doc, url) {
  const source = `${String(url || '').toLowerCase()} ${textOf(doc.body).slice(0, 1000)}`;
  if (/djkscj_list|等级考试/.test(source)) return 'certs';
  if (/xskbcx|xskb_list|kbcx|课表/.test(source)) return 'schedule';
  if (/xscjcx|cjcx_query|cjcx_list|cjcx|成绩/.test(source)) return 'grades';
  if (/xsksap_query|xsksap_list|xsksap|ksap|考试/.test(source)) return 'exams';
  return '';
}

function readSemesterHint(doc) {
  const selectors = ['#xnxq01id', '#kksj', '#xnxqid', 'select'];
  for (const selector of selectors) {
    const selected = doc.querySelector(`${selector} option:checked`) || doc.querySelector(`${selector} option[selected]`);
    if (selected) return textOf(selected);
  }
  return '';
}

function parseWeekInfo(text) {
  const source = String(text || '');
  const rangeMatch = source.match(/(\d+)\s*[-~]\s*(\d+)/);
  const singleMatch = source.match(/(?:^|[^\d])(\d+)\s*\((?:周|单周|双周)\)/);
  const startWeek = rangeMatch ? Number.parseInt(rangeMatch[1], 10) : (singleMatch ? Number.parseInt(singleMatch[1], 10) : 1);
  const endWeek = rangeMatch ? Number.parseInt(rangeMatch[2], 10) : startWeek;
  return {
    startWeek: Number.isFinite(startWeek) ? startWeek : 1,
    endWeek: Number.isFinite(endWeek) ? endWeek : 20,
    oddEven: /单/.test(source) ? '单' : (/双/.test(source) ? '双' : '')
  };
}

function buildScheduleItem(name, weekday, periods) {
  return {
    name: name || '未命名课程',
    teacher: '',
    room: '',
    weekday,
    periods,
    startWeek: 1,
    endWeek: 20,
    oddEven: '',
    credit: 0,
    code: '',
    sequence: '',
    attribute: '',
    stage: '',
    groupName: ''
  };
}

const MODERN_ROW_PERIOD_MAP = {
  1: [1, 2, 3],
  2: [4, 5],
  3: [6, 7],
  4: [8, 9, 10],
  5: [11, 12, 13],
  6: [14]
};

function normalizeCourseKey(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[（）()\[\]【】《》]/g, '')
    .replace(/[·•,，\-—_]/g, '')
    .toLowerCase();
}

function normalizeTeacherKey(value) {
  return String(value || '')
    .split(/[，,、\s]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
    .join(',');
}

function rowGroupFromPeriods(periods) {
  const ordered = Array.isArray(periods)
    ? periods.map(item => Number.parseInt(item, 10)).filter(Number.isFinite)
    : [];
  if (ordered.includes(14)) return 6;
  const first = Math.min(...ordered);
  if (first <= 3) return 1;
  if (first <= 5) return 2;
  if (first <= 7) return 3;
  if (first <= 10) return 4;
  if (first <= 13) return 5;
  return 6;
}

function splitCellValues(value) {
  const source = String(value || '').trim();
  if (!source) return [];
  return source
    .split(/[，,；;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseScheduleOccurrences(value) {
  return linesFromHtml(value)
    .flatMap(line => {
      const source = String(line || '').trim();
      if (!source) return [];
      return source
        .split(/[；;]+/)
        .map(item => item.trim())
        .filter(Boolean)
        .map(item => {
          const match = item.match(/星期([一二三四五六日天])\s*\(\s*(\d+)\s*[-~]\s*(\d+)\s*小节\s*\)/);
          if (!match) return null;
          const weekdayMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
          const start = Number.parseInt(match[2], 10);
          const end = Number.parseInt(match[3], 10);
          if (!weekdayMap[match[1]] || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
            return null;
          }
          return {
            weekday: weekdayMap[match[1]],
            periods: Array.from({ length: end - start + 1 }, (_, index) => start + index)
          };
        })
        .filter(Boolean);
    });
}

function splitScheduleSegments(detailNode) {
  const segments = [];
  let current = null;

  const ensureCurrent = name => {
    if (!current) {
      current = {
        name: name || '',
        teacher: '',
        room: '',
        weekText: '',
        groupName: ''
      };
      segments.push(current);
      return current;
    }
    if (name && !current.name) {
      current.name = name;
    }
    return current;
  };

  Array.from(detailNode.childNodes).forEach(node => {
    if (node.nodeType === 3) {
      const pieces = linesFromHtml(node.textContent || '');
      pieces.forEach(piece => {
        if (/^-{3,}$/.test(piece)) {
          current = null;
          return;
        }
        ensureCurrent(piece);
      });
      return;
    }

    if (node.nodeType !== 1) return;
    if (node.tagName === 'BR') return;

    const text = textOf(node);
    if (!text) return;
    if (/^-{3,}$/.test(text)) {
      current = null;
      return;
    }

    const item = ensureCurrent('');
    const title = node.getAttribute('title') || '';
    if (/老师/.test(title)) {
      item.teacher = text;
      return;
    }
    if (/教室|地点/.test(title)) {
      item.room = text;
      return;
    }
    if (/周次/.test(title)) {
      item.weekText = text;
      return;
    }
    if (/分组/.test(title)) {
      item.groupName = text;
      return;
    }
    if (!item.name) {
      item.name = text;
    }
  });

  return segments
    .map(segment => {
      const trimmedName = String(segment.name || '').trim();
      if (!trimmedName) return null;
      return {
        name: trimmedName,
        teacher: segment.teacher,
        room: segment.room,
        weekText: segment.weekText,
        groupName: segment.groupName
      };
    })
    .filter(Boolean);
}

function parseScheduleDetailTable(doc) {
  const table = doc.querySelector('#dataList');
  if (!table || !table.rows.length) return [];

  const headers = Array.from(table.rows[0].cells).map(cell => textOf(cell));
  const getIndex = (...names) => {
    for (const name of names) {
      const found = headers.findIndex(header => header.includes(name));
      if (found !== -1) return found;
    }
    return -1;
  };

  const codeIdx = getIndex('课程号', '课程编号');
  const sequenceIdx = getIndex('课序号');
  const nameIdx = getIndex('课程名称', '课程名', '课程');
  const teacherIdx = getIndex('教师');
  const timeIdx = getIndex('时间');
  const creditIdx = getIndex('学分');
  const roomIdx = getIndex('地点', '教室');
  const attributeIdx = getIndex('课程属性');
  const stageIdx = getIndex('选课阶段');

  return Array.from(table.rows)
    .slice(1)
    .flatMap(row => {
      const cells = Array.from(row.cells);
      if (!cells.length) return [];

      const name = nameIdx >= 0 ? textOf(cells[nameIdx]) : '';
      if (!name) return [];

      const teacher = teacherIdx >= 0 ? textOf(cells[teacherIdx]) : '';
      const occurrences = timeIdx >= 0 ? parseScheduleOccurrences(cells[timeIdx].innerHTML || cells[timeIdx].textContent || '') : [];
      if (!occurrences.length) return [];

      const rooms = roomIdx >= 0 ? splitCellValues(textOf(cells[roomIdx])) : [];
      const sharedRoom = rooms[0] || '';
      const credit = Number.parseFloat(creditIdx >= 0 ? textOf(cells[creditIdx]) : '');

      return occurrences.map((occurrence, index) => {
        const item = buildScheduleItem(name, occurrence.weekday, occurrence.periods);
        item.teacher = teacher;
        item.room = rooms[index] || sharedRoom;
        item.credit = Number.isFinite(credit) ? credit : 0;
        item.code = codeIdx >= 0 ? textOf(cells[codeIdx]) : '';
        item.sequence = sequenceIdx >= 0 ? textOf(cells[sequenceIdx]) : '';
        item.attribute = attributeIdx >= 0 ? textOf(cells[attributeIdx]) : '';
        item.stage = stageIdx >= 0 ? textOf(cells[stageIdx]) : '';
        return item;
      });
    });
}

function parseModernScheduleGrid(doc) {
  const table = doc.querySelector('#kbtable');
  if (!table) return [];

  return Array.from(table.rows)
    .slice(1)
    .flatMap((row, rowIndex) => Array.from(row.querySelectorAll('td'))
      .slice(0, 7)
      .flatMap((cell, colIndex) => {
        const detailNode = cell.querySelector('.kbcontent') || cell.querySelector('.kbcontent1');
        if (!detailNode) return [];
        return splitScheduleSegments(detailNode).map(segment => {
          const item = buildScheduleItem(segment.name, colIndex + 1, MODERN_ROW_PERIOD_MAP[rowIndex + 1] || [14]);
          item.teacher = segment.teacher || '';
          item.room = segment.room || '';
          item.groupName = segment.groupName || '';
          item.rowGroup = rowIndex + 1;
          item.weekText = segment.weekText || '';
          if (segment.weekText) {
            Object.assign(item, parseWeekInfo(segment.weekText));
          }
          return item;
        });
      }));
}

function mergeModernSchedule(detailItems, gridItems) {
  if (!detailItems.length) return gridItems;
  if (!gridItems.length) return detailItems;

  const gridBuckets = new Map();
  gridItems.forEach((item, index) => {
    const key = [
      normalizeCourseKey(item.name),
      String(item.weekday || ''),
      String(item.rowGroup || rowGroupFromPeriods(item.periods)),
      normalizeTeacherKey(item.teacher)
    ].join('|');
    if (!gridBuckets.has(key)) {
      gridBuckets.set(key, []);
    }
    gridBuckets.get(key).push({ item, index, used: false });
  });

  const findGridMatch = detail => {
    const rowGroup = rowGroupFromPeriods(detail.periods);
    const keys = [
      [
        normalizeCourseKey(detail.name),
        String(detail.weekday || ''),
        String(rowGroup),
        normalizeTeacherKey(detail.teacher)
      ].join('|'),
      [
        normalizeCourseKey(detail.name),
        String(detail.weekday || ''),
        String(rowGroup),
        ''
      ].join('|')
    ];

    for (const key of keys) {
      const bucket = gridBuckets.get(key);
      if (!bucket || !bucket.length) continue;
      const found = bucket.find(entry => !entry.used);
      if (found) {
        found.used = true;
        return found.item;
      }
    }

    const looseMatch = gridItems.find(item =>
      normalizeCourseKey(item.name) === normalizeCourseKey(detail.name)
      && item.weekday === detail.weekday
      && (item.rowGroup || rowGroupFromPeriods(item.periods)) === rowGroup
    );
    return looseMatch || null;
  };

  return detailItems.map(detail => {
    const gridMatch = findGridMatch(detail);
    if (!gridMatch) return detail;
    return {
      ...detail,
      teacher: detail.teacher || gridMatch.teacher || '',
      room: detail.room || gridMatch.room || '',
      startWeek: gridMatch.startWeek || detail.startWeek,
      endWeek: gridMatch.endWeek || detail.endWeek,
      oddEven: gridMatch.oddEven || detail.oddEven,
      groupName: gridMatch.groupName || detail.groupName || ''
    };
  });
}

function parseModernSchedule(doc) {
  const detailItems = parseScheduleDetailTable(doc);
  const gridItems = parseModernScheduleGrid(doc);
  return mergeModernSchedule(detailItems, gridItems);
}

function parseLegacySchedule(doc) {
  const table = pickTable(doc);
  if (!table) return [];

  return Array.from(table.rows)
    .slice(1)
    .flatMap((row, rowIndex) => Array.from(row.cells)
      .slice(1, 8)
      .map((cell, colIndex) => {
        const lines = linesOf(cell);
        if (!lines.length) return null;

        const rowPeriods = MODERN_ROW_PERIOD_MAP[rowIndex + 1]
          || (rowIndex + 1 === 5 ? [11, 12, 13] : [14]);
        const course = buildScheduleItem(lines[0], colIndex + 1, rowPeriods);

        lines.slice(1).forEach(line => {
          const weekInfo = parseWeekInfo(line);
          if (weekInfo.startWeek !== 1 || weekInfo.endWeek !== 1 || /周/.test(line)) {
            course.startWeek = weekInfo.startWeek;
            course.endWeek = weekInfo.endWeek;
            course.oddEven = weekInfo.oddEven;
          }
          if (!course.room && /[教楼室馆场]|线上|[A-Z]-?[A-Z]?\d{2,4}|\d{3,4}/.test(line)) {
            course.room = line;
          }
          if (!course.teacher && /^[\u4e00-\u9fa5·,，]{2,24}$/.test(line)) {
            course.teacher = line.replace(/，/g, ',');
          }
        });

        return course;
      })
      .filter(Boolean));
}

function parseSchedule(doc) {
  const items = doc.querySelector('#kbtable')
    ? parseModernSchedule(doc)
    : parseLegacySchedule(doc);
  const semester = readSemesterHint(doc);
  return items.map(item => ({
    ...item,
    semester: item.semester || semester
  }));
}

function parseGrades(doc) {
  const table = pickTable(doc);
  if (!table || !table.rows.length) return [];

  const headers = Array.from(table.rows[0].cells).map(cell => textOf(cell));
  const getIndex = (...names) => {
    for (const name of names) {
      const found = headers.findIndex(header => header.includes(name));
      if (found !== -1) return found;
    }
    return -1;
  };

  const nameIdx = getIndex('课程名', '课程');
  const codeIdx = getIndex('课程编号', '课程代码');
  const creditIdx = getIndex('学分');
  const hoursIdx = getIndex('总学时', '学时');
  const scoreIdx = getIndex('成绩', '期末');
  const flagIdx = getIndex('成绩标识');
  const assessmentIdx = getIndex('考核方式');
  const attributeIdx = getIndex('课程属性');
  const categoryIdx = getIndex('课程性质');
  const gpaIdx = getIndex('绩点', '学分绩点');
  const semesterIdx = getIndex('学年', '学期');

  return Array.from(table.rows)
    .slice(1)
    .map(row => {
      const cells = Array.from(row.cells).map(cell => textOf(cell));
      if (!cells.length) return null;

      const scoreRaw = scoreIdx >= 0 ? cells[scoreIdx] : '';
      const scoreNum = Number.parseFloat(scoreRaw);

      return {
        name: nameIdx >= 0 ? cells[nameIdx] : cells[0],
        code: codeIdx >= 0 ? cells[codeIdx] : '',
        credit: Number.parseFloat(creditIdx >= 0 ? cells[creditIdx] : '') || 0,
        hours: Number.parseFloat(hoursIdx >= 0 ? cells[hoursIdx] : '') || 0,
        score: Number.isFinite(scoreNum) ? scoreNum : null,
        scoreText: Number.isFinite(scoreNum) ? '' : scoreRaw,
        flag: flagIdx >= 0 ? cells[flagIdx] : '',
        assessment: assessmentIdx >= 0 ? cells[assessmentIdx] : '',
        attribute: attributeIdx >= 0 ? cells[attributeIdx] : '',
        category: categoryIdx >= 0 ? cells[categoryIdx] : '',
        type: categoryIdx >= 0 ? cells[categoryIdx] : '',
        gpa: Number.isFinite(Number.parseFloat(gpaIdx >= 0 ? cells[gpaIdx] : ''))
          ? Number.parseFloat(cells[gpaIdx])
          : null,
        semester: semesterIdx >= 0 ? (cells[semesterIdx] || '').replace(/~/g, '-') : readSemesterHint(doc)
      };
    })
    .filter(item => item && item.name);
}

function parseLevelExams(doc) {
  const table = doc.querySelector('#dataList');
  if (!table || !table.rows.length) return [];

  return Array.from(table.rows)
    .slice(2)
    .map(row => {
      const cells = Array.from(row.cells).map(cell => textOf(cell));
      if (!cells.length) return null;
      const name = cells[1] || '';
      if (!name) return null;

      const totalScore = Number.parseFloat(cells[4]);
      const writtenScore = Number.parseFloat(cells[2]);
      const computerScore = Number.parseFloat(cells[3]);
      let kind = '';
      if (/CET4/i.test(name)) kind = 'CET4';
      else if (/CET6/i.test(name)) kind = 'CET6';
      else if (/大学英语四级|[^六]四级/.test(name)) kind = 'CET4';
      else if (/大学英语六级|六级/.test(name)) kind = 'CET6';

      return {
        name,
        kind,
        totalScore: Number.isFinite(totalScore) ? totalScore : null,
        writtenScore: Number.isFinite(writtenScore) ? writtenScore : null,
        computerScore: Number.isFinite(computerScore) ? computerScore : null,
        date: cells[8] || cells[cells.length - 1] || ''
      };
    })
    .filter(item => item && item.name);
}

function parseExams(doc) {
  const table = pickTable(doc);
  if (!table || !table.rows.length) return [];

  const headers = Array.from(table.rows[0].cells).map(cell => textOf(cell));
  const getIndex = (...names) => {
    for (const name of names) {
      const found = headers.findIndex(header => header.includes(name));
      if (found !== -1) return found;
    }
    return -1;
  };

  const nameIdx = getIndex('课程名', '课程');
  const dateIdx = getIndex('考试日期', '日期');
  const timeIdx = getIndex('考试时间', '时间');
  const roomIdx = getIndex('考场', '地点', '教室');
  const seatIdx = getIndex('座位', '位号');

  return Array.from(table.rows)
    .slice(1)
    .map(row => {
      const cells = Array.from(row.cells).map(cell => textOf(cell));
      if (!cells.length) return null;
      return {
        name: nameIdx >= 0 ? cells[nameIdx] : cells[0],
        date: (dateIdx >= 0 ? cells[dateIdx] : '').replace(/[年月]/g, '-').replace(/日/g, ''),
        time: timeIdx >= 0 ? cells[timeIdx] : '',
        room: roomIdx >= 0 ? cells[roomIdx] : '',
        seat: seatIdx >= 0 ? cells[seatIdx] : ''
      };
    })
    .filter(item => item && item.name);
}

function createExportPayload(doc, url) {
  const type = detectPageType(doc, url);
  const payload = {
    schedule: [],
    grades: [],
    certs: [],
    exams: [],
    meta: {
      type,
      sections: type ? [type] : [],
      semester: readSemesterHint(doc),
      sourceUrl: url || '',
      pageTitle: doc.title || '',
      exportedAt: new Date().toISOString()
    }
  };

  if (type === 'schedule') payload.schedule = parseSchedule(doc);
  if (type === 'grades') payload.grades = parseGrades(doc);
  if (type === 'certs') payload.certs = parseLevelExams(doc);
  if (type === 'exams') payload.exams = parseExams(doc);

  return payload;
}

if (typeof window !== 'undefined') {
  window.NJUSTParser = {
    detectPageType,
    parseSchedule,
    parseGrades,
    parseLevelExams,
    parseExams,
    createExportPayload
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    detectPageType,
    parseSchedule,
    parseGrades,
    parseLevelExams,
    parseExams,
    createExportPayload
  };
}
