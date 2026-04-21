import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { createV2ForecastComputationSupport } from './v2-forecast-computation-support';
import { createV2ForecastDepreciationSupport } from './v2-forecast-depreciation-support';
import { V2ForecastDepreciationStorageSupport } from './v2-forecast-depreciation-storage-support';
import { V2ForecastInputModelSupport } from './v2-forecast-input-model-support';
import { V2ForecastPayloadSupport } from './v2-forecast-payload-support';
import { V2ForecastScenarioMetaSupport } from './v2-forecast-scenario-meta-support';
import { createV2ForecastScenarioSupport } from './v2-forecast-scenario-support';
import { V2ForecastSeriesSupport } from './v2-forecast-series-support';
import type {
  DepreciationRuleInput,
  ScenarioAssumptionKey,
  ScenarioClassAllocationInput,
  ScenarioStoredDepreciationRule,
  ScenarioType,
  TrendPoint,
  YearlyInvestment,
} from './v2-forecast.types';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';

@Injectable()
export class V2ForecastService {
  protected readonly logger = new Logger(V2ForecastService.name);
  private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport;
  private readonly inputModelSupport: V2ForecastInputModelSupport;
  private readonly scenarioMetaSupport: V2ForecastScenarioMetaSupport;
  private readonly seriesSupport: V2ForecastSeriesSupport;
  private readonly depreciationStorageSupport: V2ForecastDepreciationStorageSupport;
  private readonly payloadSupport: V2ForecastPayloadSupport;
  private readonly depreciationSupport: ReturnType<
    typeof createV2ForecastDepreciationSupport
  >;
  private readonly scenarioSupport: ReturnType<
    typeof createV2ForecastScenarioSupport
  >;
  private readonly computationSupport: ReturnType<
    typeof createV2ForecastComputationSupport
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    _veetiService: VeetiService,
    _veetiSyncService: VeetiSyncService,
    veetiEffectiveDataService: VeetiEffectiveDataService,
    _veetiBudgetGenerator: VeetiBudgetGenerator,
    _veetiBenchmarkService: VeetiBenchmarkService,
    _veetiSanityService: VeetiSanityService,
    private readonly importOverviewService: V2ImportOverviewService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
    this.scenarioMetaSupport = new V2ForecastScenarioMetaSupport(
      this.planningWorkspaceSupport,
    );
    this.inputModelSupport = new V2ForecastInputModelSupport(
      this.scenarioMetaSupport,
    );
    this.seriesSupport = new V2ForecastSeriesSupport(
      prisma,
      veetiEffectiveDataService,
      this.inputModelSupport,
    );
    this.depreciationStorageSupport = new V2ForecastDepreciationStorageSupport(
      prisma,
      this.inputModelSupport,
      this.scenarioMetaSupport,
    );
    this.payloadSupport = new V2ForecastPayloadSupport(
      prisma,
      importOverviewService,
      this.seriesSupport,
      this.inputModelSupport,
      this.scenarioMetaSupport,
      this.depreciationStorageSupport,
    );

