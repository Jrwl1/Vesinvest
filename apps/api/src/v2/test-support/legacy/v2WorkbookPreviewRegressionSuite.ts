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


export function registerV2WorkbookPreviewRegressionSuite() {
describe('V2Service workbook preview regression', () => {
  const ORG_ID = 'org-1';
  const VEETI_ID = 1535;

  const buildWorkbookFixtureBuffer = async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('KVA totalt');
    sheet.addRows([
      ['Rad', 2022, 2023, 2024],
      ['Omsättning', 610000, 700000, 790000],
      ['Material och tjänster', 12000, 25000, 60000],
      ['Personalkostnader', 220000, 234000, 235000],
      ['Avskrivningar och nedskrivningar', 180000, 186000, 186000],
      ['Övriga rörelsekostnader', 300000, 320000, 323000],
      [
        'Vinst (- förlust) före bokslutsdepositioner och skatter',
        15000,
        -80000,
        4000,
      ],
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  };

  it('parses the six shared KVA rows and matches them to imported workspace years', async () => {
    const fileBuffer = await buildWorkbookFixtureBuffer();
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: VEETI_ID,
        workspaceYears: [2022, 2023, 2024],
      }),
    } as any;

    const buildYearDataset = (
      year: number,
      financials: Record<string, unknown>,
    ) => ({
      year,
      veetiId: VEETI_ID,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Vuosi: year, ...financials }],
          effectiveRows: [{ Vuosi: year, ...financials }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });

    const yearDatasets = new Map([
      [
        2022,
        buildYearDataset(2022, {
          Liikevaihto: 610000,
          Henkilostokulut: 220000,
          Poistot: 180000,
          LiiketoiminnanMuutKulut: 300000,
          TilikaudenYliJaama: 15000,
        }),
      ],
      [
        2023,
        buildYearDataset(2023, {
          Liikevaihto: 700000,
          AineetJaPalvelut: 25000,
          Henkilostokulut: 234000,
          Poistot: 186000,
          LiiketoiminnanMuutKulut: 320000,
          TilikaudenYliJaama: -80000,
        }),
      ],
      [
        2024,
        buildYearDataset(2024, {
          Liikevaihto: 790000,
          AineetJaPalvelut: 60000,
          Henkilostokulut: 235000,
          Poistot: 186000,
          LiiketoiminnanMuutKulut: 323000,
          TilikaudenYliJaama: 4000,
        }),
      ],
    ]);

    const veetiEffectiveDataService = {
      getAvailableYears: jest.fn().mockResolvedValue([
        { vuosi: 2022 },
        { vuosi: 2023 },
        { vuosi: 2024 },
      ]),
      getYearDataset: jest
        .fn()
        .mockImplementation(async (_orgId: string, year: number) => {
          const dataset = yearDatasets.get(year);
          if (!dataset) {
            throw new Error(`Missing test dataset for year ${year}`);
          }
          return dataset;
        }),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.previewWorkbookImport(ORG_ID, {
      fileName: 'kronoby-kva.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: fileBuffer.length,
      fileBuffer,
    });

    expect(result.sheetName).toBe('KVA totalt');
    expect(result.importedYears).toEqual([2022, 2023, 2024]);
    expect(result.matchedYears).toEqual([2022, 2023, 2024]);
    expect(result.workbookYears).toEqual([2022, 2023, 2024]);
    expect(result.years).toHaveLength(3);
    expect(result.years[0]?.rows.map((row) => row.sourceField)).toEqual([
      'Liikevaihto',
      'AineetJaPalvelut',
      'Henkilostokulut',
      'Poistot',
      'LiiketoiminnanMuutKulut',
      'TilikaudenYliJaama',
    ]);
    expect(
      result.years
        .find((row) => row.year === 2022)
        ?.rows.find((row) => row.sourceField === 'AineetJaPalvelut'),
    ).toMatchObject({
      currentValue: null,
      workbookValue: 12000,
      currentSource: 'missing',
      suggestedAction: 'apply_workbook',
    });
    expect(
      result.years
        .find((row) => row.year === 2024)
        ?.rows.find((row) => row.sourceField === 'AineetJaPalvelut'),
    ).toMatchObject({
      currentValue: 60000,
      workbookValue: 60000,
      differs: false,
      suggestedAction: 'keep_veeti',
    });
    expect(
      result.years
        .find((row) => row.year === 2024)
        ?.rows.find((row) => row.sourceField === 'TilikaudenYliJaama'),
    ).toMatchObject({
      workbookValue: 4000,
    });
    expect(result.canApply).toBe(true);
  });

  it('rejects workbook previews that are not OpenXML workbook uploads', async () => {
    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {
        getStatus: jest.fn().mockResolvedValue({
          orgId: ORG_ID,
          veetiId: VEETI_ID,
          workspaceYears: [2024],
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.previewWorkbookImport(ORG_ID, {
        fileName: 'kronoby-kva.csv',
        contentType: 'text/csv',
        sizeBytes: 12,
        fileBuffer: Buffer.from('not-a-workbook'),
      }),
    ).rejects.toThrow('Workbook preview only supports .xlsx or .xlsm uploads.');
  });
});
}


