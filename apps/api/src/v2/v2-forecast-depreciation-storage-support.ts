import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PTS_SCENARIO_DEPRECIATION_RULE_DEFAULTS } from './pts-depreciation-defaults';
import {
  DEFAULT_VESINVEST_GROUP_DEFINITIONS,
  expandLegacyDepreciationRuleKeyToVesinvestClasses,
  VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY,
} from './vesinvest-contract';
import { V2ForecastInputModelSupport } from './v2-forecast-input-model-support';
import { V2ForecastScenarioMetaSupport } from './v2-forecast-scenario-meta-support';
import {
  toCanonicalDepreciationMethod,
  type DepreciationRuleInput,
  type DepreciationRuleView,
  type ScenarioBaselineDepreciationRow,
  type ScenarioStoredDepreciationRule,
} from './v2-forecast.types';

type ForecastProjectionLike = {
  id?: string;
  baselineDepreciation?: unknown;
  scenarioDepreciationRules?: unknown;
  vuodet?: unknown[];
};

export class V2ForecastDepreciationStorageSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inputModelSupport: V2ForecastInputModelSupport,
    private readonly scenarioMetaSupport: V2ForecastScenarioMetaSupport,
  ) {}

  mapDepreciationRule(row: Record<string, unknown>): DepreciationRuleView {
    const method = toCanonicalDepreciationMethod(String(row.method ?? '')) ?? 'none';
    return {
      id: String(row.id ?? row.assetClassKey ?? ''),
      assetClassKey: String(row.assetClassKey ?? ''),
      assetClassName: this.scenarioMetaSupport.resolveAuthoritativeDepreciationClassName(
        String(row.assetClassKey ?? ''),
        this.scenarioMetaSupport.normalizeText(
          typeof row.assetClassName === 'string' ? row.assetClassName : null,
        ) ?? null,
      ),
      method,
      linearYears:
        row.linearYears == null
          ? null
          : Math.round(this.inputModelSupport.toNumber(row.linearYears)),
      residualPercent:
        row.residualPercent == null
          ? null
          : this.inputModelSupport.round2(this.inputModelSupport.toNumber(row.residualPercent)),
      annualSchedule: Array.isArray(row.annualSchedule)
        ? row.annualSchedule.map((item: unknown) =>
            this.inputModelSupport.round2(this.inputModelSupport.toNumber(item)),
          )
        : null,
      updatedAt:
        row.updatedAt instanceof Date || typeof row.updatedAt === 'string'
          ? row.updatedAt
          : new Date(0),
      createdAt:
        row.createdAt instanceof Date || typeof row.createdAt === 'string'
          ? row.createdAt
          : new Date(0),
    };
  }

  mapScenarioDepreciationRule(
    rule: ScenarioStoredDepreciationRule,
  ): DepreciationRuleView {
    const now = new Date().toISOString();
    return {
      id: rule.id,
      assetClassKey: rule.assetClassKey,
      assetClassName: this.scenarioMetaSupport.resolveAuthoritativeDepreciationClassName(
        rule.assetClassKey,
        rule.assetClassName,
      ),
      method: rule.method,
      linearYears: rule.linearYears,
      residualPercent: rule.residualPercent,
      annualSchedule: rule.annualSchedule,
      updatedAt: now,
      createdAt: now,
    };
  }

  snapshotDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    return {
      assetClassKey: rule.assetClassKey,
      assetClassName: this.scenarioMetaSupport.resolveAuthoritativeDepreciationClassName(
        rule.assetClassKey,
        rule.assetClassName,
      ),
      method: rule.method,
      linearYears: rule.linearYears,
      residualPercent: rule.residualPercent,
      annualSchedule: rule.annualSchedule ?? null,
    };
  }

  async ensureScenarioDepreciationStorage(
    orgId: string,
    projection: ForecastProjectionLike,
  ): Promise<{
    baselineDepreciation: ScenarioBaselineDepreciationRow[];
    rules: ScenarioStoredDepreciationRule[];
  }> {
    const baselineDepreciation = this.normalizeScenarioBaselineDepreciation(
      projection?.baselineDepreciation,
    );
    const rules = this.normalizeScenarioStoredDepreciationRules(
      projection?.scenarioDepreciationRules,
    );

    const nextData: Record<string, unknown> = {};
    let nextBaseline = baselineDepreciation;
    let nextRules = rules;

    if (projection?.baselineDepreciation == null) {
      nextBaseline = this.buildScenarioBaselineDepreciationSeed(projection);
      if (nextBaseline.length > 0) {
        nextData.baselineDepreciation = nextBaseline;
      }
    }

    if (
      projection?.scenarioDepreciationRules == null ||
      (Array.isArray(projection?.scenarioDepreciationRules) &&
        projection.scenarioDepreciationRules.length === 0)
    ) {
      nextRules = await this.buildScenarioDepreciationRuleSeed(orgId);
      nextData.scenarioDepreciationRules = nextRules;
    }

    if (
      Object.keys(nextData).length > 0 &&
      projection?.id &&
      this.prisma.ennuste?.updateMany
    ) {
      await this.prisma.ennuste.updateMany({
        where: { id: projection.id, orgId },
        data: nextData,
      });
    }

    return {
      baselineDepreciation: nextBaseline,
      rules: nextRules,
    };
  }

  async saveScenarioDepreciationRules(
    orgId: string,
    scenarioId: string,
    rules: ScenarioStoredDepreciationRule[],
  ) {
    await this.prisma.ennuste.updateMany({
      where: { id: scenarioId, orgId },
      data: {
        scenarioDepreciationRules: rules,
        computedAt: null,
        computedFromUpdatedAt: null,
      },
    });
  }

  async buildScenarioDepreciationRuleSeed(
    orgId: string,
  ): Promise<ScenarioStoredDepreciationRule[]> {
    const delegate = this.prisma.organizationDepreciationRule;
    const rows = delegate?.findMany
      ? await delegate.findMany({
          where: { orgId },
          orderBy: [{ assetClassKey: 'asc' }],
        })
      : [];
    const merged = new Map<string, ScenarioStoredDepreciationRule>();
    const authoritativeClassKeys = new Set(
      DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((group) => group.key),
    );

    for (const rule of PTS_SCENARIO_DEPRECIATION_RULE_DEFAULTS) {
      merged.set(rule.assetClassKey, {
        ...rule,
      });
    }

    for (const group of DEFAULT_VESINVEST_GROUP_DEFINITIONS) {
      const legacyRule =
        merged.get(VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY[group.key]) ?? null;
      if (!legacyRule) {
        continue;
      }
      merged.set(group.key, {
        ...legacyRule,
        id: group.key,
        assetClassKey: group.key,
        assetClassName: group.label,
      });
    }

    const explicitClassKeys = new Set<string>();
    for (const row of rows as Array<{ assetClassKey?: unknown }>) {
      const assetClassKey = String(row.assetClassKey ?? '').trim();
      if (authoritativeClassKeys.has(assetClassKey)) {
        explicitClassKeys.add(assetClassKey);
      }
    }
    const sortedRows = [...rows].sort((left, right) => {
      const leftIsClass = authoritativeClassKeys.has(
        String(left.assetClassKey ?? '').trim(),
      );
      const rightIsClass = authoritativeClassKeys.has(
        String(right.assetClassKey ?? '').trim(),
      );
      if (leftIsClass === rightIsClass) {
        return String(left.assetClassKey ?? '').localeCompare(
          String(right.assetClassKey ?? ''),
        );
      }
      return leftIsClass ? 1 : -1;
    });

    for (const row of sortedRows) {
      const assetClassKey = String(row.assetClassKey ?? '').trim();
      if (!assetClassKey) continue;
      const isExplicitClassRule = authoritativeClassKeys.has(assetClassKey);
      const targetKeys = new Set<string>([
        assetClassKey,
        ...expandLegacyDepreciationRuleKeyToVesinvestClasses(assetClassKey),
      ]);
      for (const targetKey of targetKeys) {
        if (!isExplicitClassRule && explicitClassKeys.has(targetKey)) {
          continue;
        }
        const classLabel =
          DEFAULT_VESINVEST_GROUP_DEFINITIONS.find((group) => group.key === targetKey)
            ?.label ?? null;
        merged.set(targetKey, {
          id: targetKey,
          assetClassKey: targetKey,
          assetClassName:
            classLabel ?? this.scenarioMetaSupport.normalizeText(row.assetClassName) ?? null,
          method:
            toCanonicalDepreciationMethod(String(row.method ?? '')) ?? 'none',
          linearYears:
            row.linearYears == null
              ? null
              : Math.round(this.inputModelSupport.toNumber(row.linearYears)),
          residualPercent:
            row.residualPercent == null
              ? null
              : this.inputModelSupport.round2(this.inputModelSupport.toNumber(row.residualPercent)),
          annualSchedule: null,
        });
      }
    }

    return [...merged.values()];
  }

  buildScenarioBaselineDepreciationSeed(
    projection: ForecastProjectionLike,
  ): ScenarioBaselineDepreciationRow[] {
    if (!Array.isArray(projection?.vuodet)) return [];
    return projection.vuodet
      .map((entry) => {
        const row = (entry && typeof entry === 'object'
          ? entry
          : {}) as Record<string, unknown>;
        return {
          year: Math.round(this.inputModelSupport.toNumber(row.vuosi)),
          amount: this.inputModelSupport.round2(
            this.inputModelSupport.toNumber(row.poistoPerusta),
          ),
        };
      })
      .filter(
        (row: ScenarioBaselineDepreciationRow) =>
          Number.isFinite(row.year) && Number.isFinite(row.amount),
      );
  }

  normalizeScenarioBaselineDepreciation(
    raw: unknown,
  ): ScenarioBaselineDepreciationRow[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const payload = row as Record<string, unknown>;
        const year = Math.round(this.inputModelSupport.toNumber(payload.year));
        const amount = this.inputModelSupport.round2(this.inputModelSupport.toNumber(payload.amount));
        if (!Number.isFinite(year) || !Number.isFinite(amount)) return null;
        return { year, amount };
      })
      .filter(
        (
          row,
        ): row is ScenarioBaselineDepreciationRow =>
          row != null,
      );
  }

  normalizeScenarioStoredDepreciationRules(
    raw: unknown,
  ): ScenarioStoredDepreciationRule[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const assetClassKey = (
          this.scenarioMetaSupport.normalizeText(
            typeof row.assetClassKey === 'string' ? row.assetClassKey : null,
          ) ?? ''
        ).trim();
        const method = (
          this.scenarioMetaSupport.normalizeText(
            typeof row.method === 'string' ? row.method : null,
          ) ?? ''
        ).toLowerCase();
        const canonicalMethod = toCanonicalDepreciationMethod(method);
        if (!assetClassKey) return null;
        if (!canonicalMethod) {
          return null;
        }
        return {
          id:
            (
              this.scenarioMetaSupport.normalizeText(
                typeof row.id === 'string' ? row.id : null,
              ) ?? assetClassKey
            ).trim() || assetClassKey,
          assetClassKey,
          assetClassName: this.scenarioMetaSupport.normalizeText(
            typeof row.assetClassName === 'string' ? row.assetClassName : null,
          ) ?? null,
          method: canonicalMethod,
          linearYears:
            row.linearYears == null
              ? null
              : Math.round(this.inputModelSupport.toNumber(row.linearYears)),
          residualPercent:
            row.residualPercent == null
              ? null
              : this.inputModelSupport.round2(this.inputModelSupport.toNumber(row.residualPercent)),
          annualSchedule:
            Array.isArray(row.annualSchedule) &&
            row.annualSchedule.every((item) => Number.isFinite(Number(item)))
              ? row.annualSchedule.map((item) =>
                  this.inputModelSupport.round2(this.inputModelSupport.toNumber(item)),
                )
              : null,
        };
      })
      .filter(
        (
          row,
        ): row is ScenarioStoredDepreciationRule =>
          row != null,
      );
  }

  normalizeDepreciationRuleInput(input: DepreciationRuleInput): {
    id: string;
    assetClassKey: string;
    assetClassName: string | null;
    method: ScenarioStoredDepreciationRule['method'];
    linearYears: number | null;
    residualPercent: number | null;
    annualSchedule: number[] | null;
  } {
    const assetClassKeyRaw = this.scenarioMetaSupport.normalizeText(input.assetClassKey) ?? '';
    const assetClassKey = assetClassKeyRaw.trim();
    if (!assetClassKey) {
      throw new BadRequestException('assetClassKey is required.');
    }

    const method = String(input.method ?? '')
      .trim()
      .toLowerCase();
    if (method !== 'residual' && method !== 'straight-line' && method !== 'none') {
      throw new BadRequestException(
        'method must be one of: residual, straight-line, none.',
      );
    }

    let linearYears: number | null = null;
    let residualPercent: number | null = null;
    if (method === 'straight-line') {
      const parsedYears = Math.round(this.inputModelSupport.toNumber(input.linearYears));
      if (
        !Number.isFinite(parsedYears) ||
        parsedYears < 1 ||
        parsedYears > 120
      ) {
        throw new BadRequestException(
          'linearYears must be between 1 and 120 for straight-line method.',
        );
      }
      linearYears = parsedYears;
    }

    if (method === 'residual') {
      const parsedResidual = this.inputModelSupport.round2(this.inputModelSupport.toNumber(input.residualPercent));
      if (
        !Number.isFinite(parsedResidual) ||
        parsedResidual < 0 ||
        parsedResidual > 100
      ) {
        throw new BadRequestException(
          'residualPercent must be between 0 and 100 for residual method.',
        );
      }
      residualPercent = parsedResidual;
    }

    const classNameRaw = this.scenarioMetaSupport.normalizeText(input.assetClassName) ?? null;
    const assetClassName = classNameRaw ? classNameRaw.trim() : null;

    return {
      id: assetClassKey,
      assetClassKey,
      assetClassName:
        assetClassName && assetClassName.length > 0 ? assetClassName : null,
      method,
      linearYears,
      residualPercent,
      annualSchedule: null,
    };
  }

  scenarioAllocationRecordFromArray(
    allocations: Array<{ classKey?: string; sharePct?: number }>,
  ): Record<string, unknown> {
    const map = new Map<string, number>();
    for (const row of allocations) {
      const classKeyRaw = this.scenarioMetaSupport.normalizeText(row.classKey) ?? '';
      const classKey = classKeyRaw.trim();
      if (!classKey) continue;
      const sharePct = this.inputModelSupport.round2(this.inputModelSupport.toNumber(row.sharePct));
      if (!Number.isFinite(sharePct) || sharePct < 0 || sharePct > 100) {
        throw new BadRequestException(
          `sharePct must be between 0 and 100 for class "${classKey}".`,
        );
      }
      map.set(classKey, sharePct);
    }
    const total = [...map.values()].reduce((sum, value) => sum + value, 0);
    if (total > 100.01) {
      throw new BadRequestException(
        'Class allocation percentages cannot exceed 100%.',
      );
    }
    return Object.fromEntries(map.entries());
  }

  normalizeScenarioYearAllocations(
    raw: Record<string, unknown>,
  ): Array<{ classKey: string; sharePct: number }> {
    const out: Array<{ classKey: string; sharePct: number }> = [];
    for (const [classKey, shareValue] of Object.entries(raw)) {
      const key = classKey.trim();
      if (!key) continue;
      const sharePct = this.inputModelSupport.round2(this.inputModelSupport.toNumber(shareValue));
      if (!Number.isFinite(sharePct) || sharePct <= 0) continue;
      out.push({ classKey: key, sharePct });
    }
    return out.sort((a, b) => a.classKey.localeCompare(b.classKey));
  }

}
