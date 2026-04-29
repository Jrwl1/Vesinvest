import { describe, expect, it } from 'vitest';

import {
  buildDefaultReportTitle,
  buildDefaultScenarioName,
  getReportDisplayTitle,
  getScenarioDisplayName,
} from './displayNames';

const t = (key: string, defaultValue?: string) => {
  if (key === 'v2Forecast.defaultScenarioPrefix') return 'Scenario';
  if (key === 'v2Reports.defaultTitlePrefix') return 'Forecast report';
  if (key === 'v2Reports.variantInternal') return 'Internal appendix';
  return defaultValue ?? key;
};

describe('displayNames', () => {
  it('builds ISO-dated default scenario names', () => {
    expect(buildDefaultScenarioName(t as never, '2026-03-19T10:30:00.000Z')).toBe(
      'Scenario 2026-03-19',
    );
  });

  it('localizes legacy default scenario names into the current display format', () => {
    expect(getScenarioDisplayName('Skenaario 19.3.2026', t as never)).toBe(
      'Scenario 2026-03-19',
    );
  });

  it('avoids duplicating the date when the scenario name already carries the default date token', () => {
    expect(
      buildDefaultReportTitle(
        t as never,
        'Skenaario 19.3.2026',
        '2026-03-19T10:30:00.000Z',
      ),
    ).toBe('Forecast report Scenario 2026-03-19');
  });

  it('rewrites legacy default report titles into the current display format', () => {
    expect(
      getReportDisplayTitle({
        title: 'Ennusteraportti Skenaario 19.3.2026 19.3.2026',
        scenarioName: 'Skenaario 19.3.2026',
        createdAt: '2026-03-19T10:30:00.000Z',
        t: t as never,
      }),
    ).toBe('Forecast report Scenario 2026-03-19');
  });

  it('rewrites generated package report titles while preserving the package label', () => {
    const svT = (key: string, defaultValue?: string) => {
      if (key === 'v2Forecast.defaultScenarioPrefix') return 'Scenario';
      if (key === 'v2Reports.defaultTitlePrefix') return 'Prognosrapport';
      if (key === 'v2Reports.variantInternal') return 'Intern bilaga';
      return defaultValue ?? key;
    };

    expect(
      getReportDisplayTitle({
        title: 'Forecast report Scenario 2026-03-19 - Internal appendix',
        scenarioName: 'Scenario 2026-03-19',
        createdAt: '2026-03-19T10:30:00.000Z',
        t: svT as never,
      }),
    ).toBe('Prognosrapport Scenario 2026-03-19 - Intern bilaga');
  });
});
