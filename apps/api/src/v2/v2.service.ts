import { Injectable } from '@nestjs/common';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2ReportService } from './v2-report.service';
import { V2TariffPlanService } from './v2-tariff-plan.service';
import { V2VesinvestService } from './v2-vesinvest.service';

@Injectable()
export class V2Service {
  constructor(
    readonly importOverviewService: V2ImportOverviewService,
    readonly forecastService: V2ForecastService,
    readonly reportService: V2ReportService,
    readonly vesinvestService: V2VesinvestService,
    readonly tariffPlanService?: V2TariffPlanService,
  ) {}

  searchOrganizations(
    ...args: Parameters<V2ImportOverviewService['searchOrganizations']>
  ) {
    return this.importOverviewService.searchOrganizations(...args);
  }

  connectOrganization(
    ...args: Parameters<V2ImportOverviewService['connectOrganization']>
  ) {
    return this.importOverviewService.connectOrganization(...args);
  }

  importYears(...args: Parameters<V2ImportOverviewService['importYears']>) {
    return this.importOverviewService.importYears(...args);
  }

  createPlanningBaseline(
    ...args: Parameters<V2ImportOverviewService['createPlanningBaseline']>
  ) {
    return this.importOverviewService.createPlanningBaseline(...args);
  }

  syncImport(...args: Parameters<V2ImportOverviewService['syncImport']>) {
    return this.importOverviewService.syncImport(...args);
  }

  removeImportedYear(
    ...args: Parameters<V2ImportOverviewService['removeImportedYear']>
  ) {
    return this.importOverviewService.removeImportedYear(...args);
  }

  removeImportedYears(
    ...args: Parameters<V2ImportOverviewService['removeImportedYears']>
  ) {
    return this.importOverviewService.removeImportedYears(...args);
  }

  excludeImportedYears(
    ...args: Parameters<V2ImportOverviewService['excludeImportedYears']>
  ) {
    return this.importOverviewService.excludeImportedYears(...args);
  }

  restoreImportedYears(
    ...args: Parameters<V2ImportOverviewService['restoreImportedYears']>
  ) {
    return this.importOverviewService.restoreImportedYears(...args);
  }

  getImportYearData(
    ...args: Parameters<V2ImportOverviewService['getImportYearData']>
  ) {
    return this.importOverviewService.getImportYearData(...args);
  }

  previewWorkbookImport(
    ...args: Parameters<V2ImportOverviewService['previewWorkbookImport']>
  ) {
    return this.importOverviewService.previewWorkbookImport(...args);
  }

  previewStatementImport(
    ...args: Parameters<V2ImportOverviewService['previewStatementImport']>
  ) {
    return this.importOverviewService.previewStatementImport(...args);
  }

  reconcileImportYear(
    ...args: Parameters<V2ImportOverviewService['reconcileImportYear']>
  ) {
    return this.importOverviewService.reconcileImportYear(...args);
  }

  clearImportAndScenarios(
    ...args: Parameters<V2ImportOverviewService['clearImportAndScenarios']>
  ) {
    return this.importOverviewService.clearImportAndScenarios(...args);
  }

  createImportClearChallenge(
    ...args: Parameters<V2ImportOverviewService['createImportClearChallenge']>
  ) {
    return this.importOverviewService.createImportClearChallenge(...args);
  }

  completeImportYearManually(
    ...args: Parameters<V2ImportOverviewService['completeImportYearManually']>
  ) {
    return this.importOverviewService.completeImportYearManually(...args);
  }

  trackOpsEvent(...args: Parameters<V2ImportOverviewService['trackOpsEvent']>) {
    return this.importOverviewService.trackOpsEvent(...args);
  }

  getOpsFunnel(...args: Parameters<V2ImportOverviewService['getOpsFunnel']>) {
    return this.importOverviewService.getOpsFunnel(...args);
  }

  getImportStatus(
    ...args: Parameters<V2ImportOverviewService['getImportStatus']>
  ) {
    return this.importOverviewService.getImportStatus(...args);
  }

  getOverview(...args: Parameters<V2ImportOverviewService['getOverview']>) {
    return this.importOverviewService.getOverview(...args);
  }

  async getPlanningContext(
    ...args: Parameters<V2ImportOverviewService['getPlanningContext']>
  ) {
    const [context, vesinvest] = await Promise.all([
      this.importOverviewService.getPlanningContext(...args),
      this.vesinvestService.getPlanningContextSummary(args[0]),
    ]);
    return {
      ...context,
      ...vesinvest,
    };
  }

  refreshPeerSnapshot(
    ...args: Parameters<V2ImportOverviewService['refreshPeerSnapshot']>
  ) {
    return this.importOverviewService.refreshPeerSnapshot(...args);
  }

  listForecastScenarios(
    ...args: Parameters<V2ForecastService['listForecastScenarios']>
  ) {
    return this.forecastService.listForecastScenarios(...args);
  }

