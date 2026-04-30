import { ConflictException } from '@nestjs/common';
import { V2ReportService } from './v2-report.service';
import { registerV2ReportVariantRegressionSuite } from './test-support/legacy/v2ReportVariantRegressionSuite';

const buildReportService = (prisma: Record<string, unknown> = {}) =>
  new V2ReportService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { getForecastScenario: jest.fn() } as any,
    { getImportStatus: jest.fn() } as any,
  );

const makeReportPlanRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  seriesId: 'series-1',
  name: 'Water Utility Vesinvest',
  utilityName: 'Water Utility',
  businessId: '1234567-8',
  veetiId: 1535,
  identitySource: 'veeti',
  versionNumber: 1,
  status: 'active',
  selectedScenarioId: 'scenario-1',
  baselineFingerprint: 'baseline',
  scenarioFingerprint: 'scenario',
  feeRecommendation: null,
  baselineSourceState: null,
  assetEvidenceState: null,
  municipalPlanContext: null,
  maintenanceEvidenceState: null,
  conditionStudyState: null,
  financialRiskState: null,
  publicationState: null,
  communicationState: null,
  projects: [
    {
      groupKey: 'sanering_water_network',
      accountKey: 'sanering_water_network',
      depreciationClassKey: 'sanering_water_network',
      reportGroupKey: 'network_rehabilitation',
      projectCode: 'P-001',
      projectName: 'Main rehabilitation',
      totalAmount: 100,
      allocations: [
        {
          id: 'allocation-1',
          year: 2026,
          totalAmount: 100,
          waterAmount: 100,
          wastewaterAmount: 0,
        },
      ],
    },
  ],
  ...overrides,
});

