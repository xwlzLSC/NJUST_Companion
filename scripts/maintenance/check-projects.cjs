/**
 * 无副作用的工程检查：语法、页面/组件注册、相对依赖、共享副本和云端可移植性。
 * 只读取文件，不读取 .env/storage，不登录学校，不安装依赖、不部署云函数。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const roots = require('../fixtures/project-paths.cjs');
const registry = require('./shared-files.json');
const CLOUD_FUNCTIONS = ['njustSync2', 'njustCaptchaOcr', 'njustLibrary', 'todoReminderTimer'];
const report = { scripts: 0, imports: 0, pages: 0, mirrors: 0, cloudFunctions: 0 };
function mustExist(file) { if (!fs.existsSync(file)) throw new Error('缺少工程文件：' + file); }
function json(file) { mustExist(file); return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function walk(directory, extensions = ['.js', '.cjs']) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    // 不追踪联接点，不把依赖/归档/生成目录当成源码递归检查。
    if (entry.isSymbolicLink() || ['node_modules', '.git', 'target', 'build', '.maintenance-backup'].includes(entry.name)) return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file, extensions) : extensions.includes(path.extname(file)) ? [file] : [];
  });
}
function checkScript(file) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: file }); // 只编译，不执行 App/Page/学校请求。
  report.scripts++;
  for (const match of source.matchAll(/\brequire\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (![target, target + '.js', target + '.cjs', target + '.json', path.join(target, 'index.js')].some(fs.existsSync)) {
      throw new Error('相对依赖不存在：' + file + ' -> ' + match[1]);
    }
    report.imports++;
  }
}
function checkCloud(directory) {
  const pkg = json(path.join(directory, 'package.json'));
  mustExist(path.join(directory, pkg.main || 'index.js'));
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (/^file:(?:[a-z]:|\/|\\)/i.test(version)) throw new Error('云端依赖不能指向本机绝对路径：' + name);
  }
  const lockFile = path.join(directory, 'package-lock.json');
  if (fs.existsSync(lockFile)) {
    const lock = json(lockFile);
    if (JSON.stringify(lock.packages?.['']?.dependencies || {}) !== JSON.stringify(pkg.dependencies || {})) {
      throw new Error('云函数锁文件与依赖声明不一致：' + directory);
    }
    for (const key of Object.keys(lock.packages || {})) {
      if (key && !key.startsWith('node_modules/')) throw new Error('云端锁文件存在多余本机工程：' + key);
    }
  }
  report.cloudFunctions++;
}
function checkMini() {
  const mini = roots.mini('miniprogram');
  const app = json(path.join(mini, 'app.json'));
  for (const route of app.pages) {
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) mustExist(path.join(mini, route + extension));
    const config = json(path.join(mini, route + '.json'));
    for (const component of Object.values(config.usingComponents || {})) {
      if (component.startsWith('plugin://')) continue;
      const base = component.startsWith('/') ? path.join(mini, component.slice(1)) : path.resolve(path.dirname(path.join(mini, route)), component);
      for (const extension of ['.js', '.json', '.wxml', '.wxss']) mustExist(base + extension);
      if (json(base + '.json').component !== true) throw new Error('组件未声明 component:true：' + base);
    }
    report.pages++;
  }
  for (const item of app.tabBar?.list || []) {
    if (!app.pages.includes(item.pagePath)) throw new Error('底部导航指向未注册页面：' + item.pagePath);
    mustExist(path.join(mini, item.iconPath)); mustExist(path.join(mini, item.selectedIconPath));
  }
  const config = json(roots.mini('project.config.json'));
  if (config.miniprogramRoot !== 'miniprogram/' || config.cloudfunctionRoot !== 'cloudfunctions/') throw new Error('微信工程根目录配置不匹配');
  for (const file of walk(mini)) checkScript(file);
  for (const name of CLOUD_FUNCTIONS) {
    const directory = roots.mini('cloudfunctions/' + name); checkCloud(directory);
    for (const file of walk(directory)) checkScript(file);
  }
  for (const group of registry.groups) {
    const source = fs.readFileSync(roots.apk(group.source), 'utf8').replace(/\r\n/g, '\n');
    for (const copy of group.copies) {
      if (fs.readFileSync(roots.mini(copy), 'utf8').replace(/\r\n/g, '\n') !== source) throw new Error('共享副本不同步：' + copy);
      report.mirrors++;
    }
  }
}
function run() {
  for (const file of [...walk(roots.apk('js')), ...walk(roots.apk('integrations'))]) checkScript(file);
  checkScript(roots.apk('server.js')); checkScript(roots.apk('sw.js'));
  for (const file of ['index.html', 'css/app.css', 'css/campus.css', 'eng.traineddata', 'models/captcha/common_old.onnx', 'models/captcha/LICENSE']) mustExist(roots.apk(file));
  const native = roots.apk('android/app/src/main/java/com/njust/companion');
  for (const name of ['MainActivity', 'SchoolSessionPlugin', 'SecureCredentialsPlugin', 'WechatBridgePlugin', 'NJUSTWidgetPlugin', 'AppUpdatePlugin']) mustExist(path.join(native, name + '.java'));
  if (fs.existsSync(roots.mini('miniprogram/app.json'))) checkMini();
  else if (process.argv.includes('--require-mini')) throw new Error('找不到小程序工程，请设置 NJUST_MINI_ROOT');
  else console.warn('未找到小程序；仅检查 APK 工程。跨端检查请设置 NJUST_MINI_ROOT。');
  return report;
}
if (require.main === module) {
  try { console.log('工程检查通过：' + JSON.stringify(run())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { run, walk, checkCloud, CLOUD_FUNCTIONS };