  listDepreciationRules(
    ...args: Parameters<V2ForecastService['listDepreciationRules']>
  ) {
    return this.forecastService.listDepreciationRules(...args);
  }

  createDepreciationRule(
    ...args: Parameters<V2ForecastService['createDepreciationRule']>
  ) {
    return this.forecastService.createDepreciationRule(...args);
  }

  updateDepreciationRule(
    ...args: Parameters<V2ForecastService['updateDepreciationRule']>
  ) {
    return this.forecastService.updateDepreciationRule(...args);
  }

  deleteDepreciationRule(
    ...args: Parameters<V2ForecastService['deleteDepreciationRule']>
  ) {
    return this.forecastService.deleteDepreciationRule(...args);
  }

  listScenarioDepreciationRules(
    ...args: Parameters<V2ForecastService['listScenarioDepreciationRules']>
  ) {
    return this.forecastService.listScenarioDepreciationRules(...args);
  }

  createScenarioDepreciationRule(
    ...args: Parameters<V2ForecastService['createScenarioDepreciationRule']>
  ) {
    return this.forecastService.createScenarioDepreciationRule(...args);
  }

  updateScenarioDepreciationRule(
    ...args: Parameters<V2ForecastService['updateScenarioDepreciationRule']>
  ) {
    return this.forecastService.updateScenarioDepreciationRule(...args);
  }

  deleteScenarioDepreciationRule(
    ...args: Parameters<V2ForecastService['deleteScenarioDepreciationRule']>
  ) {
    return this.forecastService.deleteScenarioDepreciationRule(...args);
  }

  getScenarioClassAllocations(
    ...args: Parameters<V2ForecastService['getScenarioClassAllocations']>
  ) {
    return this.forecastService.getScenarioClassAllocations(...args);
  }

  updateScenarioClassAllocations(
    ...args: Parameters<V2ForecastService['updateScenarioClassAllocations']>
  ) {
    return this.forecastService.updateScenarioClassAllocations(...args);
  }

  createForecastScenario(
    ...args: Parameters<V2ForecastService['createForecastScenario']>
  ) {
    return this.forecastService.createForecastScenario(...args);
  }

  getForecastScenario(
    ...args: Parameters<V2ForecastService['getForecastScenario']>
  ) {
    return this.forecastService.getForecastScenario(...args);
  }

  updateForecastScenario(
    ...args: Parameters<V2ForecastService['updateForecastScenario']>
  ) {
    return this.forecastService.updateForecastScenario(...args);
  }

  deleteForecastScenario(
    ...args: Parameters<V2ForecastService['deleteForecastScenario']>
  ) {
    return this.forecastService.deleteForecastScenario(...args);
  }

  computeForecastScenario(
    ...args: Parameters<V2ForecastService['computeForecastScenario']>
  ) {
    return this.forecastService.computeForecastScenario(...args);
  }

  getInvestmentGroupDefinitions(
    ...args: Parameters<V2VesinvestService['getInvestmentGroupDefinitions']>
  ) {
    return this.vesinvestService.getInvestmentGroupDefinitions(...args);
  }

  updateInvestmentGroupDefinition(
    ...args: Parameters<V2VesinvestService['updateInvestmentGroupDefinition']>
  ) {
    return this.vesinvestService.updateInvestmentGroupDefinition(...args);
  }

  listVesinvestPlans(...args: Parameters<V2VesinvestService['listPlans']>) {
    return this.vesinvestService.listPlans(...args);
  }

  getVesinvestPlan(...args: Parameters<V2VesinvestService['getPlan']>) {
    return this.vesinvestService.getPlan(...args);
  }

  createVesinvestPlan(...args: Parameters<V2VesinvestService['createPlan']>) {
    return this.vesinvestService.createPlan(...args);
  }

  updateVesinvestPlan(...args: Parameters<V2VesinvestService['updatePlan']>) {
    return this.vesinvestService.updatePlan(...args);
  }

  cloneVesinvestPlan(...args: Parameters<V2VesinvestService['clonePlan']>) {
    return this.vesinvestService.clonePlan(...args);
  }

  syncVesinvestPlanToForecast(
    ...args: Parameters<V2VesinvestService['syncPlanToForecast']>
  ) {
    return this.vesinvestService.syncPlanToForecast(...args);
  }

  getTariffPlan(...args: Parameters<V2TariffPlanService['getTariffPlan']>) {
    return this.tariffPlanService!.getTariffPlan(...args);
  }

  upsertTariffPlan(
    ...args: Parameters<V2TariffPlanService['upsertTariffPlan']>
  ) {
    return this.tariffPlanService!.upsertTariffPlan(...args);
  }

  acceptTariffPlan(
    ...args: Parameters<V2TariffPlanService['acceptTariffPlan']>
  ) {
    return this.tariffPlanService!.acceptTariffPlan(...args);
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
