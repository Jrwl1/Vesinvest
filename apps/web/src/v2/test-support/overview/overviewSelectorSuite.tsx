import { describe, expect, it } from 'vitest';
import { pickDefaultBaselineYears } from '../../overviewSelectors';

export function registerPickDefaultBaselineYearsSuite() {
  describe('pickDefaultBaselineYears', () => {
    it('prefers the newest four-year consecutive historical run', () => {
      expect(
        pickDefaultBaselineYears([
          { vuosi: 2026, planningRole: 'current_year_estimate' },
          { vuosi: 2025, planningRole: 'historical' },
          { vuosi: 2024, planningRole: 'historical' },
          { vuosi: 2023, planningRole: 'historical' },
          { vuosi: 2022, planningRole: 'historical' },
          { vuosi: 2019, planningRole: 'historical' },
        ]),
      ).toEqual([2025, 2024, 2023, 2022]);
    });

    it('falls back to the longest available consecutive historical run when four years do not exist', () => {
      expect(
        pickDefaultBaselineYears([
          { vuosi: 2026, planningRole: 'current_year_estimate' },
          { vuosi: 2025, planningRole: 'historical' },
          { vuosi: 2023, planningRole: 'historical' },
          { vuosi: 2022, planningRole: 'historical' },
          { vuosi: 2021, planningRole: 'historical' },
        ]),
      ).toEqual([2023, 2022, 2021]);
    });
  });
}
