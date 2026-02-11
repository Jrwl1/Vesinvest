import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './budgets.repository';
import { BudgetImportService } from './budget-import.service';

/** Deterministic category keys from KVA subtotal extraction (contract). */
const SUBTOTAL_CATEGORY_KEYS = new Set([
  'sales_revenue',
  'connection_fees',
  'other_income',
  'materials_services',
  'personnel_costs',
  'other_costs',
  'purchased_services',
  'rents',
  'depreciation',
  'financial_income',
  'financial_costs',
  'investments',
  'operating_result',
  'net_result',
]);

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

  describe('findById', () => {
    it('returns budget with valisummat and tuloajurit so KVA-imported budget is readable', async () => {
      const budgetWithSubtotals = {
        id: 'kva-2023',
        orgId: 'org-1',
        vuosi: 2023,
        nimi: 'KVA 2023',
        tila: 'luonnos',
        createdAt: new Date(),
        updatedAt: new Date(),
        rivit: [],
        tuloajurit: [
          { id: 'd1', palvelutyyppi: 'vesi', yksikkohinta: '1.2', myytyMaara: '12000', talousarvioId: 'kva-2023' },
        ],
        valisummat: [
          { id: 'v1', talousarvioId: 'kva-2023', categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
          { id: 'v2', talousarvioId: 'kva-2023', categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 100000 },
        ],
      };
      repo.findById.mockResolvedValue(budgetWithSubtotals as any);

      const result = await service.findById('org-1', 'kva-2023');

      expect(result).toBe(budgetWithSubtotals);
      expect(result).not.toBeNull();
      expect(result!.valisummat).toHaveLength(2);
      expect(result!.tuloajurit).toHaveLength(1);
      expect(repo.findById).toHaveBeenCalledWith('org-1', 'kva-2023');
    });
  });

  describe('previewKva', () => {
    it('returns per-year extracted totals and deterministic category keys (preview API contract)', async () => {
      const mockSubtotalLines = [
        { categoryKey: 'sales_revenue', categoryName: 'Försäljningsintäkter', type: 'income' as const, amount: 380000, year: 2022, sourceSheet: 'KVA totalt' },
        { categoryKey: 'sales_revenue', categoryName: 'Försäljningsintäkter', type: 'income' as const, amount: 400000, year: 2023, sourceSheet: 'KVA totalt' },
        { categoryKey: 'sales_revenue', categoryName: 'Försäljningsintäkter', type: 'income' as const, amount: 420000, year: 2024, sourceSheet: 'KVA totalt' },
        { categoryKey: 'personnel_costs', categoryName: 'Personalkostnader', type: 'cost' as const, amount: 115000, year: 2024, sourceSheet: 'KVA totalt' },
      ];
      const mockParseFile = jest.fn().mockResolvedValue({
        rows: [],
        skippedRows: 0,
        detectedFormat: 'KVA template',
        warnings: [],
        templateId: 'kva',
        subtotalLines: mockSubtotalLines,
      });
      const mockRepo = { requireOrgId: jest.fn((id: string) => id) };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetsService,
          { provide: BudgetsRepository, useValue: mockRepo },
          { provide: BudgetImportService, useValue: { parseFile: mockParseFile } },
        ],
      }).compile();
      const previewService = module.get(BudgetsService);

      const result = await previewService.previewKva('org-1', Buffer.from(''), 'KVA.xlsx');

      expect(result.templateId).toBe('kva');
      expect(result.subtotalLines).toBeDefined();
      expect(result.subtotalLines!.length).toBe(4);
      const years = [...new Set(result.subtotalLines!.map((l) => l.year))].sort((a, b) => a - b);
      expect(years).toEqual([2022, 2023, 2024]);
      for (const line of result.subtotalLines!) {
        expect(SUBTOTAL_CATEGORY_KEYS.has(line.categoryKey)).toBe(true);
      }
    });

    it('regression: preview payload is deterministic across repeated uploads (same buffer yields same shape)', async () => {
      const mockSubtotalLines = [
        { categoryKey: 'sales_revenue', categoryName: 'X', type: 'income' as const, amount: 100, year: 2024, sourceSheet: 'KVA totalt' },
        { categoryKey: 'personnel_costs', categoryName: 'Y', type: 'cost' as const, amount: 50, year: 2024, sourceSheet: 'KVA totalt' },
      ];
      const mockParseFile = jest.fn().mockResolvedValue({
        rows: [],
        skippedRows: 0,
        detectedFormat: 'KVA template',
        warnings: [],
        templateId: 'kva',
        subtotalLines: mockSubtotalLines,
      });
      const mockRepo = { requireOrgId: jest.fn((id: string) => id) };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BudgetsService,
          { provide: BudgetsRepository, useValue: mockRepo },
          { provide: BudgetImportService, useValue: { parseFile: mockParseFile } },
        ],
      }).compile();
      const svc = module.get(BudgetsService);
      const buf = Buffer.from('same');
      const r1 = await svc.previewKva('org-1', buf, 'KVA.xlsx');
      const r2 = await svc.previewKva('org-1', buf, 'KVA.xlsx');
      expect(r1.subtotalLines!.length).toBe(r2.subtotalLines!.length);
      const keys1 = [...new Set(r1.subtotalLines!.map((l) => l.categoryKey))].sort();
      const keys2 = [...new Set(r2.subtotalLines!.map((l) => l.categoryKey))].sort();
      expect(keys1).toEqual(keys2);
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

    it('throws when extractedYears is provided and vuosi is not in it', async () => {
      await expect(
        service.confirmKvaImport(orgId, { ...baseBody, extractedYears: [2022, 2023] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmKvaImport(orgId, { ...baseBody, extractedYears: [2022, 2023] }),
      ).rejects.toThrow(/Selected year must be one of the years extracted/);
    });

    it('calls repo when extractedYears includes vuosi', async () => {
      await service.confirmKvaImport(orgId, { ...baseBody, extractedYears: [2022, 2023, 2024] });
      expect(repo.confirmKvaImport).toHaveBeenCalledWith(orgId, baseBody);
    });

    it('throws when subtotalLines is missing or empty', async () => {
      await expect(service.confirmKvaImport(orgId, { ...baseBody, subtotalLines: [] }))
        .rejects.toThrow(BadRequestException);
      await expect(service.confirmKvaImport(orgId, { ...baseBody, subtotalLines: [] }))
        .rejects.toThrow(/Extracted totals.*subtotalLines.*required/);
    });

    it('throws when payload references non-previewed category key', async () => {
      const bodyWithUnknownCategory = {
        ...baseBody,
        subtotalLines: [
          ...baseBody.subtotalLines,
          { palvelutyyppi: 'vesi' as const, categoryKey: 'unknown_category', tyyppi: 'kulu' as const, summa: 1, lahde: 'KVA' },
        ],
      };
      await expect(service.confirmKvaImport(orgId, bodyWithUnknownCategory))
        .rejects.toThrow(BadRequestException);
      await expect(service.confirmKvaImport(orgId, bodyWithUnknownCategory))
        .rejects.toThrow(/not a valid KVA preview category/);
    });

    it('throws ConflictException (409) when repo throws P2002 duplicate name-year', async () => {
      const prismaErr = new Error('Unique constraint failed');
      (prismaErr as any).code = 'P2002';
      repo.confirmKvaImport.mockRejectedValue(prismaErr);
      await expect(service.confirmKvaImport(orgId, baseBody)).rejects.toThrow(ConflictException);
      await expect(service.confirmKvaImport(orgId, baseBody)).rejects.toThrow(
        /budget with this name already exists for this year/,
      );
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
