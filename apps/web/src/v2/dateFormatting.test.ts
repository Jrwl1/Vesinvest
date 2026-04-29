import { afterEach, describe, expect, it } from 'vitest';

import { formatScenarioUpdatedAt as formatForecastScenarioUpdatedAt } from './forecastModel';
import { formatScenarioUpdatedAt as formatReportScenarioUpdatedAt } from './reportReadinessModel';

describe('V2 date formatting', () => {
  const date = '2026-04-29T08:00:00.000Z';

  afterEach(() => {
    document.documentElement.lang = 'fi';
    localStorage.clear();
  });

  it('formats forecast and report dates with the active Swedish locale', () => {
    document.documentElement.lang = 'sv';

    expect(formatForecastScenarioUpdatedAt(date)).toBe('29 apr. 2026');
    expect(formatReportScenarioUpdatedAt(date)).toBe('29 apr. 2026');
  });

  it('falls back to the saved app language when the document language is unavailable', () => {
    document.documentElement.lang = '';
    localStorage.setItem('va_language', 'en');

    expect(formatReportScenarioUpdatedAt(date)).toBe('Apr 29, 2026');
  });
});
