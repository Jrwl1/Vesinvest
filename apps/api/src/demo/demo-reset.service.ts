import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID, isDemoModeEnabled } from './demo.constants';

/**
 * Service to reset demo data to a clean state.
 * 
 * ONLY works when DEMO_MODE=true and ONLY affects the demo org.
 * Deletes all tenant data (budgets, projections, assumptions,
 * and legacy assets/imports) then re-seeds VA budget demo data.
 */
@Injectable()
export class DemoResetService {
  private readonly logger = new Logger(DemoResetService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Hard-reset all demo org data.
   * Returns stats about what was deleted.
   */
  async resetDemoData(): Promise<{
    success: boolean;
    deleted: {
      // VA budget entities
      ennusteVuodet: number;
      ennusteet: number;
      tuloajurit: number;
      talousarvioRivit: number;
      talousarviotValisummat: number;
      talousarviot: number;
      olettamukset: number;
      // Legacy entities
      maintenanceItems: number;
      assets: number;
      sites: number;
      importedRecords: number;
      excelSheets: number;
      excelImports: number;
      mappingColumns: number;
      importMappings: number;
      planningScenarios: number;
      invitations: number;
      legalAcceptances: number;
    };
    recreated: {
      budget: boolean;
      assumptions: number;
    };
  }> {
    if (!isDemoModeEnabled()) {
      throw new ForbiddenException('Demo reset is only available in DEMO_MODE');
    }
    this.logger.warn('Starting demo data reset...');
    return this.resetOrgData(DEMO_ORG_ID);
  }

  /**
   * Hard-reset tenant data for a specific organization.
   * Used by trial reset flow and demo reset wrapper.
   */
  async resetOrgData(orgId: string): Promise<{
    success: boolean;
    deleted: {
      // VA budget entities
      ennusteVuodet: number;
      ennusteet: number;
      tuloajurit: number;
      talousarvioRivit: number;
      talousarviotValisummat: number;
      talousarviot: number;
      olettamukset: number;
      // Legacy entities
      maintenanceItems: number;
      assets: number;
      sites: number;
      importedRecords: number;
      excelSheets: number;
      excelImports: number;
      mappingColumns: number;
      importMappings: number;
      planningScenarios: number;
      invitations: number;
      legalAcceptances: number;
    };
    recreated: {
      budget: boolean;
      assumptions: number;
    };
  }> {

    const deleted = {
      ennusteVuodet: 0,
      ennusteet: 0,
      tuloajurit: 0,
      talousarvioRivit: 0,
      talousarviotValisummat: 0,
      talousarviot: 0,
      olettamukset: 0,
      maintenanceItems: 0,
      assets: 0,
      sites: 0,
      importedRecords: 0,
      excelSheets: 0,
      excelImports: 0,
      mappingColumns: 0,
      importMappings: 0,
      planningScenarios: 0,
      invitations: 0,
      legalAcceptances: 0,
    };

    // ============================================
    // 1. Delete VA budget entities (new system)
    // ============================================

    // Delete projection years first (child of ennuste)
    const ennusteet = await this.prisma.ennuste.findMany({
      where: { orgId },
      select: { id: true },
    });
    const ennusteIds = ennusteet.map((e) => e.id);

    if (ennusteIds.length > 0) {
      const vuodetResult = await this.prisma.ennusteVuosi.deleteMany({
        where: { ennusteId: { in: ennusteIds } },
      });
      deleted.ennusteVuodet = vuodetResult.count;
    }

    // Delete projections
    const ennusteetResult = await this.prisma.ennuste.deleteMany({
      where: { orgId },
    });
    deleted.ennusteet = ennusteetResult.count;

    // Delete revenue drivers, valisummat, and budget lines (children of talousarvio)
    const talousarviot = await this.prisma.talousarvio.findMany({
      where: { orgId },
      select: { id: true },
    });
    const talousarvioIds = talousarviot.map((t) => t.id);

    if (talousarvioIds.length > 0) {
      const tuloajuritResult = await this.prisma.tuloajuri.deleteMany({
        where: { talousarvioId: { in: talousarvioIds } },
      });
      deleted.tuloajurit = tuloajuritResult.count;

      const rivitResult = await this.prisma.talousarvioRivi.deleteMany({
        where: { talousarvioId: { in: talousarvioIds } },
      });
      deleted.talousarvioRivit = rivitResult.count;

      const valisummatResult = await this.prisma.talousarvioValisumma.deleteMany({
        where: { talousarvioId: { in: talousarvioIds } },
      });
      deleted.talousarviotValisummat = valisummatResult.count;
    }

    // Delete budgets (after children so no FK issues)
    const talousarviotResult = await this.prisma.talousarvio.deleteMany({
      where: { orgId },
    });
    deleted.talousarviot = talousarviotResult.count;

    // Delete assumptions
    const olettamuksetResult = await this.prisma.olettamus.deleteMany({
      where: { orgId },
    });
    deleted.olettamukset = olettamuksetResult.count;

    this.logger.log(
      `Deleted VA data: ${deleted.talousarviot} budgets, ${deleted.talousarvioRivit} lines, ` +
      `${deleted.talousarviotValisummat} valisummat, ${deleted.tuloajurit} revenue drivers, ` +
      `${deleted.ennusteet} projections, ${deleted.olettamukset} assumptions`,
    );

    // ============================================
    // 2. Delete legacy entities (asset system)
    // ============================================

    // Maintenance items
    const maintenanceResult = await this.prisma.maintenanceItem.deleteMany({
      where: { orgId },
    });
    deleted.maintenanceItems = maintenanceResult.count;

    // Assets
    const assetsResult = await this.prisma.asset.deleteMany({
      where: { orgId },
    });
    deleted.assets = assetsResult.count;

    // Sites
    const sitesResult = await this.prisma.site.deleteMany({
      where: { orgId },
    });
    deleted.sites = sitesResult.count;

    // Import records
    const imports = await this.prisma.excelImport.findMany({
      where: { orgId },
      select: { id: true },
    });
    const importIds = imports.map((i) => i.id);

    if (importIds.length > 0) {
      const importedRecordsResult = await this.prisma.importedRecord.deleteMany({
        where: { importId: { in: importIds } },
      });
      deleted.importedRecords = importedRecordsResult.count;

      const sheetsResult = await this.prisma.excelSheet.deleteMany({
        where: { importId: { in: importIds } },
      });
      deleted.excelSheets = sheetsResult.count;
    }

    // Excel imports
    const importsResult = await this.prisma.excelImport.deleteMany({
      where: { orgId },
    });
    deleted.excelImports = importsResult.count;

    // Mapping columns
    const mappings = await this.prisma.importMapping.findMany({
      where: { orgId },
      select: { id: true },
    });
    const mappingIds = mappings.map((m) => m.id);

    if (mappingIds.length > 0) {
      const columnsResult = await this.prisma.mappingColumn.deleteMany({
        where: { mappingId: { in: mappingIds } },
      });
      deleted.mappingColumns = columnsResult.count;
    }

    // Import mappings
    const mappingsResult = await this.prisma.importMapping.deleteMany({
      where: { orgId },
    });
    deleted.importMappings = mappingsResult.count;

    // Planning scenarios
    const scenariosResult = await this.prisma.planningScenario.deleteMany({
      where: { orgId },
    });
    deleted.planningScenarios = scenariosResult.count;

    const inviteResult = await this.prisma.invitation.deleteMany({
      where: { orgId },
    });
    deleted.invitations = inviteResult.count;

    const legalResult = await this.prisma.legalAcceptance.deleteMany({
      where: { orgId },
    });
    deleted.legalAcceptances = legalResult.count;

    // Legacy asset types
    await this.prisma.assetType.deleteMany({
      where: { orgId },
    });

    // Reset stops here. Do NOT re-seed. User must click "Load demo data" (POST /demo/seed) to seed again.
    this.logger.warn(`Tenant data reset complete for org=${orgId} (empty org; no re-seed).`);

    return {
      success: true,
      deleted,
      recreated: {
        budget: false,
        assumptions: 0,
      },
    };
  }
}
