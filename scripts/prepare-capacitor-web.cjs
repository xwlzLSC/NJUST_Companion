const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'mobile-web');

async function copyDir(sourceRelative, targetRelative = sourceRelative) {
  const source = path.join(ROOT_DIR, sourceRelative);
  const target = path.join(OUTPUT_DIR, targetRelative);
  await fs.cp(source, target, { recursive: true, force: true });
}

async function copyFile(sourceRelative, targetRelative = sourceRelative) {
  const source = path.join(ROOT_DIR, sourceRelative);
  const target = path.join(OUTPUT_DIR, targetRelative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  await copyDir('css');
  await copyDir('icons');
  await copyDir('js');
  await copyFile('index.html');
  await copyFile('manifest.json');
  await copyFile('announcement.json');
  await copyFile('sw.js');
  await copyFile('node_modules/tesseract.js/dist/tesseract.min.js', 'vendor/tesseract/tesseract.min.js');
  await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'vendor/tesseract/worker.min.js');
  await copyFile('node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'vendor/tesseract-core/tesseract-core-lstm.wasm.js');
  await copyFile('node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'vendor/tesseract-core/tesseract-core-lstm.wasm');
  await copyFile('eng.traineddata', 'vendor/tesseract-data/eng.traineddata');

  const capacitorSource = path.join(ROOT_DIR, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js');
  const capacitorTarget = path.join(OUTPUT_DIR, 'js', 'capacitor.js');
  await fs.mkdir(path.dirname(capacitorTarget), { recursive: true });
  await fs.copyFile(capacitorSource, capacitorTarget);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
