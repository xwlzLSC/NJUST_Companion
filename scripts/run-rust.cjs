const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const projectRoot = join(__dirname, '..');
const userProfile = process.env.USERPROFILE || process.env.HOME || '';
const cargoHome = process.env.CARGO_HOME || join(userProfile, '.cargo');
const rustupHome = process.env.RUSTUP_HOME || join(projectRoot, '.rustup');
const cargoExecutable = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const bundledCargo = join(cargoHome, 'bin', cargoExecutable);

const command = existsSync(bundledCargo) ? bundledCargo : cargoExecutable;
const environment = {
  ...process.env,
  RUSTUP_HOME: rustupHome,
  PATH: `${join(cargoHome, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`
};

const cargoArgs = process.argv.slice(2);
const defaultArgs = ['run', '--release', '--manifest-path', 'rust-server/Cargo.toml'];
const child = spawn(command, cargoArgs.length ? cargoArgs : defaultArgs, {
  cwd: projectRoot,
  env: environment,
  stdio: 'inherit'
});

child.on('error', error => {
  if (error.code === 'ENOENT') {
    console.error('未找到 Rust/Cargo。请安装 Rust： https://rustup.rs/ ，然后重新打开 PowerShell。');
    process.exitCode = 1;
    return;
  }
  throw error;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
