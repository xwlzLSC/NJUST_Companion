/** 跨端测试共用的路径入口：APK 根目录随仓库移动，小程序路径可用环境变量指定。 */
const fs = require('node:fs');
const path = require('node:path');
const apkRoot = path.resolve(__dirname, '../..');
const siblingMini = path.resolve(apkRoot, '../NJUST_companion');
const miniRoot = path.resolve(process.env.NJUST_MINI_ROOT
  || (fs.existsSync(path.join(siblingMini, 'miniprogram/app.json')) ? siblingMini : 'E:/NJUST_companion'));
const inside = (root, relative = '') => {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('工程路径不能跳出根目录');
  return target;
};
module.exports = { apkRoot, miniRoot, apk: relative => inside(apkRoot, relative), mini: relative => inside(miniRoot, relative) };
