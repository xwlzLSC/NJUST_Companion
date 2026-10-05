// Anonymous, read-only research. No account storage, cookies or tokens logged.
const axios = require('axios');
const zlib = require('node:zlib');
const { JSDOM } = require('jsdom');
const mode = process.argv[2] || 'sites';
const publicUrls = [
  'https://jwc.njust.edu.cn/', 'https://jwc.njust.edu.cn/1060/list.htm',
  'https://ehall2.njust.edu.cn/default/index.html', 'https://lib.njust.edu.cn/',
  'https://szfz.njust.edu.cn/dekt2.0/', 'https://e.njust.edu.cn/',
  'https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp'
];
async function get(url) {
  return axios.get(url, { timeout: 12000, responseType: 'arraybuffer', maxContentLength: 12 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }, validateStatus: () => true });
}
async function sites() {
  await Promise.all(publicUrls.map(async url => {
    try {
      const response = await get(url);
      const body = Buffer.from(response.data).toString('utf8');
      const doc = new JSDOM(body, { url }).window.document;
      const links = [...doc.querySelectorAll('a[href]')].map(a => ({ text: a.textContent.trim().replace(/\s+/g, ' '), url: a.href }))
        .filter(a => /校历|培养|毕业|借阅|读者|一卡通|电|素质|学分|认证|second|login/i.test(a.text + a.url)).slice(0, 30);
      const scripts = [...doc.querySelectorAll('script[src]')].map(s => s.src).slice(-16);
      console.log(JSON.stringify({ url, status: response.status, bytes: body.length, title: doc.title, links, scripts }));
    } catch (error) { console.log(JSON.stringify({ url, error: error.code || 'request failed' })); }
  }));
}
async function upstream() {
  const response = await get('https://codeload.github.com/fans963/li_curriculum_table/tar.gz/refs/heads/develop');
  if (response.status !== 200) throw Error('Upstream archive unavailable: ' + response.status);
  const tar = zlib.gunzipSync(Buffer.from(response.data), { maxOutputLength: 32 * 1024 * 1024 });
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    if (!name) break;
    const body = tar.subarray(offset + 512, offset + 512 + size).toString('utf8');
    if (/LICENSE$|pubspec.yaml$/.test(name)) console.log(name + '\n' + body.slice(0, 1300));
    if (/(?:lib\/.*(?:library|electric|campus|calendar|credit|graduat|second|card|train|cultivat|qualification|schedule|api|url).*\.dart|rust\/.*(?:book|crawler|config).*\.rs)$/i.test(name)) {
      const interesting = body.split('\n').filter(line => /https?:|\.get\(|\.post\(|borrow|reader|semester|graduat|培养|学分|校历|电|借阅|素质/i.test(line));
      console.log(name + '\n' + interesting.slice(0, 70).join('\n'));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
}
async function portal() {
  const response = await get('https://ehall2.njust.edu.cn/js/app.19d82a96.js');
  const text = Buffer.from(response.data).toString('utf8');
  const patterns = /(?:url|URL|apiUrl|path|serviceUrl)\s*:\s*["']([^"']+)["']/g;
  const paths = [...text.matchAll(patterns)].map(match => match[1]);
  console.log(JSON.stringify({ bundleBytes: text.length, paths: [...new Set(paths)].slice(0, 100) }));
  console.log('Public endpoint paths: ' + JSON.stringify([...new Set([...text.matchAll(/pe\("([^"]+)"\)/g)].map(m => m[1]))]));
  for (const term of ['校历', 'appQuery', 'appList', 'searchApps', 'getApp', 'amp2/', 'casp/', 'user-app', 'queryApp', 'Calendar']) {
    const index = text.indexOf(term); if (index >= 0) console.log(term + ': ' + text.slice(Math.max(0, index - 120), index + 300));
  }
  for (const term of ['pe=function', 'pe=', 'baseURL', 'execCardMethod', 'getLoginUserAndGuest', 'casp-ioc', 'function pe', 'queryService', 'queryAppList', 'serviceList', 'queryAppBy', 'getServiceList', 'queryServiceGroup']) {
    const index = text.indexOf(term); if (index >= 0) console.log(term + ': ' + text.slice(Math.max(0, index - 100), index + 300));
  }
  const quality = await get('https://szfz.njust.edu.cn/dekt2.0/');
  const doc = new JSDOM(Buffer.from(quality.data).toString()).window.document;
  console.log('Second classroom public login form: ' + JSON.stringify([...doc.querySelectorAll('form')].map(form => ({ action: form.getAttribute('action'), inputs: [...form.querySelectorAll('input')].map(i => ({ name: i.name, type: i.type })) }))));
  console.log('Second classroom public links: ' + JSON.stringify([...doc.querySelectorAll('[onclick],a[href]')].map(e => ({ text: e.textContent.trim().slice(0, 40), onclick: e.getAttribute('onclick'), href: e.getAttribute('href') })).slice(0, 15)));
}
(mode === 'upstream' ? upstream() : mode === 'portal' ? portal() : sites()).catch(error => { console.error(error.message); process.exitCode = 1; });
