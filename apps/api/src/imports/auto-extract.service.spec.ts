/**
 * Tests for Auto-Extract: age-based import, installedOn derivation, provenance, no 0 sentinel.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AutoExtractService } from './auto-extract.service';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsRepository } from './imports.repository';

describe('AutoExtractService', () => {
  let service: AutoExtractService;
  let prisma: jest.Mocked<PrismaService>;
  let importsRepo: jest.Mocked<ImportsRepository>;

  const orgId = 'org-1';
  const importId = 'imp-1';
  const sheetId = 'sheet-1';

  const mockAssetType = {
    id: 'at-1',
    orgId: 'org-1',
    code: 'PIPE',
    name: 'Pipe',
    defaultLifeYears: null,
  };

  const mockSite = { id: 'site-1', name: 'Main Site' };

  function createSheet(overrides: {
    headers?: string[];
    sampleRows?: Record<string, unknown>[];
    sheetName?: string;
  } = {}) {
    return {
      id: sheetId,
      sheetName: 'Assets',
      headers: ['Name', 'Age', 'ID'],
      rowCount: 2,
      sampleRows: [
        { Name: 'Pipe A', Age: 25, ID: 'P1' },
        { Name: 'Pipe B', Age: 10, ID: 'P2' },
      ],
      ...overrides,
    };
  }

  function createImport(sheet: ReturnType<typeof createSheet>) {
    return {
      id: importId,
      orgId,
      filename: 'test.xlsx',
      status: 'PENDING',
      sheets: [sheet],
    };
  }

  beforeEach(async () => {
    const mockPrisma = {
      assetType: { findFirst: jest.fn().mockResolvedValue(mockAssetType) },
      site: { findFirst: jest.fn().mockResolvedValue(mockSite) },
      asset: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'asset-1' }),
        update: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      },
      importedRecord: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };

    const mockImportsRepo = {
      findById: jest.fn(),
      findImportedRecordByRow: jest.fn().mockResolvedValue(null),
      createImportedRecord: jest.fn().mockResolvedValue({}),
      updateImportedRecord: jest.fn().mockResolvedValue({}),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoExtractService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ImportsRepository, useValue: mockImportsRepo },
      ],
    }).compile();

    service = module.get(AutoExtractService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    importsRepo = module.get(ImportsRepository) as jest.Mocked<ImportsRepository>;
  });

  describe('ageYears parsing and installedOn derivation', () => {
    it('should derive installedOn from ageYears when no installedOn column', async () => {
      const sheet = createSheet({ headers: ['Name', 'Age', 'ID'], sampleRows: [{ Name: 'Pipe A', Age: 25, ID: 'P1' }] });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: true,
      });

      expect(result.derivedInstalledOnCount).toBe(1);
      expect(result.detectedColumns.ageYears).toBe('Age');
      expect(result.detectedColumns.installedOn).toBeUndefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should prefer installedOn from Excel when both installedOn and ageYears exist', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Installation date', 'Age', 'ID'],
        sampleRows: [{ Name: 'Pipe A', 'Installation date': '2000-06-15', Age: 24, ID: 'P1' }],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: true,
      });

      // installedOn comes from Excel; we do not overwrite with derived from age
      expect(result.derivedInstalledOnCount).toBe(0);
      expect(result.detectedColumns.installedOn).toBeDefined();
      expect(result.detectedColumns.ageYears).toBeDefined();
    });

    it('should reject invalid age (e.g. negative) and leave installedOn null', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID'],
        sampleRows: [
          { Name: 'Pipe A', Age: -1, ID: 'P1' },
          { Name: 'Pipe B', Age: 9999, ID: 'P2' },
        ],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: true,
      });

      // ageYears >= 0 && < 500 only; -1 and 9999 should not derive
      expect(result.derivedInstalledOnCount).toBe(0);
    });

    it('should derive installedOn as Jan 1 of (currentYear - ageYears)', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID'],
        sampleRows: [{ Name: 'Pipe A', Age: 5, ID: 'P1' }],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: false,
        allowFallbackIdentity: true,
      });

      expect(result.derivedInstalledOnCount).toBe(1);
      const currentYear = new Date().getUTCFullYear();
      const expectedYear = currentYear - 5;
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            installedOn: expect.any(Date),
            // ageYears is not stored; computed at API boundary
          }),
        }),
      );
      const call = (prisma.asset.create as jest.Mock).mock.calls[0][0];
      const installedOn = call.data.installedOn as Date;
      expect(installedOn.getUTCFullYear()).toBe(expectedYear);
      expect(installedOn.getUTCMonth()).toBe(0);
      expect(installedOn.getUTCDate()).toBe(1);
    });
  });

  describe('provenance: missing vs default vs excel', () => {
    it('should mark lifeYears as missing when not in Excel and no sheet default', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID'],
        sampleRows: [{ Name: 'Pipe A', Age: 10, ID: 'P1' }],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: true,
      });

      expect(result.missingLifeYearsCount).toBe(1);
      expect(result.missingReplacementCostCount).toBe(1);
      expect(result.excludedFromProjectionCount).toBe(1);
    });

    it('should apply sheet default for lifeYears and mark as default', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID'],
        sampleRows: [{ Name: 'Pipe A', Age: 10, ID: 'P1' }],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);
      (prisma.assetType.findFirst as jest.Mock).mockResolvedValue({ ...mockAssetType, defaultLifeYears: null });

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site', lifeYears: 50 },
        dryRun: true,
      });

      expect(result.missingLifeYearsCount).toBe(0);
      expect(result.assumedFields).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'lifeYears', source: 'sheet-default', value: 50 })]),
      );
    });

    it('should mark lifeYears as excel when provided in file', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID', 'Life years'],
        sampleRows: [{ Name: 'Pipe A', Age: 10, ID: 'P1', 'Life years': 40 }],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site', lifeYears: 50 },
        dryRun: false,
      });

      // Excel value 40 should be used, not default 50
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifeYears: 40,
            assumedFields: expect.any(Object),
          }),
        }),
      );
      const call = (prisma.asset.create as jest.Mock).mock.calls[0][0];
      const assumed = call.data.assumedFields as Record<string, { source: string; value?: unknown }>;
      expect(assumed?.lifeYears?.source).toBe('excel');
      expect(assumed?.lifeYears?.value).toBe(40);
    });

    it('should never use 0 as sentinel for missing lifeYears or replacementCost', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID', 'Lifetime (years)', 'Replacement cost'],
        sampleRows: [
          { Name: 'Pipe A', Age: 10, ID: 'P1', 'Lifetime (years)': 0, 'Replacement cost': 0 },
        ],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: false,
      });

      // 0 in Excel must not be stored as lifeYears or replacementCost (treated as missing)
      const call = (prisma.asset.create as jest.Mock).mock.calls[0][0];
      expect(call.data.lifeYears).toBeNull();
      expect(call.data.replacementCostEur).toBeNull();
    });
  });

  describe('preview counts', () => {
    it('should report missingLifeYearsCount, missingReplacementCostCount, derivedInstalledOnCount, excludedFromProjectionCount', async () => {
      const sheet = createSheet({
        headers: ['Name', 'Age', 'ID'],
        sampleRows: [
          { Name: 'Pipe A', Age: 20, ID: 'P1' },
          { Name: 'Pipe B', Age: 15, ID: 'P2' },
        ],
      });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      const result = await service.autoExtract(orgId, importId, sheetId, {
        sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
        dryRun: true,
      });

      expect(result.derivedInstalledOnCount).toBe(2);
      expect(result.missingLifeYearsCount).toBe(2);
      expect(result.missingReplacementCostCount).toBe(2);
      expect(result.excludedFromProjectionCount).toBe(2);
    });
  });

  describe('validation', () => {
    it('should throw NotFoundException when import not found', async () => {
      importsRepo.findById.mockResolvedValue(null);

      await expect(
        service.autoExtract(orgId, importId, sheetId, {
          sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
          dryRun: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when name column cannot be detected', async () => {
      const sheet = createSheet({ headers: ['Age', 'ID'] });
      importsRepo.findById.mockResolvedValue(createImport(sheet) as any);

      await expect(
        service.autoExtract(orgId, importId, sheetId, {
          sheetDefaults: { assetType: 'PIPE', site: 'Main Site' },
          dryRun: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
