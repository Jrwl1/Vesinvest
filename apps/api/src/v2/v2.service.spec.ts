import { V2Service } from './v2.service';

describe('V2Service import exclusion behavior', () => {
  const ORG_ID = 'org-1';

  const buildService = () => {
    const prisma = {} as any;
    const projectionsService = {} as any;
    const veetiService = {} as any;
    const veetiSyncService = {
      refreshOrg: jest.fn().mockResolvedValue({ ok: true }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: 2023,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: false,
          },
        },
        {
          vuosi: 2024,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: false,
          },
        },
      ]),
      getStatus: jest.fn().mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
    } as any;
    const veetiEffectiveDataService = {
      getExcludedYears: jest.fn().mockResolvedValue([2023]),
    } as any;
    const veetiBudgetGenerator = {
      generateBudgets: jest.fn().mockResolvedValue({
        success: true,
        count: 1,
        results: [{ budgetId: 'b-1', vuosi: 2024, mode: 'created' }],
        skipped: [],
      }),
    } as any;
    const veetiBenchmarkService = {} as any;
    const veetiSanityService = {
      checkYears: jest.fn().mockResolvedValue({ checkedAt: 'now', rows: [] }),
    } as any;

    const service = new V2Service(
      prisma,
      projectionsService,
      veetiService,
      veetiSyncService,
      veetiEffectiveDataService,
      veetiBudgetGenerator,
      veetiBenchmarkService,
      veetiSanityService,
    );

    return {
      service,
      veetiSyncService,
      veetiEffectiveDataService,
      veetiBudgetGenerator,
    };
  };

  it('skips excluded years during sync selection resolution', async () => {
    const {
      service,
      veetiBudgetGenerator,
      veetiEffectiveDataService,
      veetiSyncService,
    } = buildService();

    const result = await service.syncImport(ORG_ID, [2023, 2024]);

    expect(veetiSyncService.refreshOrg).toHaveBeenCalledWith(ORG_ID);
    expect(veetiEffectiveDataService.getExcludedYears).toHaveBeenCalledWith(
      ORG_ID,
    );
    expect(veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(ORG_ID, [
      2024,
    ]);
    expect(result.generatedBudgets.skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ vuosi: 2023 })]),
    );
  });

  it('includes excludedYears in import status response', async () => {
    const { service, veetiSyncService, veetiEffectiveDataService } =
      buildService();

    const status = await service.getImportStatus(ORG_ID);

    expect(veetiSyncService.getStatus).toHaveBeenCalledWith(ORG_ID);
    expect(veetiSyncService.getAvailableYears).toHaveBeenCalledWith(ORG_ID);
    expect(veetiEffectiveDataService.getExcludedYears).toHaveBeenCalledWith(
      ORG_ID,
    );
    expect(status.excludedYears).toEqual([2023]);
  });
});
