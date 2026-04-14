import { DEFAULT_VESINVEST_GROUP_DEFINITIONS } from './vesinvest-contract';
import { buildV2ReportPdf } from './v2-report-pdf';

describe('buildV2ReportPdf', () => {
  it('keeps accepted baseline provenance snapshot-only and normalizes Vesinvest labels', async () => {
    const toPdfText = jest.fn((value: string) => value);
    const authoritativeGroupLabel =
      DEFAULT_VESINVEST_GROUP_DEFINITIONS.find(
        (group) => group.key === 'sanering_water_network',
      )?.label ?? 'sanering_water_network';
    const baselineDataset = {
      source: 'veeti' as const,
      provenance: null,
      editedAt: null,
      editedBy: null,
      reason: null,
    };

    await buildV2ReportPdf({
      report: {
        title: 'Kronoby report',
        createdAt: '2026-04-14T08:00:00.000Z',
        baselineYear: 2026,
        requiredPriceToday: 3.2,
        requiredAnnualIncreasePct: 4.1,
        totalInvestments: 150000,
        ennuste: {
          nimi: 'Kronoby scenario',
        },
      },
      snapshot: {
        scenario: {
          assumptions: {},
          baselinePriceTodayCombined: 2.8,
          requiredPriceTodayCombinedAnnualResult: 3.2,
          requiredAnnualIncreasePctAnnualResult: 4.1,
          requiredPriceTodayCombinedCumulativeCash: 3.4,
          requiredAnnualIncreasePctCumulativeCash: 4.8,
          years: [
            {
              year: 2026,
              revenue: 300000,
              costs: 250000,
              result: 50000,
              investments: 150000,
              totalDepreciation: 45000,
              combinedPrice: 3.2,
              waterPrice: 1.6,
              wastewaterPrice: 1.6,
              soldVolume: 100000,
              cashflow: 10000,
              cumulativeCashflow: 10000,
            },
          ],
          nearTermExpenseAssumptions: [],
          yearlyInvestments: [],
        },
        baselineSourceSummaries: [
          {
            year: 2022,
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos'],
              manualDataTypes: [],
            },
            financials: baselineDataset,
            prices: baselineDataset,
            volumes: baselineDataset,
          },
          {
            year: 2024,
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos'],
              manualDataTypes: [],
            },
            financials: baselineDataset,
            prices: baselineDataset,
            volumes: baselineDataset,
          },
        ],
        vesinvestAppendix: {
          yearlyTotals: [],
          fiveYearBands: [],
          groupedProjects: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennatverk',
              totalAmount: 150000,
              projects: [],
            },
          ],
          depreciationPlan: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennatverk',
              accountKey: 'sanering_water_network',
              serviceSplit: 'water',
              method: 'straight-line',
              linearYears: 40,
              residualPercent: null,
            },
          ],
        },
      },
      reportVariant: 'confidential_appendix',
      reportSections: {
        baselineSources: true,
        investmentPlan: true,
        assumptions: false,
        yearlyInvestments: true,
        riskSummary: true,
      },
      toPdfText,
      normalizeText: (value) =>
        typeof value === 'string' && value.trim().length > 0 ? value : null,
      toNumber: (value) => Number(value),
    });

    const renderedStrings = toPdfText.mock.calls.map(([value]) => value);

    expect(renderedStrings).toContain('Accepted baseline years: 2022, 2024');
    expect(renderedStrings).not.toContain('Accepted baseline years: 2026');
    expect(renderedStrings).toContain(
      `${authoritativeGroupLabel} (sanering_water_network)`,
    );
    expect(renderedStrings).not.toContain(
      'Sanering / vattennatverk (sanering_water_network)',
    );
    expect(renderedStrings).toContain(authoritativeGroupLabel);
    expect(renderedStrings).not.toContain('Sanering / vattennatverk');
  });
});