    const ctx = this as any;
    this.depreciationSupport = createV2ForecastDepreciationSupport(ctx);
    this.scenarioSupport = createV2ForecastScenarioSupport(ctx);
    this.computationSupport = createV2ForecastComputationSupport(ctx);
  }

  async listForecastScenarios(orgId: string) {
    return this.scenarioSupport.listForecastScenarios(orgId);
  }

  async listDepreciationRules(orgId: string) {
    return this.depreciationSupport.listDepreciationRules(orgId);
  }

  async createDepreciationRule(orgId: string, body: DepreciationRuleInput) {
    return this.depreciationSupport.createDepreciationRule(orgId, body);
  }

  async updateDepreciationRule(
    orgId: string,
    ruleId: string,
    body: DepreciationRuleInput,
  ) {
    return this.depreciationSupport.updateDepreciationRule(orgId, ruleId, body);
  }

  async deleteDepreciationRule(orgId: string, ruleId: string) {
    return this.depreciationSupport.deleteDepreciationRule(orgId, ruleId);
  }

  async listScenarioDepreciationRules(orgId: string, scenarioId: string) {
    return this.depreciationSupport.listScenarioDepreciationRules(
      orgId,
      scenarioId,
    );
  }

  async createScenarioDepreciationRule(
    orgId: string,
    scenarioId: string,
    body: DepreciationRuleInput,
  ) {
    return this.depreciationSupport.createScenarioDepreciationRule(
      orgId,
      scenarioId,
      body,
    );
  }

  async updateScenarioDepreciationRule(
    orgId: string,
    scenarioId: string,
    ruleId: string,
    body: DepreciationRuleInput,
  ) {
    return this.depreciationSupport.updateScenarioDepreciationRule(
      orgId,
      scenarioId,
      ruleId,
      body,
    );
  }

  async deleteScenarioDepreciationRule(
    orgId: string,
    scenarioId: string,
    ruleId: string,
  ) {
    return this.depreciationSupport.deleteScenarioDepreciationRule(
      orgId,
      scenarioId,
      ruleId,
    );
  }

  async getScenarioClassAllocations(orgId: string, scenarioId: string) {
    return this.depreciationSupport.getScenarioClassAllocations(orgId, scenarioId);
  }

  async updateScenarioClassAllocations(
    orgId: string,
    scenarioId: string,
    body: ScenarioClassAllocationInput,
  ) {
    return this.depreciationSupport.updateScenarioClassAllocations(
      orgId,
      scenarioId,
      body,
    );
  }

  async createForecastScenario(
    orgId: string,
    body: {
      name?: string;
      talousarvioId?: string;
      horizonYears?: number;
      copyFromScenarioId?: string;
      scenarioType?: ScenarioType;
      compute?: boolean;
    },
  ) {
    return this.scenarioSupport.createForecastScenario(orgId, body);
  }

  async getForecastScenario(orgId: string, scenarioId: string) {
    return this.scenarioSupport.getForecastScenario(orgId, scenarioId);
  }

  async updateForecastScenario(
    orgId: string,
    scenarioId: string,
    body: {
      name?: string;
      horizonYears?: number;
      scenarioType?: ScenarioType;
      yearlyInvestments?: Array<{ year: number; amount: number }>;
      scenarioAssumptions?: Partial<Record<ScenarioAssumptionKey, number>>;
      nearTermExpenseAssumptions?: Array<{
        year: number;
        personnelPct?: number;
        energyPct?: number;
        opexOtherPct?: number;
      }>;
      thereafterExpenseAssumptions?: {
        personnelPct?: number;
        energyPct?: number;
        opexOtherPct?: number;
      };
    },
  ) {
    return this.scenarioSupport.updateForecastScenario(orgId, scenarioId, body);
  }

  async deleteForecastScenario(orgId: string, scenarioId: string) {
    return this.scenarioSupport.deleteForecastScenario(orgId, scenarioId);
  }

  async computeForecastScenario(orgId: string, scenarioId: string) {
    return this.computationSupport.computeForecastScenario(orgId, scenarioId);
  }

  private getImportStatus(
    ...args: Parameters<V2ImportOverviewService['getImportStatus']>
  ) {
    return this.importOverviewService.getImportStatus(...args);
  }

  private async getTrendSeries(orgId: string): Promise<TrendPoint[]> {
    return this.seriesSupport.getTrendSeries(orgId);
  }

  private async resolveLatestAcceptedVeetiBudgetId(
    orgId: string,
  ): Promise<string | null> {
    return this.planningWorkspaceSupport.resolveLatestAcceptedVeetiBudgetId(orgId);
  }

  private async resolveAcceptedPlanningBaselineBudgetIds(
    orgId: string,
  ): Promise<string[]> {
    return this.planningWorkspaceSupport.resolveAcceptedPlanningBaselineBudgetIds(
      orgId,
    );
  }

  private normalizeText(value: string | null | undefined): string | null {
    return this.scenarioMetaSupport.normalizeText(value);
  }

  private buildDefaultScenarioName(value: Date | string): string {
    return this.scenarioMetaSupport.buildDefaultScenarioName(value);
  }

  private normalizeScenarioType(raw: unknown): ScenarioType {
    return this.scenarioMetaSupport.normalizeScenarioType(raw);
  }

  private resolveScenarioType(
    rawOverrides: unknown,
    onOletus: boolean,
  ): ScenarioType {
    return this.scenarioMetaSupport.resolveScenarioType(rawOverrides, onOletus);
  }

  private resolveScenarioTypeForCreate(params: {
    requestedScenarioType?: ScenarioType;
    existingBaseScenarioExists: boolean;
    sourceScenarioType: ScenarioType | null;
  }): ScenarioType {
    return this.scenarioMetaSupport.resolveScenarioTypeForCreate(params);
  }

  private withScenarioTypeOverride(
    overrides: Record<string, number> | undefined,
    scenarioType: ScenarioType,
  ): Record<string, number> {
    return this.scenarioMetaSupport.withScenarioTypeOverride(
      overrides,
      scenarioType,
    );
  }

  private toNumber(value: unknown): number {
    return this.inputModelSupport.toNumber(value);
  }

  private round2(value: number): number {
    return this.inputModelSupport.round2(value);
  }

  private normalizeYearOverrides(
    raw: unknown,
  ): Record<number, Record<string, unknown>> {
    return this.inputModelSupport.normalizeYearOverrides(raw);
  }

  private normalizeUserInvestments(raw: unknown): YearlyInvestment[] {
    return this.inputModelSupport.normalizeUserInvestments(raw);
  }

  private normalizeAssumptionOverrides(raw: unknown): Record<string, number> {
    return this.inputModelSupport.normalizeAssumptionOverrides(raw);
  }

  private normalizeScenarioAssumptionOverrides(
    raw: Partial<Record<ScenarioAssumptionKey, unknown>>,
  ): Partial<Record<ScenarioAssumptionKey, number>> {
    return this.inputModelSupport.normalizeScenarioAssumptionOverrides(raw);
  }

  private normalizeThereafterExpenseAssumptions(raw: {
    personnelPct?: number;
    energyPct?: number;
    opexOtherPct?: number;
  }) {
    return this.inputModelSupport.normalizeThereafterExpenseAssumptions(raw);
  }

  private extractExplicitNearTermExpenseAssumptions(
    baseYear: number | null,
    rawOverrides: unknown,
  ) {
    return this.inputModelSupport.extractExplicitNearTermExpenseAssumptions(
      baseYear,
      rawOverrides,
    );
  }

  private normalizeNearTermExpenseAssumptions(
    raw: Array<{
      year: number;
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    }>,
    baseYear: number | null,
  ) {
    return this.inputModelSupport.normalizeNearTermExpenseAssumptions(
      raw,
      baseYear,
    );
  }

  private buildYearOverrides(
    investments: YearlyInvestment[],
    nearTermExpenseAssumptions: Array<{
      year: number;
      personnelPct: number;
      energyPct: number;
      opexOtherPct: number;
    }>,
    rawExistingOverrides?: unknown,
  ): Record<number, Record<string, unknown>> {
    return this.inputModelSupport.buildYearOverrides(
      investments,
      nearTermExpenseAssumptions,
      rawExistingOverrides,
    );
  }

  private buildYearlyInvestments(
    projection: any,
    baseYear: number | null,
  ): YearlyInvestment[] {
    return this.inputModelSupport.buildYearlyInvestments(projection, baseYear);
  }

  private mapScenarioPayload(orgId: string, projection: any) {
    return this.payloadSupport.mapScenarioPayload(orgId, projection, {
      ensureScenarioDepreciationStorage: (nextOrgId, nextProjection) =>
        this.ensureScenarioDepreciationStorage(nextOrgId, nextProjection),
      resolveLatestComparableBaselinePrice: (nextOrgId) =>
        this.resolveLatestComparableBaselinePrice(nextOrgId),
      buildYearlyInvestments: (nextProjection, baseYear) =>
        this.buildYearlyInvestments(nextProjection, baseYear),
    });
  }

  private computeRequiredPriceForZeroResult(firstYear: any) {
    return this.payloadSupport.computeRequiredPriceForZeroResult(firstYear);
  }

  private async resolveLatestComparableBaselinePrice(
    orgId: string,
  ): Promise<number | null> {
    return this.payloadSupport.resolveLatestComparableBaselinePrice(orgId);
  }

  private mapDepreciationRule(row: any) {
    return this.depreciationStorageSupport.mapDepreciationRule(row);
  }

  private mapScenarioDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    return this.depreciationStorageSupport.mapScenarioDepreciationRule(rule);
  }

  private snapshotDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    return this.depreciationStorageSupport.snapshotDepreciationRule(rule);
  }

  private ensureScenarioDepreciationStorage(orgId: string, projection: any) {
    return this.depreciationStorageSupport.ensureScenarioDepreciationStorage(
      orgId,
      projection,
    );
  }

  private saveScenarioDepreciationRules(
    orgId: string,
    scenarioId: string,
    rules: ScenarioStoredDepreciationRule[],
  ) {
    return this.depreciationStorageSupport.saveScenarioDepreciationRules(
      orgId,
      scenarioId,
      rules,
    );
  }

  private buildScenarioDepreciationRuleSeed(orgId: string) {
    return this.depreciationStorageSupport.buildScenarioDepreciationRuleSeed(
      orgId,
    );
  }

  private normalizeDepreciationRuleInput(body: DepreciationRuleInput) {
    return this.depreciationStorageSupport.normalizeDepreciationRuleInput(body);
  }

  private scenarioAllocationRecordFromArray(
    allocations: Array<{ classKey?: string; sharePct?: number }>,
  ) {
    return this.depreciationStorageSupport.scenarioAllocationRecordFromArray(
      allocations,
    );
  }

  private normalizeScenarioYearAllocations(raw: Record<string, unknown>) {
    return this.depreciationStorageSupport.normalizeScenarioYearAllocations(raw);
  }

  private isPrismaUniqueError(error: unknown): boolean {
    return this.scenarioMetaSupport.isPrismaUniqueError(error);
  }
}
