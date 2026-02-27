import { describe, expect, it } from 'vitest';

import fiRaw from './locales/fi.json?raw';
import svRaw from './locales/sv.json?raw';
import enRaw from './locales/en.json?raw';
import appShellV2Raw from '../v2/AppShellV2.tsx?raw';
import overviewPageV2Raw from '../v2/OverviewPageV2.tsx?raw';
import ennustePageV2Raw from '../v2/EnnustePageV2.tsx?raw';
import reportsPageV2Raw from '../v2/ReportsPageV2.tsx?raw';

const filesToCheck = [
  { name: 'fi.json', raw: fiRaw },
  { name: 'sv.json', raw: svRaw },
  { name: 'en.json', raw: enRaw },
  { name: 'AppShellV2.tsx', raw: appShellV2Raw },
  { name: 'OverviewPageV2.tsx', raw: overviewPageV2Raw },
  { name: 'EnnustePageV2.tsx', raw: ennustePageV2Raw },
  { name: 'ReportsPageV2.tsx', raw: reportsPageV2Raw },
] as const;

const mojibakePattern =
  /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u024F]|\uFFFD/;
const brokenNordicReplacementPattern =
  /[A-Za-z\u00C5\u00C4\u00D6\u00E5\u00E4\u00F6]\?[A-Za-z\u00C5\u00C4\u00D6\u00E5\u00E4\u00F6]/;

describe('locale and UI encoding integrity', () => {
  it('fails on known broken nordic mojibake samples', () => {
    expect(mojibakePattern.test('Ã…rlig fÃ¶rÃ¤ndring')).toBe(true);
    expect(mojibakePattern.test('Årlig förändring')).toBe(false);
    expect(brokenNordicReplacementPattern.test('myyty vesim?ara')).toBe(true);
    expect(brokenNordicReplacementPattern.test('myyty vesimäärä')).toBe(false);
  });

  for (const file of filesToCheck) {
    it(`${file.name} has no mojibake or broken nordic replacements`, () => {
      expect(file.raw, `mojibake found in ${file.name}`).not.toMatch(
        mojibakePattern,
      );
      expect(
        file.raw,
        `broken nordic replacement found in ${file.name}`,
      ).not.toMatch(brokenNordicReplacementPattern);
    });
  }
});
