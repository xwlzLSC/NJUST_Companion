/** 枚举有效回归测试后调用 Node，避免依赖各平台 shell 对文件通配符的展开方式。 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const roots = require('../fixtures/project-paths.cjs');
const hasMini = fs.existsSync(roots.mini('miniprogram/app.json'));
if (!hasMini && process.argv.includes('--all')) {
  console.error('完整跨端测试需要小程序工程，请设置 NJUST_MINI_ROOT；只测 APK 可运行 npm test。');
  process.exit(1);
}
const directory = roots.apk('scripts');
const files = fs.readdirSync(directory).filter(name => /^test-.*\.cjs$/.test(name)).sort();
const selected = files.filter(name => {
  const source = fs.readFileSync(path.join(directory, name), 'utf8');
  const needsMini = /projectPaths\.mini\(/.test(source);
  // 这两份测试同时覆盖 APK，内部会跳过不存在的小程序，不能跳过整份文件。
  const mixedTests = ['test-study-features.cjs', 'test-schedule-weeks.cjs'];
  if (!hasMini && needsMini && !mixedTests.includes(name)) { console.warn('跳过小程序相关测试：' + name); return false; }
  return true;
});
const result = spawnSync(process.execPath, ['--test', ...selected.map(name => path.join(directory, name))], { cwd: roots.apkRoot, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
