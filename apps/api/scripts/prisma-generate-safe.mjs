import { spawnSync } from 'node:child_process';

import {
  appRoot,
  cleanupTempEngineFiles,
  hasHealthyGeneratedClient,
} from './prisma-client-health.mjs';

const MAX_GENERATE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

async function main() {
  if (process.platform === 'win32') {
    const cleanup = await cleanupTempEngineFiles();
    if (cleanup.failed.length > 0) {
      console.error(
        '[prisma-generate-safe] Failed to remove stale Prisma engine temp files before generate.',
      );
      for (const item of cleanup.failed) {
        console.error(` - ${item.fileName}`);
      }
      process.exit(1);
    }
  }

  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt += 1) {
    const result = runPrismaGenerate();

    lastResult = result;

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
      if (await hasHealthyGeneratedClient()) {
        process.exit(0);
      }

      console.error(
        '[prisma-generate-safe] Prisma generate completed, but the generated client failed artifact or schema validation.',
      );
      process.exit(1);
    }

    if (!isWindowsEngineRenameIssue(result) || process.platform !== 'win32') {
      process.exit(result.status ?? 1);
    }

    const cleanup = await cleanupTempEngineFiles();
    if (cleanup.failed.length > 0) {
      console.error(
        '[prisma-generate-safe] Prisma generate hit a Windows engine rename lock and stale temp files could not be removed.',
      );
      process.exit(result.status ?? 1);
    }

    if (attempt < MAX_GENERATE_ATTEMPTS) {
      console.warn(
        `[prisma-generate-safe] Prisma generate hit a Windows engine rename lock. Retrying (${attempt}/${MAX_GENERATE_ATTEMPTS})...`,
      );
      await delay(RETRY_DELAY_MS * attempt);
    }
  }

  if (lastResult && isWindowsEngineRenameIssue(lastResult) && process.platform === 'win32') {
    const noEngineResult = runPrismaGenerate({ noEngine: true });
    if (noEngineResult.status === 0 && (await hasHealthyGeneratedClient())) {
      console.warn(
        '[prisma-generate-safe] Prisma generate hit a Windows engine rename lock. A no-engine generate refreshed the client code and schema while keeping the current engine binary.',
      );
      process.exit(0);
    }
  }

  process.exit(lastResult?.status ?? 1);
}

function runPrismaGenerate(options = {}) {
  const env = { ...process.env };
  if (options.noEngine) {
    env.PRISMA_GENERATE_NO_ENGINE = '1';
  } else {
    delete env.PRISMA_GENERATE_NO_ENGINE;
  }

  const result = spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : 'pnpm',
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'pnpm exec prisma generate']
      : ['exec', 'prisma', 'generate'],
    {
      cwd: appRoot,
      encoding: 'utf8',
      env,
      shell: false,
      stdio: 'pipe',
    },
  );

  if (result.error) {
    console.error('[prisma-generate-safe] Failed to start prisma generate', result.error);
    process.exit(1);
  }

  return result;
}

function isWindowsEngineRenameIssue(result) {
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return (
    combinedOutput.includes('EPERM: operation not permitted, rename') &&
    combinedOutput.includes('query_engine-windows.dll.node')
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error('[prisma-generate-safe] unexpected failure', error);
  process.exit(1);
});