const expectConflictCode = async (
  promise: Promise<unknown>,
  code: string,
  messagePattern: RegExp,
) => {
  try {
    await promise;
    throw new Error(`Expected ConflictException with code ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(ConflictException);
    const response = (err as ConflictException).getResponse();
    expect(response).toMatchObject({
      code,
      message: expect.stringMatching(messagePattern),
    });
  }
};

describe('V2ReportService collaborator helpers', () => {
  it('normalizes legacy public-summary variant into the regulator package section set', () => {
    const service = buildReportService();

    const variant = (service as any).normalizeReportVariant('public_summary');
    const sections = (service as any).buildReportSections(variant);

    expect(variant).toBe('regulator_package');
    expect(sections).toEqual({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
  });

  it('builds board package sections with summarized assumptions but without yearly investment rows', () => {
    const service = buildReportService();

    const variant = (service as any).normalizeReportVariant('board_package');
    const sections = (service as any).buildReportSections(variant);

    expect(variant).toBe('board_package');
    expect(sections).toEqual({
      baselineSources: true,
      investmentPlan: true,
      assumptions: true,
      yearlyInvestments: false,
      riskSummary: true,
    });
  });

  it('builds baseline source summaries from dataset provenance', () => {
    const service = buildReportService();

    const summary = (service as any).buildBaselineSourceSummary(
      {
        years: [
          {
            vuosi: 2024,
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos'],
              manualDataTypes: ['taksa'],
            },
          },
        ],
      },
      2024,
      {
        sourceStatus: 'MIXED',
        datasets: [
          {
            dataType: 'tilinpaatos',
            source: 'veeti',
            overrideMeta: null,
          },
          {
            dataType: 'taksa',
            source: 'manual',
            overrideMeta: {
              provenance: 'workbook',
              editedAt: '2026-03-20T10:00:00.000Z',
              editedBy: 'planner@example.com',
              reason: 'Updated workbook import',
            },
          },
          {
            dataType: 'volume_vesi',
            source: 'veeti',
            overrideMeta: null,
          },
          {
            dataType: 'volume_jatevesi',
            source: 'manual',
            overrideMeta: {
              provenance: 'qdis',
              editedAt: '2026-03-21T10:00:00.000Z',
              editedBy: 'planner@example.com',
              reason: 'QDIS import',
            },
          },
        ],
      },
    );

    expect(summary).toMatchObject({
      year: 2024,
      sourceStatus: 'MIXED',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos'],
        manualDataTypes: ['taksa'],
      },
      financials: {
        dataType: 'tilinpaatos',
        source: 'veeti',
      },
      prices: {
        dataType: 'taksa',
        source: 'manual',
        provenance: 'workbook',
      },
      volumes: {
        dataType: 'volume_vesi+volume_jatevesi',
        source: 'manual',
        provenance: 'qdis',
      },
    });
  });

  it('rejects accepted tariff packages whose fingerprints no longer match live report inputs', () => {
    const service = buildReportService();

    expect(() =>
      (service as any).assertAcceptedTariffPlanCurrent(
        {
          baselineFingerprint: 'old-baseline',
          scenarioFingerprint: 'live-scenario',
        },
        'live-baseline',
        'live-scenario',
      ),
    ).toThrow(ConflictException);
  });

  it('clamps hostile stored report sections to the normalized package variant', async () => {
    const service = buildReportService({
      ennusteReport: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'report-1',
          title: 'Regulator report',
          createdAt: new Date('2026-04-30T08:00:00.000Z'),
          baselineYear: 2025,
          requiredPriceToday: 3.2,
          requiredAnnualIncreasePct: 4.1,
          totalInvestments: 100000,
          ennuste: { id: 'scenario-1', nimi: 'Scenario' },
          snapshotJson: {
            reportVariant: 'regulator_package',
            reportSections: {
              baselineSources: true,
              investmentPlan: true,
              assumptions: true,
              yearlyInvestments: true,
              riskSummary: true,
            },
            acceptedBaselineYears: [2024, 2025],
          },
        }),
      },
    });

    const report = await service.getReport('org-1', 'report-1');

    expect(report.snapshot.reportSections).toEqual({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
  });

  it.each([
    [
      'inactive revision',
      makeReportPlanRecord({ status: 'draft' }),
      {},
      'VESINVEST_INACTIVE_REVISION',
      /active Vesinvest revision/i,
    ],
    [
      'missing linked scenario',
      makeReportPlanRecord({ selectedScenarioId: null }),
      {},
      'VESINVEST_SCENARIO_REQUIRED',
      /not linked to a forecast scenario/i,
    ],
    [
      'scenario mismatch',
      makeReportPlanRecord({ selectedScenarioId: 'scenario-1' }),
      { ennusteId: 'scenario-2' },
      'VESINVEST_SCENARIO_MISMATCH',
      /different forecast scenario/i,
    ],
  ])(
    'returns a structured report-create conflict for %s',
    async (_name, planRecord, requestOverrides, code, messagePattern) => {
      const service = buildReportService({
        vesinvestPlan: {
          findFirst: jest.fn().mockResolvedValue(planRecord),
        },
      });
      (service as any).getVesinvestGroupClassificationDefaults = jest
        .fn()
        .mockResolvedValue(new Map());

      await expectConflictCode(
        service.createReport('org-1', 'user-1', {
          vesinvestPlanId: 'plan-1',
          ...requestOverrides,
        }),
        code,
        messagePattern,
      );
    },
  );

  it('blocks report creation when linked Forecast investments diverge from Vesinvest allocations', async () => {
    const service = buildReportService({
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue(makeReportPlanRecord()),
      },
    });
    (service as any).getVesinvestGroupClassificationDefaults = jest
      .fn()
      .mockResolvedValue(new Map());
    (service as any).getCurrentBaselineSnapshot = jest.fn().mockResolvedValue({
      fingerprint: 'baseline',
      acceptedYears: [2025],
      utilityIdentity: {
        veetiId: 1535,
        utilityName: 'Water Utility',
        businessId: '1234567-8',
        identitySource: 'veeti',
      },
    });
    (service as any).getForecastScenario = jest.fn().mockResolvedValue({
      id: 'scenario-1',
      name: 'Linked scenario',
      baselineYear: 2025,
      updatedAt: new Date('2026-04-30T08:00:00.000Z'),
      computedFromUpdatedAt: new Date('2026-04-30T08:00:00.000Z'),
      yearlyInvestments: [
        {
          year: 2026,
          amount: 75,
          waterAmount: 75,
          wastewaterAmount: 0,
          vesinvestPlanId: 'plan-1',
          allocationId: 'allocation-1',
        },
      ],
      investmentSeries: [{ year: 2026, amount: 75 }],
      years: [{ year: 2026, investment: 75 }],
    });

    await expectConflictCode(
      service.createReport('org-1', 'user-1', {
        vesinvestPlanId: 'plan-1',
      }),
      'VESINVEST_SCENARIO_INVESTMENTS_STALE',
      /sync asset management to forecast/i,
    );
  });

  it('blocks report creation when Forecast rows omit active Vesinvest allocation links', async () => {
    const service = buildReportService({
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue(makeReportPlanRecord()),
      },
    });
    (service as any).getVesinvestGroupClassificationDefaults = jest
      .fn()
      .mockResolvedValue(new Map());
    (service as any).getCurrentBaselineSnapshot = jest.fn().mockResolvedValue({
      fingerprint: 'baseline',
      acceptedYears: [2025],
      utilityIdentity: {
        veetiId: 1535,
        utilityName: 'Water Utility',
        businessId: '1234567-8',
        identitySource: 'veeti',
      },
    });
    (service as any).getForecastScenario = jest.fn().mockResolvedValue({
      id: 'scenario-1',
      name: 'Manual scenario',
      baselineYear: 2025,
      updatedAt: new Date('2026-04-30T08:00:00.000Z'),
      computedFromUpdatedAt: new Date('2026-04-30T08:00:00.000Z'),
      yearlyInvestments: [
        {
          year: 2026,
          amount: 100,
          target: 'Manual row with no active Vesinvest allocation link',
        },
      ],
      investmentSeries: [{ year: 2026, amount: 100 }],
      years: [{ year: 2026, investment: 100 }],
    });

    await expectConflictCode(
      service.createReport('org-1', 'user-1', {
        vesinvestPlanId: 'plan-1',
      }),
      'VESINVEST_SCENARIO_INVESTMENTS_STALE',
      /sync asset management to forecast/i,
    );
  });
});

registerV2ReportVariantRegressionSuite();
