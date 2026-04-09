const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT_DIR, 'android');

function findFirstExisting(paths) {
  return paths.find(item => item && fs.existsSync(item)) || '';
}

function findJdk21Home() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))) {
    return process.env.JAVA_HOME;
  }

  const microsoftDir = path.join('C:', 'Program Files', 'Microsoft');
  if (fs.existsSync(microsoftDir)) {
    const entries = fs.readdirSync(microsoftDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^jdk-21/i.test(entry.name))
      .map(entry => path.join(microsoftDir, entry.name));
    const jdk = findFirstExisting(entries.map(item => path.join(item, 'bin', 'java.exe')).map(item => path.dirname(path.dirname(item))));
    if (jdk) return jdk;
  }

  return '';
}

function normalizeSdkDir(value) {
  return String(value || '').replace(/\\/g, '\\\\');
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
      stdio: 'inherit',
      shell: options.shell || false,
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
  const sdkRoot = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  if (!sdkRoot || !fs.existsSync(sdkRoot)) {
    throw new Error('未找到 Android SDK，请先安装到 %LOCALAPPDATA%\\Android\\Sdk 或设置 ANDROID_HOME');
  }

  const javaHome = findJdk21Home();
  if (!javaHome) {
    throw new Error('未找到 JDK 21，请先安装 Microsoft.OpenJDK.21 或设置 JAVA_HOME');
  }

  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    PATH: `${path.join(javaHome, 'bin')};${path.join(sdkRoot, 'platform-tools')};${process.env.PATH || ''}`
  };

  await fsp.writeFile(
    path.join(ANDROID_DIR, 'local.properties'),
    `sdk.dir=${normalizeSdkDir(sdkRoot)}\n`,
    'utf8'
  );

  await run('npm', ['run', 'android:sync'], { cwd: ROOT_DIR, env, shell: true });
  await run('gradlew.bat', ['assembleDebug'], { cwd: ANDROID_DIR, env, shell: true });
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
