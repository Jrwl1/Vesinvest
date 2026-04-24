import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsPageV2 } from '../../ReportsPageV2';

const downloadReportPdfV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getReportV2 = vi.fn();
const listForecastScenariosV2 = vi.fn();
const listReportsV2 = vi.fn();

vi.mock('../../../api', () => ({
  downloadReportPdfV2: (...args: unknown[]) => downloadReportPdfV2(...args),
  getForecastScenarioV2: (...args: unknown[]) => getForecastScenarioV2(...args),
  getReportV2: (...args: unknown[]) => getReportV2(...args),
  listForecastScenariosV2: (...args: unknown[]) => listForecastScenariosV2(...args),
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
}));



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

    fireEvent.click(
      screen.getAllByRole('button', {
        name: /Tariff Plan|Maksusuunnitelma|Avgiftsplan/,
      })[0]!,
    );

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

    fireEvent.click(
      screen.getAllByRole('button', {
        name: /Tariff Plan|Maksusuunnitelma|Avgiftsplan/,
      })[0]!,
    );

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
