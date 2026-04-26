import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  VeetiEffectiveDataService,
  type OverrideProvenance,
} from '../veeti/veeti-effective-data.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import {
  computeVesinvestBaselineFingerprint,
  DEFAULT_VESINVEST_GROUP_DEFINITIONS,
  normalizeVesinvestDepreciationClassKey,
  sortVesinvestGroupDefinitions,
} from './vesinvest-contract';
import type {
  BaselineDatasetSource,
  BaselineSourceSummary,
  PlanningRole,
  SnapshotPayload,
  VesinvestBaselineSnapshotYear,
} from './v2-report.types';

export class V2ReportBaselineSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport,
    private readonly importOverviewService: V2ImportOverviewService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
  ) {}

async getCurrentBaselineSnapshot(orgId: string) {
    const [
      acceptedYears,
      latestAcceptedBudgetId,
      planningContext,
      utilityIdentity,
    ] = await Promise.all([
      this.planningWorkspaceSupport.resolvePlanningBaselineYears(orgId, {
        persistRepair: true,
      }),
      this.planningWorkspaceSupport.resolveLatestAcceptedVeetiBudgetId(orgId),
      this.importOverviewService.getPlanningContext(orgId),
      this.getOptionalBoundUtilityIdentity(orgId),
    ]);
    const baselineYears = Array.isArray(planningContext?.baselineYears)
      ? planningContext.baselineYears.map((row) => ({
          year: row.year,
          planningRole: row.planningRole ?? null,
          quality: row.quality,
          sourceStatus: row.sourceStatus,
          sourceBreakdown: row.sourceBreakdown,
          financials: row.financials,
          prices: row.prices,
          volumes: row.volumes,
          soldWaterVolume: row.soldWaterVolume,
          soldWastewaterVolume: row.soldWastewaterVolume,
          combinedSoldVolume: row.combinedSoldVolume,
        }))
      : [];
    return {
      utilityIdentity,
      acceptedYears,
      latestAcceptedBudgetId,
      baselineYears,
      fingerprint: computeVesinvestBaselineFingerprint({
        acceptedYears,
        latestAcceptedBudgetId,
        baselineYears,
        utilityIdentity,
      }),
    };
  }

  readSavedBaselineSourceState(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        acceptedYears: [] as number[],
        latestAcceptedBudgetId: null as string | null,
        veetiId: null as number | null,
        utilityName: null as string | null,
        businessId: null as string | null,
        identitySource: null as 'veeti' | null,
      };
    }
    const record = value as Record<string, unknown>;
    return {
      acceptedYears: this.normalizeYearList(record.acceptedYears),
      latestAcceptedBudgetId:
        typeof record.latestAcceptedBudgetId === 'string'
          ? record.latestAcceptedBudgetId
          : null,
      veetiId:
        typeof record.veetiId === 'number' && Number.isFinite(record.veetiId)
          ? Math.round(record.veetiId)
          : null,
      utilityName:
        typeof record.utilityName === 'string' ? record.utilityName.trim() || null : null,
      businessId:
        typeof record.businessId === 'string' ? record.businessId.trim() || null : null,
      identitySource:
        record.identitySource === 'veeti' ? ('veeti' as const) : null,
    };
  }

  hasLegacyBaselineSnapshotDrift(
    baselineSourceState: unknown,
    currentBaseline: Awaited<ReturnType<V2ReportBaselineSupport['getCurrentBaselineSnapshot']>>,
  ) {
    const saved = this.readSavedBaselineSourceState(baselineSourceState);
    if (
      saved.acceptedYears.length === 0 &&
      (saved.latestAcceptedBudgetId?.length ?? 0) === 0
    ) {
      return true;
    }
    const bound = currentBaseline.utilityIdentity;
    if (
      !bound ||
      saved.veetiId == null ||
      !saved.utilityName ||
      saved.identitySource == null
    ) {
      return true;
    }
    if (
      saved.veetiId !== bound.veetiId ||
      saved.utilityName !== bound.utilityName ||
      (saved.businessId ?? null) !== (bound.businessId ?? null) ||
      saved.identitySource !== bound.identitySource
    ) {
      return true;
    }
    if (
      saved.latestAcceptedBudgetId !== currentBaseline.latestAcceptedBudgetId
    ) {
      return true;
    }
    return (
      JSON.stringify(saved.acceptedYears) !==
      JSON.stringify(currentBaseline.acceptedYears)
    );
  }

  async getOrderedVesinvestGroupDefinitions(orgId: string) {
    const findMany = this.prisma.vesinvestGroupDefinition?.findMany;
    const rows =
      typeof findMany === 'function'
        ? await findMany({
            orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
            select: {
              key: true,
              label: true,
              defaultAccountKey: true,
              defaultDepreciationClassKey: true,
              reportGroupKey: true,
              serviceSplit: true,
            },
          })
        : [];
    const persistedMap = new Map(
      rows.map((row) => [
        row.key,
        {
          key: row.key,
          label: row.label,
          defaultAccountKey: row.defaultAccountKey,
          defaultDepreciationClassKey:
            normalizeVesinvestDepreciationClassKey(
              row.key,
              row.defaultDepreciationClassKey,
            ) ?? row.key,
          reportGroupKey: row.reportGroupKey,
          serviceSplit: row.serviceSplit,
        },
      ]),
    );
    const base = DEFAULT_VESINVEST_GROUP_DEFINITIONS.map(
      (item) => persistedMap.get(item.key) ?? { ...item },
    );
    const overrideFindMany = this.prisma.vesinvestGroupOverride?.findMany;
    if (typeof overrideFindMany !== 'function') {
      return sortVesinvestGroupDefinitions(base);
    }
    const overrides = await overrideFindMany({
      where: { orgId },
      orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
      select: {
        key: true,
        label: true,
        defaultAccountKey: true,
        defaultDepreciationClassKey: true,
        reportGroupKey: true,
        serviceSplit: true,
      },
    });
    if (overrides.length === 0) {
      return sortVesinvestGroupDefinitions(base);
    }
    const overrideMap = new Map(
      overrides.map((row) => [
        row.key,
        {
          key: row.key,
          label: row.label,
          defaultAccountKey: row.defaultAccountKey,
          defaultDepreciationClassKey:
            normalizeVesinvestDepreciationClassKey(
              row.key,
              row.defaultDepreciationClassKey,
            ) ?? row.key,
          reportGroupKey: row.reportGroupKey,
          serviceSplit: row.serviceSplit,
        },
      ]),
    );
    const merged = base.map((item) => overrideMap.get(item.key) ?? item);
    return sortVesinvestGroupDefinitions(merged);
  }

  async getVesinvestGroupClassificationDefaults(orgId: string) {
    return new Map(
      (await this.getOrderedVesinvestGroupDefinitions(orgId)).map((group) => [
        group.key,
        {
          defaultAccountKey: group.defaultAccountKey,
          defaultDepreciationClassKey:
            normalizeVesinvestDepreciationClassKey(
              group.key,
              group.defaultDepreciationClassKey,
            ) ?? group.key,
        },
      ] as const),
    );
  }

  async getOptionalBoundUtilityIdentity(orgId: string) {
    const bound = await this.importOverviewService.getBoundUtilityIdentity(orgId);
    if (!bound?.veetiId || !bound.utilityName) {
      return null;
    }
    return {
      veetiId: bound.veetiId,
      utilityName: bound.utilityName,
      businessId: bound.businessId ?? null,
      identitySource: 'veeti' as const,
    };
  }

  buildBaselineSourceSummary(
    importStatus: {
      years: Array<{
        vuosi: number;
        planningRole?: PlanningRole;
        sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
        sourceBreakdown?: {
          veetiDataTypes?: string[];
          manualDataTypes?: string[];
        };
      }>;
    },
    year: number,
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): BaselineSourceSummary {
    const yearStatus =
      importStatus.years.find((row) => row.vuosi === year) ?? null;
    const financials = this.buildBaselineDatasetSource(
      yearDataset,
      'tilinpaatos',
      'tilinpaatos',
    );
    const prices = this.buildBaselineDatasetSource(yearDataset, 'taksa', 'taksa');
    const volumes = this.mergeBaselineDatasetSources(yearDataset, [
      'volume_vesi',
      'volume_jatevesi',
    ]);

    return {
      year,
      planningRole:
        yearStatus?.planningRole ??
        (year === new Date().getFullYear()
          ? 'current_year_estimate'
          : 'historical'),
      sourceStatus: yearStatus?.sourceStatus ?? yearDataset.sourceStatus,
      sourceBreakdown: {
        veetiDataTypes: yearStatus?.sourceBreakdown?.veetiDataTypes ?? [],
        manualDataTypes: yearStatus?.sourceBreakdown?.manualDataTypes ?? [],
      },
      financials,
      prices,
      volumes,
    };
  }

  buildBaselineSourceSummaryFromVesinvestSnapshot(
    rawState: Prisma.JsonValue | null,
    requestedYear: number | null,
  ): BaselineSourceSummary | null {
    const summaries = this.buildBaselineSourceSummariesFromVesinvestSnapshot(
      rawState,
      [],
    );
    return this.selectPrimaryBaselineSourceSummary(summaries, requestedYear);
  }

  buildBaselineSourceSummariesFromCurrentBaseline(
    currentBaseline: Awaited<
      ReturnType<V2ReportBaselineSupport['getCurrentBaselineSnapshot']>
    >,
    acceptedYears: number[],
  ): BaselineSourceSummary[] {
    return this.buildBaselineSourceSummariesFromYears(
      currentBaseline.baselineYears,
      acceptedYears,
    );
  }

  buildBaselineSourceSummariesFromVesinvestSnapshot(
    rawState: Prisma.JsonValue | null,
    acceptedYears: number[],
  ): BaselineSourceSummary[] {
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
      return [];
    }
    const state = rawState as Record<string, unknown>;
    const years = Array.isArray(state.baselineYears)
      ? (state.baselineYears as VesinvestBaselineSnapshotYear[])
      : [];
    return this.buildBaselineSourceSummariesFromYears(years, acceptedYears);
  }

  buildBaselineSourceSummariesFromYears(
    years: VesinvestBaselineSnapshotYear[],
    acceptedYears: number[],
  ): BaselineSourceSummary[] {
    const acceptedYearSet =
      acceptedYears.length > 0 ? new Set(acceptedYears) : null;
    return [...years]
      .filter((item) => {
        const year = this.toNumber(item.year);
        if (!Number.isInteger(year) || year <= 0) {
          return false;
        }
        return acceptedYearSet == null || acceptedYearSet.has(year);
      })
      .map((item) => ({
        year: this.toNumber(item.year),
        planningRole: (
          item.planningRole === 'current_year_estimate'
            ? 'current_year_estimate'
            : 'historical'
        ) as PlanningRole,
        sourceStatus: (
          item.sourceStatus === 'VEETI' ||
          item.sourceStatus === 'MANUAL' ||
          item.sourceStatus === 'MIXED'
            ? item.sourceStatus
            : 'INCOMPLETE'
        ) as BaselineSourceSummary['sourceStatus'],
        sourceBreakdown: {
          veetiDataTypes: Array.isArray(item.sourceBreakdown?.veetiDataTypes)
            ? item.sourceBreakdown?.veetiDataTypes.filter(
                (entry): entry is string => typeof entry === 'string',
              )
            : [],
          manualDataTypes: Array.isArray(item.sourceBreakdown?.manualDataTypes)
            ? item.sourceBreakdown?.manualDataTypes.filter(
                (entry): entry is string => typeof entry === 'string',
              )
            : [],
        },
        financials: this.normalizeSavedBaselineDataset(
          item.financials,
          'tilinpaatos',
        ),
        prices: this.normalizeSavedBaselineDataset(item.prices, 'taksa'),
        volumes: this.normalizeSavedBaselineDataset(
          item.volumes,
          'volume_vesi+volume_jatevesi',
        ),
      }))
      .sort((left, right) => left.year - right.year);
  }

  selectPrimaryBaselineSourceSummary(
    summaries: BaselineSourceSummary[],
    requestedYear: number | null,
  ): BaselineSourceSummary | null {
    if (summaries.length === 0) {
      return null;
    }
    if (requestedYear != null) {
      const requested = summaries.find((item) => item.year === requestedYear);
      if (requested) {
        return requested;
      }
    }
    return summaries[summaries.length - 1] ?? null;
  }

  readSnapshotBaselineSourceSummaries(
    snapshot: Partial<SnapshotPayload>,
  ): BaselineSourceSummary[] {
    if (Array.isArray(snapshot.baselineSourceSummaries)) {
      return [...snapshot.baselineSourceSummaries].sort(
        (left, right) => left.year - right.year,
      );
    }
    return snapshot.baselineSourceSummary ? [snapshot.baselineSourceSummary] : [];
  }

  normalizeSavedBaselineDataset(
    raw: VesinvestBaselineSnapshotYear['financials'],
    fallbackDataType: string,
  ): BaselineDatasetSource {
    const dataset =
      raw && typeof raw === 'object' ? (raw as BaselineDatasetSource) : null;
    return {
      dataType: this.normalizeText(dataset?.dataType) ?? fallbackDataType,
      source:
        dataset?.source === 'veeti' || dataset?.source === 'manual'
          ? dataset.source
          : 'none',
      provenance:
        dataset?.provenance && typeof dataset.provenance === 'object'
          ? (dataset.provenance as OverrideProvenance)
          : null,
      editedAt: this.normalizeText(dataset?.editedAt) ?? null,
      editedBy: this.normalizeText(dataset?.editedBy) ?? null,
      reason: this.normalizeText(dataset?.reason) ?? null,
    };
  }

  buildBaselineDatasetSource(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    requestedDataType: string,
    fallbackDataType: string,
  ): BaselineDatasetSource {
    const dataset =
      yearDataset.datasets.find((row) => row.dataType === requestedDataType) ??
      null;

    return {
      dataType: dataset?.dataType ?? fallbackDataType,
      source: dataset?.source ?? 'none',
      provenance: dataset?.overrideMeta?.provenance ?? null,
      editedAt: dataset?.overrideMeta?.editedAt ?? null,
      editedBy: dataset?.overrideMeta?.editedBy ?? null,
      reason: dataset?.overrideMeta?.reason ?? null,
    };
  }

  mergeBaselineDatasetSources(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    dataTypes: string[],
  ): BaselineDatasetSource {
    const datasets = dataTypes
      .map((dataType) =>
        yearDataset.datasets.find((row) => row.dataType === dataType) ?? null,
      )
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const source =
      datasets.some((row) => row.source === 'manual')
        ? 'manual'
        : datasets.some((row) => row.source === 'veeti')
        ? 'veeti'
        : 'none';
    const overrideMeta =
      [...datasets]
        .map((row) => row.overrideMeta)
        .filter(
          (row): row is NonNullable<(typeof datasets)[number]['overrideMeta']> =>
            row !== null,
        )
        .sort(
          (left, right) =>
            new Date(right.editedAt).getTime() - new Date(left.editedAt).getTime(),
        )[0] ?? null;

    return {
      dataType: dataTypes.join('+'),
      source,
      provenance: overrideMeta?.provenance ?? null,
      editedAt: overrideMeta?.editedAt ?? null,
      editedBy: overrideMeta?.editedBy ?? null,
      reason: overrideMeta?.reason ?? null,
    };
  }

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  normalizeText(value: string | null | undefined): string | null {
    if (value == null) return null;
    let out = value;

    if (/\\u[0-9a-fA-F]{4}/.test(out)) {
      out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : '';
      });
    }

    if (/[ÃÂâ]/.test(out)) {
      const recovered = Buffer.from(out, 'latin1').toString('utf8');
      if (this.looksRecoveredText(recovered, out)) {
        out = recovered;
      }
    }

    return out;
  }

  normalizeYearList(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) =>
        typeof item === 'number' && Number.isFinite(item)
          ? Math.round(item)
          : typeof item === 'string' && item.trim().length > 0
          ? Number(item)
          : NaN,
      )
      .filter((item) => Number.isInteger(item))
      .sort((left, right) => left - right);
  }

  formatIsoDate(value: Date | string): string {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value instanceof Date ? parsed.toISOString().slice(0, 10) : value;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  buildDefaultScenarioName(value: Date | string): string {
    return `Scenario ${this.formatIsoDate(value)}`;
  }

  buildDefaultReportTitle(
    scenarioName: string | null | undefined,
    value: Date | string,
  ): string {
    const safeScenarioName =
      this.normalizeText(scenarioName)?.trim() || 'Scenario';
    return `Forecast report ${safeScenarioName} ${this.formatIsoDate(value)}`;
  }

  looksRecoveredText(candidate: string, original: string): boolean {
    const badPattern = /Ã|Â|â/;
    if (badPattern.test(candidate)) return false;
    const candidateScore = (candidate.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
      .length;
    const originalScore = (original.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
      .length;
    return candidateScore >= originalScore;
  }

  toPdfText(value: string): string {
    const sanitized = value
      .replace(/[\u00A0\u202F]/g, ' ')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...');

    return Array.from(sanitized)
      .map((char) => {
        const codePoint = char.codePointAt(0) ?? 0x3f;
        return codePoint === 0x09 ||
          codePoint === 0x0a ||
          codePoint === 0x0d ||
          (codePoint >= 0x20 && codePoint <= 0xff)
          ? char
          : '?';
      })
      .join('');
  }
}
