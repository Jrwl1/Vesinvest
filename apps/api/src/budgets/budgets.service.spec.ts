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
      confirmKvaImport: jest.fn().mockResolvedValue({
        success: true,
        budgetId: 'budget-new',
        created: { subtotalLines: 3, revenueDrivers: 2, accountLines: 0 },
      }),
      requireOrgId: jest.fn((id: string) => id),
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

  describe('confirmKvaImport', () => {
    const orgId = 'org-1';
    const baseBody = {
      nimi: 'KVA Import 2024',
      vuosi: 2024,
      subtotalLines: [
        { palvelutyyppi: 'vesi' as const, categoryKey: 'sales_revenue', tyyppi: 'tulo' as const, summa: 400000, lahde: 'KVA' },
        { palvelutyyppi: 'vesi' as const, categoryKey: 'personnel_costs', tyyppi: 'kulu' as const, summa: 100000, lahde: 'KVA' },
        { palvelutyyppi: 'vesi' as const, categoryKey: 'depreciation', tyyppi: 'poisto' as const, summa: 50000, lahde: 'KVA' },
      ],
      revenueDrivers: [
        { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.2, myytyMaara: 12000, alvProsentti: 25.5 },
        { palvelutyyppi: 'jatevesi' as const, yksikkohinta: 2.0, myytyMaara: 9000 },
      ],
    };

    it('calls repo.confirmKvaImport and returns result', async () => {
      const result = await service.confirmKvaImport(orgId, baseBody);
      expect(result.success).toBe(true);
      expect(result.budgetId).toBe('budget-new');
      expect(repo.confirmKvaImport).toHaveBeenCalledWith(orgId, baseBody);
    });

    it('throws when nimi is empty', async () => {
      await expect(service.confirmKvaImport(orgId, { ...baseBody, nimi: '' }))
        .rejects.toThrow(BadRequestException);
      await expect(service.confirmKvaImport(orgId, { ...baseBody, nimi: '  ' }))
        .rejects.toThrow('Budget name (nimi) is required');
    });

    it('throws when vuosi is out of range', async () => {
      await expect(service.confirmKvaImport(orgId, { ...baseBody, vuosi: 1999 }))
        .rejects.toThrow(BadRequestException);
      await expect(service.confirmKvaImport(orgId, { ...baseBody, vuosi: 2101 }))
        .rejects.toThrow('Year (vuosi) must be between 2000 and 2100');
    });

    it('passes accountLines when provided', async () => {
      const withLines = {
        ...baseBody,
        accountLines: [
          { tiliryhma: '4100', nimi: 'Energi', tyyppi: 'kulu' as const, summa: 10000 },
        ],
      };
      await service.confirmKvaImport(orgId, withLines);
      expect(repo.confirmKvaImport).toHaveBeenCalledWith(orgId, withLines);
    });
  });
});
