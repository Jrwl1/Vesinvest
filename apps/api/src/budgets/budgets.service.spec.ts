import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './budgets.repository';
import { BudgetImportService } from './budget-import.service';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let repo: jest.Mocked<BudgetsRepository>;

  beforeEach(async () => {
    const mockRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'budget-1', orgId: 'org-1' }),
      createLine: jest.fn().mockResolvedValue({}),
      upsertDriverByPalvelutyyppi: jest.fn().mockResolvedValue({}),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: BudgetsRepository, useValue: mockRepo },
        { provide: BudgetImportService, useValue: {} },
      ],
    }).compile();
    service = module.get(BudgetsService);
    repo = module.get(BudgetsRepository);
  });

  describe('importConfirm', () => {
    const orgId = 'org-1';
    const budgetId = 'budget-1';
    const rows = [
      { tiliryhma: '4100', nimi: 'Energi', tyyppi: 'kulu', summa: 1000 },
    ];

    it('creates lines and returns created/skipped counts', async () => {
      const result = await service.importConfirm(orgId, budgetId, rows);
      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(1);
      expect(repo.createLine).toHaveBeenCalledWith(orgId, budgetId, expect.objectContaining({ tiliryhma: '4100', summa: 1000 }));
    });

    it('throws when no rows', async () => {
      await expect(service.importConfirm(orgId, budgetId, [])).rejects.toThrow(BadRequestException);
      await expect(service.importConfirm(orgId, budgetId, [])).rejects.toThrow('No rows to import');
    });

    it('when revenueDrivers provided, upserts Tuloajuri by palvelutyyppi', async () => {
      const revenueDrivers = [
        { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.2, myytyMaara: 10000, alvProsentti: 24 },
        { palvelutyyppi: 'jatevesi' as const, yksikkohinta: 2.5, myytyMaara: 8000, liittymamaara: 500 },
      ];
      await service.importConfirm(orgId, budgetId, rows, revenueDrivers);
      expect(repo.upsertDriverByPalvelutyyppi).toHaveBeenCalledTimes(2);
      expect(repo.upsertDriverByPalvelutyyppi).toHaveBeenCalledWith(
        orgId,
        budgetId,
        expect.objectContaining({
          palvelutyyppi: 'vesi',
          yksikkohinta: 1.2,
          myytyMaara: 10000,
          alvProsentti: 24,
        }),
      );
      expect(repo.upsertDriverByPalvelutyyppi).toHaveBeenCalledWith(
        orgId,
        budgetId,
        expect.objectContaining({
          palvelutyyppi: 'jatevesi',
          yksikkohinta: 2.5,
          myytyMaara: 8000,
          liittymamaara: 500,
        }),
      );
    });

    it('when revenueDrivers all empty/zero, does NOT call upsertDriverByPalvelutyyppi', async () => {
      await service.importConfirm(orgId, budgetId, rows, [
        { palvelutyyppi: 'vesi' as const },
        { palvelutyyppi: 'jatevesi' as const },
      ]);
      expect(repo.upsertDriverByPalvelutyyppi).not.toHaveBeenCalled();
    });

    it('when at least one driver has yksikkohinta > 0, calls upsertDriverByPalvelutyyppi for meaningful drivers', async () => {
      await service.importConfirm(orgId, budgetId, rows, [
        { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.2 },
        { palvelutyyppi: 'jatevesi' as const },
      ]);
      expect(repo.upsertDriverByPalvelutyyppi).toHaveBeenCalledTimes(1);
      expect(repo.upsertDriverByPalvelutyyppi).toHaveBeenCalledWith(
        orgId,
        budgetId,
        expect.objectContaining({ palvelutyyppi: 'vesi', yksikkohinta: 1.2, myytyMaara: 0 }),
      );
    });
  });
});
