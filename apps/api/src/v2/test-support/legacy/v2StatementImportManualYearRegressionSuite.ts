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


export function registerV2StatementImportManualYearRegressionSuite() {
describe('V2Service statement import manual-year regression', () => {
  const ORG_ID = 'org-1';
  const YEAR = 2024;
  const buildTariffYearDataset = (params?: {
    revenue?: number;
    fixedRevenue?: number | null;
    waterPrice?: number;
    wastewaterPrice?: number;
    soldWaterVolume?: number;
    soldWastewaterVolume?: number;
  }) => ({
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
        rawRows: [
          {
            Vuosi: YEAR,
            Liikevaihto: params?.revenue ?? 100000,
            PerusmaksuYhteensa: params?.fixedRevenue ?? null,
            AineetJaPalvelut: 15000,
            Henkilostokulut: 20000,
            LiiketoiminnanMuutKulut: 18000,
            Poistot: 5000,
            TilikaudenYliJaama: 30000,
          },
        ],
        effectiveRows: [
          {
            Vuosi: YEAR,
            Liikevaihto: params?.revenue ?? 100000,
            PerusmaksuYhteensa: params?.fixedRevenue ?? null,
            AineetJaPalvelut: 15000,
            Henkilostokulut: 20000,
            LiiketoiminnanMuutKulut: 18000,
            Poistot: 5000,
            TilikaudenYliJaama: 30000,
          },
        ],
        source: 'manual',
        hasOverride: true,
        reconcileNeeded: true,
        overrideMeta: null,
      },
      {
        dataType: 'taksa',
        rawRows: [
          { Tyyppi_Id: 1, Kayttomaksu: params?.waterPrice ?? 2.5 },
          { Tyyppi_Id: 2, Kayttomaksu: params?.wastewaterPrice ?? 3.1 },
        ],
        effectiveRows: [
          { Tyyppi_Id: 1, Kayttomaksu: params?.waterPrice ?? 2.5 },
          { Tyyppi_Id: 2, Kayttomaksu: params?.wastewaterPrice ?? 3.1 },
        ],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_vesi',
        rawRows: [{ Maara: params?.soldWaterVolume ?? 25000 }],
        effectiveRows: [{ Maara: params?.soldWaterVolume ?? 25000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_jatevesi',
        rawRows: [{ Maara: params?.soldWastewaterVolume ?? 24000 }],
        effectiveRows: [{ Maara: params?.soldWastewaterVolume ?? 24000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
    ],
  });

  it('keeps a statement-backed financial patch sync-ready without extra backend workflow flags', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: 1535,
        workspaceYears: [YEAR],
      }),
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
      getYearDataset: jest.fn().mockResolvedValue({
        year: YEAR,
        veetiId: 1535,
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
            rawRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 700000,
                AineetJaPalvelut: 175000,
                Henkilostokulut: 220000,
                LiiketoiminnanMuutKulut: 315000,
                Poistot: 182000,
                RahoitustuototJaKulut: -9000,
                TilikaudenYliJaama: 4000,
              },
            ],
            effectiveRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 700000,
                AineetJaPalvelut: 175000,
                Henkilostokulut: 220000,
                LiiketoiminnanMuutKulut: 315000,
                Poistot: 182000,
                RahoitustuototJaKulut: -9000,
                TilikaudenYliJaama: 4000,
              },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      }),
      upsertOverride,
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

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            tariff_revenue: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    const result = await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from statement PDF: bokslut-2024.pdf',
        financials: {
          liikevaihto: 786930.85,
          perusmaksuYhteensa: 244000.15,
          aineetJaPalvelut: 182000.12,
          henkilostokulut: 235498.71,
          liiketoiminnanMuutKulut: 322785.53,
          poistot: 186904.08,
          rahoitustuototJaKulut: -10225.3,
          tilikaudenYliJaama: 3691.35,
        },
        statementImport: {
          fileName: 'bokslut-2024.pdf',
          pageNumber: 4,
          confidence: 98,
          scannedPageCount: 5,
          matchedFields: [
            'liikevaihto',
            'henkilostokulut',
            'liiketoiminnanMuutKulut',
            'poistot',
            'rahoitustuototJaKulut',
            'tilikaudenYliJaama',
          ],
          warnings: [],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        veetiId: 1535,
        vuosi: YEAR,
        dataType: 'tilinpaatos',
        editedBy: 'user-1',
        rows: [
          expect.objectContaining({
            Liikevaihto: 786930.85,
            PerusmaksuYhteensa: 244000.15,
            AineetJaPalvelut: 182000.12,
            Henkilostokulut: 235498.71,
            LiiketoiminnanMuutKulut: 322785.53,
            Poistot: 186904.08,
            RahoitustuototJaKulut: -10225.3,
            TilikaudenYliJaama: 3691.35,
            __sourceMeta: expect.objectContaining({
              reason: 'Imported from statement PDF: bokslut-2024.pdf',
              provenance: expect.objectContaining({
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: [
                  'liikevaihto',
                  'henkilostokulut',
                  'liiketoiminnanMuutKulut',
                  'poistot',
                  'rahoitustuototJaKulut',
                  'tilikaudenYliJaama',
                ],
                warnings: [],
                fieldSources: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'Liikevaihto',
                    provenance: expect.objectContaining({
                      kind: 'statement_import',
                    }),
                  }),
                  expect.objectContaining({
                    sourceField: 'TilikaudenYliJaama',
                    provenance: expect.objectContaining({
                      kind: 'statement_import',
                    }),
                  }),
                ]),
              }),
            }),
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      year: YEAR,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
      tariffRevenueReason: null,
    });
  });

  it('returns a missing_fixed_revenue tariff reason when fixed revenue is absent', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 136900,
          fixedRevenue: null,
        }),
      ),
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

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.completeness.tariff_revenue).toBe(false);
    expect(result.tariffRevenueReason).toBe('missing_fixed_revenue');
    expect(result.baselineReady).toBe(true);
    expect(result.baselineWarnings).toEqual(['tariffRevenueMismatch']);
  });

  it('returns a mismatch tariff reason when revenue does not reconcile after fixed revenue is present', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 100000,
          fixedRevenue: 12000,
        }),
      ),
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

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.completeness.tariff_revenue).toBe(false);
    expect(result.tariffRevenueReason).toBe('mismatch');
    expect(result.baselineReady).toBe(true);
    expect(result.baselineWarnings).toEqual(['tariffRevenueMismatch']);
  });

  it('does not mark the financial baseline ready when Liikevaihto is zero', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 0,
          fixedRevenue: 0,
        }),
      ),
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

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.baselineReady).toBe(false);
    expect(result.baselineMissingRequirements).toContain('financialBaseline');
  });

  it('treats explicit zero fixed revenue as a real value instead of a missing one', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 136900,
          fixedRevenue: 0,
        }),
      ),
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

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.completeness.tariff_revenue).toBe(true);
    expect(result.tariffRevenueReason).toBeNull();
  });

  it('includes tariff revenue mismatch metadata in refreshed status rows', async () => {
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: 1535,
        workspaceYears: [YEAR],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            tariff_revenue: false,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: [],
          },
          warnings: [],
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getExcludedYears: jest.fn().mockResolvedValue([]),
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 100000,
          fixedRevenue: 12000,
        }),
      ),
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

    const status = await service.getImportStatus(ORG_ID);

    expect(status.years[0]).toMatchObject({
      vuosi: YEAR,
      baselineReady: true,
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
    });
    expect(status.years[0].missingRequirements).toContain('tariffRevenue');
  });

  it('stores workbook provenance and preserves untouched financial fields during selective override apply', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: 1535,
        workspaceYears: [YEAR],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
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
            rawRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 710000,
                AineetJaPalvelut: null,
                Henkilostokulut: 230000,
                LiiketoiminnanMuutKulut: 305000,
                Poistot: 180000,
                TilikaudenYliJaama: -5000,
              },
            ],
            effectiveRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 710000,
                AineetJaPalvelut: 170000,
                Henkilostokulut: 230000,
                LiiketoiminnanMuutKulut: 305000,
                Poistot: 180000,
                TilikaudenYliJaama: -5000,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: '2026-03-08T12:00:00.000Z',
              editedBy: 'user-1',
              reason: 'Previous repair',
              provenance: {
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: ['liikevaihto'],
                warnings: [],
              },
            },
          },
        ],
      }),
      upsertOverride,
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

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from KVA workbook: kronoby-kva.xlsx',
        financials: {
          aineetJaPalvelut: 182000.12,
        },
        workbookImport: {
          kind: 'kva_import',
          fileName: 'kronoby-kva.xlsx',
          sheetName: 'KVA totalt',
          matchedYears: [2022, 2023, 2024],
          candidateRows: [
            {
              sourceField: 'AineetJaPalvelut',
              workbookValue: 182000.12,
              action: 'apply_workbook',
            },
            {
              sourceField: 'Poistot',
              workbookValue: 180000,
              action: 'keep_veeti',
            },
          ],
          confirmedSourceFields: ['AineetJaPalvelut'],
          warnings: [],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'tilinpaatos',
        rows: [
          expect.objectContaining({
            Vuosi: YEAR,
            Liikevaihto: 710000,
            AineetJaPalvelut: 182000.12,
            Henkilostokulut: 230000,
            LiiketoiminnanMuutKulut: 305000,
            Poistot: 180000,
            TilikaudenYliJaama: -5000,
            __sourceMeta: expect.objectContaining({
              reason: 'Imported from KVA workbook: kronoby-kva.xlsx',
              provenance: expect.objectContaining({
                kind: 'kva_import',
                fileName: 'kronoby-kva.xlsx',
                sheetName: 'KVA totalt',
                matchedYears: [2022, 2023, 2024],
                confirmedSourceFields: ['AineetJaPalvelut'],
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
                  {
                    sourceField: 'Poistot',
                    workbookValue: 180000,
                    action: 'keep_veeti',
                  },
                ],
              }),
            }),
          }),
        ],
      }),
    );
  });

  it('stores QDIS import provenance on price and volume overrides', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        veetiId: 1535,
        nimi: 'Water Utility',
        ytunnus: '1234567-8',
        fetchedAt: '2026-03-08T10:00:00.000Z',
        years: [YEAR],
        excludedYears: [],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      upsertOverride,
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

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos'],
            manualDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    const result = await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from QDIS PDF: qdis-2022.pdf',
        prices: {
          waterUnitPrice: 1.2,
          wastewaterUnitPrice: 2.5,
        },
        volumes: {
          soldWaterVolume: 65000,
          soldWastewaterVolume: 35000,
        },
        qdisImport: {
          fileName: 'qdis-2022.pdf',
          pageNumber: 2,
          confidence: 94,
          scannedPageCount: 2,
          matchedFields: [
            'waterUnitPrice',
            'wastewaterUnitPrice',
            'soldWaterVolume',
            'soldWastewaterVolume',
          ],
          warnings: [],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'taksa',
        rows: expect.arrayContaining([
          expect.objectContaining({
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'qdis_import',
                fileName: 'qdis-2022.pdf',
                pageNumber: 2,
                confidence: 94,
              }),
            }),
          }),
        ]),
      }),
    );
    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'volume_jatevesi',
        rows: [
          expect.objectContaining({
            Maara: 35000,
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'qdis_import',
                fileName: 'qdis-2022.pdf',
              }),
            }),
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      year: YEAR,
      patchedDataTypes: expect.arrayContaining([
        'taksa',
        'volume_vesi',
        'volume_jatevesi',
      ]),
    });
  });

  it('stores generic document provenance when one PDF patches financials and tariff data together', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: 1535,
        workspaceYears: [YEAR],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        year: YEAR,
        veetiId: 1535,
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
            rawRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 700000,
                AineetJaPalvelut: 175000,
                Henkilostokulut: 220000,
                LiiketoiminnanMuutKulut: 315000,
                Poistot: 182000,
                TilikaudenYliJaama: 4000,
              },
            ],
            effectiveRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 700000,
                AineetJaPalvelut: 175000,
                Henkilostokulut: 220000,
                LiiketoiminnanMuutKulut: 315000,
                Poistot: 182000,
                TilikaudenYliJaama: 4000,
              },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      }),
      upsertOverride,
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

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: [],
            manualDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from source document: source-2024.pdf',
        financials: {
          liikevaihto: 786930.85,
          tilikaudenYliJaama: 3691.35,
        },
        prices: {
          waterUnitPrice: 1.2,
          wastewaterUnitPrice: 2.5,
        },
        volumes: {
          soldWaterVolume: 65000,
          soldWastewaterVolume: 35000,
        },
        documentImport: {
          fileName: 'source-2024.pdf',
          pageNumber: undefined,
          pageNumbers: [1, 2],
          confidence: 91,
          scannedPageCount: 6,
          matchedFields: [
            'Liikevaihto',
            'TilikaudenYliJaama',
            'waterUnitPrice',
            'wastewaterUnitPrice',
            'soldWaterVolume',
            'soldWastewaterVolume',
          ],
          warnings: ['Generic PDF detection needs manual review before saving.'],
          documentProfile: 'generic_pdf',
          datasetKinds: ['financials', 'prices', 'volumes'],
          sourceLines: [
            {
              text: 'Omsattning 786 930,85',
              pageNumber: 2,
            },
            {
              text: 'Water 1,20 EUR/m3',
              pageNumber: 1,
            },
          ],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'tilinpaatos',
        rows: [
          expect.objectContaining({
            Liikevaihto: 786930.85,
            TilikaudenYliJaama: 3691.35,
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'document_import',
                fileName: 'source-2024.pdf',
                pageNumber: null,
                pageNumbers: [1, 2],
                documentProfile: 'generic_pdf',
                datasetKinds: ['financials', 'prices', 'volumes'],
                sourceLines: [
                  {
                    text: 'Omsattning 786 930,85',
                    pageNumber: 2,
                  },
                  {
                    text: 'Water 1,20 EUR/m3',
                    pageNumber: 1,
                  },
                ],
                fieldSources: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'Liikevaihto',
                    provenance: expect.objectContaining({
                      kind: 'document_import',
                    }),
                  }),
                ]),
              }),
            }),
          }),
        ],
      }),
    );
    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'taksa',
        rows: expect.arrayContaining([
          expect.objectContaining({
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'document_import',
                fileName: 'source-2024.pdf',
              }),
            }),
          }),
        ]),
      }),
    );
  });
});
}


