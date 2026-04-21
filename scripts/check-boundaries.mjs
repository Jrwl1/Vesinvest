import { spawnSync } from 'node:child_process';

const args = [
  'exec',
  'depcruise',
  '--config',
  '.dependency-cruiser.cjs',
  '--output-type',
  'err-long',
  'apps/web/src',
  'apps/api/src',
  'packages/domain/src',
];

const result = spawnSync(
  process.platform === 'win32' ? 'cmd.exe' : 'pnpm',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', `pnpm ${args.join(' ')}`]
    : args,
  {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  console.error('[check-boundaries] Failed to start dependency-cruiser.', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
