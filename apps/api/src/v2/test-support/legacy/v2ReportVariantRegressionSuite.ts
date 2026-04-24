import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { V2ForecastService } from '../../v2-forecast.service';
import { V2ImportOverviewService } from '../../v2-import-overview.service';
import { V2ReportService } from '../../v2-report.service';
import { V2Service } from '../../v2.service';
import { computeVesinvestScenarioFingerprint } from '../../vesinvest-contract';

const buildFacadeFromArgs = (
  prisma: any,
  projectionsService: any,
  veetiService: any,
  veetiSyncService: any,
  veetiEffectiveDataService: any,
  veetiBudgetGenerator: any,
  veetiBenchmarkService: any,
  veetiSanityService: any,
) =>
  buildFacadeService({
    prisma,
    projectionsService,
    veetiService: {
      getOrganizationById: jest.fn().mockResolvedValue({
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kieli_Id: 2,
      }),
      ...veetiService,
    },
    veetiSyncService: {
      getStatus: jest.fn().mockResolvedValue({
        orgId: 'org-1',
        veetiId: 1535,
        workspaceYears: [],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([]),
      ...veetiSyncService,
    },
    veetiEffectiveDataService: {
      getExcludedYears: jest.fn().mockResolvedValue([]),
      ...veetiEffectiveDataService,
    },
    veetiBudgetGenerator,
    veetiBenchmarkService,
    veetiSanityService,
  });

const buildFacadeService = (deps: {
  prisma: any;
  projectionsService: any;
  veetiService: any;
  veetiSyncService: any;
  veetiEffectiveDataService: any;
  veetiBudgetGenerator: any;
  veetiBenchmarkService: any;
  veetiSanityService: any;
}) => {
  const importOverviewService = new V2ImportOverviewService(
    deps.prisma,
    deps.projectionsService,
    deps.veetiService,
    deps.veetiSyncService,
    deps.veetiEffectiveDataService,
    deps.veetiBudgetGenerator,
    deps.veetiBenchmarkService,
    deps.veetiSanityService,
  );
  const forecastService = new V2ForecastService(
    deps.prisma,
    deps.projectionsService,
    deps.veetiService,
    deps.veetiSyncService,
    deps.veetiEffectiveDataService,
    deps.veetiBudgetGenerator,
    deps.veetiBenchmarkService,
    deps.veetiSanityService,
    importOverviewService,
  );
  const reportService = new V2ReportService(
    deps.prisma,
    deps.projectionsService,
    deps.veetiService,
    deps.veetiSyncService,
    deps.veetiEffectiveDataService,
    deps.veetiBudgetGenerator,
    deps.veetiBenchmarkService,
    deps.veetiSanityService,
    forecastService,
    importOverviewService,
  );

  return new V2Service(importOverviewService, forecastService, reportService, {
    getPlanningContextSummary: jest.fn().mockResolvedValue({
      vesinvest: {
        hasPlan: false,
        planCount: 0,
        activePlan: null,
      },
    }),
  } as any);
};

export function registerV2ReportVariantRegressionSuite() {
describe('V2Service report variant regression', () => {
  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';
  const NOW = new Date('2026-03-08T12:00:00.000Z');

  const buildScenario = () => ({
    id: 'scenario-1',
    name: 'Statement-backed scenario',
    onOletus: false,
    talousarvioId: 'budget-1',
    baselineYear: 2024,
    horizonYears: 20,
    assumptions: {
      inflaatio: 0.025,
      hintakorotus: 0.03,
    },
    yearlyInvestments: [
      {
        year: 2024,
        amount: 150000,
        category: 'network',
        investmentType: 'replacement',
        confidence: 'high',
        note: 'Main line renewal',
      },
    ],
    nearTermExpenseAssumptions: [],
    thereafterExpenseAssumptions: {
      personnelPct: 2,
      energyPct: 3,
      opexOtherPct: 2,
    },
    requiredPriceTodayCombined: 3.1,
    baselinePriceTodayCombined: 2.5,
    requiredAnnualIncreasePct: 12,
    requiredPriceTodayCombinedAnnualResult: 3.2,
    requiredAnnualIncreasePctAnnualResult: 14,
    requiredPriceTodayCombinedCumulativeCash: 3.4,
    requiredAnnualIncreasePctCumulativeCash: 18,
    feeSufficiency: {
      baselineCombinedPrice: 2.5,
      annualResult: {
        requiredPriceToday: 3.2,
        requiredAnnualIncreasePct: 14,
        underfundingStartYear: 2027,
        peakDeficit: 25000,
      },
      cumulativeCash: {
        requiredPriceToday: 3.4,
        requiredAnnualIncreasePct: 18,
        underfundingStartYear: 2026,
        peakGap: 90000,
      },
    },
    years: [
      {
        year: 2024,
        revenue: 780000,
        costs: 805000,
        result: -25000,
        investments: 150000,
        totalDepreciation: 186000,
        combinedPrice: 2.5,
        soldVolume: 100000,
        cashflow: -45000,
        cumulativeCashflow: -45000,
        waterPrice: 1.2,
        wastewaterPrice: 1.3,
      },
      {
        year: 2025,
        revenue: 790000,
        costs: 812000,
        result: -22000,
        investments: 0,
        totalDepreciation: 188000,
        combinedPrice: 2.6,
        soldVolume: 99500,
        cashflow: -32000,
        cumulativeCashflow: -77000,
        waterPrice: 1.24,
        wastewaterPrice: 1.36,
      },
      {
        year: 2026,
        revenue: 805000,
        costs: 820000,
        result: -15000,
        investments: 50000,
        totalDepreciation: 190000,
        combinedPrice: 2.72,
        soldVolume: 99000,
        cashflow: -20000,
        cumulativeCashflow: -97000,
        waterPrice: 1.3,
        wastewaterPrice: 1.42,
      },
      {
        year: 2027,
        revenue: 820000,
        costs: 829000,
        result: -9000,
        investments: 100000,
        totalDepreciation: 194000,
        combinedPrice: 2.86,
        soldVolume: 98500,
        cashflow: -15000,
        cumulativeCashflow: -112000,
        waterPrice: 1.37,
        wastewaterPrice: 1.49,
      },
      {
        year: 2028,
        revenue: 838000,
        costs: 840000,
        result: -2000,
        investments: 50000,
        totalDepreciation: 197000,
        combinedPrice: 2.98,
        soldVolume: 98000,
        cashflow: -7000,
        cumulativeCashflow: -119000,
        waterPrice: 1.43,
        wastewaterPrice: 1.55,
      },
      {
        year: 2029,
        revenue: 854000,
        costs: 848000,
        result: 6000,
        investments: 150000,
        totalDepreciation: 201000,
        combinedPrice: 3.1,
        soldVolume: 97500,
        cashflow: 2000,
        cumulativeCashflow: -117000,
        waterPrice: 1.49,
        wastewaterPrice: 1.61,
      },
    ],
    priceSeries: [],
    investmentSeries: [{ year: 2024, amount: 150000 }],
    cashflowSeries: [],
    computedAt: NOW,
    computedFromUpdatedAt: NOW,
    updatedAt: NOW,
    createdAt: NOW,
  });

  const buildAcceptedTariffPlan = (
    scenario: ReturnType<typeof buildScenario> = buildScenario(),
    baselineFingerprint = 'baseline-1',
  ) => ({
    id: 'tariff-1',
    orgId: ORG_ID,
    vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    scenarioId: scenario.id,
    status: 'accepted',
    baselineInput: {},
    allocationPolicy: {},
    recommendation: {
      baselineFingerprint,
      scenarioFingerprint: computeVesinvestScenarioFingerprint({
        scenarioId: scenario.id,
        updatedAt: scenario.updatedAt,
        computedFromUpdatedAt: scenario.computedFromUpdatedAt,
        yearlyInvestments: scenario.yearlyInvestments,
        years: scenario.years,
      }),
    },
    readinessChecklist: { isReady: true },
    acceptedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  });

  const buildYearDataset = () => ({
    year: 2024,
    veetiId: 1535,
    sourceStatus: 'MIXED',
    completeness: {
      tilinpaatos: true,
      taksa: true,
      volume_vesi: true,
      volume_jatevesi: true,
    },
    hasManualOverrides: true,
    hasVeetiData: true,
    datasets: [
      {
        dataType: 'tilinpaatos',
        rawRows: [{ Liikevaihto: 700000 }],
        effectiveRows: [{ Liikevaihto: 786930.85 }],
        source: 'manual',
        hasOverride: true,
        reconcileNeeded: true,
        overrideMeta: {
          editedAt: NOW.toISOString(),
          editedBy: 'user-1',
          reason: 'Statement import',
          provenance: {
            kind: 'statement_import',
            fileName: 'bokslut-2024.pdf',
            pageNumber: 4,
            importedAt: NOW.toISOString(),
          },
        },
      },
      {
        dataType: 'taksa',
        rawRows: [{ Kayttomaksu: 2.5 }],
        effectiveRows: [{ Kayttomaksu: 2.5 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_vesi',
        rawRows: [{ Maara: 65000 }],
        effectiveRows: [{ Maara: 65000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_jatevesi',
        rawRows: [{ Maara: 35000 }],
        effectiveRows: [{ Maara: 35000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
    ],
  });

  const buildReportCreateHarness = (
    scenarioOverrides: Partial<ReturnType<typeof buildScenario>> = {},
  ) => {
    const scenario = {
      ...buildScenario(),
      ...scenarioOverrides,
    };
    const prisma = {
      ennusteReport: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'report-harness',
          orgId: ORG_ID,
          title: data.title,
          createdAt: NOW,
          baselineYear: data.baselineYear,
          requiredPriceToday: data.requiredPriceToday,
          requiredAnnualIncreasePct: data.requiredAnnualIncreasePct,
          totalInvestments: data.totalInvestments,
          snapshotJson: data.snapshotJson,
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestTariffPlan: {
        findFirst: jest.fn().mockResolvedValue(buildAcceptedTariffPlan(scenario)),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 1,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2024],
            latestAcceptedBudgetId: null,
            veetiId: 1535,
            utilityName: 'Water Utility',
            businessId: '1234567-8',
            identitySource: 'veeti',
          },
          projects: [],
        }),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(buildYearDataset()),
    } as any;
    const service = buildFacadeFromArgs(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(scenario as any);
    jest
      .spyOn((service as any).reportService, 'getCurrentBaselineSnapshot')
      .mockResolvedValue({
        utilityIdentity: {
          veetiId: 1535,
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          identitySource: 'veeti',
        },
        acceptedYears: [2024],
        latestAcceptedBudgetId: null,
        baselineYears: [],
        hasTrustedBaseline: true,
        fingerprint: 'baseline-1',
      });
    jest.spyOn((service as any).reportService, 'getImportStatus').mockResolvedValue({
      years: [
        {
          vuosi: 2024,
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    return { prisma, service };
  };

  it('returns canonical summary rows and trust/result signals from getImportYearData', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        ...buildYearDataset(),
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: 180000,
                Henkilostokulut: 120000,
                Poistot: 140000,
                LiiketoiminnanMuutKulut: 140000,
                TilikaudenYliJaama: 25000,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 786930.85,
                AineetJaPalvelut: 190000,
                Henkilostokulut: 235499,
                Poistot: 180000,
                LiiketoiminnanMuutKulut: 132000,
                TilikaudenYliJaama: 3691,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: NOW.toISOString(),
              editedBy: 'user-1',
              reason: 'Statement import',
              provenance: {
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: ['liikevaihto', 'tilikaudenYliJaama'],
                warnings: [],
              },
            },
          },
        ],
      }),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, 2024);

    expect(result.summaryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'revenue',
          sourceField: 'Liikevaihto',
          rawValue: 700000,
          effectiveValue: 786930.85,
          changed: true,
        }),
        expect.objectContaining({
          key: 'depreciation',
          sourceField: 'Poistot',
          rawValue: 140000,
          effectiveValue: 180000,
          changed: true,
        }),
        expect.objectContaining({
          key: 'result',
          sourceField: 'TilikaudenYliJaama',
          rawValue: 25000,
          effectiveValue: 3691,
          changed: true,
        }),
      ]),
    );
    expect(result.trustSignal).toMatchObject({
      level: 'material',
      reasons: expect.arrayContaining([
        'statement_import',
        'mixed_source',
        'result_changed',
      ]),
      changedSummaryKeys: expect.arrayContaining(['revenue', 'depreciation', 'result']),
      statementImport: expect.objectContaining({
        fileName: 'bokslut-2024.pdf',
      }),
    });
    expect(result.subrowAvailability).toEqual({
      truthfulSubrowsAvailable: false,
      reason: 'year_summary_only',
      rawRowCount: 1,
      effectiveRowCount: 1,
    });
    expect(result.resultToZero).toMatchObject({
      rawValue: 25000,
      effectiveValue: 3691,
      delta: -21309,
      absoluteGap: 3691,
      marginPct: 0.47,
      direction: 'above_zero',
    });
  });

  it('keeps the result summary tied to explicit TilikaudenYliJaama in getImportYearData when other rows would imply a different derived result', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        ...buildYearDataset(),
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 1000,
                AineetJaPalvelut: 200,
                Henkilostokulut: 300,
                Poistot: 40,
                LiiketoiminnanMuutKulut: 50,
                TilikaudenYliJaama: 25,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 1200,
                AineetJaPalvelut: 210,
                Henkilostokulut: 320,
                Poistot: 45,
                LiiketoiminnanMuutKulut: 55,
                TilikaudenYliJaama: 410,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: NOW.toISOString(),
              editedBy: 'user-1',
              reason: 'Manual correction',
              provenance: {
                kind: 'manual_edit',
                importedAt: NOW.toISOString(),
              },
            },
          },
        ],
      }),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, 2024);
    const resultRow = result.summaryRows.find((row: any) => row.key === 'result');
    expect(resultRow).toMatchObject({
      sourceField: 'TilikaudenYliJaama',
      rawValue: 25,
      effectiveValue: 410,
      changed: true,
    });
    expect(result.resultToZero).toMatchObject({
      rawValue: 25,
      effectiveValue: 410,
      delta: 385,
      absoluteGap: 410,
      marginPct: 34.17,
      direction: 'above_zero',
    });
  });

  it('surfaces workbook provenance separately from generic manual overrides in getImportYearData', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        ...buildYearDataset(),
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: null,
                Henkilostokulut: 120000,
                Poistot: 140000,
                LiiketoiminnanMuutKulut: 140000,
                TilikaudenYliJaama: 25000,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: 182000.12,
                Henkilostokulut: 120000,
                Poistot: 140000,
                LiiketoiminnanMuutKulut: 140000,
                TilikaudenYliJaama: 25000,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: NOW.toISOString(),
              editedBy: 'user-1',
              reason: 'Workbook repair',
              provenance: {
                kind: 'kva_import',
                fileName: 'kronoby-kva.xlsx',
                pageNumber: null,
                confidence: null,
                scannedPageCount: null,
                matchedFields: ['AineetJaPalvelut'],
                warnings: [],
                sheetName: 'KVA totalt',
                matchedYears: [2022, 2023, 2024],
                confirmedSourceFields: ['AineetJaPalvelut'],
                candidateRows: [
                  {
                    sourceField: 'AineetJaPalvelut',
                    workbookValue: 182000.12,
                    action: 'apply_workbook',
                  },
                ],
                fieldSources: [
                  {
                    sourceField: 'Liikevaihto',
                    provenance: {
                      kind: 'statement_import',
                      fileName: 'bokslut-2024.pdf',
                      pageNumber: 4,
                      confidence: 98,
                      scannedPageCount: 5,
                      matchedFields: ['Liikevaihto', 'TilikaudenYliJaama'],
                      warnings: [],
                    },
                  },
                  {
                    sourceField: 'AineetJaPalvelut',
                    provenance: {
                      kind: 'kva_import',
                      fileName: 'kronoby-kva.xlsx',
                      pageNumber: null,
                      confidence: null,
                      scannedPageCount: null,
                      matchedFields: ['AineetJaPalvelut'],
                      warnings: [],
                      sheetName: 'KVA totalt',
                      matchedYears: [2022, 2023, 2024],
                      confirmedSourceFields: ['AineetJaPalvelut'],
                      candidateRows: [
                        {
                          sourceField: 'AineetJaPalvelut',
                          workbookValue: 182000.12,
                          action: 'apply_workbook',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      }),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, 2024);
    expect(result.summaryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'materialsCosts',
          sourceField: 'AineetJaPalvelut',
          rawValue: null,
          effectiveValue: 182000.12,
          changed: true,
        }),
      ]),
    );
    expect(result.trustSignal).toMatchObject({
      level: 'material',
      reasons: expect.arrayContaining([
        'statement_import',
        'workbook_import',
        'mixed_source',
      ]),
      workbookImport: expect.objectContaining({
        kind: 'kva_import',
        fileName: 'kronoby-kva.xlsx',
        sheetName: 'KVA totalt',
        confirmedSourceFields: ['AineetJaPalvelut'],
      }),
      statementImport: expect.objectContaining({
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      }),
    });
    expect(result.datasets[0]?.overrideMeta?.provenance).toMatchObject({
      kind: 'kva_import',
      fileName: 'kronoby-kva.xlsx',
      fieldSources: expect.arrayContaining([
        expect.objectContaining({
          sourceField: 'Liikevaihto',
          provenance: expect.objectContaining({
            kind: 'statement_import',
            fileName: 'bokslut-2024.pdf',
          }),
        }),
        expect.objectContaining({
          sourceField: 'AineetJaPalvelut',
          provenance: expect.objectContaining({
            kind: 'kva_import',
            fileName: 'kronoby-kva.xlsx',
          }),
        }),
      ]),
      candidateRows: [
        {
          sourceField: 'AineetJaPalvelut',
          workbookValue: 182000.12,
          action: 'apply_workbook',
        },
      ],
    });
  });

  it('keeps statement-backed baseline provenance and public-summary sections across report create and readback', async () => {
    let createdReport: any = null;
    const prisma = {
      ennusteReport: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          createdReport = {
            id: 'report-1',
            orgId: ORG_ID,
            title: data.title,
            createdAt: NOW,
            baselineYear: data.baselineYear,
            requiredPriceToday: data.requiredPriceToday,
            requiredAnnualIncreasePct: data.requiredAnnualIncreasePct,
            totalInvestments: data.totalInvestments,
            snapshotJson: data.snapshotJson,
          };
          return createdReport;
        }),
        findMany: jest.fn().mockImplementation(async () =>
          createdReport
            ? [
                {
                  ...createdReport,
                  ennuste: {
                    id: 'scenario-1',
                    nimi: 'Statement-backed scenario',
                  },
                },
              ]
            : [],
        ),
        findFirst: jest.fn().mockImplementation(async () =>
          createdReport
            ? {
                ...createdReport,
                ennuste: {
                  id: 'scenario-1',
                  nimi: 'Statement-backed scenario',
                },
              }
            : null,
          ),
      },
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestGroupOverride: {
        findMany: jest.fn().mockResolvedValue([
          {
            key: 'legacy_extra_class',
            label: 'Legacy extra class',
            defaultAccountKey: 'legacy_extra_class',
            defaultDepreciationClassKey: 'legacy_extra_class',
            reportGroupKey: 'network_rehabilitation',
            serviceSplit: 'mixed',
          },
        ]),
      },
      vesinvestTariffPlan: {
        findFirst: jest.fn().mockResolvedValue(buildAcceptedTariffPlan()),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 1,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2024],
            latestAcceptedBudgetId: null,
            veetiId: 1535,
            utilityName: 'Water Utility',
            businessId: '1234567-8',
            identitySource: 'veeti',
          },
          projects: [],
        }),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(buildYearDataset()),
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);
    jest
      .spyOn((service as any).reportService, 'getCurrentBaselineSnapshot')
      .mockResolvedValue({
        utilityIdentity: {
          veetiId: 1535,
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          identitySource: 'veeti',
        },
        acceptedYears: [2024],
        latestAcceptedBudgetId: null,
        baselineYears: [],
        hasTrustedBaseline: true,
        fingerprint: 'baseline-1',
      });
    jest.spyOn((service as any).reportService, 'getImportStatus').mockResolvedValue({
      years: [
        {
          vuosi: 2024,
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    jest.useFakeTimers().setSystemTime(NOW);
    try {
      await service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
        variant: 'public_summary',
      });
    } finally {
      jest.useRealTimers();
    }

    const listedReports = await service.listReports(ORG_ID);
    const createArgs = (prisma.ennusteReport.create as jest.Mock).mock.calls[0][0];
    const snapshot = createArgs.data.snapshotJson as any;

    expect(createArgs.data.title).toBe(
      'Forecast report Statement-backed scenario 2026-03-08',
    );
    expect(snapshot.reportVariant).toBe('public_summary');
    expect(snapshot.reportSections).toMatchObject({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
    expect(snapshot.acceptedBaselineYears).toEqual([2024]);
    expect(snapshot.baselineSourceSummaries).toHaveLength(1);
    expect(snapshot.baselineSourceSummary.financials).toMatchObject({
      source: 'manual',
      provenance: expect.objectContaining({
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      }),
    });
    expect(snapshot.baselineSourceSummary.prices).toMatchObject({
      source: 'veeti',
    });
    expect(listedReports[0]?.baselineSourceSummary).toMatchObject({
      sourceStatus: 'MIXED',
      financials: expect.objectContaining({
        source: 'manual',
        provenance: expect.objectContaining({
          kind: 'statement_import',
          fileName: 'bokslut-2024.pdf',
        }),
      }),
    });
    expect(listedReports[0]?.requiredPriceToday).toBe(3.2);
    expect(listedReports[0]?.requiredAnnualIncreasePct).toBe(14);

    const report = await service.getReport(ORG_ID, 'report-1');
    expect(report.variant).toBe('public_summary');
    expect(report.snapshot.reportSections).toMatchObject({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
    expect(report.snapshot.acceptedBaselineYears).toEqual([2024]);
    expect(report.snapshot.baselineSourceSummaries).toHaveLength(1);
    expect(report.snapshot.baselineSourceSummary?.financials.provenance).toMatchObject(
      {
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      },
    );
  });

  it('allows report creation when yearly investment placeholders add only zero-only years', async () => {
    const { prisma, service } = buildReportCreateHarness({
      yearlyInvestments: [
        ...buildScenario().yearlyInvestments,
        {
          year: 2025,
          amount: 0,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Zero placeholder',
        },
      ],
    });

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    });

    expect(prisma.ennusteReport.create).toHaveBeenCalledTimes(1);
  });

  it('allows report creation when computed series explicitly includes matching zero-only years', async () => {
    const { prisma, service } = buildReportCreateHarness({
      yearlyInvestments: [
        ...buildScenario().yearlyInvestments,
        {
          year: 2025,
          amount: 0,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Zero placeholder',
        },
      ],
      investmentSeries: [
        { year: 2024, amount: 150000 },
        { year: 2025, amount: 0 },
        { year: 2026, amount: 0 },
      ],
    });

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    });

    expect(prisma.ennusteReport.create).toHaveBeenCalledTimes(1);
  });
  it('still blocks report creation when yearly investment inputs no longer match the computed series', async () => {
    const { prisma, service } = buildReportCreateHarness({
      yearlyInvestments: [
        ...buildScenario().yearlyInvestments,
        {
          year: 2025,
          amount: 50000,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Uncomputed addition',
        },
      ],
    });

    await expect(
      service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/Scenario investment inputs changed after last compute/i);
    expect(prisma.ennusteReport.create).not.toHaveBeenCalled();
  });

  it('still blocks report creation when computed investment series retains a positive year missing from inputs', async () => {
    const { prisma, service } = buildReportCreateHarness({
      investmentSeries: [
        { year: 2024, amount: 150000 },
        { year: 2025, amount: 50000 },
      ],
    });

    await expect(
      service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/Scenario investment inputs changed after last compute/i);
    expect(prisma.ennusteReport.create).not.toHaveBeenCalled();
  });

  it('prefers the saved Vesinvest baseline snapshot when creating a report from a linked plan', async () => {
    let createdReport: any = null;
    const prisma = {
      ennusteReport: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          createdReport = {
            id: 'report-2',
            orgId: ORG_ID,
            title: data.title,
            createdAt: NOW,
            baselineYear: data.baselineYear,
            requiredPriceToday: data.requiredPriceToday,
            requiredAnnualIncreasePct: data.requiredAnnualIncreasePct,
            totalInvestments: data.totalInvestments,
            snapshotJson: data.snapshotJson,
          };
          return createdReport;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockImplementation(async () =>
          createdReport
            ? {
                ...createdReport,
                ennuste: {
                  id: 'scenario-1',
                  nimi: 'Statement-backed scenario',
                },
              }
            : null,
        ),
      },
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestTariffPlan: {
        findFirst: jest.fn().mockResolvedValue(
          buildAcceptedTariffPlan(buildScenario(), 'baseline-2'),
        ),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 2,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2022, 2023, 2024],
            latestAcceptedBudgetId: 'budget-2024',
            veetiId: 1535,
            utilityName: 'Water Utility',
            businessId: '1234567-8',
            identitySource: 'veeti',
            baselineYears: [
              {
                year: 2022,
                planningRole: 'historical',
                sourceStatus: 'VEETI',
                sourceBreakdown: {
                  veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
                  manualDataTypes: [],
                },
                financials: {
                  dataType: 'tilinpaatos',
                  source: 'veeti',
                  provenance: null,
                  editedAt: null,
                  editedBy: null,
                  reason: null,
                },
                prices: {
                  dataType: 'taksa',
                  source: 'veeti',
                  provenance: null,
                  editedAt: null,
                  editedBy: null,
                  reason: null,
                },
                volumes: {
                  dataType: 'volume_vesi+volume_jatevesi',
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
                  dataType: 'tilinpaatos',
                  source: 'manual',
                  provenance: {
                    kind: 'document_import',
                    fileName: 'saved-2023-source.pdf',
                    pageNumbers: [3, 4],
                    confidence: 94,
                    scannedPageCount: 6,
                    matchedFields: ['Liikevaihto'],
                    warnings: [],
                  },
                  editedAt: NOW.toISOString(),
                  editedBy: 'user-1',
                  reason: 'Saved with Vesinvest',
                },
                prices: {
                  dataType: 'taksa',
                  source: 'veeti',
                  provenance: null,
                  editedAt: null,
                  editedBy: null,
                  reason: null,
                },
                volumes: {
                  dataType: 'volume_vesi+volume_jatevesi',
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
                  dataType: 'tilinpaatos',
                  source: 'manual',
                  provenance: {
                    kind: 'statement_import',
                    fileName: 'saved-baseline.pdf',
                    pageNumber: 7,
                    confidence: 99,
                    scannedPageCount: 8,
                    matchedFields: ['Liikevaihto'],
                    warnings: [],
                  },
                  editedAt: NOW.toISOString(),
                  editedBy: 'user-1',
                  reason: 'Saved with Vesinvest',
                },
                prices: {
                  dataType: 'taksa',
                  source: 'veeti',
                  provenance: null,
                  editedAt: null,
                  editedBy: null,
                  reason: null,
                },
                volumes: {
                  dataType: 'volume_vesi+volume_jatevesi',
                  source: 'manual',
                  provenance: {
                    kind: 'qdis_import',
                    fileName: 'saved-qdis.pdf',
                    pageNumber: 2,
                    confidence: 87,
                    scannedPageCount: 3,
                    matchedFields: ['waterUnitPrice'],
                    warnings: [],
                  },
                  editedAt: NOW.toISOString(),
                  editedBy: 'user-1',
                  reason: 'Saved with Vesinvest',
                },
              },
            ],
          },
          projects: [
            {
              groupKey: 'sanering_water_network',
              projectCode: 'P-001',
              projectName: 'Main rehabilitation',
              totalAmount: 150000,
              allocations: [
                {
                  year: 2026,
                  totalAmount: 50000,
                },
                {
                  year: 2027,
                  totalAmount: 100000,
                },
              ],
            },
            {
              groupKey: 'wastewater_treatment',
              projectCode: 'P-002',
              projectName: 'Plant renewal',
              totalAmount: 200000,
              allocations: [
                {
                  year: 2028,
                  totalAmount: 50000,
                },
                {
                  year: 2029,
                  totalAmount: 150000,
                },
              ],
            },
          ],
        }),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn(),
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);
    jest
      .spyOn((service as any).reportService, 'getCurrentBaselineSnapshot')
      .mockResolvedValue({
        utilityIdentity: {
          veetiId: 1535,
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          identitySource: 'veeti',
        },
        acceptedYears: [2022, 2023, 2024],
        latestAcceptedBudgetId: 'budget-2024',
        baselineYears: [],
        hasTrustedBaseline: true,
        fingerprint: 'baseline-2',
      });

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    });

    expect(veetiEffectiveDataService.getYearDataset).not.toHaveBeenCalled();
    const createArgs = (prisma.ennusteReport.create as jest.Mock).mock.calls[0][0];
    const snapshot = createArgs.data.snapshotJson as any;
    expect(snapshot.vesinvestPlan).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Water Utility Vesinvest',
      versionNumber: 2,
    });
    expect(snapshot.acceptedBaselineYears).toEqual([2022, 2023, 2024]);
    expect(snapshot.vesinvestAppendix).toMatchObject({
      yearlyTotals: [
        { year: 2024, totalAmount: 0 },
        { year: 2025, totalAmount: 0 },
        { year: 2026, totalAmount: 50000 },
        { year: 2027, totalAmount: 100000 },
        { year: 2028, totalAmount: 50000 },
        { year: 2029, totalAmount: 150000 },
      ],
      fiveYearBands: [
        {
          startYear: 2024,
          endYear: 2028,
          totalAmount: 200000,
        },
        {
          startYear: 2029,
          endYear: 2029,
          totalAmount: 150000,
        },
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
                { year: 2026, totalAmount: 50000 },
                { year: 2027, totalAmount: 100000 },
              ],
              totalAmount: 150000,
            },
          ],
        },
        {
          classKey: 'wastewater_treatment',
          classLabel: 'Avloppsrening',
          totalAmount: 200000,
          projects: [
            {
              code: 'P-002',
              name: 'Plant renewal',
              classKey: 'wastewater_treatment',
              classLabel: 'Avloppsrening',
              accountKey: 'wastewater_treatment',
              allocations: [
                { year: 2028, totalAmount: 50000 },
                { year: 2029, totalAmount: 150000 },
              ],
              totalAmount: 200000,
            },
          ],
        },
      ],
      depreciationPlan: expect.arrayContaining([
        expect.objectContaining({
          classKey: 'sanering_water_network',
          classLabel: 'Sanering / vattennätverk',
          accountKey: 'sanering_water_network',
          serviceSplit: 'water',
        }),
        expect.objectContaining({
          classKey: 'wastewater_treatment',
          classLabel: 'Avloppsrening',
          accountKey: 'wastewater_treatment',
          serviceSplit: 'wastewater',
        }),
      ]),
    });
    expect(snapshot.vesinvestAppendix.depreciationPlan).toHaveLength(10);
    expect(
      snapshot.vesinvestAppendix.depreciationPlan.some(
        (row: any) => row.classKey === 'legacy_extra_class',
      ),
    ).toBe(false);
    expect(snapshot.baselineSourceSummaries).toHaveLength(3);
    expect(snapshot.baselineSourceSummaries[1]).toMatchObject({
      year: 2023,
      sourceStatus: 'MIXED',
      financials: {
        source: 'manual',
        provenance: expect.objectContaining({
          kind: 'document_import',
          fileName: 'saved-2023-source.pdf',
        }),
      },
    });
    expect(snapshot.baselineSourceSummary).toMatchObject({
      sourceStatus: 'MANUAL',
      financials: {
        source: 'manual',
        provenance: expect.objectContaining({
          fileName: 'saved-baseline.pdf',
        }),
      },
      volumes: {
        source: 'manual',
        provenance: expect.objectContaining({
          fileName: 'saved-qdis.pdf',
        }),
      },
    });
  });

  it('blocks report creation for a legacy active revision without a saved baseline snapshot', async () => {
    const prisma = {
      ennusteReport: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 2,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: null,
          projects: [],
        }),
      },
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);

    await expect(
      service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/Re-verify baseline before creating report/i);
    expect(prisma.ennusteReport.create).not.toHaveBeenCalled();
  });
});
}
