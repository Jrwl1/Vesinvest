import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { V2ForecastService } from '../../v2-forecast.service';
import { V2ImportOverviewService } from '../../v2-import-overview.service';
import { V2ReportService } from '../../v2-report.service';
import { V2Service } from '../../v2.service';

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


export function registerV2YearReconcileBehaviorSuite() {
describe('V2Service year reconcile behavior', () => {
  const ORG_ID = 'org-1';
  const YEAR = 2024;

  it('re-applies only allowed requested VEETI data types and returns refreshed year data', async () => {
    const yearDataset = {
      year: YEAR,
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
          rawRows: [{ Liikevaihto: 1000 }],
          effectiveRows: [{ Liikevaihto: 1200 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [{ Kayttomaksu: 1.5 }],
          effectiveRows: [{ Kayttomaksu: 1.5 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    };

    const prisma = {} as any;
    const projectionsService = {} as any;
    const veetiService = {} as any;
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            tariff_revenue: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest
        .fn()
        .mockResolvedValueOnce(yearDataset)
        .mockResolvedValueOnce({
          ...yearDataset,
          sourceStatus: 'VEETI',
          datasets: yearDataset.datasets.map((dataset) =>
            dataset.dataType === 'tilinpaatos'
              ? {
                  ...dataset,
                  source: 'veeti',
                  hasOverride: false,
                  reconcileNeeded: false,
                }
              : dataset,
          ),
        })
        .mockResolvedValue({
          ...yearDataset,
          sourceStatus: 'VEETI',
          datasets: yearDataset.datasets.map((dataset) =>
            dataset.dataType === 'tilinpaatos'
              ? {
                  ...dataset,
                  source: 'veeti',
                  hasOverride: false,
                  reconcileNeeded: false,
                }
              : dataset,
          ),
        }),
      getExcludedYears: jest.fn().mockResolvedValue([]),
      removeOverrides: jest.fn().mockResolvedValue({ count: 1 }),
    } as any;
    const veetiBudgetGenerator = {} as any;
    const veetiBenchmarkService = {} as any;
    const veetiSanityService = {} as any;

    const service = buildFacadeService({ prisma, projectionsService, veetiService, veetiSyncService, veetiEffectiveDataService, veetiBudgetGenerator, veetiBenchmarkService, veetiSanityService });

    const result = await service.reconcileImportYear(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      YEAR,
      {
        action: 'apply_veeti',
        dataTypes: ['tilinpaatos', 'unknown_type'],
      } as any,
    );

    expect(veetiEffectiveDataService.removeOverrides).toHaveBeenCalledWith(
      ORG_ID,
      1535,
      YEAR,
      ['tilinpaatos'],
    );
    expect(result.reconciledDataTypes).toEqual(['tilinpaatos']);
    expect(result.yearData.sourceStatus).toBe('VEETI');
    expect(result.status.excludedYears).toEqual([]);
  });

  it('allows VEETI reconcile for prices and both volume datasets in one request', async () => {
    const ORG_ID = 'org-1';
    const YEAR = 2024;
    const yearDataset = {
      year: YEAR,
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
          dataType: 'taksa',
          rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.75 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 23800 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    };
    const prisma = {} as any;
    const projectionsService = {} as any;
    const veetiService = {} as any;
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            tariff_revenue: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest
        .fn()
        .mockResolvedValueOnce(yearDataset)
        .mockResolvedValueOnce({
          ...yearDataset,
          sourceStatus: 'VEETI',
          datasets: yearDataset.datasets.map((dataset) => ({
            ...dataset,
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
          })),
        }),
      getExcludedYears: jest.fn().mockResolvedValue([]),
      removeOverrides: jest.fn().mockResolvedValue({ count: 3 }),
    } as any;
    const veetiBudgetGenerator = {} as any;
    const veetiBenchmarkService = {} as any;
    const veetiSanityService = {} as any;

    const service = buildFacadeService({ prisma, projectionsService, veetiService, veetiSyncService, veetiEffectiveDataService, veetiBudgetGenerator, veetiBenchmarkService, veetiSanityService });

    const result = await service.reconcileImportYear(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      YEAR,
      {
        action: 'apply_veeti',
        dataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
      } as any,
    );

    expect(veetiEffectiveDataService.removeOverrides).toHaveBeenCalledWith(
      ORG_ID,
      1535,
      YEAR,
      ['taksa', 'volume_vesi', 'volume_jatevesi'],
    );
    expect(result.reconciledDataTypes).toEqual([
      'taksa',
      'volume_vesi',
      'volume_jatevesi',
    ]);
  });
});
}


