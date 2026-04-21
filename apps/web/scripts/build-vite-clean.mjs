import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.platform === 'win32' ? 'cmd.exe' : 'pnpm',
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm exec vite build']
    : ['exec', 'vite', 'build'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  console.error('[build-vite-clean] Failed to start vite build.', result.error);
  process.exit(1);
}

const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (
  combinedOutput.includes('[plugin:vite:reporter]') ||
  /\(\!\)/.test(combinedOutput)
) {
  console.error('[build-vite-clean] Build emitted warnings and must stay warning-free.');
  process.exit(1);
}
