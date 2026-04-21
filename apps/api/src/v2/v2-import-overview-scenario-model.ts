import { PrismaService } from '../prisma/prisma.service';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { V2ForecastDepreciationStorageSupport } from './v2-forecast-depreciation-storage-support';
import { V2ForecastInputModelSupport } from './v2-forecast-input-model-support';
import { V2ForecastPayloadSupport } from './v2-forecast-payload-support';
import { V2ForecastScenarioMetaSupport } from './v2-forecast-scenario-meta-support';
import { V2ForecastSeriesSupport } from './v2-forecast-series-support';
import type {
  DepreciationRuleInput,
  ScenarioAssumptionKey,
  ScenarioStoredDepreciationRule,
  ScenarioType,
  TrendPoint,
  YearlyInvestment,
} from './v2-forecast.types';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';

type ImportStatusReader = {
  getImportStatus(orgId: string): Promise<{
    workspaceYears?: number[] | null;
    years?: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      sourceStatus?: string;
      isExcluded?: boolean;
    }>;
  }>;
};

export class V2ImportOverviewScenarioModel {
  private readonly scenarioMetaSupport: V2ForecastScenarioMetaSupport;
  private readonly inputModelSupport: V2ForecastInputModelSupport;
  private readonly seriesSupport: V2ForecastSeriesSupport;
  private readonly depreciationStorageSupport: V2ForecastDepreciationStorageSupport;
  private readonly payloadSupport: V2ForecastPayloadSupport;

  constructor(
    prisma: PrismaService,
    veetiEffectiveDataService: VeetiEffectiveDataService,
    importStatusReader: ImportStatusReader,
    planningWorkspaceSupport: V2PlanningWorkspaceSupport,
  ) {
    this.scenarioMetaSupport = new V2ForecastScenarioMetaSupport(
      planningWorkspaceSupport,
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
      importStatusReader,
      this.seriesSupport,
      this.inputModelSupport,
      this.scenarioMetaSupport,
      this.depreciationStorageSupport,
    );
  }

  getTrendSeries(orgId: string): Promise<TrendPoint[]> {
    return this.seriesSupport.getTrendSeries(orgId);
  }

  toNumber(value: unknown): number {
    return this.inputModelSupport.toNumber(value);
  }

  round2(value: number): number {
    return this.inputModelSupport.round2(value);
  }

  normalizeNonNegativeNullable(value: number | null): number | null {
    return this.inputModelSupport.normalizeNonNegativeNullable(value);
  }

  summaryValuesDiffer(left: number | null, right: number | null): boolean {
    return this.inputModelSupport.summaryValuesDiffer(left, right);
  }

  computeCombinedPrice(
    drivers: Array<{ yksikkohinta: unknown; myytyMaara: unknown }>,
  ): number {
    return this.inputModelSupport.computeCombinedPrice(drivers);
  }

  normalizeYearOverrides(
    raw: unknown,
  ): Record<number, Record<string, unknown>> {
    return this.inputModelSupport.normalizeYearOverrides(raw);
  }

  normalizeUserInvestments(raw: unknown): YearlyInvestment[] {
    return this.inputModelSupport.normalizeUserInvestments(raw);
  }

  normalizeAssumptionOverrides(raw: unknown): Record<string, number> {
    return this.inputModelSupport.normalizeAssumptionOverrides(raw);
  }

  normalizeScenarioAssumptionOverrides(
    raw: Partial<Record<ScenarioAssumptionKey, unknown>>,
  ) {
    return this.inputModelSupport.normalizeScenarioAssumptionOverrides(raw);
  }

  normalizeThereafterExpenseAssumptions(raw: {
    personnelPct?: number;
    energyPct?: number;
    opexOtherPct?: number;
  }) {
    return this.inputModelSupport.normalizeThereafterExpenseAssumptions(raw);
  }

  buildThereafterExpenseAssumptions(assumptions: Record<string, number>) {
    return this.inputModelSupport.buildThereafterExpenseAssumptions(assumptions);
  }

