import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const requiredFiles = [
  'docs/index.md',
  'docs/product/index.md',
  'docs/architecture/index.md',
  'docs/architecture/boundaries.md',
  'docs/quality/index.md',
  'docs/quality/gates.md',
  'docs/harness/index.md',
  'docs/harness/local-dev.md',
  'docs/harness/browser-validation.md',
  'docs/harness/observability.md',
  'docs/harness/ci.md',
  'docs/exec-plans/index.md',
  'docs/generated/index.md',
];

const scannedRoots = [
  'docs/index.md',
  'docs/product',
  'docs/architecture',
  'docs/quality',
  'docs/harness',
  'docs/exec-plans',
  'docs/generated',
];

const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)|`([^`]+\.md)`/g;

function fail(message) {
  console.error(`[check-docs-index] ${message}`);
  process.exitCode = 1;
}

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function collectMarkdownFiles(entryPath, files = []) {
  if (!fs.existsSync(entryPath)) {
    return files;
  }

  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    if (entryPath.endsWith('.md')) {
      files.push(entryPath);
    }
    return files;
  }

  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    collectMarkdownFiles(path.join(entryPath, entry.name), files);
  }
  return files;
}

function linkTargetExists(filePath, rawTarget) {
  if (
    rawTarget.startsWith('http://') ||
    rawTarget.startsWith('https://') ||
    rawTarget.startsWith('#') ||
    rawTarget.startsWith('mailto:')
  ) {
    return true;
  }

  const withoutAnchor = rawTarget.split('#')[0];
  if (!withoutAnchor || withoutAnchor.startsWith('app://')) {
    return true;
  }

  const baseDir = path.dirname(filePath);
  const absoluteTarget = path.resolve(baseDir, withoutAnchor);
  if (fs.existsSync(absoluteTarget)) {
    return true;
  }

  const repoRelativeTarget = path.resolve(repoRoot, withoutAnchor);
  return fs.existsSync(repoRelativeTarget);
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    fail(`Missing required indexed doc ${relativePath}.`);
  }
}

for (const root of scannedRoots) {
  const absoluteRoot = path.join(repoRoot, root);
  for (const filePath of collectMarkdownFiles(absoluteRoot)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const relativeFile = normalizeSlashes(path.relative(repoRoot, filePath));
    let match;
    while ((match = markdownLinkPattern.exec(source)) !== null) {
      const rawTarget = match[1] ?? match[2];
      if (!rawTarget || rawTarget.includes('*')) {
        continue;
      }
      if (!linkTargetExists(filePath, rawTarget)) {
        fail(`${relativeFile} links to missing target ${rawTarget}.`);
      }
    }
  }
}

if (!process.exitCode) {
  console.log('Docs index check passed.');
}
