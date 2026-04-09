import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsPageV2 } from './ReportsPageV2';

const downloadReportPdfV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getReportV2 = vi.fn();
const listForecastScenariosV2 = vi.fn();
const listReportsV2 = vi.fn();

vi.mock('../api', () => ({
  downloadReportPdfV2: (...args: unknown[]) => downloadReportPdfV2(...args),
  getForecastScenarioV2: (...args: unknown[]) => getForecastScenarioV2(...args),
  getReportV2: (...args: unknown[]) => getReportV2(...args),
  listForecastScenariosV2: (...args: unknown[]) => listForecastScenariosV2(...args),
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
}));

describe('ReportsPageV2', () => {
  beforeEach(() => {
    downloadReportPdfV2.mockReset();
    getForecastScenarioV2.mockReset();
    getReportV2.mockReset();
    listForecastScenariosV2.mockReset();
    listReportsV2.mockReset();

    listReportsV2.mockResolvedValue([
      {
        id: 'report-1',
        title: 'Forecast report Water Utility 2026-04-09',
        createdAt: '2026-04-09T08:00:00.000Z',
        ennuste: { id: 'scenario-1', nimi: 'Water Utility Vesinvest v2' },
        baselineYear: 2024,
        requiredPriceToday: 3.2,
        requiredAnnualIncreasePct: 4.1,
        totalInvestments: 100000,
        baselineSourceSummary: null,
        variant: 'confidential_appendix',
        pdfUrl: '/v2/reports/report-1/pdf',
      },
    ]);
    getReportV2.mockResolvedValue({
      id: 'report-1',
      title: 'Forecast report Water Utility 2026-04-09',
      createdAt: '2026-04-09T08:00:00.000Z',
      baselineYear: 2024,
      requiredPriceToday: 3.2,
      requiredAnnualIncreasePct: 4.1,
      totalInvestments: 100000,
      ennuste: { id: 'scenario-1', nimi: 'Water Utility Vesinvest v2' },
      snapshot: {
        scenario: {
          id: 'scenario-1',
          name: 'Water Utility Vesinvest v2',
          baselineYear: 2024,
          requiredPriceTodayCombinedAnnualResult: 3.2,
          requiredAnnualIncreasePctAnnualResult: 4.1,
          requiredPriceTodayCombinedCumulativeCash: 3.4,
          requiredAnnualIncreasePctCumulativeCash: 4.8,
          baselinePriceTodayCombined: 2.8,
          assumptions: {},
          yearlyInvestments: [],
        },
        generatedAt: '2026-04-09T08:00:00.000Z',
        baselineSourceSummary: null,
        vesinvestPlan: {
          id: 'plan-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          versionNumber: 2,
        },
        vesinvestAppendix: {
          yearlyTotals: [
            { year: 2026, totalAmount: 100000 },
            { year: 2027, totalAmount: 50000 },
          ],
          fiveYearBands: [
            { startYear: 2026, endYear: 2030, totalAmount: 150000 },
          ],
          groupedProjects: [
            {
              reportGroupKey: 'network_rehabilitation',
              reportGroupLabel: 'Network rehabilitation',
              totalAmount: 150000,
              projects: [
                {
                  code: 'P-001',
                  name: 'Main rehabilitation',
                  groupKey: 'sanering_water_network',
                  groupLabel: 'Sanering / vattennatverk',
                  accountKey: 'sanering_water_network',
                  allocations: [
                    {
                      year: 2026,
                      totalAmount: 150000,
                      waterAmount: 150000,
                      wastewaterAmount: 0,
                    },
                  ],
                  totalAmount: 150000,
                },
              ],
            },
          ],
        },
        reportVariant: 'confidential_appendix',
        reportSections: {
          baselineSources: true,
          assumptions: true,
          yearlyInvestments: true,
          riskSummary: true,
        },
      },
      variant: 'confidential_appendix',
      pdfUrl: '/v2/reports/report-1/pdf',
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the Vesinvest revision source in report metadata when present', async () => {
    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={() => undefined}
        onFocusedReportChange={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(getReportV2).toHaveBeenCalledWith('report-1');
    });

    expect(await screen.findByText('Water Utility Vesinvest / v2')).toBeTruthy();
    expect(await screen.findByText('2026-2030')).toBeTruthy();
    expect(screen.getByText('Network rehabilitation')).toBeTruthy();
    expect(screen.getByText('sanering_water_network')).toBeTruthy();
    expect(screen.getByText('Sanering / vattennatverk')).toBeTruthy();
    expect(screen.getByText('Main rehabilitation')).toBeTruthy();
  });
});
