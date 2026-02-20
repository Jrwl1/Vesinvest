import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectionsService } from './projections.service';
import { ProjectionsRepository } from './projections.repository';
import { ProjectionEngine } from './projection-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import type { DriverPaths } from './driver-paths';

describe('ProjectionsService', () => {
  const ORG_ID = 'org-1';
  const BUDGET_ID = 'budget-1';
  const PROJECTION_ID = 'projection-1';

  let service: ProjectionsService;
  let repo: {
    findById: jest.Mock;
    replaceYears: jest.Mock;
    requireBudgetOwnership: jest.Mock;
  };
  let prisma: {
    olettamus: { findMany: jest.Mock };
    ennuste: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    talousarvio: { findFirst: jest.Mock };
  };
  let storedYears: Array<Record<string, unknown>>;
  let projectionTemplate: any;

  beforeEach(async () => {
    storedYears = [];
    projectionTemplate = {
      id: PROJECTION_ID,
      orgId: ORG_ID,
      talousarvioId: BUDGET_ID,
      nimi: 'Perusskenaario 2025',
      aikajaksoVuosia: 20,
      olettamusYlikirjoitukset: null,
      ajuriPolut: null,
      userInvestments: null,
      onOletus: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      talousarvio: {
        id: BUDGET_ID,
        orgId: ORG_ID,
        vuosi: 2025,
        nimi: 'KVA 2025',
        perusmaksuYhteensa: null,
        tuloajurit: [],
        rivit: [],
        valisummat: [
          { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: '250000', palvelutyyppi: 'vesi' },
          { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: '180000', palvelutyyppi: 'jatevesi' },
          { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: '120000', palvelutyyppi: 'vesi' },
          { categoryKey: 'depreciation', tyyppi: 'poisto', summa: '50000', palvelutyyppi: 'vesi' },
          { categoryKey: 'investments', tyyppi: 'investointi', summa: '30000', palvelutyyppi: 'vesi' },
        ],
      },
      vuodet: [],
    };

    repo = {
      findById: jest.fn().mockImplementation(async () => ({
        ...projectionTemplate,
        vuodet: storedYears,
      })),
      replaceYears: jest.fn().mockImplementation(async (_projectionId: string, years: Array<Record<string, unknown>>) => {
        storedYears = years;
        return years;
      }),
      requireBudgetOwnership: jest.fn().mockResolvedValue({
        id: BUDGET_ID,
        orgId: ORG_ID,
        vuosi: 2025,
      }),
    };

    prisma = {
      olettamus: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ennuste: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: PROJECTION_ID }),
        update: jest.fn().mockResolvedValue({ id: PROJECTION_ID }),
      },
      talousarvio: {
        findFirst: jest.fn().mockResolvedValue({ vuosi: 2025 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectionsService,
        ProjectionEngine,
        { provide: ProjectionsRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ProjectionsService);
  });

  it('computeForBudget auto-creates and computes baseline for subtotal budget without drivers', async () => {
    const result = await service.computeForBudget(ORG_ID, BUDGET_ID);

    expect(prisma.ennuste.create).toHaveBeenCalled();
    expect(prisma.ennuste.update).toHaveBeenCalled();
    expect(repo.replaceYears).toHaveBeenCalled();
    expect(Array.isArray(result.vuodet)).toBe(true);
    expect((result.vuodet ?? []).length).toBeGreaterThan(0);
    expect(result.requiredTariff).not.toBeNull();
  });

  it('does not override explicit ajuriPolut with fallback synthesis', async () => {
    const explicitPaths: DriverPaths = {
      vesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 1.75 } },
        myytyMaara: { mode: 'manual', values: { 2025: 100000 } },
      },
      jatevesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 2.35 } },
        myytyMaara: { mode: 'manual', values: { 2025: 50000 } },
      },
    };
    projectionTemplate = {
      ...projectionTemplate,
      ajuriPolut: explicitPaths,
    };

    const result = await service.compute(ORG_ID, PROJECTION_ID);

    expect(prisma.ennuste.update).not.toHaveBeenCalled();
    expect((result.vuodet ?? []).length).toBeGreaterThan(0);
    const firstYear = result.vuodet?.[0];
    expect(Number(firstYear?.myytyVesimaara ?? 0)).toBeCloseTo(150000, -1);
  });

  it('throws a clear error for explicit ajuriPolut with invalid volume and does not overwrite paths', async () => {
    const explicitInvalidPaths: DriverPaths = {
      vesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 1.75 } },
        myytyMaara: { mode: 'manual', values: { 2025: 0 } },
      },
      jatevesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 2.35 } },
        myytyMaara: { mode: 'manual', values: { 2025: 0 } },
      },
    };
    projectionTemplate = {
      ...projectionTemplate,
      ajuriPolut: explicitInvalidPaths,
    };

    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(BadRequestException);
    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      'Projection driver overrides are invalid: add a positive volume value for at least one service.',
    );
    expect(prisma.ennuste.update).not.toHaveBeenCalled();
  });

  it('fails with clear error when budget has no account lines and no subtotals', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      talousarvio: {
        ...projectionTemplate.talousarvio,
        rivit: [],
        valisummat: [],
      },
    };

    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(BadRequestException);
    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      'Projection budget has no account lines or subtotal data',
    );
  });
});
