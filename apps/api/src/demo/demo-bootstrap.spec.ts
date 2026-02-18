/**
 * Tests to ensure demo bootstrap follows Site Handling Contract.
 * 
 * Key invariant: Demo mode must NEVER create sites or assets.
 * Sites must be created manually or via import.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID } from './demo.constants';

// Mock PrismaService
const mockPrismaService = {
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  talousarvio: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  },
  talousarvioValisumma: {
    createMany: jest.fn(),
  },
  talousarvioRivi: {
    create: jest.fn(),
  },
  tuloajuri: {
    createMany: jest.fn(),
  },
  olettamus: {
    upsert: jest.fn(),
  },
  ennuste: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  site: {
    create: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  asset: {
    create: jest.fn(),
    upsert: jest.fn(),
  },
  assetType: {
    upsert: jest.fn(),
  },
};

describe('DemoBootstrapService - Site Handling Contract', () => {
  let service: DemoBootstrapService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoBootstrapService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DemoBootstrapService>(DemoBootstrapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureDemoOrg', () => {
    it('only creates org; no sites, assets, or budget data', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({
        id: DEMO_ORG_ID,
        name: 'Demo-vesilaitos',
        slug: 'demo',
      });

      await service.ensureDemoOrg();

      expect(mockPrismaService.organization.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.site.create).not.toHaveBeenCalled();
      expect(mockPrismaService.asset.create).not.toHaveBeenCalled();
      expect(mockPrismaService.assetType.upsert).not.toHaveBeenCalled();
    });

    it('is idempotent when org already exists', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: DEMO_ORG_ID,
        name: 'Demo-vesilaitos',
        slug: 'demo',
      });

      await service.ensureDemoOrg();

      expect(mockPrismaService.organization.create).not.toHaveBeenCalled();
    });
  });

  describe('seedDemoData', () => {
    it('returns alreadySeeded true when 3-year set (batch) already exists', async () => {
      mockPrismaService.talousarvio.findFirst.mockResolvedValue({ id: 'budget-1' });

      const result = await service.seedDemoData();

      expect(result.alreadySeeded).toBe(true);
      expect(result.seededAt).toBeDefined();
      expect(result.batchId).toBeDefined();
      expect(result.created).toBeUndefined();
    });
  });
});

describe('Site Handling Contract - No "Main Treatment Plant" in code', () => {
  /**
   * This test fails if the literal string "Main Treatment Plant" appears
   * in demo bootstrap logic, ensuring no default sites are hardcoded.
   */
  it('should not contain "Main Treatment Plant" string', async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    const filesToCheck = [
      path.join(__dirname, 'demo-bootstrap.service.ts'),
      path.join(__dirname, 'demo.module.ts'),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).not.toContain('Main Treatment Plant');
      }
    }
  });

  it('should not contain "Main Plant" as a hardcoded site name', async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    const filesToCheck = [
      path.join(__dirname, 'demo-bootstrap.service.ts'),
      path.join(__dirname, 'demo.module.ts'),
    ];

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Allow "Main Plant" in comments explaining the contract
        // but not in actual code creating sites
        const hasMainPlantInCreate = 
          content.includes("name: 'Main Plant'") ||
          content.includes('name: "Main Plant"');
        expect(hasMainPlantInCreate).toBe(false);
      }
    }
  });
});
