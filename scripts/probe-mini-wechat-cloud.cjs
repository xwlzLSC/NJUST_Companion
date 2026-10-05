// Executes the real cloud entry's anonymous preparation/check against school.
// All database operations are in-memory: no deployment, credentials or cloud writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const cloudRoot = process.env.MINI_CLOUD_ROOT || 'E:/NJUST_companion/cloudfunctions/njustSync2';
const sourcePath = process.env.MINI_CLOUD_SOURCE || path.resolve(cloudRoot, 'index.js');
const dbRecords = new Map();
const collection = name => ({
  doc: id => ({
    get: async () => ({ data: structuredClone(dbRecords.get(name + ':' + id)) || null }),
    set: async ({ data }) => dbRecords.set(name + ':' + id, structuredClone(data))
  }),
  where: criteria => ({ update: async ({ data }) => {
    const key = name + ':' + criteria._id, old = dbRecords.get(key);
    const matches = old && Object.entries(criteria).every(([field, value]) => field === '_id' || old[field] === value);
    if (matches) dbRecords.set(key, { ...old, ...data });
    return { stats: { updated: matches ? 1 : 0 } };
  } })
});
const db = { collection, command: {}, createCollection: async () => {}, runTransaction: callback => callback({ collection }) };
const cloud = { init: () => {}, database: () => db, getWXContext: () => ({ OPENID: 'anonymous-local-probe' }) };
const actualRequire = createRequire(path.resolve(cloudRoot, 'index.js'));
const context = vm.createContext({ module: { exports: {} }, exports: {},
  require: name => name === 'wx-server-sdk' ? cloud : actualRequire(name),
  __dirname: cloudRoot, __filename: sourcePath, Buffer, URL, URLSearchParams, process,
  setTimeout, clearTimeout, setInterval, clearInterval,
  console: { log: () => {}, error: () => {}, warn: () => {} }
});
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context);
(async () => {
  const attempt = await context.exports.main({ action: 'prepareWechatLogin' }, {});
  if (!attempt.ok) throw new Error('Anonymous cloud prepare failed: ' + String(attempt.error || '').replace(/https?:\/\/\S+/g, '[school URL]'));
  console.log('Actual cloud entry: prepared school QR + link; revision', attempt.wechatRevision);
  const qrBytes = Buffer.from(attempt.imageDataUrl.split(',')[1], 'base64');
  const { Jimp } = require('jimp');
  const decodedQr = await Jimp.read(qrBytes);
  console.log('QR bytes:', qrBytes.length, '; decoded dimensions:', decodedQr.bitmap.width, 'x', decodedQr.bitmap.height);
  const jsQR = require('jsqr');
  const schoolPayload = jsQR(new Uint8ClampedArray(decodedQr.bitmap.data), decodedQr.bitmap.width, decodedQr.bitmap.height);
  if (!schoolPayload || schoolPayload.data !== attempt.url) throw new Error('School QR payload differs from the one-time confirmation link');
  console.log('School QR payload: matches the one-time confirmation link (not printed)');
  // Exercise the actual mini's conversion/validation with these real bytes.
  // Its wx filesystem/storage are memory-only; no QR file or login link is
  // written to disk or to a real mini-program/device/cloud database.
  const miniRoot = process.env.MINI_PROGRAM_ROOT || 'E:/NJUST_companion/miniprogram';
  const miniStorage = new Map(), miniFiles = new Map();
  const wx = { env: { USER_DATA_PATH: 'wxfile://anonymous-local-probe' },
    getStorageSync: key => structuredClone(miniStorage.get(key)),
    setStorageSync: (key, value) => miniStorage.set(key, structuredClone(value)),
    removeStorageSync: key => miniStorage.delete(key),
    getFileSystemManager: () => ({ writeFile: options => {
      let bytes;
      if (typeof options.data === 'string' && options.encoding === 'base64' && !options.data.startsWith('data:')) {
        bytes = Buffer.from(options.data, 'base64');
      } else if (Object.prototype.toString.call(options.data) === '[object ArrayBuffer]') bytes = Buffer.from(options.data);
      else throw new Error('QR writer received unsupported data or encoding');
      miniFiles.set(options.filePath, bytes); options.success();
    }, unlink: options => { miniFiles.delete(options.filePath); } }),
    getImageInfo: options => { void Jimp.read(miniFiles.get(options.src)).then(image => options.success({ width: image.bitmap.width,
      height: image.bitmap.height, path: options.src }), () => options.fail({ errMsg: 'Invalid image' })); }
  };
  const miniContext = vm.createContext({ wx, module: { exports: {} }, Date, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(fs.readFileSync(path.join(miniRoot, 'utils/wechat-login.js'), 'utf8'), miniContext);
  const mini = miniContext.module.exports;
  wx.setStorageSync(mini.STORAGE_KEY, { ...attempt, mode: 'qr' });
  const localQrPath = await mini.ensureQrFile(mini.loadPending());
  if (!miniFiles.get(localQrPath).equals(qrBytes)) throw new Error('Mini QR bytes differ from the school response');
  mini.clearPending();
  console.log('Actual mini QR pipeline: identical binary image decoded; memory-only files cleaned:', miniFiles.size === 0);
  const renderer = require(path.join(miniRoot, 'utils/wechat-qr-canvas.js'));
  const matrix = renderer.buildMatrix(attempt.url);
  for (const size of [145, 176, 300, 512]) {
    const pixels = new Uint8ClampedArray(size * size * 4);
    let black = false;
    renderer.paint({
      setFillStyle: color => { black = color === '#000000'; },
      fillRect: (x, y, width, height) => {
        for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
          const index = (row * size + column) * 4;
          pixels[index] = pixels[index + 1] = pixels[index + 2] = black ? 0 : 255;
          pixels[index + 3] = 255;
        }
      }
    }, matrix, size);
    const decoded = jsQR(pixels, size, size);
    if (!decoded || decoded.data !== schoolPayload.data) throw new Error('Memory canvas QR cannot be decoded at size ' + size);
  }
  console.log('Memory canvas QR: decoded at 145/176/300/512 px; identical school payload; no file required');
  const state = await context.exports.main({ action: 'checkWechatLogin', attemptId: attempt.attemptId }, {});
  if (!state.ok || state.state !== 'pending') throw new Error('Anonymous cloud pending-state check failed');
  console.log('Actual cloud entry: anonymous state', state.state, '; database writes were in-memory only');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
