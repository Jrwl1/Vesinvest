import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'apps/web/src',
  'apps/api/src',
  'apps/api/prisma',
  'e2e',
];

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.json',
  '.prisma',
  '.sql',
  '.md',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.claude',
  'playwright-report',
  'test-results',
  'output',
]);

const MOJIBAKE_PATTERN = /(?:\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u024F]|\uFFFD)/u;
const MOJIBAKE_ALLOWLIST = new Set([
  path.normalize('apps/web/src/i18n/locale-encoding.test.ts'),
]);

const findings = [];

function walk(currentPath) {
  if (!fs.existsSync(currentPath)) return;

  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    checkFile(currentPath);
    return;
  }

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    walk(path.join(currentPath, entry.name));
  }
}

function checkFile(filePath) {
  const ext = path.extname(filePath);
  if (!EXTENSIONS.has(ext)) return;

  const raw = fs.readFileSync(filePath);
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    findings.push({
      type: 'bom',
      filePath,
      message: 'UTF-8 BOM detected',
    });
  }

  const normalized = path.normalize(filePath);
  if (MOJIBAKE_ALLOWLIST.has(normalized)) return;

  const text = raw.toString('utf8');
  const match = text.match(MOJIBAKE_PATTERN);
  if (!match) return;

  const index = match.index ?? 0;
  const line = text.slice(0, index).split(/\r?\n/).length;
  findings.push({
    type: 'mojibake',
    filePath,
    line,
    message: `Possible mojibake sequence "${match[0]}"`,
  });
}

for (const root of ROOTS) {
  walk(root);
}

if (findings.length > 0) {
  console.error('Text integrity check failed:\n');
  for (const finding of findings) {
    if (finding.type === 'bom') {
      console.error(`- [BOM] ${finding.filePath}: ${finding.message}`);
      continue;
    }
    console.error(`- [MOJIBAKE] ${finding.filePath}:${finding.line}: ${finding.message}`);
  }
  process.exit(1);
}

console.log('Text integrity check passed.');
