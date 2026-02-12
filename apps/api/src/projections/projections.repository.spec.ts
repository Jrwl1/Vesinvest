import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectionsRepository } from './projections.repository';
import { PrismaService } from '../prisma/prisma.service';
import type { DriverPaths } from './driver-paths';

describe('ProjectionsRepository', () => {
  let repo: ProjectionsRepository;
  let prisma: { ennuste: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; updateMany: jest.Mock; deleteMany: jest.Mock } };

  const ORG_ID = 'org-1';
  const PROJ_ID = 'proj-1';
  const BUDGET_ID = 'budget-1';

  beforeEach(async () => {
    prisma = {
      ennuste: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectionsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repo = module.get(ProjectionsRepository);
  });

  describe('create with ajuriPolut (save/load compatibility)', () => {
    it('persists ajuriPolut and returns it in create result', async () => {
      const ajuriPolut: DriverPaths = {
        vesi: {
          yksikkohinta: { mode: 'percent', baseYear: 2025, baseValue: 1.5, annualPercent: 0.02 },
          myytyMaara: { mode: 'manual', values: { 2025: 10000, 2026: 10500 } },
        },
      };
      const created = {
        id: PROJ_ID,
        orgId: ORG_ID,
        talousarvioId: BUDGET_ID,
        nimi: 'Test',
        aikajaksoVuosia: 5,
        ajuriPolut,
        talousarvio: { id: BUDGET_ID, vuosi: 2025, nimi: 'B' },
        vuodet: [],
      };
      prisma.ennuste.create.mockResolvedValue(created);

      const result = await repo.create(ORG_ID, {
        talousarvioId: BUDGET_ID,
        nimi: 'Test',
        aikajaksoVuosia: 5,
        ajuriPolut,
      });

      expect(prisma.ennuste.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ajuriPolut: expect.any(Object),
          }),
        }),
      );
      expect(result.ajuriPolut).toEqual(ajuriPolut);
    });

    it('allows create without ajuriPolut (fallback when config missing)', async () => {
      const created = {
        id: PROJ_ID,
        orgId: ORG_ID,
        talousarvioId: BUDGET_ID,
        nimi: 'Test',
        aikajaksoVuosia: 5,
        ajuriPolut: null,
        talousarvio: { id: BUDGET_ID, vuosi: 2025, nimi: 'B' },
        vuodet: [],
      };
      prisma.ennuste.create.mockResolvedValue(created);

      const result = await repo.create(ORG_ID, {
        talousarvioId: BUDGET_ID,
        nimi: 'Test',
        aikajaksoVuosia: 5,
      });

      expect(prisma.ennuste.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ajuriPolut: undefined,
          }),
        }),
      );
      expect(result.ajuriPolut).toBeNull();
    });
  });

  describe('update and findById (save/load)', () => {
    it('update with ajuriPolut persists and findById returns updated', async () => {
      const ajuriPolut: DriverPaths = {
        jatevesi: {
          yksikkohinta: { mode: 'manual', values: { 2025: 2.0 } },
        },
      };
      const updatedProjection = {
        id: PROJ_ID,
        orgId: ORG_ID,
        talousarvioId: BUDGET_ID,
        nimi: 'Test',
        aikajaksoVuosia: 10,
        ajuriPolut,
        talousarvio: {},
        vuodet: [],
      };
      prisma.ennuste.updateMany.mockResolvedValue({ count: 1 });
      prisma.ennuste.findFirst.mockResolvedValue(updatedProjection);

      const result = await repo.update(ORG_ID, PROJ_ID, { ajuriPolut });

      expect(prisma.ennuste.updateMany).toHaveBeenCalledWith({
        where: { id: PROJ_ID, orgId: ORG_ID },
        data: expect.objectContaining({ ajuriPolut: expect.any(Object) }),
      });
      expect(result).not.toBeNull();
      expect(result!.ajuriPolut).toEqual(ajuriPolut);
    });
  });
});
