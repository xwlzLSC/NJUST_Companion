/** @maintenance
 * 浏览器/APK 验证码图像预处理与识别调度，优先使用可用本地模型，再按当前实现降级。
 * 一次识别要绑定一次验证码会话；改善 OCR 不应通过不断后台换图来提高命中率，否则手工输入会失效。
 */
/* Shared browser/Node captcha preprocessing. See Tesseract's ImproveQuality guide. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NJUSTCaptchaOCR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const INIT = { load_system_dawg: '0', load_freq_dawg: '0' };
  const PARAMETERS = {
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    user_defined_dpi: '300'
  };

  function variants({ width, height, data }) {
    if (!width || !height || width > 1024 || height > 512) throw new Error('验证码图片尺寸异常');
    const scale = 3, padding = 10;
    // Remove the one-pixel frame, not character strokes inside the image.
    const w = (width - 2) * scale + padding * 2;
    const h = (height - 2) * scale + padding * 2;
    return [null, 170].map(threshold => {
      const stride = Math.ceil(w * 3 / 4) * 4;
      const bytes = new Uint8Array(54 + stride * h);
      const header = new DataView(bytes.buffer);
      bytes[0] = 66; bytes[1] = 77;
      header.setUint32(2, bytes.length, true);
      header.setUint32(10, 54, true);
      header.setUint32(14, 40, true);
      header.setInt32(18, w, true);
      header.setInt32(22, h, true);
      header.setUint16(26, 1, true);
      header.setUint16(28, 24, true);
      bytes.fill(255, 54);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3] / 255;
          let value = (data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114) * alpha + 255 * (1 - alpha);
          if (threshold !== null) value = value < threshold ? 0 : 255;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const offset = 54 + (h - 1 - (padding + (y - 1) * scale + dy)) * stride + (padding + (x - 1) * scale + dx) * 3;
              bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = Math.round(value);
            }
          }
        }
      }
      return bytes;
    });
  }

  async function recognize(worker, images, encode = value => value) {
    const votes = new Map();
    // All passes inspect the SAME challenge; never fetch a new image here.
    for (let i = 0; i < 3; i++) {
      await worker.setParameters({ ...PARAMETERS, tessedit_pageseg_mode: i === 2 ? '13' : '7' });
      const result = await worker.recognize(encode(images[i === 2 ? 0 : i]));
      const raw = String(result.data.text || '').trim().replace(/\s/g, '');
      if (!/^[A-Za-z0-9]{4,6}$/.test(raw)) continue;
      const confidence = Number(result.data.confidence) || 0;
      const vote = votes.get(raw) || { text: raw, count: 0, confidence: 0 };
      vote.count++;
      vote.confidence = Math.max(vote.confidence, confidence);
      votes.set(raw, vote);
      if (vote.count >= 2 || (i === 0 && confidence >= 85)) return raw;
    }
    const best = [...votes.values()].sort((a, b) => b.count - a.count || b.confidence - a.confidence)[0];
    return best && best.confidence >= 35 ? best.text : '';
  }

  async function browserVariants(url) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('验证码图片无法解码，请刷新'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return variants(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  function browserEncode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return 'data:image/bmp;base64,' + btoa(binary);
  }
  return { INIT, PARAMETERS, variants, recognize, browserVariants, browserEncode };
});
