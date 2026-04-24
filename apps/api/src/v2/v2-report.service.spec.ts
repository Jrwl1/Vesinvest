import { ConflictException } from '@nestjs/common';
import { V2ReportService } from './v2-report.service';
import { registerV2ReportVariantRegressionSuite } from './test-support/legacy/v2ReportVariantRegressionSuite';

const buildReportService = () =>
  new V2ReportService(
    {} as any,
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

describe('V2ReportService collaborator helpers', () => {
  it('normalizes public-summary variant into the expected section set', () => {
    const service = buildReportService();

    const variant = (service as any).normalizeReportVariant('public_summary');
    const sections = (service as any).buildReportSections(variant);

    expect(variant).toBe('public_summary');
    expect(sections).toEqual({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
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
});

registerV2ReportVariantRegressionSuite();
