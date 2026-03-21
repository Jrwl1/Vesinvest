import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const prismaClientDir = path.join(
  appRoot,
  '..',
  '..',
  'node_modules',
  '.pnpm',
  '@prisma+client@5.22.0_prisma@5.22.0',
  'node_modules',
  '.prisma',
  'client',
);

function hasGeneratedClient() {
  return (
    fs.existsSync(path.join(prismaClientDir, 'index.d.ts')) &&
    fs.existsSync(path.join(prismaClientDir, 'index.js'))
  );
}

const result = spawnSync(
  process.platform === 'win32' ? 'cmd.exe' : 'pnpm',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm exec prisma generate']
    : ['exec', 'prisma', 'generate'],
  {
  cwd: appRoot,
  encoding: 'utf8',
  shell: false,
  stdio: 'pipe',
  },
);

if (result.error) {
  console.error('[prisma-generate-safe] Failed to start prisma generate', result.error);
  process.exit(1);
}

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  process.exit(0);
}

const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const isWindowsEngineRenameIssue =
  process.platform === 'win32' &&
  combinedOutput.includes('EPERM: operation not permitted, rename') &&
  combinedOutput.includes('query_engine-windows.dll.node');

if (isWindowsEngineRenameIssue && hasGeneratedClient()) {
  console.warn(
    '[prisma-generate-safe] Prisma generate hit a Windows engine rename lock, but an existing generated client is present. Continuing with the current client.',
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
