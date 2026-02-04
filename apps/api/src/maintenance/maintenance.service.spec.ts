/**
 * Tests for projection exclusion: no 0 sentinel, excludedAssetCount, missingFieldsBreakdown.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRepository } from './maintenance.repository';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningScenariosService } from '../planning-scenarios/planning-scenarios.service';
import { Prisma } from '@prisma/client';

type AssetWithRelations = Prisma.AssetGetPayload<{
  include: { assetType: true; maintenanceItems: true };
}>;

function mockAsset(overrides: Partial<AssetWithRelations> = {}): AssetWithRelations {
  return {
    id: 'asset-1',
    orgId: 'org-1',
    siteId: 'site-1',
    assetTypeId: 'at-1',
    externalRef: 'A1',
    name: 'Asset 1',
    installedOn: new Date('2010-01-01'),
    lifeYears: null,
    replacementCostEur: null,
    criticality: null,
    status: 'active',
    sourceImportId: null,
    sourceSheetName: null,
    sourceRowNumber: null,
    assumedFields: null,
    derivedIdentity: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    assetType: {
      id: 'at-1',
      orgId: 'org-1',
      code: 'PIPE',
      name: 'Pipe',
      defaultLifeYears: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    maintenanceItems: [],
    ...overrides,
  } as AssetWithRelations;
}

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: jest.Mocked<PrismaService>;
  let scenariosService: jest.Mocked<PlanningScenariosService>;

  const orgId = 'org-1';

  beforeEach(async () => {
    const mockPrisma = {
      asset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const mockRepo = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
    };

    const mockScenarios = {
      findById: jest.fn().mockResolvedValue(null),
      findDefault: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MaintenanceRepository, useValue: mockRepo },
        { provide: PlanningScenariosService, useValue: mockScenarios },
      ],
    }).compile();

    service = module.get(MaintenanceService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    scenariosService = module.get(PlanningScenariosService) as jest.Mocked<PlanningScenariosService>;
  });

  describe('projection exclusion logic', () => {
    it('should exclude assets with missing lifeYears from CAPEX and set excludedAssetCount', async () => {
      const assetNoLife = mockAsset({
        id: 'a1',
        name: 'No lifetime',
        lifeYears: null,
        replacementCostEur: new Prisma.Decimal(1000),
        assetType: { ...mockAsset().assetType, defaultLifeYears: null },
      });
      const assetWithLife = mockAsset({
        id: 'a2',
        name: 'With lifetime',
        lifeYears: 30,
        replacementCostEur: new Prisma.Decimal(2000),
      });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([assetNoLife, assetWithLife]);

      const result = await service.projection(orgId, {
        fromYear: 2025,
        toYear: 2035,
      });

      expect(result.excludedAssetCount).toBe(1);
      expect(result.missingFieldsBreakdown).toBeDefined();
      expect(result.missingFieldsBreakdown!.excludedAssetCount).toBe(1);
      expect(result.missingFieldsBreakdown!.missingLifeYearsCount).toBe(1);
      expect(result.missingFieldsBreakdown!.missingReplacementCostCount).toBe(0);

      // CAPEX in rows should only include the asset with lifetime (replacement in 2010+30=2040, outside 2025-2035 so may be 0)
      const totalCapex = result.rows.reduce((sum, r) => sum + r.capex, 0);
      // a2 replacement year = 2010 + 30 = 2040, outside range -> 0. So totalCapex should be 0.
      expect(totalCapex).toBe(0);
    });

    it('should exclude assets with missing replacementCost from CAPEX and set missingReplacementCostCount', async () => {
      const assetNoCost = mockAsset({
        id: 'a1',
        lifeYears: 50,
        replacementCostEur: null,
      });
      const assetWithCost = mockAsset({
        id: 'a2',
        name: 'With cost',
        lifeYears: 50,
        replacementCostEur: new Prisma.Decimal(5000),
        installedOn: new Date('2020-01-01'),
      });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([assetNoCost, assetWithCost]);

      const result = await service.projection(orgId, {
        fromYear: 2025,
        toYear: 2074,
      });

      expect(result.excludedAssetCount).toBe(1);
      expect(result.missingFieldsBreakdown!.missingReplacementCostCount).toBe(1);
      expect(result.missingFieldsBreakdown!.missingLifeYearsCount).toBe(0);

      // Only a2 has replacement in range (2020+50=2070). So CAPEX should be 5000 in year 2070.
      const row2070 = result.rows.find((r) => r.year === 2070);
      expect(row2070).toBeDefined();
      expect(row2070!.capex).toBe(5000);
    });

    it('should not use 0 as sentinel: null lifeYears and null cost mean exclude', async () => {
      const assetMissingBoth = mockAsset({
        id: 'a1',
        lifeYears: null,
        replacementCostEur: null,
        assetType: { ...mockAsset().assetType, defaultLifeYears: null },
      });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([assetMissingBoth]);

      const result = await service.projection(orgId, {
        fromYear: 2025,
        toYear: 2030,
      });

      expect(result.excludedAssetCount).toBe(1);
      expect(result.missingFieldsBreakdown!.missingLifeYearsCount).toBe(1);
      expect(result.missingFieldsBreakdown!.missingReplacementCostCount).toBe(1);
      const totalCapex = result.rows.reduce((sum, r) => sum + r.capex, 0);
      expect(totalCapex).toBe(0);
    });

    it('should include asset when assetType.defaultLifeYears fills missing lifeYears', async () => {
      const assetNoLifeButTypeDefault = mockAsset({
        id: 'a1',
        lifeYears: null,
        replacementCostEur: new Prisma.Decimal(3000),
        assetType: { ...mockAsset().assetType, defaultLifeYears: 25 },
      });
      assetNoLifeButTypeDefault.installedOn = new Date('2020-01-01');
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([assetNoLifeButTypeDefault]);

      const result = await service.projection(orgId, {
        fromYear: 2025,
        toYear: 2050,
      });

      expect(result.excludedAssetCount).toBe(0);
      expect(result.missingFieldsBreakdown!.missingLifeYearsCount).toBe(0);
      // Replacement year 2020+25=2045
      const row2045 = result.rows.find((r) => r.year === 2045);
      expect(row2045?.capex).toBe(3000);
    });
  });
});
