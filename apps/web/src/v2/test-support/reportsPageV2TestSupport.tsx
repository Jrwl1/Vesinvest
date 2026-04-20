import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsPageV2 } from '../ReportsPageV2';

const downloadReportPdfV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getReportV2 = vi.fn();
const listForecastScenariosV2 = vi.fn();
const listReportsV2 = vi.fn();

vi.mock('../../api', () => ({
  downloadReportPdfV2: (...args: unknown[]) => downloadReportPdfV2(...args),
  getForecastScenarioV2: (...args: unknown[]) => getForecastScenarioV2(...args),
  getReportV2: (...args: unknown[]) => getReportV2(...args),
  listForecastScenariosV2: (...args: unknown[]) => listForecastScenariosV2(...args),
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
}));


export function registerReportsPageV2PreviewDetailSuite() {
  describe('ReportsPageV2 preview detail', () => {
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
          yearlyInvestments: [
            {
              year: 2026,
              amount: 150000,
              depreciationClassKey: 'sanering_water_network',
              depreciationRuleSnapshot: {
                assetClassKey: 'sanering_water_network',
                assetClassName: 'Sanering / vattennatverk',
                method: 'straight-line',
                linearYears: 40,
                residualPercent: null,
              },
            },
          ],
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
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              totalAmount: 150000,
              projects: [
                {
                  code: 'P-001',
                  name: 'Main rehabilitation',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennätverk',
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
          depreciationPlan: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              accountKey: 'sanering_water_network',
              serviceSplit: 'water',
              method: 'straight-line',
              linearYears: 40,
              residualPercent: null,
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
    expect((await screen.findAllByText('Hyväksytyt pohjavuodet')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('2022, 2023, 2024')).length).toBeGreaterThan(0);
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
    expect(
      screen.queryByText('Lähivuosien kuluoletukset (muokattava)'),
    ).toBeNull();
    expect(screen.getAllByText('Vesiverkon saneeraus').length).toBeGreaterThan(1);
    expect(screen.getByText('Main rehabilitation')).toBeTruthy();
    expect(screen.getByText('Poistosuunnitelma')).toBeTruthy();
    expect(screen.getAllByText('Tasapoisto 40 vuotta').length).toBeGreaterThan(1);
    expect(screen.getByText('Vesi')).toBeTruthy();
    expect(screen.queryByText('Sanering / vattennatverk')).toBeNull();
  });

  it('keeps the left rail as a lightweight report chooser', async () => {
    listReportsV2.mockResolvedValueOnce([
      {
        id: 'report-1',
        title: 'Forecast report Board review 2026-04-09',
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

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={() => undefined}
        onFocusedReportChange={() => undefined}
      />,
    );

    const reportRow = (await screen.findByText(
      /Forecast report Board review 2026-04-09/i,
    )).closest('.v2-report-row') as HTMLElement;
    const railSummary = document.querySelector('.v2-reports-list-summary') as HTMLElement;
    const rowMeta = reportRow.querySelector('.v2-report-row-meta') as HTMLElement;

    expect(within(reportRow).getByText('Forecast report Board review 2026-04-09')).toBeTruthy();
    expect(rowMeta.textContent).toContain('Water Utility Vesinvest v2');
    expect(within(reportRow).getByText(/2024/)).toBeTruthy();
    expect(
      within(reportRow).queryByText('Required price today (annual result = 0)'),
    ).toBeNull();
    expect(within(reportRow).queryByText('Investments')).toBeNull();
    expect(within(railSummary).queryByText('Selected report')).toBeNull();
  });

  it('promotes the selected report preview and keeps source-level detail behind disclosure chrome', async () => {
    const { container } = render(
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

    expect(
      container.querySelector('.v2-reports-layout')?.className,
    ).toContain('has-selected-report');
    expect(
      container.querySelector('.v2-reports-preview-card')?.className,
    ).toContain('v2-reports-preview-card-primary');
    expect(
      container.querySelector('.v2-reports-list-card')?.className,
    ).toContain('v2-reports-list-card-secondary');
    expect((await screen.findAllByText('Tekniset lähdetiedot')).length).toBeGreaterThan(0);
  });

  it('keeps the reports list hint anchored to saved reports when reports already exist', async () => {
    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={() => undefined}
        onFocusedReportChange={() => undefined}
        savedFeePathReportConflictActive={true}
        savedFeePathPlanId="plan-1"
      />,
    );

    expect(
      await screen.findByText(
        'Tarkista tallennetut raportit, variantit ja PDF-viennin tila.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Avaa Ennuste, laske skenaario ja luo ensimmäinen raportti.',
      ),
    ).toBeNull();
  });

  it('keeps detailed assumption and investment rows out of the public summary preview', async () => {
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
          groupedProjects: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              totalAmount: 100000,
              projects: [
                {
                  code: 'P-001',
                  name: 'Main rehabilitation',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennätverk',
                  accountKey: 'sanering_water_network',
                  allocations: [
                    {
                      year: 2026,
                      totalAmount: 100000,
                      waterAmount: 100000,
                      wastewaterAmount: 0,
                    },
                  ],
                  totalAmount: 100000,
                },
              ],
            },
          ],
          depreciationPlan: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              accountKey: 'sanering_water_network',
              serviceSplit: 'water',
              method: 'straight-line',
              linearYears: 40,
              residualPercent: null,
            },
          ],
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
    expect(screen.queryByText('Koko vuositason taulukko')).toBeNull();
    expect(screen.queryByText('Poistosuunnitelma')).toBeNull();
    expect(screen.queryByText('Main rehabilitation')).toBeNull();
    expect(screen.getByText('Vesiverkon saneeraus')).toBeTruthy();
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
          depreciationPlan: [],
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
}

export function registerReportsPageV2ExportReadinessSuite() {
  describe('ReportsPageV2 export readiness', () => {
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
          yearlyInvestments: [
            {
              year: 2026,
              amount: 150000,
              depreciationClassKey: 'sanering_water_network',
              depreciationRuleSnapshot: {
                assetClassKey: 'sanering_water_network',
                assetClassName: 'Sanering / vattennatverk',
                method: 'straight-line',
                linearYears: 40,
                residualPercent: null,
              },
            },
          ],
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
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              totalAmount: 150000,
              projects: [
                {
                  code: 'P-001',
                  name: 'Main rehabilitation',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennätverk',
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
          depreciationPlan: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              accountKey: 'sanering_water_network',
              serviceSplit: 'water',
              method: 'straight-line',
              linearYears: 40,
              residualPercent: null,
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

  it('disables export and drops the ready helper when preview differs from the saved variant', async () => {
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

    expect(
      await screen.findByText('Tallennettu raportti on valmis vietäväksi.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Julkinen yhteenveto' }));

    await waitFor(() => {
      expect(screen.getAllByText('Lataa PDF')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Lataa PDF' }).hasAttribute('disabled'),
      ).toBe(true);
      expect(
        screen.getByText(/PDF-vienti.+tallennettua raporttiversiota/u),
      ).toBeTruthy();
      expect(
        screen.queryByText('Tallennettu raportti on valmis vietäväksi.'),
      ).toBeNull();
    });
  });

  it('keeps the saved report title in the document header', async () => {
    const { container } = render(
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

    const documentHeader = container.querySelector('.v2-reports-document-header');
    expect(documentHeader?.textContent).toContain(
      'Ennusteraportti Water Utility Vesinvest v2 2026-04-09',
    );
    expect(documentHeader?.textContent).toContain('Luotu esikatselu');
  });

  it('prefers the fetched saved report title over the list summary title in the document header', async () => {
    listReportsV2.mockResolvedValueOnce([
      {
        id: 'report-1',
        title: 'Outdated list title',
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

    const { container } = render(
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

    const documentHeader = container.querySelector('.v2-reports-document-header');
    expect(documentHeader?.textContent).toContain(
      'Ennusteraportti Water Utility Vesinvest v2 2026-04-09',
    );
    expect(documentHeader?.textContent).not.toContain('Outdated list title');
  });

  it('disables export when the saved report has no PDF available', async () => {
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
          assumptions: { perusmaksuMuutos: 0.05 },
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
        baselineSourceSummaries: [],
        baselineSourceSummary: null,
        vesinvestPlan: null,
        vesinvestAppendix: null,
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
      pdfUrl: null,
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

    expect(
      screen.getByRole('button', { name: 'Lataa PDF' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByText(/PDF-vienti on.+poissa käytöstä/u),
    ).toBeTruthy();
  });

  it('keeps the unavailable export message authoritative when preview also differs from the saved variant', async () => {
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
          assumptions: { perusmaksuMuutos: 0.05 },
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
        baselineSourceSummaries: [],
        baselineSourceSummary: null,
        vesinvestPlan: null,
        vesinvestAppendix: null,
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
      pdfUrl: null,
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

    fireEvent.click(screen.getByRole('button', { name: 'Julkinen yhteenveto' }));

    await waitFor(() => {
      expect(
        screen.getByText(/PDF-vienti on.+poissa käytöstä/u),
      ).toBeTruthy();
      expect(
        screen.queryByText(/PDF-vienti.+tallennettua raporttiversiota/u),
      ).toBeNull();
    });
  });

  it('drops the ready helper while a PDF export is in flight', async () => {
    downloadReportPdfV2.mockReturnValue(
      new Promise(() => undefined),
    );

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

    expect(
      await screen.findByText('Tallennettu raportti on valmis vietäväksi.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Lataa PDF' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ladataan PDF...' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Ladataan PDF...' }).hasAttribute('disabled'),
      ).toBe(true);
      expect(
        screen.queryByText('Tallennettu raportti on valmis vietäväksi.'),
      ).toBeNull();
    });
  });

  it('derives accepted baseline years from saved baseline provenance when the explicit list is missing', async () => {
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
        baselineSourceSummaries: [
          {
            year: 2024,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos'],
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
            year: 2022,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos'],
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
        ],
        baselineSourceSummary: {
          year: 2024,
          planningRole: 'historical',
          sourceStatus: 'VEETI',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos'],
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
        vesinvestPlan: {
          id: 'plan-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          versionNumber: 2,
        },
        vesinvestAppendix: {
          yearlyTotals: [{ year: 2026, totalAmount: 100000 }],
          fiveYearBands: [],
          groupedProjects: [],
          depreciationPlan: [],
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

    expect((await screen.findAllByText('2022, 2024')).length).toBeGreaterThan(0);
  });

  });
}

export function registerReportsPageV2RoutingEmptyStateSuite() {
  describe('ReportsPageV2 routing and empty state', () => {
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
          yearlyInvestments: [
            {
              year: 2026,
              amount: 150000,
              depreciationClassKey: 'sanering_water_network',
              depreciationRuleSnapshot: {
                assetClassKey: 'sanering_water_network',
                assetClassName: 'Sanering / vattennatverk',
                method: 'straight-line',
                linearYears: 40,
                residualPercent: null,
              },
            },
          ],
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
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              totalAmount: 150000,
              projects: [
                {
                  code: 'P-001',
                  name: 'Main rehabilitation',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennätverk',
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
          depreciationPlan: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              accountKey: 'sanering_water_network',
              serviceSplit: 'water',
              method: 'straight-line',
              linearYears: 40,
              residualPercent: null,
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

  it('uses the readiness-derived empty-state hint when a computed scenario is ready but no reports exist', async () => {
    listReportsV2.mockResolvedValueOnce([]);
    listForecastScenariosV2.mockResolvedValueOnce([
      {
        id: 'scenario-1',
        name: 'Water Utility Vesinvest v2',
      },
    ]);
    getForecastScenarioV2.mockResolvedValueOnce({
      id: 'scenario-1',
      name: 'Water Utility Vesinvest v2',
      baselineYear: 2024,
      updatedAt: '2026-04-09T08:00:00.000Z',
      computedAt: '2026-04-09T08:00:00.000Z',
      computedFromUpdatedAt: '2026-04-09T08:00:00.000Z',
      years: [{ year: 2026 }],
      yearlyInvestments: [
        {
          year: 2026,
          amount: 100000,
          depreciationRuleSnapshot: {
            assetClassKey: 'sanering_water_network',
            assetClassName: 'Sanering / vattennatverk',
            method: 'straight-line',
            linearYears: 40,
            residualPercent: null,
          },
        },
      ],
    });

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={() => undefined}
        onFocusedReportChange={() => undefined}
      />,
    );

    expect(
      (
        await screen.findAllByText(
          'Viimeisin laskettu skenaario voidaan julkaista raporttina.',
        )
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByText(
        'Avaa Ennuste, laske skenaario ja luo ensimmäinen raportti.',
      ),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Avaa Ennuste luodaksesi raportin' }),
    ).toBeTruthy();
  });

  it('prefers the saved fee-path scenario over stale runtime session state in the empty-state CTA', async () => {
    window.sessionStorage.setItem(
      'v2_forecast_runtime_state',
      JSON.stringify({ selectedScenarioId: 'stress-1' }),
    );
    listReportsV2.mockResolvedValueOnce([]);
    listForecastScenariosV2.mockResolvedValueOnce([
      { id: 'base-1', name: 'Saved fee path scenario' },
      { id: 'stress-1', name: 'Runtime hypothesis' },
    ]);
    getForecastScenarioV2.mockResolvedValueOnce({
      id: 'base-1',
      name: 'Saved fee path scenario',
      baselineYear: 2024,
      updatedAt: '2026-04-09T08:00:00.000Z',
      computedAt: '2026-04-09T08:00:00.000Z',
      computedFromUpdatedAt: '2026-04-09T08:00:00.000Z',
      years: [{ year: 2026 }],
      yearlyInvestments: [],
    });
    const onGoToForecast = vi.fn();

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={onGoToForecast}
        savedFeePathPlanId="plan-1"
        savedFeePathScenarioId="base-1"
        onFocusedReportChange={() => undefined}
      />,
    );

    expect((await screen.findAllByText('Saved fee path scenario')).length).toBeGreaterThan(0);
    expect(getForecastScenarioV2).toHaveBeenCalledWith('base-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Avaa Ennuste luodaksesi raportin' }),
    );

    expect(onGoToForecast).toHaveBeenCalledWith('base-1');
  });

  it('returns stale saved fee-path report flows back to Overview instead of opening Forecast', async () => {
    window.sessionStorage.setItem(
      'v2_forecast_runtime_state',
      JSON.stringify({ selectedScenarioId: 'stress-1' }),
    );
    listReportsV2.mockResolvedValueOnce([]);
    listForecastScenariosV2.mockResolvedValueOnce([
      { id: 'base-1', name: 'Saved fee path scenario' },
      { id: 'stress-1', name: 'Runtime hypothesis' },
    ]);
    getForecastScenarioV2.mockResolvedValueOnce({
      id: 'base-1',
      name: 'Saved fee path scenario',
      baselineYear: 2024,
      updatedAt: '2026-04-09T08:00:00.000Z',
      computedAt: '2026-04-09T08:00:00.000Z',
      computedFromUpdatedAt: '2026-04-09T08:00:00.000Z',
      years: [{ year: 2026 }],
      yearlyInvestments: [],
    });
    const onGoToForecast = vi.fn();
    const onGoToOverviewFeePath = vi.fn();

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={onGoToForecast}
        onGoToOverviewFeePath={onGoToOverviewFeePath}
        savedFeePathPlanId="plan-1"
        savedFeePathScenarioId="base-1"
        savedFeePathPricingStatus="verified"
        savedFeePathReportConflictActive
        onFocusedReportChange={() => undefined}
      />,
    );

    expect((await screen.findAllByText('Saved fee path scenario')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Avaa maksupolku' })[0]!);

    expect(onGoToOverviewFeePath).toHaveBeenCalledWith('plan-1');
    expect(onGoToForecast).not.toHaveBeenCalled();
  });

  it('keeps the saved fee-path reopen affordance visible above an existing report list when the fee path is stale', async () => {
    listReportsV2.mockResolvedValueOnce([
      {
        id: 'report-1',
        title: 'Saved report',
        variant: 'confidential_appendix',
        createdAt: '2026-04-09T08:00:00.000Z',
        ennuste: { id: 'base-1', nimi: 'Saved fee path scenario' },
        baselineYear: 2024,
        baselineSourceSummary: null,
        acceptedBaselineYears: [2024],
        requiredPriceToday: 3.2,
        requiredAnnualIncreasePct: 4.1,
        hasPdf: true,
      },
    ]);
    const onGoToOverviewFeePath = vi.fn();

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={vi.fn()}
        onGoToOverviewFeePath={onGoToOverviewFeePath}
        savedFeePathPlanId="plan-1"
        savedFeePathScenarioId="base-1"
        savedFeePathPricingStatus="verified"
        savedFeePathReportConflictActive
        onFocusedReportChange={() => undefined}
      />,
    );

    expect(
      (await screen.findAllByText('Saved fee path scenario')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Tarkista tallennetut raportit, variantit ja PDF-viennin tila.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Avaa maksupolku' }));

    expect(onGoToOverviewFeePath).toHaveBeenCalledWith('plan-1');
  });

  it('falls back to runtime scenario state when there is no saved fee-path scenario', async () => {
    window.sessionStorage.setItem(
      'v2_forecast_runtime_state',
      JSON.stringify({ selectedScenarioId: 'stress-1' }),
    );
    listReportsV2.mockResolvedValueOnce([]);
    listForecastScenariosV2.mockResolvedValueOnce([
      { id: 'base-1', name: 'Saved fee path scenario' },
      { id: 'stress-1', name: 'Runtime hypothesis' },
    ]);
    getForecastScenarioV2.mockResolvedValueOnce({
      id: 'stress-1',
      name: 'Runtime hypothesis',
      baselineYear: 2024,
      updatedAt: '2026-04-09T08:00:00.000Z',
      computedAt: '2026-04-09T08:00:00.000Z',
      computedFromUpdatedAt: '2026-04-09T08:00:00.000Z',
      years: [{ year: 2026 }],
      yearlyInvestments: [],
    });
    const onGoToForecast = vi.fn();

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={onGoToForecast}
        onFocusedReportChange={() => undefined}
      />,
    );

    expect(await screen.findByText('Runtime hypothesis')).toBeTruthy();
    expect(getForecastScenarioV2).toHaveBeenCalledWith('stress-1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Avaa Ennuste luodaksesi raportin' }),
    );

    expect(onGoToForecast).toHaveBeenCalledWith('stress-1');

  });

  });
}

export function registerReportsPageV2SmokeSuite() {
  describe('ReportsPageV2 smoke', () => {
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
          yearlyInvestments: [
            {
              year: 2026,
              amount: 150000,
              depreciationClassKey: 'sanering_water_network',
              depreciationRuleSnapshot: {
                assetClassKey: 'sanering_water_network',
                assetClassName: 'Sanering / vattennatverk',
                method: 'straight-line',
                linearYears: 40,
                residualPercent: null,
              },
            },
          ],
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
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              totalAmount: 150000,
              projects: [
                {
                  code: 'P-001',
                  name: 'Main rehabilitation',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennätverk',
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
          depreciationPlan: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              accountKey: 'sanering_water_network',
              serviceSplit: 'water',
              method: 'straight-line',
              linearYears: 40,
              residualPercent: null,
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
    expect((await screen.findAllByText('Hyväksytyt pohjavuodet')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('2022, 2023, 2024')).length).toBeGreaterThan(0);
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
    expect(
      screen.queryByText('Lähivuosien kuluoletukset (muokattava)'),
    ).toBeNull();
    expect(screen.getAllByText('Vesiverkon saneeraus').length).toBeGreaterThan(1);
    expect(screen.getByText('Main rehabilitation')).toBeTruthy();
    expect(screen.getByText('Poistosuunnitelma')).toBeTruthy();
    expect(screen.getAllByText('Tasapoisto 40 vuotta').length).toBeGreaterThan(1);
    expect(screen.getByText('Vesi')).toBeTruthy();
    expect(screen.queryByText('Sanering / vattennatverk')).toBeNull();
  });

  it('disables export and drops the ready helper when preview differs from the saved variant', async () => {
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

    expect(
      await screen.findByText('Tallennettu raportti on valmis vietäväksi.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Julkinen yhteenveto' }));

    await waitFor(() => {
      expect(screen.getAllByText('Lataa PDF')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Lataa PDF' }).hasAttribute('disabled'),
      ).toBe(true);
      expect(
        screen.getByText(/PDF-vienti.+tallennettua raporttiversiota/u),
      ).toBeTruthy();
      expect(
        screen.queryByText('Tallennettu raportti on valmis vietäväksi.'),
      ).toBeNull();
    });
  });

  it('uses the readiness-derived empty-state hint when a computed scenario is ready but no reports exist', async () => {
    listReportsV2.mockResolvedValueOnce([]);
    listForecastScenariosV2.mockResolvedValueOnce([
      {
        id: 'scenario-1',
        name: 'Water Utility Vesinvest v2',
      },
    ]);
    getForecastScenarioV2.mockResolvedValueOnce({
      id: 'scenario-1',
      name: 'Water Utility Vesinvest v2',
      baselineYear: 2024,
      updatedAt: '2026-04-09T08:00:00.000Z',
      computedAt: '2026-04-09T08:00:00.000Z',
      computedFromUpdatedAt: '2026-04-09T08:00:00.000Z',
      years: [{ year: 2026 }],
      yearlyInvestments: [
        {
          year: 2026,
          amount: 100000,
          depreciationRuleSnapshot: {
            assetClassKey: 'sanering_water_network',
            assetClassName: 'Sanering / vattennatverk',
            method: 'straight-line',
            linearYears: 40,
            residualPercent: null,
          },
        },
      ],
    });

    render(
      <ReportsPageV2
        refreshToken={0}
        focusedReportId={null}
        onGoToForecast={() => undefined}
        onFocusedReportChange={() => undefined}
      />,
    );

    expect(
      (
        await screen.findAllByText(
          'Viimeisin laskettu skenaario voidaan julkaista raporttina.',
        )
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByText(
        'Avaa Ennuste, laske skenaario ja luo ensimmäinen raportti.',
      ),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Avaa Ennuste luodaksesi raportin' }),
    ).toBeTruthy();
  });

  });
}
