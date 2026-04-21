import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { ManualYearCompletionDto } from './dto/manual-year-completion.dto';
import { ImportYearReconcileDto } from './dto/import-year-reconcile.dto';
import { OpsEventDto } from './dto/ops-event.dto';
import { createV2ImportManualPatchSupport } from './v2-import-manual-patch-support';
import { createV2ImportWorkspaceSupport } from './v2-import-workspace-support';
import { createV2OverviewReadModelSupport } from './v2-overview-read-model-support';
import { createV2ImportOverviewBaselineModel } from './v2-import-overview-baseline-model';
import { createV2ImportOverviewPlanningSupport } from './v2-import-overview-planning-support';
import { createV2ImportOverviewProvenanceModel } from './v2-import-overview-provenance-model';
import { V2ImportOverviewScenarioModel } from './v2-import-overview-scenario-model';
import type {
  PlanningRole,
  SyncRequirement,
  StatementPreviewRequest,
  StatementPreviewResponse,
  WorkbookPreviewRequest,
  WorkbookPreviewResponse,
} from './v2-import-overview.types';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';

@Injectable()
export class V2ImportOverviewService {
  protected readonly logger = new Logger(V2ImportOverviewService.name);
  private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport;
  private readonly planningSupport: ReturnType<
    typeof createV2ImportOverviewPlanningSupport
  >;
  private readonly baselineModel: ReturnType<
    typeof createV2ImportOverviewBaselineModel
  >;
  private readonly provenanceModel: ReturnType<
    typeof createV2ImportOverviewProvenanceModel
  >;
  private readonly scenarioModel: V2ImportOverviewScenarioModel;
  private readonly workspaceSupport: ReturnType<
    typeof createV2ImportWorkspaceSupport
  >;
  private readonly manualPatchSupport: ReturnType<
    typeof createV2ImportManualPatchSupport
  >;
  private readonly overviewReadModelSupport: ReturnType<
    typeof createV2OverviewReadModelSupport
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    private readonly veetiService: VeetiService,
    private readonly veetiSyncService: VeetiSyncService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
    private readonly veetiBudgetGenerator: VeetiBudgetGenerator,
    private readonly veetiBenchmarkService: VeetiBenchmarkService,
    private readonly veetiSanityService: VeetiSanityService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
    this.scenarioModel = new V2ImportOverviewScenarioModel(
      prisma,
      veetiEffectiveDataService,
      this,
      this.planningWorkspaceSupport,
    );

