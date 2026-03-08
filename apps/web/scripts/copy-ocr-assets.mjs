import { mkdir, copyFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const publicRoot = path.join(appRoot, 'public', 'vendor', 'tesseract');
const coreTargetDir = path.join(publicRoot, 'core');
const require = createRequire(import.meta.url);

async function findPackageDir(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    const pnpmStoreDir = path.join(repoRoot, 'node_modules', '.pnpm');
    const entries = await readdir(pnpmStoreDir, { withFileTypes: true });
    const packageEntry = entries.find(
      (entry) => entry.isDirectory() && entry.name.startsWith(`${packageName}@`),
    );
    if (!packageEntry) {
      throw new Error(`Unable to locate ${packageName} in pnpm store.`);
    }
    const packageDir = path.join(
      pnpmStoreDir,
      packageEntry.name,
      'node_modules',
      packageName,
    );
    await access(packageDir);
    return packageDir;
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function copyWorker() {
  const tesseractPackageDir = await findPackageDir('tesseract.js');
  const workerSource = path.join(tesseractPackageDir, 'dist', 'worker.min.js');
  await ensureDir(publicRoot);
  await copyFile(workerSource, path.join(publicRoot, 'worker.min.js'));
}

async function copyCoreAssets() {
  const coreSourceDir = await findPackageDir('tesseract.js-core');
  await ensureDir(coreTargetDir);
  const files = await readdir(coreSourceDir, { withFileTypes: true });
  const assetNames = files
    .filter(
      (entry) =>
        entry.isFile() &&
        /^tesseract-core.*\.(js|wasm)$/.test(entry.name),
    )
    .map((entry) => entry.name);

  await Promise.all(
    assetNames.map((name) =>
      copyFile(path.join(coreSourceDir, name), path.join(coreTargetDir, name)),
    ),
  );
}

await copyWorker();
await copyCoreAssets();
