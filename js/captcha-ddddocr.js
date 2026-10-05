/** @maintenance
 * ddddocr 模型适配器：RGBA 图像缩放成单通道输入，ONNX 推理后执行字符序列解码。
 * common_old.onnx 是模型名称，不是应删除的历史缓存；模型及许可证随部署保留。
 * 推理通过队列串行执行，模型/字体映射需配套；不要对同一推理会话无限并发，也不要记录验证码原图或账号密码。
 */
/* ddddocr common_old.onnx adapter. Model/charset attribution: models/captcha/LICENSE. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NJUSTDdddOCR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CHARSET = {0:'',78:'2',357:'F',409:'7',687:'D',747:'M',761:'C',806:'r',821:'Y',1066:'b',1107:'c',1583:'J',1614:'I',1638:'f',1769:'v',2041:'i',2089:'l',2203:'B',2525:'E',2663:'u',2879:'9',3072:'k',3466:'s',3930:'P',3963:'Z',4050:'n',4410:'1',4488:'G',4617:'m',4666:'K',4730:'z',4771:'A',4810:'W',5027:'p',5046:'T',5225:'X',5418:'O',5554:'H',5726:'d',5734:'V',5806:'4',5961:'6',6185:'j',6216:'N',6257:'e',6386:'S',6601:'Q',6612:'y',6672:'L',6736:'x',6749:'0',6939:'o',6977:'5',6979:'8',7136:'w',7198:'a',7262:'R',7284:'U',7405:'q',7721:'3',7723:'t',8119:'g',8196:'h'};

  /** @maintenance
   * 限制输入尺寸并按比例缩放，透明像素按白底处理，输出 NCHW 的浮点灰度张量；模型输入高度与训练时保持一致。
   */
  function tensorPixels({ width, height, data }) {
    if (width < 3 || height < 3 || width > 1024 || height > 512) throw new Error('验证码尺寸异常');
    const targetHeight = 64, targetWidth = Math.max(1, Math.floor(width * 64 / height));
    if (targetWidth > 1024) throw new Error('验证码宽高比异常');
    const values = new Float32Array(targetWidth * targetHeight);
    const gray = (x, y) => {
      const i = (y * width + x) * 4, alpha = data[i + 3] / 255;
      return ((.299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2]) * alpha + 255 * (1 - alpha)) / 255;
    };
    for (let y = 0; y < targetHeight; y++) {
      const sy = Math.max(0, Math.min(height - 1, (y + .5) * height / targetHeight - .5));
      const y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), fy = sy - y0;
      for (let x = 0; x < targetWidth; x++) {
        const sx = Math.max(0, Math.min(width - 1, (x + .5) * width / targetWidth - .5));
        const x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), fx = sx - x0;
        values[y * targetWidth + x] = (gray(x0, y0) * (1 - fx) + gray(x1, y0) * fx) * (1 - fy)
          + (gray(x0, y1) * (1 - fx) + gray(x1, y1) * fx) * fy;
      }
    }
    return { values, dims: [1, 1, targetHeight, targetWidth] };
  }

  /** @maintenance
   * 执行 CTC 解码：过滤 blank，合并连续重复字符，最终只接受合理长度的字母数字；未知字符索引返回空结果。
   */
  function decode(indices) {
    let text = '', previous = -1;
    for (const value of indices) {
      const index = Number(value);
      if (!Number.isInteger(index) || !Object.prototype.hasOwnProperty.call(CHARSET, index)) return '';
      if (index !== previous && index !== 0) text += CHARSET[index];
      previous = index;
    }
    return /^[A-Za-z0-9]{4,6}$/.test(text) ? text : '';
  }

  /** @maintenance
   * 加载模型并建立串行推理队列。每次任务失败后仍恢复队列，避免一次识别异常令后续识别全部阻塞。
   */
  async function createEngine(ort, model) {
    ort.env.wasm.numThreads = 1; // Works without cross-origin isolation in WebView/Cloud Functions.
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], logSeverityLevel: 3 });
    let queue = Promise.resolve();
    return {
      recognize(pixels) {
        const run = queue.then(async () => {
          const { values, dims } = tensorPixels(pixels);
          const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', values, dims) });
          const result = output[session.outputNames[0]];
          // common_old declares [1, sequence] but returns [sequence, 1, classes]
          // on current ONNX runtimes. Decode the actual tensor, not model metadata.
          if (result.dims.length === 3) {
            const classes = result.dims[2], indices = [];
            for (let offset = 0; offset < result.data.length; offset += classes) {
              let best = 0;
              for (let i = 1; i < classes; i++) if (result.data[offset + i] > result.data[offset + best]) best = i;
              indices.push(best);
            }
            return decode(indices);
          }
          return decode(result.data);
        });
        queue = run.catch(() => {});
        return run;
      },
      close: () => session.release()
    };
  }

  let browserEnginePromise;
  function browserEngine() {
    if (!browserEnginePromise) browserEnginePromise = (async () => {
      const native = Boolean(window.Capacitor && window.Capacitor.isNativePlatform());
      const base = new URL(native ? './vendor/onnxruntime/' : './node_modules/onnxruntime-web/dist/', location.href).href;
      if (!window.ort) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = base + 'ort.wasm.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('验证码识别模型未能加载'));
        document.head.appendChild(script);
      });
      window.ort.env.wasm.wasmPaths = base;
      return createEngine(window.ort, new URL('./models/captcha/common_old.onnx', location.href).href);
    })();
    return browserEnginePromise;
  }

  async function recognizeBrowser(url) {
    const engine = await browserEngine();
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve; image.onerror = () => reject(new Error('验证码图片无法解码')); image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return engine.recognize(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }
  return { createEngine, tensorPixels, decode, browserEngine, recognizeBrowser };
});
