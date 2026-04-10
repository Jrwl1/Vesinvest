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
          assumptions: {
            perusmaksuMuutos: 0.05,
          },
          years: [
            {
              year: 2026,
              soldVolume: 100000,
              totalDepreciation: 45000,
            },
            {
              year: 2027,
              soldVolume: 99500,
              totalDepreciation: 47000,
            },
            {
              year: 2028,
              soldVolume: 99000,
              totalDepreciation: 49000,
            },
            {
              year: 2029,
              soldVolume: 98500,
              totalDepreciation: 50500,
            },
            {
              year: 2030,
              soldVolume: 98000,
              totalDepreciation: 52000,
            },
          ],
          nearTermExpenseAssumptions: [
            {
              year: 2026,
              personnelPct: 2,
              energyPct: 3,
              opexOtherPct: 1,
            },
          ],
          thereafterExpenseAssumptions: {
            personnelPct: 2,
            energyPct: 2.5,
            opexOtherPct: 1.5,
          },
          yearlyInvestments: [],
        },
        generatedAt: '2026-04-09T08:00:00.000Z',
        acceptedBaselineYears: [2022, 2023, 2024],
        baselineSourceSummaries: [
          {
            year: 2022,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              manualDataTypes: [],
            },
            financials: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
            prices: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
            volumes: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
          },
          {
            year: 2023,
            planningRole: 'historical',
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa'],
              manualDataTypes: ['tilinpaatos'],
            },
            financials: {
              source: 'manual',
              provenance: {
                kind: 'document_import',
                fileName: 'baseline-2023.pdf',
                pageNumbers: [3, 4],
                sourceLines: [
                  { pageNumber: 3, text: 'Revenue 95 000 EUR' },
                  { pageNumber: 4, text: 'Operating costs 70 000 EUR' },
                ],
              },
              editedAt: '2026-04-09T08:00:00.000Z',
              editedBy: 'planner@example.com',
              reason: 'Reviewed',
            },
            prices: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
            volumes: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
          },
          {
            year: 2024,
            planningRole: 'historical',
            sourceStatus: 'MANUAL',
            sourceBreakdown: {
              veetiDataTypes: ['taksa'],
              manualDataTypes: ['tilinpaatos', 'volume_vesi'],
            },
            financials: {
              source: 'manual',
              provenance: {
                kind: 'statement_import',
                fileName: 'baseline-2024.pdf',
              },
              editedAt: '2026-04-09T08:00:00.000Z',
              editedBy: 'planner@example.com',
              reason: 'Reviewed',
            },
            prices: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
            volumes: {
              source: 'manual',
              provenance: {
                kind: 'excel_import',
                fileName: 'kva-2024.xlsx',
              },
              editedAt: '2026-04-09T08:00:00.000Z',
              editedBy: 'planner@example.com',
              reason: 'Reviewed',
            },
          },
        ],
        baselineSourceSummary: {
          year: 2024,
          planningRole: 'historical',
          sourceStatus: 'MANUAL',
          sourceBreakdown: {
            veetiDataTypes: ['taksa'],
            manualDataTypes: ['tilinpaatos', 'volume_vesi'],
          },
          financials: {
            source: 'manual',
            provenance: {
              kind: 'statement_import',
              fileName: 'baseline-2024.pdf',
            },
            editedAt: '2026-04-09T08:00:00.000Z',
            editedBy: 'planner@example.com',
            reason: 'Reviewed',
          },
          prices: {
            source: 'veeti',
            provenance: null,
            editedAt: null,
            editedBy: null,
            reason: null,
          },
          volumes: {
            source: 'manual',
            provenance: {
              kind: 'excel_import',
              fileName: 'kva-2024.xlsx',
            },
            editedAt: '2026-04-09T08:00:00.000Z',
            editedBy: 'planner@example.com',
            reason: 'Reviewed',
          },
        },
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
            { year: 2028, totalAmount: 0 },
            { year: 2029, totalAmount: 0 },
            { year: 2030, totalAmount: 0 },
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
          investmentPlan: true,
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
    expect(await screen.findByText('2022, 2023, 2024')).toBeTruthy();
    expect((await screen.findAllByText('2026-2030')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Mistä hinta muodostuu')).toBeTruthy();
    expect((await screen.findAllByText('Perusmaksun muutos')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('5,00 %')).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/Source document \(baseline-2023\.pdf\).+pp\. 3, 4/),
    ).toBeTruthy();
    expect(await screen.findByText(/Revenue 95 000 EUR/)).toBeTruthy();
    expect(await screen.findByText(/Operating costs 70 000 EUR/)).toBeTruthy();
    expect(await screen.findByText('Työkirjaimportti (kva-2024.xlsx)')).toBeTruthy();
    expect(await screen.findByText('2026-2030 (5)')).toBeTruthy();
    expect(screen.getByText('Network rehabilitation')).toBeTruthy();
    expect(screen.getByText('sanering_water_network')).toBeTruthy();
    expect(screen.getByText('Sanering / vattennatverk')).toBeTruthy();
    expect(screen.getByText('Main rehabilitation')).toBeTruthy();
  });

  it('keeps detailed assumption rows out of the public summary tariff card', async () => {
    listReportsV2.mockResolvedValueOnce([
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
        variant: 'public_summary',
        pdfUrl: '/v2/reports/report-1/pdf',
      },
    ]);
    getReportV2.mockResolvedValueOnce({
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
          assumptions: {
            perusmaksuMuutos: 0.05,
          },
          years: [
            {
              year: 2026,
              soldVolume: 100000,
              totalDepreciation: 45000,
            },
          ],
          nearTermExpenseAssumptions: [
            {
              year: 2026,
              personnelPct: 2,
              energyPct: 3,
              opexOtherPct: 1,
            },
          ],
          thereafterExpenseAssumptions: {
            personnelPct: 2,
            energyPct: 2.5,
            opexOtherPct: 1.5,
          },
          yearlyInvestments: [],
        },
        generatedAt: '2026-04-09T08:00:00.000Z',
        acceptedBaselineYears: [2024],
        baselineSourceSummary: {
          year: 2024,
          planningRole: 'historical',
          sourceStatus: 'VEETI',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
            manualDataTypes: [],
          },
          financials: {
            source: 'veeti',
            provenance: null,
            editedAt: null,
            editedBy: null,
            reason: null,
          },
          prices: {
            source: 'veeti',
            provenance: null,
            editedAt: null,
            editedBy: null,
            reason: null,
          },
          volumes: {
            source: 'veeti',
            provenance: null,
            editedAt: null,
            editedBy: null,
            reason: null,
          },
        },
        baselineSourceSummaries: [],
        vesinvestPlan: {
          id: 'plan-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          versionNumber: 2,
        },
        vesinvestAppendix: {
          yearlyTotals: [{ year: 2026, totalAmount: 100000 }],
          fiveYearBands: [
            { startYear: 2026, endYear: 2026, totalAmount: 100000 },
          ],
          groupedProjects: [],
        },
        reportVariant: 'public_summary',
        reportSections: {
          baselineSources: true,
          investmentPlan: true,
          assumptions: false,
          yearlyInvestments: false,
          riskSummary: true,
        },
      },
      variant: 'public_summary',
      pdfUrl: '/v2/reports/report-1/pdf',
    } as any);

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

    expect(await screen.findByText(/Mist/)).toBeTruthy();
    expect(screen.queryByText('Perusmaksun muutos')).toBeNull();
    expect(screen.queryByText('5,00 %')).toBeNull();
    expect(screen.getAllByText('2026-2026').length).toBeGreaterThan(0);
  });

  it('keeps the statement filename visible when workbook repair is mixed into the same report dataset', async () => {
    getReportV2.mockResolvedValueOnce({
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
          years: [{ year: 2026, soldVolume: 100000, totalDepreciation: 45000 }],
          nearTermExpenseAssumptions: [],
          thereafterExpenseAssumptions: {
            personnelPct: 2,
            energyPct: 2.5,
            opexOtherPct: 1.5,
          },
          yearlyInvestments: [],
        },
        generatedAt: '2026-04-09T08:00:00.000Z',
        acceptedBaselineYears: [2024],
        baselineSourceSummaries: [
          {
            year: 2024,
            planningRole: 'historical',
            sourceStatus: 'MANUAL',
            sourceBreakdown: {
              veetiDataTypes: [],
              manualDataTypes: ['tilinpaatos'],
            },
            financials: {
              source: 'manual',
              provenance: {
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                fieldSources: [
                  {
                    sourceField: 'Liikevaihto',
                    provenance: {
                      kind: 'statement_import',
                      fileName: 'bokslut-2024.pdf',
                    },
                  },
                  {
                    sourceField: 'Poistot',
                    provenance: {
                      kind: 'excel_import',
                      fileName: 'kva-2024.xlsx',
                    },
                  },
                ],
              },
              editedAt: '2026-04-09T08:00:00.000Z',
              editedBy: 'planner@example.com',
              reason: 'Reviewed',
            },
            prices: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
            volumes: {
              source: 'veeti',
              provenance: null,
              editedAt: null,
              editedBy: null,
              reason: null,
            },
          },
        ],
        baselineSourceSummary: null,
        vesinvestPlan: {
          id: 'plan-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          versionNumber: 2,
        },
        vesinvestAppendix: {
          yearlyTotals: [{ year: 2026, totalAmount: 100000 }],
          fiveYearBands: [
            { startYear: 2026, endYear: 2026, totalAmount: 100000 },
          ],
          groupedProjects: [],
        },
        reportVariant: 'confidential_appendix',
        reportSections: {
          baselineSources: true,
          investmentPlan: true,
          assumptions: true,
          yearlyInvestments: true,
          riskSummary: true,
        },
      },
      variant: 'confidential_appendix',
      pdfUrl: '/v2/reports/report-1/pdf',
    } as any);

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={() => undefined}
        onFocusedReportChange={() => undefined}
      />,
    );

    expect((await screen.findAllByText(/bokslut-2024\.pdf/)).length).toBeGreaterThan(0);
  });
});
