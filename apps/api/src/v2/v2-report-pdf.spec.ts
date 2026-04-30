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
          yearlyInvestments: [
            {
              year: 2026,
              amount: 150000,
              category: 'sanering_water_network',
              investmentType: 'replacement',
              confidence: 'high',
              note: 'Priority renewal',
            },
          ],
        },
        baselineSourceSummaries: [
          {
            year: 2022,
            sourceStatus: 'MANUAL',
            sourceBreakdown: {
              veetiDataTypes: [],
              manualDataTypes: [
                'energia',
                'investointi',
                'taksa',
                'tilinpaatos',
                'verkko',
                'volume_jatevesi',
                'volume_vesi',
              ],
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
              projects: [
                {
                  code: 'P-001',
                  name: 'Water network renewal',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennatverk',
                  accountKey: 'sanering_water_network',
                  allocations: [],
                  totalAmount: 150000,
                },
              ],
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
      reportVariant: 'internal_appendix',
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
    expect(renderedStrings).toContain(authoritativeGroupLabel);
    expect(renderedStrings).not.toContain(
      'Sanering / vattennatverk (sanering_water_network)',
    );
    expect(renderedStrings).not.toContain('Sanering / vattennatverk');
    expect(
      renderedStrings.some((value) => value.includes('sanering_water_network')),
    ).toBe(false);
    expect(renderedStrings.some((value) => value.includes('MANUAL'))).toBe(false);
    expect(renderedStrings.some((value) => value.includes('tilinpaatos'))).toBe(
      false,
    );
    expect(
      renderedStrings.some((value) => value.includes('volume_jatevesi')),
    ).toBe(false);
    expect(renderedStrings.some((value) => value.includes('replacement'))).toBe(
      false,
    );
    expect(renderedStrings.some((value) => value === 'high')).toBe(false);
    expect(renderedStrings).toContain(
      'Required combined price today: 3.20 EUR/m³',
    );
    expect(renderedStrings).toContain(
      'Cumulative cash floor: 3.40 EUR/m³ (4.80 %)',
    );
    expect(renderedStrings).not.toContain(
      'Annual-result floor today: 3.20 EUR/m³ | Cumulative-cash floor today: 3.40 EUR/m³',
    );
  });

  it('uses the saved report locale for package labels', async () => {
    const toPdfText = jest.fn((value: string) => value);

    await buildV2ReportPdf({
      report: {
        title: 'Prognosrapport Kronoby 2026-04-29 - Myndighetspaket',
        createdAt: '2026-04-29T08:00:00.000Z',
        baselineYear: 2025,
        requiredPriceToday: 2.54,
        requiredAnnualIncreasePct: 25.79,
        totalInvestments: 600000,
        ennuste: {
          nimi: 'Kronoby scenario',
        },
      },
      snapshot: {
        reportLocale: 'sv',
        scenario: {
          assumptions: {},
          baselinePriceTodayCombined: 1.9,
          requiredPriceTodayCombinedAnnualResult: 2.54,
          requiredAnnualIncreasePctAnnualResult: 25.79,
          requiredPriceTodayCombinedCumulativeCash: 4.25,
          requiredAnnualIncreasePctCumulativeCash: 123.68,
          years: [],
          nearTermExpenseAssumptions: [],
          yearlyInvestments: [],
        },
        acceptedBaselineYears: [2022, 2023, 2024, 2025],
        baselineSourceSummaries: [],
      },
      reportVariant: 'regulator_package',
      reportSections: {
        baselineSources: true,
        investmentPlan: true,
        assumptions: false,
        yearlyInvestments: false,
        riskSummary: true,
      },
      toPdfText,
      normalizeText: (value) =>
        typeof value === 'string' && value.trim().length > 0 ? value : null,
      toNumber: (value) => Number(value),
    });

    const renderedStrings = toPdfText.mock.calls.map(([value]) => value);

    expect(renderedStrings).toContain(
      'Prognosrapport Kronoby 2026-04-29 - Myndighetspaket',
    );
    expect(renderedStrings).toContain('Rapportvariant: Myndighetspaket');
    expect(renderedStrings).not.toContain('Report variant: Regulator package');
  });

  it('localizes validation placeholder text in internal appendix PDFs', async () => {
    const toPdfText = jest.fn((value: string) => value);

    await buildV2ReportPdf({
      report: {
        title: 'Prognosrapport Kronoby 2026-04-29 - Intern bilaga',
        createdAt: '2026-04-29T08:00:00.000Z',
        baselineYear: 2025,
        requiredPriceToday: 1.51,
        requiredAnnualIncreasePct: 20.53,
        totalInvestments: 600000,
        ennuste: {
          nimi: 'Kronoby scenario',
        },
      },
      snapshot: {
        reportLocale: 'sv',
        scenario: {
          assumptions: {},
          baselinePriceTodayCombined: 1.9,
          requiredPriceTodayCombinedAnnualResult: 1.51,
          requiredAnnualIncreasePctAnnualResult: 20.53,
          requiredPriceTodayCombinedCumulativeCash: 2.42,
          requiredAnnualIncreasePctCumulativeCash: 27.37,
          years: [],
          nearTermExpenseAssumptions: [],
          yearlyInvestments: [
            {
              year: 2026,
              amount: 100000,
              category: 'sanering_water_network',
              investmentType: 'replacement',
              confidence: 'high',
              note: 'Plausible 20-year investment programme for audit flow.',
            },
          ],
        },
        acceptedBaselineYears: [2022, 2023, 2024, 2025],
        baselineSourceSummaries: [],
        vesinvestPlan: {
          name: 'Kronoby Vesinvest',
          versionNumber: 1,
          assetEvidenceState: {
            notes: 'Investeringsprogrammet har granskats f?r den aktiva planen.',
          },
        },
        vesinvestAppendix: {
          yearlyTotals: [],
          fiveYearBands: [],
          groupedProjects: [
            {
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennatverk',
              totalAmount: 600000,
              projects: [
                {
                  code: 'P-2030-01',
                  name: 'Ledningsnät saneering 2026-2030',
                  classKey: 'sanering_water_network',
                  classLabel: 'Sanering / vattennatverk',
                  accountKey: 'sanering_water_network',
                  allocations: [],
                  totalAmount: 600000,
                },
              ],
            },
          ],
          depreciationPlan: [],
        },
        tariffPlan: {
          recommendation: {
            proposedAnnualRevenue: 434347,
            smoothingYears: 5,
            averageAnnualIncreasePct: 0,
            fees: {},
            lawReadiness: { smoothingStatus: 'ok' },
          },
          revenueEvidence: {
            notes: 'Underlaget har granskats f?r den aktiva avgiftsplanen.',
          },
          costEvidence: { notes: 'Reviewed during live deployment audit.' },
          regionalDifferentiationState: {
            notes: 'Moderate risk; monitor affordability, liquidity, and staged implementation.',
          },
        },
      } as any,
      reportVariant: 'internal_appendix',
      reportSections: {
        baselineSources: false,
        investmentPlan: true,
        assumptions: true,
        yearlyInvestments: true,
        riskSummary: true,
      },
      toPdfText,
      normalizeText: (value) =>
        typeof value === 'string' && value.trim().length > 0 ? value : null,
      toNumber: (value) => Number(value),
    });

    const renderedStrings = toPdfText.mock.calls.map(([value]) => value);
    const joined = renderedStrings.join('\n');

    expect(joined).toContain('Sanering av ledningsnät 2026-2030');
    expect(joined).toContain(
      'Underlaget har granskats för den aktiva planen.',
    );
    expect(joined).toContain(
      'Underlaget har granskats för den aktiva avgiftsplanen.',
    );
    expect(joined).toContain(
      'Följ betalningsförmåga, likviditet och etappvis genomförande.',
    );
    expect(joined).not.toContain('Ledningsnät saneering 2026-2030');
    expect(joined).not.toContain('Reviewed during live deployment audit.');
    expect(joined).not.toContain('Plausible 20-year investment programme');
    expect(joined).not.toContain('Moderate risk; monitor affordability');
    expect(joined).not.toContain('f?r den aktiva');
  });
});
