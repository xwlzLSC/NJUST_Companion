const projectPaths = require('./fixtures/project-paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = process.env.NJUST_MINI_ROOT || projectPaths.mini("");
const cloudRoot = path.join(root, 'cloudfunctions/njustSync2');
const source = fs.readFileSync(path.join(cloudRoot, 'index.js'), 'utf8');
const tesseract = require(path.join(cloudRoot, 'node_modules/tesseract.js'));
let workers = 0;
const context = vm.createContext({
  require: createRequire(path.join(cloudRoot, 'index.js')), __dirname: cloudRoot, Buffer, process,
  captchaOcr: require('../js/captcha-ocr'),
  ddddOcr: require('../js/captcha-ddddocr'),
  cloud: { callFunction: async ({ data }) => ({ result: data.action === 'diagnostics'
    ? { ok: true, memoryLimitMB: 512, timeoutMS: 30000 }
    : { ok: true, text: 'vbcz' } }) },
  console,
  getTesseract: () => ({ createWorker: (...args) => { workers++; return tesseract.createWorker(...args); } }),
  cleanText: value => String(value || '').trim()
});
vm.runInContext('let globalOcrWorker=null; let ocrWorkerPromise=null; let ocrQueue=Promise.resolve(); let captchaEnginePromise=null; let dedicatedOcrStatus={checkedAt:0,ready:false};\n' +
  source.slice(source.indexOf('async function getOcrWorker()'), source.indexOf('async function submitClassicLogin')), context);
(async () => {
  const started = Date.now();
  const [first, second] = await Promise.all([context.getOcrWorker(), context.getOcrWorker()]);
  try {
    assert.equal(first, second);
    assert.equal(workers, 1);
    const image = fs.readFileSync(path.join(__dirname, 'fixtures/captcha/vbcz.png'));
    const texts = await Promise.all([context.solveCaptchaOCR(image), context.solveCaptchaOCR(image)]);
    assert.equal(texts[0], texts[1]);
    assert.equal(texts[0], 'vbcz');
    const secondImage = fs.readFileSync(path.join(__dirname, 'fixtures/captcha/cn3b.png'));
    assert.equal(await context.solveCaptchaOCR(secondImage), 'cn3b');
    assert.equal(await context.canUseDedicatedOcr(), true);
    assert.equal(await context.solveCaptchaOCR(image, true), 'vbcz');
    console.log('Bundled OCR initialized once; concurrent recognition passed; elapsed ms:', Date.now() - started);
  } finally {
    await first.terminate();
    await (await context.getCaptchaEngine()).close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