    const ctx = this as any;
    this.baselineModel = createV2ImportOverviewBaselineModel(ctx);
    this.provenanceModel = createV2ImportOverviewProvenanceModel(ctx);
    this.planningSupport = createV2ImportOverviewPlanningSupport(ctx);
    this.workspaceSupport = createV2ImportWorkspaceSupport(ctx);
    this.manualPatchSupport = createV2ImportManualPatchSupport(ctx);
    this.overviewReadModelSupport = createV2OverviewReadModelSupport(ctx);
  }

  async searchOrganizations(query: string, limit: number) {
    return this.workspaceSupport.searchOrganizations(query, limit);
  }

  async connectOrganization(orgId: string, veetiId: number) {
    return this.workspaceSupport.connectOrganization(orgId, veetiId);
  }

  async getBoundUtilityIdentity(orgId: string) {
    return this.workspaceSupport.getBoundUtilityIdentity(orgId);
  }

  async importYears(orgId: string, years: number[]) {
    return this.workspaceSupport.importYears(orgId, years);
  }

  async createPlanningBaseline(orgId: string, years: number[]) {
    return this.workspaceSupport.createPlanningBaseline(orgId, years);
  }

  async syncImport(orgId: string, years: number[]) {
    return this.workspaceSupport.syncImport(orgId, years);
  }

  async removeImportedYear(orgId: string, year: number) {
    return this.workspaceSupport.removeImportedYear(orgId, year);
  }

  async removeImportedYears(orgId: string, years: number[]) {
    return this.workspaceSupport.removeImportedYears(orgId, years);
  }

  async excludeImportedYears(orgId: string, years: number[]) {
    return this.workspaceSupport.excludeImportedYears(orgId, years);
  }

  async restoreImportedYears(orgId: string, years: number[]) {
    return this.workspaceSupport.restoreImportedYears(orgId, years);
  }

  async getImportYearData(orgId: string, year: number) {
    return this.manualPatchSupport.getImportYearData(orgId, year);
  }

  async previewWorkbookImport(
    orgId: string,
    input: WorkbookPreviewRequest,
  ): Promise<WorkbookPreviewResponse> {
    return this.manualPatchSupport.previewWorkbookImport(orgId, input);
  }

  async previewStatementImport(
    orgId: string,
    year: number,
    input: StatementPreviewRequest,
  ): Promise<StatementPreviewResponse> {
    return this.manualPatchSupport.previewStatementImport(orgId, year, input);
  }

  async reconcileImportYear(
    orgId: string,
    userId: string,
    roles: string[],
    year: number,
    body: ImportYearReconcileDto,
  ) {
    return this.manualPatchSupport.reconcileImportYear(
      orgId,
      userId,
      roles,
      year,
      body,
    );
  }

  async clearImportAndScenarios(
    orgId: string,
    roles: string[],
    confirmToken?: string,
  ) {
    return this.manualPatchSupport.clearImportAndScenarios(
      orgId,
      roles,
      confirmToken,
    );
  }

  async completeImportYearManually(
    orgId: string,
    userId: string,
    roles: string[],
    body: ManualYearCompletionDto,
  ) {
    return this.manualPatchSupport.completeImportYearManually(
      orgId,
      userId,
      roles,
      body,
    );
  }

  async trackOpsEvent(
    orgId: string,
    userId: string,
    roles: string[],
    body: OpsEventDto,
  ) {
    return this.overviewReadModelSupport.trackOpsEvent(orgId, userId, roles, body);
  }

  async getOpsFunnel(orgId: string, roles: string[]) {
    return this.overviewReadModelSupport.getOpsFunnel(orgId, roles);
  }

  async getImportStatus(orgId: string) {
    return this.overviewReadModelSupport.getImportStatus(orgId);
  }

  async getOverview(orgId: string) {
    return this.overviewReadModelSupport.getOverview(orgId);
  }

  async getPlanningContext(orgId: string) {
    return this.overviewReadModelSupport.getPlanningContext(orgId);
  }

  async refreshPeerSnapshot(orgId: string, requestedYear?: number) {
    return this.overviewReadModelSupport.refreshPeerSnapshot(orgId, requestedYear);
  }

  private resolveVeetiOrgLanguage(
    veetiId: number | null | undefined,
  ): Promise<{ kieliId: number | null; uiLanguage: 'fi' | 'sv' | null }> {
    return this.planningSupport.resolveVeetiOrgLanguage(veetiId);
  }

  private normalizeYears(years: number[]): number[] {
    return this.planningSupport.normalizeYears(years);
  }

  private getCurrentPlanningYear(): number {
    return this.planningSupport.getCurrentPlanningYear();
  }

  private isFuturePlanningYear(year: number): boolean {
    return this.planningSupport.isFuturePlanningYear(year);
  }

  private resolvePlanningRole(year: number): PlanningRole {
    return this.planningSupport.resolvePlanningRole(year);
  }

  private annotatePlanningYearRows<T extends { vuosi: number }>(yearRows: T[]) {
    return this.planningSupport.annotatePlanningYearRows(yearRows);
  }

  private hydrateYearRowsWithTariffRevenueReadiness<
    T extends {
      vuosi: number;
      completeness: Record<string, boolean>;
      missingRequirements?: SyncRequirement[];
    },
  >(orgId: string, yearRows: T[]) {
    return this.planningSupport.hydrateYearRowsWithTariffRevenueReadiness(
      orgId,
      yearRows,
    );
  }

  private resolveWorkspaceYearRows(importStatus: {
    years?: Array<{ vuosi: number }>;
    workspaceYears?: number[];
  }) {
    return this.planningSupport.resolveWorkspaceYearRows(importStatus);
  }

  private resolveImportedYears(importStatus: {
    years?: Array<{ vuosi: number }>;
    workspaceYears?: number[];
  }): number[] {
    return this.planningSupport.resolveImportedYears(importStatus);
  }

  private resolvePlanningBaselineYears(
    orgId: string,
    options?: {
      link?: { veetiId: number; workspaceYears?: number[] } | null;
      persistRepair?: boolean;
    },
  ): Promise<number[]> {
    return this.planningSupport.resolvePlanningBaselineYears(orgId, options);
  }

  private resolveFallbackPlanningBaselineYears(
    orgId: string,
    workspaceYears: number[],
  ): Promise<number[]> {
    return this.planningSupport.resolveFallbackPlanningBaselineYears(
      orgId,
      workspaceYears,
    );
  }

  private persistPlanningBaselineYears(
    orgId: string,
    veetiId: number,
    workspaceYears: number[],
    includedYears: number[],
  ): Promise<void> {
    return this.planningSupport.persistPlanningBaselineYears(
      orgId,
      veetiId,
      workspaceYears,
      includedYears,
    );
  }

  private getWorkspaceYears(orgId: string): Promise<number[]> {
    return this.planningSupport.getWorkspaceYears(orgId);
  }

  private persistWorkspaceYears(orgId: string, years: number[]): Promise<number[]> {
    return this.planningSupport.persistWorkspaceYears(orgId, years);
  }

  private removeWorkspaceYears(orgId: string, years: number[]): Promise<number[]> {
    return this.planningSupport.removeWorkspaceYears(orgId, years);
  }

  private buildBaselineSourceSummary(...args: Parameters<typeof this.baselineModel.buildBaselineSourceSummary>) {
    return this.baselineModel.buildBaselineSourceSummary(...args);
  }

  private buildKpi(...args: Parameters<typeof this.baselineModel.buildKpi>) {
    return this.baselineModel.buildKpi(...args);
  }

  private buildPeerSnapshot(...args: Parameters<typeof this.baselineModel.buildPeerSnapshot>) {
    return this.baselineModel.buildPeerSnapshot(...args);
  }

  private emptyCompleteness(): Record<string, boolean> {
    return this.baselineModel.emptyCompleteness();
  }

  private resolveMissingSyncRequirements(completeness: Record<string, boolean>) {
    return this.baselineModel.resolveMissingSyncRequirements(completeness);
  }

  private resolveSyncBlockReason(completeness: Record<string, boolean>) {
    return this.baselineModel.resolveSyncBlockReason(completeness);
  }

  private resolveBaselineBlockReason(params: {
    completeness: Record<string, boolean>;
    baselineReady?: boolean;
    baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
  }) {
    return this.baselineModel.resolveBaselineBlockReason(params);
  }

  private evaluateBaselineReadiness(
    ...args: Parameters<typeof this.baselineModel.evaluateBaselineReadiness>
  ) {
    return this.baselineModel.evaluateBaselineReadiness(...args);
  }

  private augmentCompletenessWithTariffRevenue(
    ...args: Parameters<typeof this.baselineModel.augmentCompletenessWithTariffRevenue>
  ) {
    return this.baselineModel.augmentCompletenessWithTariffRevenue(...args);
  }

  private buildImportYearSummaryRows(
    ...args: Parameters<typeof this.provenanceModel.buildImportYearSummaryRows>
  ) {
    return this.provenanceModel.buildImportYearSummaryRows(...args);
  }

  private buildImportYearTrustSignal(
    ...args: Parameters<typeof this.provenanceModel.buildImportYearTrustSignal>
  ) {
    return this.provenanceModel.buildImportYearTrustSignal(...args);
  }

  private buildImportYearResultToZeroSignal(
    ...args: Parameters<typeof this.provenanceModel.buildImportYearResultToZeroSignal>
  ) {
    return this.provenanceModel.buildImportYearResultToZeroSignal(...args);
  }

  private buildImportYearSubrowAvailability(
    ...args: Parameters<typeof this.provenanceModel.buildImportYearSubrowAvailability>
  ) {
    return this.provenanceModel.buildImportYearSubrowAvailability(...args);
  }

  private buildStatementPreviewFields(
    ...args: Parameters<typeof this.provenanceModel.buildStatementPreviewFields>
  ) {
    return this.provenanceModel.buildStatementPreviewFields(...args);
  }

  private assertWorkbookPreviewUpload(
    ...args: Parameters<typeof this.provenanceModel.assertWorkbookPreviewUpload>
  ) {
    return this.provenanceModel.assertWorkbookPreviewUpload(...args);
  }

  private assertStatementPreviewUpload(
    ...args: Parameters<typeof this.provenanceModel.assertStatementPreviewUpload>
  ) {
    return this.provenanceModel.assertStatementPreviewUpload(...args);
  }

  private normalizeText(value: string | null | undefined): string | null {
    return this.provenanceModel.normalizeText(value);
  }

  private toNumber(value: unknown): number {
    return this.scenarioModel.toNumber(value);
  }

  private round2(value: number): number {
    return this.scenarioModel.round2(value);
  }

  private normalizeNonNegativeNullable(value: number | null): number | null {
    return this.scenarioModel.normalizeNonNegativeNullable(value);
  }

  private summaryValuesDiffer(left: number | null, right: number | null): boolean {
    return this.scenarioModel.summaryValuesDiffer(left, right);
  }

  private getTrendSeries(orgId: string) {
    return this.scenarioModel.getTrendSeries(orgId);
  }

  private resolveLatestAcceptedVeetiBudgetId(orgId: string): Promise<string | null> {
    return this.planningWorkspaceSupport.resolveLatestAcceptedVeetiBudgetId(orgId);
  }

  private resolveAcceptedPlanningBaselineBudgetIds(
    orgId: string,
  ): Promise<string[]> {
    return this.planningWorkspaceSupport.resolveAcceptedPlanningBaselineBudgetIds(
      orgId,
    );
  }

  private resolveLatestDataIndex(...args: Parameters<V2ImportOverviewScenarioModel['resolveLatestDataIndex']>) {
    return this.scenarioModel.resolveLatestDataIndex(...args);
  }

  private resolveLatestComparableYear(
    ...args: Parameters<V2ImportOverviewScenarioModel['resolveLatestComparableYear']>
  ) {
    return this.scenarioModel.resolveLatestComparableYear(...args);
  }

  private resolveLatestPrice(
    ...args: Parameters<V2ImportOverviewScenarioModel['resolveLatestPrice']>
  ) {
    return this.scenarioModel.resolveLatestPrice(...args);
  }

  private sanitizeOpsAttrs(
    attrs: Record<string, unknown> | undefined,
  ): Record<string, string | number | boolean | null> {
    const out: Record<string, string | number | boolean | null> = {};
    if (!attrs || typeof attrs !== 'object') return out;
    for (const [key, value] of Object.entries(attrs)) {
      if (
        value == null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        out[key] = value ?? null;
      } else if (value instanceof Date) {
        out[key] = value.toISOString();
      } else {
        out[key] = JSON.stringify(value);
      }
    }
    return out;
  }
}
