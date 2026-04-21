import path from 'node:path';

export const REPO_ROOTS = ['apps/web', 'apps/api', 'packages'];

export const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.scss',
]);

export const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.git',
  'playwright-report',
  'test-results',
  'output',
]);

export const RUNTIME_LINE_CAP = 800;
export const TEST_LINE_CAP = 1500;
export const CSS_LINE_CAP = 1500;
export const THIN_FACADE_LINE_CAP = 250;

export const THIN_FACADE_ALLOWLIST = new Set([
  'apps/api/src/v2/test-support/v2ServiceLegacySuites.ts',
  'apps/web/src/api.ts',
  'apps/web/src/api/v2.ts',
  'apps/web/src/api/v2/types.ts',
  'apps/web/src/legacy-app.css',
  'apps/web/src/legacy-assets.css',
  'apps/web/src/legacy-operations.css',
  'apps/web/src/legacy-shared.css',
  'apps/web/src/v2/test-support/appShellV2TestSupport.tsx',
  'apps/web/src/v2/test-support/ennustePageV2TestSupport.tsx',
  'apps/web/src/v2/test-support/overviewPageV2TestSupport.tsx',
  'apps/web/src/v2/test-support/reportsPageV2TestSupport.tsx',
  'apps/web/src/v2/test-support/vesinvestPlanningPanelTestSupport.tsx',
  'apps/web/src/v2/v2.css',
  'apps/web/src/v2/v2-overview.css',
  'apps/web/src/v2/v2-shared.css',
]);

export function normalizeRepoPath(filePath) {
  return filePath.split(path.sep).join('/');
}

export function isScannedFile(repoPath) {
  if (repoPath.endsWith('.d.ts')) {
    return false;
  }
  return SCANNED_EXTENSIONS.has(path.extname(repoPath));
}

export function isCssFile(repoPath) {
  return /\.(css|scss)$/i.test(repoPath);
}

export function isTestLikeFile(repoPath) {
  return (
    /(^|\/)test-support\//.test(repoPath) ||
    /\.(spec|test)\.[jt]sx?$/i.test(repoPath)
  );
}

export function getLineCap(repoPath) {
  if (isCssFile(repoPath)) {
    return CSS_LINE_CAP;
  }
  if (isTestLikeFile(repoPath)) {
    return TEST_LINE_CAP;
  }
  return RUNTIME_LINE_CAP;
}
