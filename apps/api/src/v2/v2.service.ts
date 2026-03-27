import { Injectable } from '@nestjs/common';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2ReportService } from './v2-report.service';

@Injectable()
export class V2Service {
  constructor(
    readonly importOverviewService: V2ImportOverviewService,
    readonly forecastService: V2ForecastService,
    readonly reportService: V2ReportService,
  ) {}

  searchOrganizations(...args: Parameters<V2ImportOverviewService['searchOrganizations']>) {
    return this.importOverviewService.searchOrganizations(...args);
  }

  connectOrganization(...args: Parameters<V2ImportOverviewService['connectOrganization']>) {
    return this.importOverviewService.connectOrganization(...args);
  }

  importYears(...args: Parameters<V2ImportOverviewService['importYears']>) {
    return this.importOverviewService.importYears(...args);
  }

  createPlanningBaseline(...args: Parameters<V2ImportOverviewService['createPlanningBaseline']>) {
    return this.importOverviewService.createPlanningBaseline(...args);
  }

  syncImport(...args: Parameters<V2ImportOverviewService['syncImport']>) {
    return this.importOverviewService.syncImport(...args);
  }

  removeImportedYear(...args: Parameters<V2ImportOverviewService['removeImportedYear']>) {
    return this.importOverviewService.removeImportedYear(...args);
  }

  removeImportedYears(...args: Parameters<V2ImportOverviewService['removeImportedYears']>) {
    return this.importOverviewService.removeImportedYears(...args);
  }

  excludeImportedYears(...args: Parameters<V2ImportOverviewService['excludeImportedYears']>) {
    return this.importOverviewService.excludeImportedYears(...args);
  }

  restoreImportedYears(...args: Parameters<V2ImportOverviewService['restoreImportedYears']>) {
    return this.importOverviewService.restoreImportedYears(...args);
  }

  getImportYearData(...args: Parameters<V2ImportOverviewService['getImportYearData']>) {
    return this.importOverviewService.getImportYearData(...args);
  }

  previewWorkbookImport(...args: Parameters<V2ImportOverviewService['previewWorkbookImport']>) {
    return this.importOverviewService.previewWorkbookImport(...args);
  }

  previewStatementImport(...args: Parameters<V2ImportOverviewService['previewStatementImport']>) {
    return this.importOverviewService.previewStatementImport(...args);
  }

  reconcileImportYear(...args: Parameters<V2ImportOverviewService['reconcileImportYear']>) {
    return this.importOverviewService.reconcileImportYear(...args);
  }

  clearImportAndScenarios(...args: Parameters<V2ImportOverviewService['clearImportAndScenarios']>) {
    return this.importOverviewService.clearImportAndScenarios(...args);
  }

  completeImportYearManually(...args: Parameters<V2ImportOverviewService['completeImportYearManually']>) {
    return this.importOverviewService.completeImportYearManually(...args);
  }

  trackOpsEvent(...args: Parameters<V2ImportOverviewService['trackOpsEvent']>) {
    return this.importOverviewService.trackOpsEvent(...args);
  }

  getOpsFunnel(...args: Parameters<V2ImportOverviewService['getOpsFunnel']>) {
    return this.importOverviewService.getOpsFunnel(...args);
  }

  getImportStatus(...args: Parameters<V2ImportOverviewService['getImportStatus']>) {
    return this.importOverviewService.getImportStatus(...args);
  }

  getOverview(...args: Parameters<V2ImportOverviewService['getOverview']>) {
    return this.importOverviewService.getOverview(...args);
  }

  getPlanningContext(...args: Parameters<V2ImportOverviewService['getPlanningContext']>) {
    return this.importOverviewService.getPlanningContext(...args);
  }

  refreshPeerSnapshot(...args: Parameters<V2ImportOverviewService['refreshPeerSnapshot']>) {
    return this.importOverviewService.refreshPeerSnapshot(...args);
  }

  listForecastScenarios(...args: Parameters<V2ForecastService['listForecastScenarios']>) {
    return this.forecastService.listForecastScenarios(...args);
  }

  listDepreciationRules(...args: Parameters<V2ForecastService['listDepreciationRules']>) {
    return this.forecastService.listDepreciationRules(...args);
  }

  createDepreciationRule(...args: Parameters<V2ForecastService['createDepreciationRule']>) {
    return this.forecastService.createDepreciationRule(...args);
  }

  updateDepreciationRule(...args: Parameters<V2ForecastService['updateDepreciationRule']>) {
    return this.forecastService.updateDepreciationRule(...args);
  }

  deleteDepreciationRule(...args: Parameters<V2ForecastService['deleteDepreciationRule']>) {
    return this.forecastService.deleteDepreciationRule(...args);
  }

  listScenarioDepreciationRules(...args: Parameters<V2ForecastService['listScenarioDepreciationRules']>) {
    return this.forecastService.listScenarioDepreciationRules(...args);
  }

  createScenarioDepreciationRule(...args: Parameters<V2ForecastService['createScenarioDepreciationRule']>) {
    return this.forecastService.createScenarioDepreciationRule(...args);
  }

  updateScenarioDepreciationRule(...args: Parameters<V2ForecastService['updateScenarioDepreciationRule']>) {
    return this.forecastService.updateScenarioDepreciationRule(...args);
  }

  deleteScenarioDepreciationRule(...args: Parameters<V2ForecastService['deleteScenarioDepreciationRule']>) {
    return this.forecastService.deleteScenarioDepreciationRule(...args);
  }

  getScenarioClassAllocations(...args: Parameters<V2ForecastService['getScenarioClassAllocations']>) {
    return this.forecastService.getScenarioClassAllocations(...args);
  }

  updateScenarioClassAllocations(...args: Parameters<V2ForecastService['updateScenarioClassAllocations']>) {
    return this.forecastService.updateScenarioClassAllocations(...args);
  }

  createForecastScenario(...args: Parameters<V2ForecastService['createForecastScenario']>) {
    return this.forecastService.createForecastScenario(...args);
  }

  getForecastScenario(...args: Parameters<V2ForecastService['getForecastScenario']>) {
    return this.forecastService.getForecastScenario(...args);
  }

  updateForecastScenario(...args: Parameters<V2ForecastService['updateForecastScenario']>) {
    return this.forecastService.updateForecastScenario(...args);
  }

  deleteForecastScenario(...args: Parameters<V2ForecastService['deleteForecastScenario']>) {
    return this.forecastService.deleteForecastScenario(...args);
  }

  computeForecastScenario(...args: Parameters<V2ForecastService['computeForecastScenario']>) {
    return this.forecastService.computeForecastScenario(...args);
  }

  listReports(...args: Parameters<V2ReportService['listReports']>) {
    return this.reportService.listReports(...args);
  }

  createReport(...args: Parameters<V2ReportService['createReport']>) {
    return this.reportService.createReport(...args);
  }

  getReport(...args: Parameters<V2ReportService['getReport']>) {
    return this.reportService.getReport(...args);
  }

  buildReportPdf(...args: Parameters<V2ReportService['buildReportPdf']>) {
    return this.reportService.buildReportPdf(...args);
  }
}
