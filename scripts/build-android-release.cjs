const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT_DIR, 'android');

function normalizeSdkDir(value) {
  return String(value || '').replace(/\\/g, '\\\\');
}

function resolveCommand(command) {
  if (process.platform === 'win32') {
    if (command === 'npm') return 'npm.cmd';
    if (command === 'gradlew') return 'gradlew.bat';
  }
  return command;
}

function findSdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '',
    process.env.HOME ? path.join(process.env.HOME, 'Android', 'Sdk') : ''
  ].filter(Boolean);
  return candidates.find(item => fs.existsSync(item)) || '';
}

function hasReleaseSigningConfig() {
  const keystoreProperties = path.join(ANDROID_DIR, 'keystore.properties');
  if (fs.existsSync(keystoreProperties)) return true;
  return [
    process.env.ANDROID_SIGNING_STORE_FILE,
    process.env.ANDROID_SIGNING_STORE_PASSWORD,
    process.env.ANDROID_SIGNING_KEY_ALIAS,
    process.env.ANDROID_SIGNING_KEY_PASSWORD
  ].every(Boolean);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveCommand(command), args, {
      cwd: options.cwd || ROOT_DIR,
      stdio: 'inherit',
      shell: options.shell ?? false,
      env: options.env || process.env
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} 失败，退出码 ${code}`));
    });
  });
}

async function main() {
  const sdkRoot = findSdkRoot();
  if (!sdkRoot) {
    throw new Error('未找到 Android SDK，请先设置 ANDROID_HOME / ANDROID_SDK_ROOT');
  }

  if (!process.env.JAVA_HOME) {
    throw new Error('未找到 JAVA_HOME，请先安装 JDK 21 并设置 JAVA_HOME');
  }

  if (!hasReleaseSigningConfig()) {
    throw new Error('未找到 release 签名配置，请准备 android/keystore.properties 或设置 ANDROID_SIGNING_* 环境变量');
  }

  const env = {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    PATH: process.platform === 'win32'
      ? `${path.join(process.env.JAVA_HOME, 'bin')};${path.join(sdkRoot, 'platform-tools')};${process.env.PATH || ''}`
      : `${path.join(process.env.JAVA_HOME, 'bin')}:${path.join(sdkRoot, 'platform-tools')}:${process.env.PATH || ''}`
  };

  await fsp.writeFile(
    path.join(ANDROID_DIR, 'local.properties'),
    `sdk.dir=${normalizeSdkDir(sdkRoot)}\n`,
    'utf8'
  );

  await run('npm', ['run', 'android:sync'], {
    cwd: ROOT_DIR,
    env,
    shell: process.platform === 'win32'
  });

  await run(process.platform === 'win32' ? 'gradlew' : './gradlew', ['assembleRelease'], {
    cwd: ANDROID_DIR,
    env,
    shell: process.platform === 'win32'
  });
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
