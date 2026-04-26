import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const agentMapPath = path.join(repoRoot, 'AGENTS.md');
const MAX_LINES = 130;

const requiredLinks = [
  'docs/index.md',
  'docs/product/index.md',
  'docs/architecture/index.md',
  'docs/quality/index.md',
  'docs/harness/index.md',
  'docs/exec-plans/active/',
  'docs/exec-plans/completed/',
  'docs/generated/index.md',
];

const retiredProtocolHeadings = [
  '## Mode Router',
  '## HUMANAUDIT',
  '## PLAN',
  '## RUNSPRINT',
  '### Allowed writes',
  '### Forbidden touch',
];

function fail(message) {
  console.error(`[check-agent-map] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(agentMapPath)) {
  fail('AGENTS.md is missing.');
  process.exit();
}

const source = fs.readFileSync(agentMapPath, 'utf8');
const lineCount = source.trimEnd().split(/\r?\n/).length;

if (lineCount > MAX_LINES) {
  fail(`AGENTS.md has ${lineCount} lines; cap is ${MAX_LINES}.`);
}

for (const link of requiredLinks) {
  if (!source.includes(link)) {
    fail(`AGENTS.md must link to ${link}.`);
  }

  const targetPath = path.join(repoRoot, link);
  if (!fs.existsSync(targetPath)) {
    fail(`AGENTS.md links to missing path ${link}.`);
  }
}

for (const heading of retiredProtocolHeadings) {
  if (source.includes(heading)) {
    fail(`AGENTS.md still contains retired protocol heading "${heading}".`);
  }
}

if (!source.includes('This file is the short entry point')) {
  fail('AGENTS.md must identify itself as the short entry point.');
}

if (!process.exitCode) {
  console.log('Agent map check passed.');
}

