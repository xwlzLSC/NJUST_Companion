// Anonymous live check of the public catalogue and the undeployed cloud
// handler. No academic login, database writes, upload or user credentials.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { requestLibrary } = require('../integrations/library/server.cjs');
const core = require('../js/library-core');
const MINI = process.env.MINI_PROGRAM_ROOT || 'E:/NJUST_companion';
const schoolRequire = createRequire(path.join(MINI, 'cloudfunctions/njustSync2/index.js'));
const cloudExports = {};
const context = {
  exports: cloudExports, module: { exports: cloudExports }, console, setTimeout, clearTimeout,
  require: name => name === './library-core'
    ? require(path.join(MINI, 'cloudfunctions/njustLibrary/library-core.js')) : schoolRequire(name)
};
vm.runInNewContext(fs.readFileSync(path.join(MINI, 'cloudfunctions/njustLibrary/index.js'), 'utf8'), context);
async function main() {
  const web = await requestLibrary('search', { query: '高等数学' });
  const cloud = await cloudExports.main({ action: 'search', query: '高等数学' });
  if (!cloud.ok) throw new Error(cloud.error);
  if (!web.result.books.length || !cloud.result.books.length) throw new Error('live search did not produce books');
  const first = web.result.books[0];
  const details = await cloudExports.main({ action: 'detail', id: first.id });
  if (!details.ok) throw new Error(details.error);
  const page2 = await requestLibrary('search', { query: '高等数学', page: 2 });
  if (!page2.result.books.length || page2.result.books[0].id === first.id) throw new Error('pagination did not advance');
  console.log(JSON.stringify({
    ok: true, libraryRevision: core.REVISION,
    search: { count: web.result.books.length, total: web.result.totalCount, firstTitle: first.title,
      callNo: first.callNo, authorPresent: !!first.author, publisherPresent: !!first.publisher },
    cloudMatches: cloud.result.books[0].id === first.id && cloud.result.totalCount === web.result.totalCount,
    page2: { count: page2.result.books.length, page: page2.result.page },
    detail: { isbn: details.result.isbn, copies: details.result.locations.length,
      hasLocations: details.result.locations.some(item => item.location),
      hasStatuses: details.result.locations.every(item => item.status),
      available: details.result.availableCount }
  }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
