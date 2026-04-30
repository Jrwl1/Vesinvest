import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  displayValidationAssetEvidenceNote,
  displayValidationProjectName,
  displayValidationProjectNote,
  displayValidationProjectSubtype,
  displayValidationTariffEvidenceNote,
  displayValidationTariffRiskNote,
} from './validationDisplayText';

const t = ((_: string, fallback: string) => fallback) as TFunction;

describe('validation display text', () => {
  it('replaces validation placeholders and stale bad-encoding payloads', () => {
    expect(
      displayValidationProjectName(t, 'Ledningsn\u00e4t saneering 2026-2030'),
    ).toBe('Network rehabilitation 2026-2030');
    expect(displayValidationProjectSubtype(t, 'network_rehabilitation')).toBe(
      'Network rehabilitation',
    );
    expect(displayValidationProjectSubtype(t, 'N?tsanering')).toBe(
      'Network rehabilitation',
    );
    expect(
      displayValidationProjectNote(
        t,
        'Plausible 20-year investment programme for audit flow.',
      ),
    ).toBe('Investment programme reviewed for the active plan.');
    expect(
      displayValidationProjectNote(
        t,
        'Investeringsprogrammet har granskats f?r den aktiva planen.',
      ),
    ).toBe('Investment programme reviewed for the active plan.');
    expect(
      displayValidationAssetEvidenceNote(
        t,
        'Reviewed during live deployment audit.',
      ),
    ).toBe('Evidence reviewed for the active plan.');
    expect(
      displayValidationTariffEvidenceNote(
        t,
        'Reviewed during live deployment audit.',
      ),
    ).toBe('Evidence reviewed for the active tariff plan.');
    expect(
      displayValidationTariffEvidenceNote(
        t,
        'Underlaget har granskats f?r den aktiva avgiftsplanen.',
      ),
    ).toBe('Evidence reviewed for the active tariff plan.');
    expect(
      displayValidationTariffRiskNote(
        t,
        'Moderate risk; monitor affordability, liquidity, and staged implementation.',
      ),
    ).toBe('Monitor affordability, liquidity, and staged implementation.');
  });
});
