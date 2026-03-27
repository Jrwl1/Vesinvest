import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { V2CoreSupport } from './v2-core-support';

@Injectable()
export class V2ImportOverviewService {
  private readonly core: V2CoreSupport;

  constructor(
    prisma: PrismaService,
    projectionsService: ProjectionsService,
    veetiService: VeetiService,
    veetiSyncService: VeetiSyncService,
    veetiEffectiveDataService: VeetiEffectiveDataService,
    veetiBudgetGenerator: VeetiBudgetGenerator,
    veetiBenchmarkService: VeetiBenchmarkService,
    veetiSanityService: VeetiSanityService,
  ) {
    this.core = new V2CoreSupport(
      prisma,
      projectionsService,
      veetiService,
      veetiSyncService,
      veetiEffectiveDataService,
      veetiBudgetGenerator,
      veetiBenchmarkService,
      veetiSanityService,
    );
  }

  searchOrganizations(...args: Parameters<V2CoreSupport['searchOrganizations']>) {
    return this.core.searchOrganizations(...args);
  }

  connectOrganization(...args: Parameters<V2CoreSupport['connectOrganization']>) {
    return this.core.connectOrganization(...args);
  }

  importYears(...args: Parameters<V2CoreSupport['importYears']>) {
    return this.core.importYears(...args);
  }

  createPlanningBaseline(...args: Parameters<V2CoreSupport['createPlanningBaseline']>) {
    return this.core.createPlanningBaseline(...args);
  }

  syncImport(...args: Parameters<V2CoreSupport['syncImport']>) {
    return this.core.syncImport(...args);
  }

  removeImportedYear(...args: Parameters<V2CoreSupport['removeImportedYear']>) {
    return this.core.removeImportedYear(...args);
  }

  removeImportedYears(...args: Parameters<V2CoreSupport['removeImportedYears']>) {
    return this.core.removeImportedYears(...args);
  }

  excludeImportedYears(...args: Parameters<V2CoreSupport['excludeImportedYears']>) {
    return this.core.excludeImportedYears(...args);
  }

  restoreImportedYears(...args: Parameters<V2CoreSupport['restoreImportedYears']>) {
    return this.core.restoreImportedYears(...args);
  }

  getImportYearData(...args: Parameters<V2CoreSupport['getImportYearData']>) {
    return this.core.getImportYearData(...args);
  }

  previewWorkbookImport(...args: Parameters<V2CoreSupport['previewWorkbookImport']>) {
    return this.core.previewWorkbookImport(...args);
  }

  previewStatementImport(...args: Parameters<V2CoreSupport['previewStatementImport']>) {
    return this.core.previewStatementImport(...args);
  }

  reconcileImportYear(...args: Parameters<V2CoreSupport['reconcileImportYear']>) {
    return this.core.reconcileImportYear(...args);
  }

  clearImportAndScenarios(...args: Parameters<V2CoreSupport['clearImportAndScenarios']>) {
    return this.core.clearImportAndScenarios(...args);
  }

  completeImportYearManually(...args: Parameters<V2CoreSupport['completeImportYearManually']>) {
    return this.core.completeImportYearManually(...args);
  }

  trackOpsEvent(...args: Parameters<V2CoreSupport['trackOpsEvent']>) {
    return this.core.trackOpsEvent(...args);
  }

  getOpsFunnel(...args: Parameters<V2CoreSupport['getOpsFunnel']>) {
    return this.core.getOpsFunnel(...args);
  }

  getImportStatus(...args: Parameters<V2CoreSupport['getImportStatus']>) {
    return this.core.getImportStatus(...args);
  }

  getOverview(...args: Parameters<V2CoreSupport['getOverview']>) {
    return this.core.getOverview(...args);
  }

  getPlanningContext(...args: Parameters<V2CoreSupport['getPlanningContext']>) {
    return this.core.getPlanningContext(...args);
  }

  refreshPeerSnapshot(...args: Parameters<V2CoreSupport['refreshPeerSnapshot']>) {
    return this.core.refreshPeerSnapshot(...args);
  }
}
