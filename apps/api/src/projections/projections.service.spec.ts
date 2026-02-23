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
    delete: jest.Mock;
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
          {
            categoryKey: 'sales_revenue',
            tyyppi: 'tulo',
            summa: '250000',
            palvelutyyppi: 'vesi',
          },
          {
            categoryKey: 'sales_revenue',
            tyyppi: 'tulo',
            summa: '180000',
            palvelutyyppi: 'jatevesi',
          },
          {
            categoryKey: 'personnel_costs',
            tyyppi: 'kulu',
            summa: '120000',
            palvelutyyppi: 'vesi',
          },
          {
            categoryKey: 'depreciation',
            tyyppi: 'poisto',
            summa: '50000',
            palvelutyyppi: 'vesi',
          },
          {
            categoryKey: 'investments',
            tyyppi: 'investointi',
            summa: '30000',
            palvelutyyppi: 'vesi',
          },
        ],
      },
      vuodet: [],
    };

    repo = {
      findById: jest.fn().mockImplementation(async () => ({
        ...projectionTemplate,
        vuodet: storedYears,
      })),
      replaceYears: jest
        .fn()
        .mockImplementation(
          async (
            _projectionId: string,
            years: Array<Record<string, unknown>>,
          ) => {
            storedYears = years;
            return years;
          },
        ),
      requireBudgetOwnership: jest.fn().mockResolvedValue({
        id: BUDGET_ID,
        orgId: ORG_ID,
        vuosi: 2025,
      }),
      delete: jest.fn().mockResolvedValue({ deleted: true }),
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

  it('computeForBudget auto-creates and computes baseline for subtotal budget when baseline drivers are provided', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      talousarvio: {
        ...projectionTemplate.talousarvio,
        tuloajurit: [
          {
            palvelutyyppi: 'vesi',
            yksikkohinta: '1.7',
            myytyMaara: '120000',
            perusmaksu: null,
            liittymamaara: 0,
          },
          {
            palvelutyyppi: 'jatevesi',
            yksikkohinta: '2.2',
            myytyMaara: '90000',
            perusmaksu: null,
            liittymamaara: 0,
          },
        ],
      },
    };

    const result = await service.computeForBudget(ORG_ID, BUDGET_ID);

    expect(prisma.ennuste.create).toHaveBeenCalled();
    expect(prisma.ennuste.update).not.toHaveBeenCalled();
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

  it('falls back to subtotal-derived drivers when imported baseline drivers are materially inconsistent', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      ajuriPolut: null,
      talousarvio: {
        ...projectionTemplate.talousarvio,
        tuloajurit: [
          {
            palvelutyyppi: 'vesi',
            yksikkohinta: '1',
            myytyMaara: '2',
            perusmaksu: null,
            liittymamaara: 0,
            sourceMeta: { imported: true, manualOverride: false },
          },
          {
            palvelutyyppi: 'jatevesi',
            yksikkohinta: '1',
            myytyMaara: '2',
            perusmaksu: null,
            liittymamaara: 0,
            sourceMeta: { imported: true, manualOverride: false },
          },
        ],
      },
    };

    const result = await service.compute(ORG_ID, PROJECTION_ID);
    expect((result.vuodet ?? []).length).toBeGreaterThan(0);
    expect(Number(result.vuodet?.[0]?.tulotYhteensa ?? 0)).toBeGreaterThan(
      100000,
    );
    expect(prisma.ennuste.update).not.toHaveBeenCalled();
  });

  it('blocks compute when manually-overridden baseline drivers are materially inconsistent with subtotal Tulot', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      ajuriPolut: null,
      talousarvio: {
        ...projectionTemplate.talousarvio,
        tuloajurit: [
          {
            palvelutyyppi: 'vesi',
            yksikkohinta: '1',
            myytyMaara: '2',
            perusmaksu: null,
            liittymamaara: 0,
            sourceMeta: { imported: false, manualOverride: true },
          },
          {
            palvelutyyppi: 'jatevesi',
            yksikkohinta: '1',
            myytyMaara: '2',
            perusmaksu: null,
            liittymamaara: 0,
            sourceMeta: { imported: false, manualOverride: true },
          },
        ],
      },
    };

    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      'Baseline Tulot and driver-based revenue are inconsistent',
    );
    expect(prisma.ennuste.update).not.toHaveBeenCalled();
  });

  it('treats liikevaihto as sales revenue in baseline mismatch validation', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      ajuriPolut: null,
      talousarvio: {
        ...projectionTemplate.talousarvio,
        valisummat: [
          {
            categoryKey: 'liikevaihto',
            tyyppi: 'tulo',
            summa: '430000',
            palvelutyyppi: 'muu',
          },
          {
            categoryKey: 'henkilostokulut',
            tyyppi: 'kulu',
            summa: '120000',
            palvelutyyppi: 'muu',
          },
          {
            categoryKey: 'poistot',
            tyyppi: 'poisto',
            summa: '50000',
            palvelutyyppi: 'muu',
          },
        ],
        tuloajurit: [
          {
            palvelutyyppi: 'vesi',
            yksikkohinta: '1',
            myytyMaara: '2',
            perusmaksu: null,
            liittymamaara: 0,
            sourceMeta: { imported: false, manualOverride: true },
          },
          {
            palvelutyyppi: 'jatevesi',
            yksikkohinta: '1',
            myytyMaara: '2',
            perusmaksu: null,
            liittymamaara: 0,
            sourceMeta: { imported: false, manualOverride: true },
          },
        ],
      },
    };

    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      'Baseline Tulot and driver-based revenue are inconsistent',
    );
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

    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      BadRequestException,
    );
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

    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.compute(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      'Projection budget has no account lines or subtotal data',
    );
  });

  it('blocks deleting the default scenario', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      onOletus: true,
    };

    await expect(service.delete(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.delete(ORG_ID, PROJECTION_ID)).rejects.toThrow(
      'Default scenario cannot be deleted',
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a non-default scenario', async () => {
    projectionTemplate = {
      ...projectionTemplate,
      onOletus: false,
    };

    await expect(service.delete(ORG_ID, PROJECTION_ID)).resolves.toEqual({
      deleted: true,
    });
    expect(repo.delete).toHaveBeenCalledWith(ORG_ID, PROJECTION_ID);
  });
});
