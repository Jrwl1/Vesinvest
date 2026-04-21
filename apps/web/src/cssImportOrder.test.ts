/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readCssBarrel = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const getCssImports = (relativePath: string) =>
  [...readCssBarrel(relativePath).matchAll(/@import\s+['"](.+?)['"];/g)].map(
    (match) => match[1],
  );

describe('css import order barrels', () => {
  it.each([
    [
      './legacy-app.css',
      [
        './legacy-auth.css',
        './legacy-shared.css',
        './legacy-assets.css',
        './legacy-operations.css',
        './legacy-admin.css',
      ],
    ],
    ['./legacy-assets.css', ['./legacy-assets-overview.css']],
    [
      './legacy-operations.css',
      [
        './legacy-operations-import.css',
        './legacy-operations-import-complete.css',
        './legacy-operations-projection-calm.css',
        './legacy-operations-import-method.css',
        './legacy-operations-import-workbook.css',
        './legacy-operations-budget.css',
        './legacy-operations-forecast-layout.css',
        './legacy-operations-forecast-results.css',
        './legacy-operations-forecast-reporting.css',
        './legacy-operations-budget-import.css',
        './legacy-operations-forecast-refresh.css',
        './legacy-operations-veeti.css',
      ],
    ],
    [
      './legacy-shared.css',
      [
        './legacy-shared-foundation.css',
        './legacy-shared-language.css',
        './legacy-shared-print.css',
      ],
    ],
    [
      './v2/v2.css',
      [
        './v2-shell.css',
        './v2-vesinvest.css',
        './v2-overview.css',
        './v2-reports.css',
        './v2-forecast.css',
        './v2-shared.css',
      ],
    ],
    [
      './v2/v2-overview.css',
      [
        './v2-overview-workspace.css',
        './v2-overview-review.css',
        './v2-overview-handoff.css',
      ],
    ],
    ['./v2/v2-shared.css', ['./v2-shared-core.css', './v2-shared-layout.css']],
  ])('keeps %s imports stable', (relativePath, expectedImports) => {
    expect(getCssImports(relativePath)).toEqual(expectedImports);
  });
});
