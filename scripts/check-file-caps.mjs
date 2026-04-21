import fs from 'node:fs';
import path from 'node:path';

import {
  REPO_ROOTS,
  SKIP_DIRS,
  getLineCap,
  isScannedFile,
  normalizeRepoPath,
} from './repo-health-config.mjs';

function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  const lines = text.split(/\r\n|\r|\n/);
  return /(?:\r\n|\r|\n)$/.test(text) ? lines.length - 1 : lines.length;
}

function walk(dirPath, findings) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(absolutePath, findings);
      continue;
    }

    const repoPath = normalizeRepoPath(absolutePath);
    if (!isScannedFile(repoPath)) {
      continue;
    }

    const lineCount = countLines(fs.readFileSync(absolutePath, 'utf8'));
    const cap = getLineCap(repoPath);
    if (lineCount > cap) {
      findings.push({ repoPath, lineCount, cap });
    }
  }
}

const findings = [];
for (const root of REPO_ROOTS) {
  if (!fs.existsSync(root)) {
    continue;
  }
  walk(root, findings);
}

if (findings.length > 0) {
  findings.sort((left, right) => right.lineCount - left.lineCount);
  console.error('File cap check failed:\n');
  for (const finding of findings) {
    console.error(
      `- ${finding.repoPath}: ${finding.lineCount} lines (cap ${finding.cap})`,
    );
  }
  process.exit(1);
}

console.log('File cap check passed.');
