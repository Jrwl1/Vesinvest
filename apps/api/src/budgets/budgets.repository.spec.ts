import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BudgetsRepository } from './budgets.repository';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unit tests for BudgetsRepository — Phase 0 additions.
 *
 * These tests use a mock PrismaService to verify:
 * 1. Multiple budget profiles per org+year (unique constraint logic)
 * 2. Valisumma (subtotal) CRUD operations
 * 3. Tenant guard enforcement on valisumma operations
 */
describe('BudgetsRepository', () => {
  let repo: BudgetsRepository;
  let prisma: Record<string, any>;

  const ORG_ID = 'org-test-1';
  const BUDGET_ID = 'budget-test-1';

  beforeEach(async () => {
    prisma = {
      talousarvio: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      talousarvioRivi: {
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
      },
      tuloajuri: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
      talousarvioValisumma: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repo = module.get(BudgetsRepository);
  });

  // ── Budget profile creation (nimi required) ──

  describe('create (budget profiles)', () => {
    it('creates a budget with explicit nimi', async () => {
      const data = { vuosi: 2026, nimi: 'KVA Import' };
      prisma.talousarvio.create.mockResolvedValue({
        id: BUDGET_ID, orgId: ORG_ID, ...data, tila: 'luonnos',
      });

      const result = await repo.create(ORG_ID, data);

      expect(prisma.talousarvio.create).toHaveBeenCalledWith({
        data: { orgId: ORG_ID, vuosi: 2026, nimi: 'KVA Import', tila: 'luonnos' },
        include: { rivit: true, tuloajurit: true },
      });
      expect(result.nimi).toBe('KVA Import');
    });

    it('defaults nimi when not provided', async () => {
      const data = { vuosi: 2026 };
      prisma.talousarvio.create.mockResolvedValue({
        id: BUDGET_ID, orgId: ORG_ID, vuosi: 2026, nimi: 'Talousarvio 2026', tila: 'luonnos',
      });

      await repo.create(ORG_ID, data);

      expect(prisma.talousarvio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nimi: 'Talousarvio 2026' }),
        include: expect.any(Object),
      });
    });

    it('two budgets in same org+year with different names → two separate creates (requires DB unique on orgId+vuosi+nimi)', async () => {
      // Regression: DB must have unique(orgId, vuosi, nimi) not (orgId, vuosi). Otherwise second create would 409.
      prisma.talousarvio.create.mockResolvedValueOnce({
        id: 'b-1', orgId: ORG_ID, vuosi: 2026, nimi: 'Profile A', tila: 'luonnos',
      });
      const first = await repo.create(ORG_ID, { vuosi: 2026, nimi: 'Profile A' });

      prisma.talousarvio.create.mockResolvedValueOnce({
        id: 'b-2', orgId: ORG_ID, vuosi: 2026, nimi: 'Profile B', tila: 'luonnos',
      });
      const second = await repo.create(ORG_ID, { vuosi: 2026, nimi: 'Profile B' });

      expect(prisma.talousarvio.create).toHaveBeenCalledTimes(2);
      expect(first.nimi).toBe('Profile A');
      expect(second.nimi).toBe('Profile B');
      expect(first.id).not.toBe(second.id);
    });

    it('duplicate name in same org+year → Prisma throws unique constraint error', async () => {
      // P2002: meta.target is ['orgId','vuosi','nimi'] when DB has unique(orgId, vuosi, nimi).
      // If target were ['orgId','vuosi'] only, DB would still have old one-budget-per-year constraint.
      const prismaError = new Error('Unique constraint failed on the fields: (`orgId`,`vuosi`,`nimi`)');
      (prismaError as any).code = 'P2002';
      prisma.talousarvio.create.mockRejectedValue(prismaError);

      await expect(repo.create(ORG_ID, { vuosi: 2026, nimi: 'Same Name' }))
        .rejects.toThrow('Unique constraint failed');
    });
  });

  // ── Valisumma CRUD ──

  describe('findValisummat', () => {
    it('returns sorted valisummat for a budget', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue({ id: BUDGET_ID, orgId: ORG_ID });
      const mockData = [
        { id: 'v-1', categoryKey: 'personnel_costs', palvelutyyppi: 'jatevesi' },
        { id: 'v-2', categoryKey: 'sales_revenue', palvelutyyppi: 'vesi' },
      ];
      prisma.talousarvioValisumma.findMany.mockResolvedValue(mockData);

      const result = await repo.findValisummat(ORG_ID, BUDGET_ID);

      expect(prisma.talousarvioValisumma.findMany).toHaveBeenCalledWith({
        where: { talousarvioId: BUDGET_ID },
        orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }],
      });
      expect(result).toHaveLength(2);
    });

    it('enforces org ownership (throws if budget not found)', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue(null);

      await expect(repo.findValisummat(ORG_ID, 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertValisumma', () => {
    const baseData = {
      palvelutyyppi: 'vesi' as const,
      categoryKey: 'sales_revenue',
      tyyppi: 'tulo' as const,
      summa: 150000,
      label: 'Försäljningsintäkter',
      lahde: 'KVA',
    };

    beforeEach(() => {
      prisma.talousarvio.findFirst.mockResolvedValue({ id: BUDGET_ID, orgId: ORG_ID });
    });

    it('calls prisma.upsert with correct composite key', async () => {
      prisma.talousarvioValisumma.upsert.mockResolvedValue({ id: 'v-new', ...baseData });

      await repo.upsertValisumma(ORG_ID, BUDGET_ID, baseData);

      expect(prisma.talousarvioValisumma.upsert).toHaveBeenCalledWith({
        where: {
          talousarvioId_palvelutyyppi_categoryKey: {
            talousarvioId: BUDGET_ID,
            palvelutyyppi: 'vesi',
            categoryKey: 'sales_revenue',
          },
        },
        create: expect.objectContaining({
          talousarvioId: BUDGET_ID,
          palvelutyyppi: 'vesi',
          categoryKey: 'sales_revenue',
          tyyppi: 'tulo',
          summa: 150000,
          label: 'Försäljningsintäkter',
          lahde: 'KVA',
        }),
        update: expect.objectContaining({
          tyyppi: 'tulo',
          summa: 150000,
          label: 'Försäljningsintäkter',
          lahde: 'KVA',
        }),
      });
    });

    it('same categoryKey updates amount (upsert = update path)', async () => {
      // Simulate existing row — Prisma upsert handles it natively
      const updatedRow = { id: 'v-existing', ...baseData, summa: 200000 };
      prisma.talousarvioValisumma.upsert.mockResolvedValue(updatedRow);

      const result = await repo.upsertValisumma(ORG_ID, BUDGET_ID, { ...baseData, summa: 200000 });

      expect(result.summa).toBe(200000);
    });

    it('new categoryKey inserts (upsert = create path)', async () => {
      const newRow = {
        ...baseData,
        categoryKey: 'depreciation',
        tyyppi: 'poisto' as const,
        summa: 90000,
      };
      prisma.talousarvioValisumma.upsert.mockResolvedValue({ id: 'v-new', ...newRow });

      const result = await repo.upsertValisumma(ORG_ID, BUDGET_ID, newRow);

      expect(result.categoryKey).toBe('depreciation');
    });

    it('enforces org ownership', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue(null);

      await expect(repo.upsertValisumma('wrong-org', BUDGET_ID, baseData))
        .rejects.toThrow(NotFoundException);
    });

    it('nullifies label and lahde when not provided', async () => {
      const dataWithoutOptionals = {
        palvelutyyppi: 'jatevesi' as const,
        categoryKey: 'energy_costs',
        tyyppi: 'kulu' as const,
        summa: 85000,
      };
      prisma.talousarvioValisumma.upsert.mockResolvedValue({ id: 'v-x', ...dataWithoutOptionals });

      await repo.upsertValisumma(ORG_ID, BUDGET_ID, dataWithoutOptionals);

      expect(prisma.talousarvioValisumma.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ label: null, lahde: null }),
          update: expect.objectContaining({ label: null, lahde: null }),
        }),
      );
    });
  });

  describe('upsertManyValisummat', () => {
    const items = [
      { palvelutyyppi: 'vesi' as const, categoryKey: 'sales_revenue', tyyppi: 'tulo' as const, summa: 150000, lahde: 'KVA' },
      { palvelutyyppi: 'vesi' as const, categoryKey: 'personnel_costs', tyyppi: 'kulu' as const, summa: 120000, lahde: 'KVA' },
      { palvelutyyppi: 'jatevesi' as const, categoryKey: 'depreciation', tyyppi: 'poisto' as const, summa: 90000, lahde: 'KVA' },
    ];

    it('wraps all upserts in a $transaction', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue({ id: BUDGET_ID, orgId: ORG_ID });
      prisma.$transaction.mockResolvedValue(items.map((_, i) => ({ id: `v-${i}` })));

      await repo.upsertManyValisummat(ORG_ID, BUDGET_ID, items);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // $transaction receives an array of Prisma promises (one per item)
      const transactionArg = prisma.$transaction.mock.calls[0][0];
      expect(transactionArg).toHaveLength(3);
    });

    it('enforces org ownership before starting transaction', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue(null);

      await expect(repo.upsertManyValisummat('wrong-org', BUDGET_ID, items))
        .rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('deleteValisummat', () => {
    it('deletes all valisummat for a budget', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue({ id: BUDGET_ID, orgId: ORG_ID });
      prisma.talousarvioValisumma.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repo.deleteValisummat(ORG_ID, BUDGET_ID);

      expect(prisma.talousarvioValisumma.deleteMany).toHaveBeenCalledWith({
        where: { talousarvioId: BUDGET_ID },
      });
      expect(result.count).toBe(5);
    });

    it('enforces org ownership', async () => {
      prisma.talousarvio.findFirst.mockResolvedValue(null);

      await expect(repo.deleteValisummat('wrong-org', BUDGET_ID))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── findById includes valisummat ──

  describe('findById', () => {
    it('includes valisummat in the budget response', async () => {
      const budget = {
        id: BUDGET_ID,
        orgId: ORG_ID,
        vuosi: 2026,
        nimi: 'Test',
        rivit: [],
        tuloajurit: [],
        valisummat: [{ id: 'v-1', categoryKey: 'sales_revenue' }],
      };
      prisma.talousarvio.findFirst.mockResolvedValue(budget);

      const result = await repo.findById(ORG_ID, BUDGET_ID);

      expect(prisma.talousarvio.findFirst).toHaveBeenCalledWith({
        where: { id: BUDGET_ID, orgId: ORG_ID },
        include: expect.objectContaining({
          valisummat: { orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }] },
        }),
      });
      expect(result?.valisummat).toHaveLength(1);
    });
  });

  // ── confirmKvaImport (transactional) ──

  describe('confirmKvaImport', () => {
    const baseData = {
      vuosi: 2024,
      nimi: 'KVA Import 2024',
      subtotalLines: [
        { palvelutyyppi: 'vesi' as const, categoryKey: 'sales_revenue', tyyppi: 'tulo' as const, summa: 400000, lahde: 'KVA' },
        { palvelutyyppi: 'vesi' as const, categoryKey: 'personnel_costs', tyyppi: 'kulu' as const, summa: 100000, lahde: 'KVA' },
        { palvelutyyppi: 'vesi' as const, categoryKey: 'operating_result', tyyppi: 'tulos' as const, summa: 50000, lahde: 'KVA' },
      ],
      revenueDrivers: [
        { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.2, myytyMaara: 12000, alvProsentti: 25.5 },
      ],
    };

    it('confirm-path integration: writes extracted values into Talousarvio for chosen org, year, and name', async () => {
      const budgetId = 'tal-import-1';
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: budgetId }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const payload = {
        vuosi: 2025,
        nimi: 'KVA 2025 Extract',
        subtotalLines: [
          { palvelutyyppi: 'vesi' as const, categoryKey: 'sales_revenue', tyyppi: 'tulo' as const, summa: 500000, lahde: 'KVA' },
          { palvelutyyppi: 'vesi' as const, categoryKey: 'personnel_costs', tyyppi: 'kulu' as const, summa: 120000, lahde: 'KVA' },
        ],
        revenueDrivers: [
          { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.5, myytyMaara: 15000, alvProsentti: 25.5 },
          { palvelutyyppi: 'jatevesi' as const, yksikkohinta: 2.2, myytyMaara: 8000 },
        ],
      };

      const result = await repo.confirmKvaImport(ORG_ID, payload);

      expect(result.success).toBe(true);
      expect(result.budgetId).toBe(budgetId);
      expect(mockTx.talousarvio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: ORG_ID,
          vuosi: 2025,
          nimi: 'KVA 2025 Extract',
        }),
      });
      const valisummaData = mockTx.talousarvioValisumma.createMany.mock.calls[0][0].data;
      expect(valisummaData.every((r: any) => r.talousarvioId === budgetId)).toBe(true);
      expect(valisummaData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ categoryKey: 'sales_revenue', summa: 500000 }),
          expect.objectContaining({ categoryKey: 'personnel_costs', summa: 120000 }),
        ]),
      );
      expect(result.created.subtotalLines).toBe(2);
      expect(result.created.revenueDrivers).toBe(2);
    });

    it('creates budget + subtotals + drivers in one $transaction', async () => {
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: 'budget-tx-1' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await repo.confirmKvaImport(ORG_ID, baseData);

      expect(result.success).toBe(true);
      expect(result.budgetId).toBe('budget-tx-1');
      expect(mockTx.talousarvio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orgId: ORG_ID, vuosi: 2024, nimi: 'KVA Import 2024' }),
      });
      // Should only persist 2 subtotals (excludes tulos type)
      expect(result.created.subtotalLines).toBe(2);
      expect(mockTx.talousarvioValisumma.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ categoryKey: 'sales_revenue' }),
          expect.objectContaining({ categoryKey: 'personnel_costs' }),
        ]),
      });
      // Verify tulos type is excluded
      const createManyData = mockTx.talousarvioValisumma.createMany.mock.calls[0][0].data;
      expect(createManyData.every((d: any) => d.tyyppi !== 'tulos')).toBe(true);
      // Regression: createMany must include createdAt/updatedAt (DB has NOT NULL updatedAt, no default)
      expect(createManyData.every((d: any) => d.createdAt instanceof Date && d.updatedAt instanceof Date)).toBe(true);
      // Contract: same transaction creates both valisummat and tuloajurit (KVA import)
      expect(mockTx.tuloajuri.create).toHaveBeenCalled();
    });

    it('confirmKvaImport creates valisummat and tuloajurit in same transaction (contract)', async () => {
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: 'b-contract' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await repo.confirmKvaImport(ORG_ID, {
        vuosi: 2024,
        nimi: 'KVA',
        subtotalLines: [
          { palvelutyyppi: 'vesi' as const, categoryKey: 'sales_revenue', tyyppi: 'tulo' as const, summa: 100 },
        ],
        revenueDrivers: [
          { palvelutyyppi: 'vesi' as const, yksikkohinta: 1, myytyMaara: 500 },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.talousarvioValisumma.createMany).toHaveBeenCalled();
      expect(mockTx.tuloajuri.create).toHaveBeenCalled();
    });

    it('excludes result-type subtotals from persistence', async () => {
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: 'b-1' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await repo.confirmKvaImport(ORG_ID, baseData);

      // 3 subtotals provided, 1 is type 'tulos' → only 2 persisted
      expect(result.created.subtotalLines).toBe(2);
    });

    it('skips zero-value drivers', async () => {
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: 'b-1' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const data = {
        ...baseData,
        subtotalLines: [],
        revenueDrivers: [
          { palvelutyyppi: 'vesi' as const, yksikkohinta: 0, myytyMaara: 0 },
          { palvelutyyppi: 'jatevesi' as const, yksikkohinta: 2.0, myytyMaara: 9000 },
        ],
      };

      const result = await repo.confirmKvaImport(ORG_ID, data);
      // Only jatevesi driver is meaningful
      expect(result.created.revenueDrivers).toBe(1);
    });

    it('persists partial drivers when only unit price (or perusmaksu) is set', async () => {
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: 'b-partial' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await repo.confirmKvaImport(ORG_ID, {
        vuosi: 2024,
        nimi: 'KVA',
        subtotalLines: [],
        revenueDrivers: [
          { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.2, myytyMaara: 0, alvProsentti: 25.5 },
          { palvelutyyppi: 'jatevesi' as const, yksikkohinta: 2.0, myytyMaara: 0, perusmaksu: 20 },
        ],
      });

      expect(result.created.revenueDrivers).toBe(2);
      expect(mockTx.tuloajuri.create).toHaveBeenCalledTimes(2);
      expect(mockTx.tuloajuri.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ palvelutyyppi: 'vesi', yksikkohinta: 1.2, myytyMaara: 0 }),
      });
      expect(mockTx.tuloajuri.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ palvelutyyppi: 'jatevesi', yksikkohinta: 2, myytyMaara: 0, perusmaksu: 20 }),
      });
    });

    it('persists account lines when provided', async () => {
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: 'b-1' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const data = {
        ...baseData,
        subtotalLines: [],
        accountLines: [
          { tiliryhma: '4100', nimi: 'Energi', tyyppi: 'kulu' as const, summa: 10000 },
          { tiliryhma: '3100', nimi: 'Myynti', tyyppi: 'tulo' as const, summa: 20000 },
        ],
      };

      const result = await repo.confirmKvaImport(ORG_ID, data);
      expect(result.created.accountLines).toBe(2);
      expect(mockTx.talousarvioRivi.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ tiliryhma: '4100', summa: 10000 }),
        ]),
      });
    });

    it('throws when (orgId, vuosi, nimi) already exists (unique constraint)', async () => {
      const prismaError = new Error('Unique constraint failed on the fields: (`orgId`,`vuosi`,`nimi`)');
      (prismaError as any).code = 'P2002';
      const mockTx = {
        talousarvio: { create: jest.fn().mockRejectedValue(prismaError) },
        talousarvioValisumma: { createMany: jest.fn() },
        tuloajuri: { create: jest.fn() },
        talousarvioRivi: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await expect(repo.confirmKvaImport(ORG_ID, baseData)).rejects.toThrow(/Unique constraint|P2002|orgId|vuosi|nimi/);
      expect(mockTx.talousarvio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orgId: ORG_ID, vuosi: 2024, nimi: 'KVA Import 2024' }),
      });
    });

    it('persists revenue drivers on confirm and findById returns tuloajurit with numeric fields', async () => {
      const BUDGET_ID_REV = 'b-rev-drivers';
      const revenueDrivers = [
        { palvelutyyppi: 'vesi' as const, yksikkohinta: 1.234, myytyMaara: 1000, liittymamaara: 200 },
        { palvelutyyppi: 'jatevesi' as const, yksikkohinta: 2.5, myytyMaara: 500, liittymamaara: 100 },
      ];
      const storedTuloajurit = [
        { id: 'td-1', palvelutyyppi: 'vesi', yksikkohinta: 1.234, myytyMaara: 1000, liittymamaara: 200, talousarvioId: BUDGET_ID_REV },
        { id: 'td-2', palvelutyyppi: 'jatevesi', yksikkohinta: 2.5, myytyMaara: 500, liittymamaara: 100, talousarvioId: BUDGET_ID_REV },
      ];
      const mockTx = {
        talousarvio: { create: jest.fn().mockResolvedValue({ id: BUDGET_ID_REV, orgId: ORG_ID, vuosi: 2024, nimi: 'KVA', tila: 'luonnos' }) },
        talousarvioValisumma: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        tuloajuri: { create: jest.fn().mockResolvedValue({}) },
        talousarvioRivi: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
      prisma.talousarvio.findFirst.mockImplementation((args: any) => {
        if (args?.where?.id === BUDGET_ID_REV && args?.where?.orgId === ORG_ID) {
          return Promise.resolve({
            id: BUDGET_ID_REV,
            orgId: ORG_ID,
            vuosi: 2024,
            nimi: 'KVA',
            tila: 'luonnos',
            rivit: [],
            valisummat: [],
            tuloajurit: storedTuloajurit,
          });
        }
        return Promise.resolve(null);
      });

      const result = await repo.confirmKvaImport(ORG_ID, {
        vuosi: 2024,
        nimi: 'KVA',
        subtotalLines: [],
        revenueDrivers,
        accountLines: [],
      });

      expect(result.success).toBe(true);
      expect(result.budgetId).toBe(BUDGET_ID_REV);
      expect(result.created.revenueDrivers).toBe(2);
      expect(mockTx.tuloajuri.create).toHaveBeenCalledTimes(2);
      expect(mockTx.tuloajuri.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          palvelutyyppi: 'vesi',
          yksikkohinta: 1.234,
          myytyMaara: 1000,
          liittymamaara: 200,
        }),
      });
      expect(mockTx.tuloajuri.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          palvelutyyppi: 'jatevesi',
          yksikkohinta: 2.5,
          myytyMaara: 500,
          liittymamaara: 100,
        }),
      });

      const budget = await repo.findById(ORG_ID, result.budgetId!);
      expect(budget).not.toBeNull();
      expect(budget!.tuloajurit).toHaveLength(2);
      const vesi = budget!.tuloajurit!.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = budget!.tuloajurit!.find((d) => d.palvelutyyppi === 'jatevesi');
      expect(vesi).toBeDefined();
      expect(vesi).toMatchObject({ palvelutyyppi: 'vesi', yksikkohinta: 1.234, myytyMaara: 1000, liittymamaara: 200 });
      expect(jatevesi).toBeDefined();
      expect(jatevesi).toMatchObject({ palvelutyyppi: 'jatevesi', yksikkohinta: 2.5, myytyMaara: 500, liittymamaara: 100 });
    });
  });
});
