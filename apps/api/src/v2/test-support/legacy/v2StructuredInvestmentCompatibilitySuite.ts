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


export function registerV2StructuredInvestmentCompatibilitySuite() {
describe('V2Service structured investment compatibility', () => {
  const buildService = () =>
    buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

  it('normalizes legacy yearly investments to the structured contract with null metadata', () => {
    const service = buildService();

    const result = ((service as any).forecastService as any).normalizeUserInvestments([
      { year: 2024, amount: 1200 },
    ]);

    expect(result).toEqual([
      {
        rowId: 'investment-2024-0',
        year: 2024,
        amount: 1200,
        target: null,
        category: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
      },
    ]);
  });

  it('builds yearly investment rows that preserve structured metadata while keeping legacy years compatible', () => {
    const service = buildService();

    const rows = ((service as any).forecastService as any).buildYearlyInvestments(
      {
        aikajaksoVuosia: 2,
        userInvestments: [
          { year: 2024, amount: 1000 },
          {
            year: 2025,
            amount: 2000,
            target: 'Wastewater plant',
            category: 'network',
            investmentType: 'replacement',
            confidence: 'high',
            waterAmount: 1200,
            wastewaterAmount: 800,
            note: 'Trunk line renewal',
          },
        ],
        vuosiYlikirjoitukset: {},
      },
      2024,
    );

    expect(rows).toEqual([
      {
        rowId: 'investment-2024-0',
        year: 2024,
        amount: 1000,
        target: null,
        category: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
      },
      {
        rowId: 'investment-2025-1',
        year: 2025,
        amount: 2000,
        target: 'Wastewater plant',
        category: 'network',
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: 'replacement',
        confidence: 'high',
        waterAmount: 1200,
        wastewaterAmount: 800,
        note: 'Trunk line renewal',
      },
      {
        rowId: 'year-2026',
        year: 2026,
        amount: 0,
        target: null,
        category: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
      },
    ]);
  });

  it('keeps one category value per investment row for depreciation mapping compatibility', () => {
    const service = buildService();

    const result = ((service as any).forecastService as any).normalizeUserInvestments([
      {
        year: 2024,
        amount: 1200,
        category: 'network',
      },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        year: 2024,
        category: 'network',
      }),
    );
    expect(Array.isArray(result[0].category)).toBe(false);
  });

  it('preserves investment program target and service split fields', () => {
    const service = buildService();

    const result = ((service as any).forecastService as any).normalizeUserInvestments([
      {
        year: 2024,
        amount: 1200,
        target: 'Main line renewal',
        category: 'network',
        waterAmount: 700,
        wastewaterAmount: 500,
        note: 'Phase 1',
      },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        year: 2024,
        amount: 1200,
        target: 'Main line renewal',
        category: 'network',
        waterAmount: 700,
        wastewaterAmount: 500,
        note: 'Phase 1',
      }),
    );
  });
});
}


