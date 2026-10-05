const projectPaths = require('./fixtures/project-paths.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(projectPaths.apk("js/native-sync.js"), 'utf8');
const profileSection = source.slice(source.indexOf('const PROFILE = {'), source.indexOf('function createEmptyData('));
const routeSection = source.slice(source.indexOf('function resolveBusinessBase('), source.indexOf('function isValidCaptchaCode('));
const context = vm.createContext({
  nativeState: { username: '', entryOrigin: 'http://202.119.81.112:8080' },
  uniqueUrls: values => [...new Set(values.filter(Boolean))]
});
vm.runInContext(profileSection + routeSection, context);

const official = context.classicEntryPaths('https://bkjw.njust.edu.cn');
assert.equal(official.loginPagePath, '/njlgdx/framework/main.jsp');
assert.equal(official.captchaPath, '/njlgdx/verifycode.servlet');
assert.equal(official.loginPath, '/njlgdx/xk/Verifyservlet');

const legacy = context.classicEntryPaths('http://202.119.81.113:8080');
assert.equal(legacy.loginPagePath, '/');
assert.equal(legacy.loginPath, '/Logon.do?method=logon');

assert.equal(context.getEntryOriginCandidates('1')[0], 'https://bkjw.njust.edu.cn');
assert.equal(context.getEntryOriginCandidates('2')[0], 'http://202.119.81.113:8080');
console.log('PASS: Android native route selection and official HTTPS fallback');
