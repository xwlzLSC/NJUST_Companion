// Fetches only public challenge images (never attempts a login).
const fs = require('node:fs/promises');
const path = require('node:path');
const { Jimp } = require('jimp');
const dddd = require('../js/captcha-ddddocr');

(async () => {
  const dir = path.join(__dirname, '../storage/ocr-samples');
  await fs.mkdir(dir, { recursive: true });
  if (process.argv.includes('--fetch')) {
    const axios = require('axios');
    for (let i = 0; i < 8; i++) {
      const base = 'http://202.119.81.112:8080';
      const page = await axios.get(base + '/', { timeout: 8000 });
      const cookie = (page.headers['set-cookie'] || []).map(value => value.split(';')[0]).join('; ');
      const response = await axios.get(base + '/verifycode.servlet?t=' + Date.now(), {
        responseType: 'arraybuffer', timeout: 8000, headers: { Cookie: cookie, Referer: base + '/' }
      });
      const data = Buffer.from(response.data);
      await Jimp.read(data); // Reject HTML/errors before storing a fixture.
      await fs.writeFile(path.join(dir, i + '.jpg'), data);
    }
  }
  const files = (await fs.readdir(dir)).filter(file => /^\d+\.jpg$/.test(file)).sort();
  const worker = await require('tesseract.js').createWorker('eng', 1, { langPath: path.join(__dirname, '..'), gzip: false });
  await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' });
  const start = Date.now();
  const engine = await dddd.createEngine(require('onnxruntime-web/wasm'), await fs.readFile(path.join(__dirname, '../models/captcha/common_old.onnx')));
  console.log('ddddocr cold initialization ms:', Date.now() - start);
  const sheet = new Jimp({ width: 360, height: Math.max(1, files.length) * 140, color: 0xffffffff });
  try {
    for (const [i, file] of files.entries()) {
      const image = await Jimp.read(path.join(dir, file));
      const input = await fs.readFile(path.join(dir, file));
      const raw = (await worker.recognize(input)).data.text.trim();
      const started = Date.now();
      const text = await engine.recognize(image.bitmap);
      console.log(JSON.stringify({ file, original: raw, ddddocr: text, inferenceMs: Date.now() - started }));
      sheet.composite(image.resize({ w: 310, h: 110, mode: 'nearestNeighbor' }), 10, i * 140 + 10);
    }
    await sheet.write(path.join(dir, 'contact.png'));
  } finally { await worker.terminate(); await engine.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
