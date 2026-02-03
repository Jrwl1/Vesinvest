import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID, isDemoModeEnabled } from './demo.module';

/**
 * Service to reset demo data to a clean state.
 * 
 * ONLY works when DEMO_MODE=true and ONLY affects the demo org.
 * Deletes all tenant data (sites, assets, imports, etc.) and
 * recreates only org/user/roles/assetTypes.
 */
@Injectable()
export class DemoResetService {
  private readonly logger = new Logger(DemoResetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hard-reset all demo org data.
   * Returns stats about what was deleted.
   */
  async resetDemoData(): Promise<{
    success: boolean;
    deleted: {
      maintenanceItems: number;
      assets: number;
      sites: number;
      importedRecords: number;
      excelSheets: number;
      excelImports: number;
      mappingColumns: number;
      importMappings: number;
      planningScenarios: number;
    };
    recreated: {
      assetTypes: number;
    };
  }> {
    // Guard: Only works in demo mode
    if (!isDemoModeEnabled()) {
      throw new ForbiddenException('Demo reset is only available in DEMO_MODE');
    }

    this.logger.warn('Starting demo data reset...');

    // Delete in correct order (respect foreign key constraints)
    const deleted = {
      maintenanceItems: 0,
      assets: 0,
      sites: 0,
      importedRecords: 0,
      excelSheets: 0,
      excelImports: 0,
      mappingColumns: 0,
      importMappings: 0,
      planningScenarios: 0,
    };

    // 1. Delete maintenance items
    const maintenanceResult = await this.prisma.maintenanceItem.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });
    deleted.maintenanceItems = maintenanceResult.count;
    this.logger.log(`Deleted ${deleted.maintenanceItems} maintenance items`);

    // 2. Delete assets
    const assetsResult = await this.prisma.asset.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });
    deleted.assets = assetsResult.count;
    this.logger.log(`Deleted ${deleted.assets} assets`);

    // 3. Delete sites
    const sitesResult = await this.prisma.site.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });
    deleted.sites = sitesResult.count;
    this.logger.log(`Deleted ${deleted.sites} sites`);

    // 4. Delete imported records (need to get import IDs first)
    const imports = await this.prisma.excelImport.findMany({
      where: { orgId: DEMO_ORG_ID },
      select: { id: true },
    });
    const importIds = imports.map((i) => i.id);

    if (importIds.length > 0) {
      const importedRecordsResult = await this.prisma.importedRecord.deleteMany({
        where: { importId: { in: importIds } },
      });
      deleted.importedRecords = importedRecordsResult.count;
      this.logger.log(`Deleted ${deleted.importedRecords} imported records`);

      // 5. Delete excel sheets
      const sheetsResult = await this.prisma.excelSheet.deleteMany({
        where: { importId: { in: importIds } },
      });
      deleted.excelSheets = sheetsResult.count;
      this.logger.log(`Deleted ${deleted.excelSheets} excel sheets`);
    }

    // 6. Delete excel imports
    const importsResult = await this.prisma.excelImport.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });
    deleted.excelImports = importsResult.count;
    this.logger.log(`Deleted ${deleted.excelImports} excel imports`);

    // 7. Delete mapping columns (need to get mapping IDs first)
    const mappings = await this.prisma.importMapping.findMany({
      where: { orgId: DEMO_ORG_ID },
      select: { id: true },
    });
    const mappingIds = mappings.map((m) => m.id);

    if (mappingIds.length > 0) {
      const columnsResult = await this.prisma.mappingColumn.deleteMany({
        where: { mappingId: { in: mappingIds } },
      });
      deleted.mappingColumns = columnsResult.count;
      this.logger.log(`Deleted ${deleted.mappingColumns} mapping columns`);
    }

    // 8. Delete import mappings
    const mappingsResult = await this.prisma.importMapping.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });
    deleted.importMappings = mappingsResult.count;
    this.logger.log(`Deleted ${deleted.importMappings} import mappings`);

    // 9. Delete planning scenarios
    const scenariosResult = await this.prisma.planningScenario.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });
    deleted.planningScenarios = scenariosResult.count;
    this.logger.log(`Deleted ${deleted.planningScenarios} planning scenarios`);

    // 10. Recreate asset types (delete and recreate to ensure clean state)
    await this.prisma.assetType.deleteMany({
      where: { orgId: DEMO_ORG_ID },
    });

    const assetTypes = [
      { code: 'PUMP', name: 'Pump', defaultLifeYears: 15 },
      { code: 'VALVE', name: 'Valve', defaultLifeYears: 25 },
      { code: 'PIPE', name: 'Pipe', defaultLifeYears: 50 },
      { code: 'METER', name: 'Water Meter', defaultLifeYears: 10 },
    ];

    for (const at of assetTypes) {
      await this.prisma.assetType.create({
        data: {
          orgId: DEMO_ORG_ID,
          code: at.code,
          name: at.name,
          defaultLifeYears: at.defaultLifeYears,
        },
      });
    }

    this.logger.warn('Demo data reset complete!');

    return {
      success: true,
      deleted,
      recreated: {
        assetTypes: assetTypes.length,
      },
    };
  }
}
