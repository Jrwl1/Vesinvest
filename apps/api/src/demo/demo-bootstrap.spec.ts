/**
 * Tests to ensure demo bootstrap follows Site Handling Contract.
 * 
 * Key invariant: Demo mode must NEVER create sites or assets.
 * Sites must be created manually or via import.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID } from './demo.module';

// Mock PrismaService
const mockPrismaService = {
  organization: {
    findUnique: jest.fn(),
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
    it('should NOT create any sites', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({
        id: DEMO_ORG_ID,
        name: 'Demo Water Utility',
        slug: 'demo',
      });
      mockPrismaService.assetType.upsert.mockResolvedValue({});

      await service.ensureDemoOrg();

      // site.create should NEVER be called
      expect(mockPrismaService.site.create).not.toHaveBeenCalled();
      expect(mockPrismaService.site.upsert).not.toHaveBeenCalled();
    });

    it('should NOT create any assets', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({
        id: DEMO_ORG_ID,
        name: 'Demo Water Utility',
        slug: 'demo',
      });
      mockPrismaService.assetType.upsert.mockResolvedValue({});

      await service.ensureDemoOrg();

      // asset.create should NEVER be called
      expect(mockPrismaService.asset.create).not.toHaveBeenCalled();
      expect(mockPrismaService.asset.upsert).not.toHaveBeenCalled();
    });

    it('should create asset types (foundational reference data)', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({
        id: DEMO_ORG_ID,
        name: 'Demo Water Utility',
        slug: 'demo',
      });
      mockPrismaService.assetType.upsert.mockResolvedValue({});

      await service.ensureDemoOrg();

      // Asset types ARE allowed
      expect(mockPrismaService.assetType.upsert).toHaveBeenCalled();
      expect(mockPrismaService.assetType.upsert.mock.calls.length).toBeGreaterThanOrEqual(4);
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
