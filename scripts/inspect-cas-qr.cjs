// Anonymous school QR probe; never accepts or prints user credentials/tokens.
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { spawnSync } = require('node:child_process');

(async () => {
  const { wrapper } = await import('axios-cookiejar-support');
  const client = wrapper(axios.create({ jar: new CookieJar(), timeout: 12000 }));
  await client.get('https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp');
  const token = await client.get('https://ids.njust.edu.cn/authserver/qrCode/getToken');
  const qr = await client.get('https://ids.njust.edu.cn/authserver/qrCode/getCode', {
    params: { uuid: String(token.data).trim() }, responseType: 'arraybuffer'
  });
  const decoder = spawnSync('python', ['-c', [
    'import sys, cv2, numpy as np',
    'from urllib.parse import urlsplit, parse_qs',
    'image = cv2.imdecode(np.frombuffer(sys.stdin.buffer.read(), np.uint8), cv2.IMREAD_COLOR)',
    'value, _, _ = cv2.QRCodeDetector().detectAndDecode(image)',
    'url = urlsplit(value)',
    'print(url.scheme + "://" + url.netloc + url.path)',
    'print("query keys:", list(parse_qs(url.query).keys()))'
  ].join('\n')], { input: Buffer.from(qr.data), encoding: 'utf8' });
  console.log('QR image:', qr.headers['content-type'], qr.data.length, 'bytes');
  console.log(decoder.stdout);
  if (decoder.status !== 0) throw new Error('QR decoder failed');
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