  buildYearOverrides(
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

  normalizeNearTermExpenseAssumptions(
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

  extractExplicitNearTermExpenseAssumptions(
    baseYear: number | null,
    rawOverrides: unknown,
  ) {
    return this.inputModelSupport.extractExplicitNearTermExpenseAssumptions(
      baseYear,
      rawOverrides,
    );
  }

  buildNearTermExpenseAssumptions(
    baseYear: number | null,
    assumptions: Record<string, number>,
    rawOverrides: unknown,
  ) {
    return this.inputModelSupport.buildNearTermExpenseAssumptions(
      baseYear,
      assumptions,
      rawOverrides,
    );
  }

  buildYearlyInvestments(
    projection: any,
    baseYear: number | null,
  ): YearlyInvestment[] {
    return this.inputModelSupport.buildYearlyInvestments(projection, baseYear);
  }

  mapScenarioPayload(orgId: string, projection: any) {
    return this.payloadSupport.mapScenarioPayload(orgId, projection);
  }

  computeRequiredPriceForZeroResult(firstYear: any) {
    return this.payloadSupport.computeRequiredPriceForZeroResult(firstYear);
  }

  resolveLatestComparableBaselinePrice(orgId: string) {
    return this.payloadSupport.resolveLatestComparableBaselinePrice(orgId);
  }

  mapDepreciationRule(row: any) {
    return this.depreciationStorageSupport.mapDepreciationRule(row);
  }

  mapScenarioDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    return this.depreciationStorageSupport.mapScenarioDepreciationRule(rule);
  }

  snapshotDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    return this.depreciationStorageSupport.snapshotDepreciationRule(rule);
  }

  ensureScenarioDepreciationStorage(orgId: string, projection: any) {
    return this.depreciationStorageSupport.ensureScenarioDepreciationStorage(
      orgId,
      projection,
    );
  }

  saveScenarioDepreciationRules(
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

  buildScenarioDepreciationRuleSeed(orgId: string) {
    return this.depreciationStorageSupport.buildScenarioDepreciationRuleSeed(
      orgId,
    );
  }

  normalizeDepreciationRuleInput(input: DepreciationRuleInput) {
    return this.depreciationStorageSupport.normalizeDepreciationRuleInput(input);
  }

  scenarioAllocationRecordFromArray(
    allocations: Array<{ classKey?: string; sharePct?: number }>,
  ) {
    return this.depreciationStorageSupport.scenarioAllocationRecordFromArray(
      allocations,
    );
  }

  normalizeScenarioYearAllocations(raw: Record<string, unknown>) {
    return this.depreciationStorageSupport.normalizeScenarioYearAllocations(raw);
  }

  isPrismaUniqueError(error: unknown): boolean {
    return this.scenarioMetaSupport.isPrismaUniqueError(error);
  }

  resolveLatestDataIndex(points: TrendPoint[]): number {
    return this.scenarioMetaSupport.resolveLatestDataIndex(points);
  }

  resolveLatestComparableYear(
    years:
      | Array<{
          vuosi: number;
          completeness?: {
            tilinpaatos?: boolean;
            volume_vesi?: boolean;
            volume_jatevesi?: boolean;
          };
        }>
      | undefined,
  ): number | null {
    return this.scenarioMetaSupport.resolveLatestComparableYear(years);
  }

  readRows(raw: unknown) {
    return this.seriesSupport.readRows(raw as never);
  }

  readFirstRecord(raw: unknown) {
    return this.seriesSupport.readFirstRecord(raw as never);
  }

  resolveLatestPrice(
    rows: Array<Record<string, unknown>>,
    typeId: number,
  ): number {
    return this.seriesSupport.resolveLatestPrice(rows, typeId);
  }

  splitVaOperatingCosts(row: Record<string, unknown> | null) {
    return this.seriesSupport.splitVaOperatingCosts(row);
  }

  normalizeText(value: string | null | undefined): string | null {
    return this.scenarioMetaSupport.normalizeText(value);
  }

  formatIsoDate(value: Date | string): string {
    return this.scenarioMetaSupport.formatIsoDate(value);
  }

  buildDefaultScenarioName(value: Date | string): string {
    return this.scenarioMetaSupport.buildDefaultScenarioName(value);
  }

  looksRecoveredText(candidate: string, original: string): boolean {
    return this.scenarioMetaSupport.looksRecoveredText(candidate, original);
  }

  normalizeScenarioType(raw: unknown): ScenarioType {
    return this.scenarioMetaSupport.normalizeScenarioType(raw);
  }
}
