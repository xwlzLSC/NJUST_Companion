// Anonymous, read-only school connectivity probe. Never prints challenge tokens or cookies.
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
(async () => {
  const { wrapper } = await import('axios-cookiejar-support');
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, timeout: 12000, headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36'
  } }));
  const page = await client.get('https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp');
  console.log('CAS QR form:', /id=["']qrLoginForm/.test(page.data));
  const casPage = new URL(page.request.res.responseUrl);
  const academicService = new URL(casPage.searchParams.get('service'));
  console.log('Academic service:', academicService.origin + academicService.pathname);
  if (process.argv.includes('--cookie-scopes')) {
    const saved = await jar.serialize();
    console.log('Anonymous cookie scopes:', saved.cookies.map(cookie => ({
      name: cookie.key, domain: cookie.domain, path: cookie.path,
      httpOnly: Boolean(cookie.httpOnly), secure: Boolean(cookie.secure)
    })));
    return;
  }
  const response = await client.get('https://ids.njust.edu.cn/authserver/qrCode/getToken');
  const uuid = String(response.data).trim().replace(/^['"]|['"]$/g, '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(uuid)) throw new Error('invalid anonymous challenge');
  const image = await client.get('https://ids.njust.edu.cn/authserver/qrCode/getCode', {
    params: { uuid }, responseType: 'arraybuffer'
  });
  console.log('QR image:', image.status, image.headers['content-type'], image.data.length, 'bytes');
  const status = await client.get('https://ids.njust.edu.cn/authserver/qrCode/getStatus.htl', { params: { uuid } });
  console.log('Anonymous state:', String(status.data));
})().catch(error => { console.error(error.code || 'School probe failed'); process.exitCode = 1; });
