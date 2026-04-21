import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SSE_USAGE_PATTERNS = [
  /@Sse\(/,
  /\bSse\b/,
  /text\/event-stream/,
  /\bEventSource\b/,
  /sse-stream/,
];

const ALLOWLIST = {
  '1116226': {
    title: '@nestjs/core SSE newline injection',
    guard: async () => !(await repoUsesSse()),
    rationale:
      'The advisory is limited to Nest SSE response handling. This repo has no SSE endpoints or EventSource consumers.',
  },
};

async function main() {
  const audit = runAudit();
  const advisories = Object.values(audit.advisories ?? {});

  if (advisories.length === 0) {
    process.stdout.write(audit.stdout);
    process.exit(0);
  }

  const blocked = [];
  const allowed = [];

  for (const advisory of advisories) {
    const allowEntry = ALLOWLIST[String(advisory.id)];
    if (!allowEntry) {
      blocked.push(advisory);
      continue;
    }

    const allowedHere = await allowEntry.guard();
    if (allowedHere) {
      allowed.push({
        advisory,
        rationale: allowEntry.rationale,
      });
      continue;
    }

    blocked.push(advisory);
  }

  if (blocked.length > 0) {
    process.stderr.write(audit.stdout);
    process.stderr.write('\n[audit:prod] Blocking advisories remain.\n');
    for (const advisory of blocked) {
      process.stderr.write(
        ` - ${advisory.id} ${advisory.module_name}: ${advisory.title}\n`,
      );
    }
    process.exit(1);
  }

  process.stdout.write('[audit:prod] Allowlisted advisories:\n');
  for (const entry of allowed) {
    process.stdout.write(
      ` - ${entry.advisory.id} ${entry.advisory.module_name}: ${entry.rationale}\n`,
    );
  }
}

function runAudit() {
  const result = spawnSync('pnpm', ['audit', '--prod', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = (result.stdout ?? '').trim();
  if (!stdout) {
    throw new Error('pnpm audit --prod --json returned no JSON output');
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Failed to parse pnpm audit JSON output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { ...parsed, stdout: `${stdout}\n` };
}

async function repoUsesSse() {
  const roots = ['apps/api/src', 'apps/web/src', 'packages'];
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(repoRoot, relativeRoot);
    if (await directoryContainsSseUsage(absoluteRoot)) {
      return true;
    }
  }
  return false;
}

async function directoryContainsSseUsage(directoryPath) {
  let entries;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (await directoryContainsSseUsage(absolutePath)) {
        return true;
      }
      continue;
    }

    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      continue;
    }

    const source = await fs.readFile(absolutePath, 'utf8');
    if (SSE_USAGE_PATTERNS.some((pattern) => pattern.test(source))) {
      return true;
    }
  }

  return false;
}

main().catch((error) => {
  console.error('[audit:prod] unexpected failure', error);
  process.exit(1);
});
