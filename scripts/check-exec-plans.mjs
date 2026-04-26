import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const requiredPaths = [
  'docs/exec-plans/active',
  'docs/exec-plans/completed',
  'docs/exec-plans/templates/feature.md',
  'docs/exec-plans/templates/bugfix.md',
  'docs/exec-plans/templates/audit.md',
];

const requiredPlanHeadings = [
  '## Goal',
  '## Verification',
  '## Evidence',
];

function fail(message) {
  console.error(`[check-exec-plans] ${message}`);
  process.exitCode = 1;
}

function collectPlans(directoryPath, files = []) {
  if (!fs.existsSync(directoryPath)) {
    return files;
  }

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectPlans(entryPath, files);
      continue;
    }
    if (entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

for (const relativePath of requiredPaths) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    fail(`Missing required execution-plan path ${relativePath}.`);
  }
}

const sprintPath = path.join(repoRoot, 'docs/SPRINT.md');
if (fs.existsSync(sprintPath)) {
  const sprintSource = fs.readFileSync(sprintPath, 'utf8');
  if (!sprintSource.includes('Retired Sprint Queue')) {
    fail('docs/SPRINT.md must remain a retired pointer, not an active queue.');
  }
}

for (const area of ['active', 'completed']) {
  const planDir = path.join(repoRoot, 'docs/exec-plans', area);
  for (const filePath of collectPlans(planDir)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const relativeFile = path.relative(repoRoot, filePath).split(path.sep).join('/');
    for (const heading of requiredPlanHeadings) {
      if (!source.includes(heading)) {
        fail(`${relativeFile} is missing ${heading}.`);
      }
    }
  }
}

if (!process.exitCode) {
  console.log('Execution plan check passed.');
}

