import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { ProjectionsService } from '../projections/projections.service';
import type {
  DepreciationRuleView,
  DepreciationRuleInput,
  ScenarioClassAllocationInput,
  ScenarioStoredDepreciationRule,
} from './v2-forecast.types';
import { DEFAULT_VESINVEST_GROUP_DEFINITIONS } from './vesinvest-contract';

type ForecastProjection = Awaited<ReturnType<ProjectionsService['findById']>>;
type ScenarioDepreciationStorage = {
  rules: ScenarioStoredDepreciationRule[];
};
type NormalizedDepreciationRule = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: ScenarioStoredDepreciationRule['method'];
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule: number[] | null;
};

type ForecastDepreciationContext = {
  prisma: PrismaService;
  projectionsService: Pick<ProjectionsService, 'findById'>;
  createDepreciationRule: (
    orgId: string,
    body: DepreciationRuleInput,
  ) => Promise<DepreciationRuleView>;
  getScenarioClassAllocations: (
    orgId: string,
    scenarioId: string,
  ) => Promise<{
    scenarioId: string;
    years: Array<{
      year: number;
      allocations: Array<{ classKey: string; sharePct: number }>;
    }>;
  }>;
  buildScenarioDepreciationRuleSeed: (
    orgId: string,
  ) => Promise<ScenarioStoredDepreciationRule[]>;
  mapScenarioDepreciationRule: (
    rule: ScenarioStoredDepreciationRule,
  ) => DepreciationRuleView;
  mapDepreciationRule: (row: Record<string, unknown>) => DepreciationRuleView;
  normalizeDepreciationRuleInput: (
    body: DepreciationRuleInput,
  ) => NormalizedDepreciationRule;
  isPrismaUniqueError: (error: unknown) => boolean;
  ensureScenarioDepreciationStorage: (
    orgId: string,
    projection: ForecastProjection,
  ) => Promise<ScenarioDepreciationStorage>;
  saveScenarioDepreciationRules: (
    orgId: string,
    scenarioId: string,
    rules: ScenarioStoredDepreciationRule[],
  ) => Promise<void>;
  normalizeYearOverrides: (
    raw: unknown,
  ) => Record<number, Record<string, unknown>>;
  toNumber: (value: unknown) => number;
  normalizeScenarioYearAllocations: (
    raw: Record<string, unknown>,
  ) => Array<{ classKey: string; sharePct: number }>;
  scenarioAllocationRecordFromArray: (
    allocations: Array<{ classKey?: string; sharePct?: number }>,
  ) => Record<string, unknown>;
};

export function createV2ForecastDepreciationSupport(
  ctx: ForecastDepreciationContext,
) {
  return {
    async listDepreciationRules(orgId: string) {
      const rules = await ctx.buildScenarioDepreciationRuleSeed(orgId);
      return DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((group) =>
        ctx.mapScenarioDepreciationRule(
          rules.find((rule) => rule.assetClassKey === group.key) ?? {
            id: group.key,
            assetClassKey: group.key,
            assetClassName: group.label,
            method: 'none',
            linearYears: null,
            residualPercent: null,
            annualSchedule: null,
          },
        ),
      );
    },

    async createDepreciationRule(orgId: string, body: DepreciationRuleInput) {
      const delegate = ctx.prisma.organizationDepreciationRule;
      const normalized = ctx.normalizeDepreciationRuleInput(body);
      const orgScopedRule = {
        assetClassKey: normalized.assetClassKey,
        assetClassName: normalized.assetClassName,
        method: normalized.method,
        linearYears: normalized.linearYears,
        residualPercent: normalized.residualPercent,
      };
      try {
        const created = await delegate.create({
          data: {
            orgId,
            ...orgScopedRule,
            method:
              normalized.method === 'straight-line' ? 'linear' : normalized.method,
          },
        });
        return ctx.mapDepreciationRule(created as unknown as Record<string, unknown>);
      } catch (error) {
        if (ctx.isPrismaUniqueError(error)) {
          throw new ConflictException(
            `Depreciation rule for class "${normalized.assetClassKey}" already exists.`,
          );
        }
        throw error;
      }
    },

    async updateDepreciationRule(
      orgId: string,
      ruleId: string,
      body: DepreciationRuleInput,
    ) {
      const delegate = ctx.prisma.organizationDepreciationRule;
      const existing = await delegate.findFirst({
        where: { id: ruleId, orgId },
      });
      if (!existing) {
        return ctx.createDepreciationRule(orgId, {
          assetClassKey: body.assetClassKey ?? ruleId,
          assetClassName: body.assetClassName,
          method: body.method ?? 'none',
          linearYears: body.linearYears,
          residualPercent: body.residualPercent,
        });
      }

      const normalized = ctx.normalizeDepreciationRuleInput({
        assetClassKey: body.assetClassKey ?? existing.assetClassKey,
        assetClassName:
          body.assetClassName !== undefined
            ? body.assetClassName
            : existing.assetClassName,
        method: body.method ?? existing.method,
        linearYears:
          body.linearYears !== undefined
            ? body.linearYears
            : existing.linearYears,
        residualPercent:
          body.residualPercent !== undefined
            ? body.residualPercent
            : ctx.toNumber(existing.residualPercent),
      });

      try {
        const updated = await delegate.update({
          where: { id: ruleId },
          data: {
            assetClassKey: normalized.assetClassKey,
            assetClassName: normalized.assetClassName,
            method:
              normalized.method === 'straight-line'
                ? 'linear'
                : normalized.method,
            linearYears: normalized.linearYears,
            residualPercent: normalized.residualPercent,
          },
        });
        return ctx.mapDepreciationRule(updated as unknown as Record<string, unknown>);
      } catch (error) {
        if (ctx.isPrismaUniqueError(error)) {
          throw new ConflictException(
            `Depreciation rule for class "${normalized.assetClassKey}" already exists.`,
          );
        }
        throw error;
      }
    },

    async deleteDepreciationRule(orgId: string, ruleId: string) {
      const delegate = ctx.prisma.organizationDepreciationRule;
      const result = await delegate.deleteMany({
        where: { id: ruleId, orgId },
      });
      if (result.count === 0) {
        throw new NotFoundException('Depreciation rule not found.');
      }
      return { deleted: true };
    },

    async listScenarioDepreciationRules(orgId: string, scenarioId: string) {
      const scenario = await ctx.projectionsService.findById(orgId, scenarioId);
      const storage = await ctx.ensureScenarioDepreciationStorage(orgId, scenario);
      return storage.rules.map((rule) => ctx.mapScenarioDepreciationRule(rule));
    },

    async createScenarioDepreciationRule(
      orgId: string,
      scenarioId: string,
      body: DepreciationRuleInput,
    ) {
      const scenario = await ctx.projectionsService.findById(orgId, scenarioId);
      const storage = await ctx.ensureScenarioDepreciationStorage(orgId, scenario);
      const normalized = ctx.normalizeDepreciationRuleInput(body);
      if (
        storage.rules.some(
          (rule) => rule.assetClassKey === normalized.assetClassKey,
        )
      ) {
        throw new ConflictException(
          `Depreciation rule for class "${normalized.assetClassKey}" already exists.`,
        );
      }
      const nextRules = [
        ...storage.rules,
        {
          ...normalized,
          id: normalized.assetClassKey,
        },
      ];
      await ctx.saveScenarioDepreciationRules(orgId, scenarioId, nextRules);
      return ctx.mapScenarioDepreciationRule(nextRules[nextRules.length - 1]!);
    },

    async updateScenarioDepreciationRule(
      orgId: string,
      scenarioId: string,
      ruleId: string,
      body: DepreciationRuleInput,
    ) {
      const scenario = await ctx.projectionsService.findById(orgId, scenarioId);
      const storage = await ctx.ensureScenarioDepreciationStorage(orgId, scenario);
      const existing = storage.rules.find((rule) => rule.id === ruleId);
      if (!existing) {
        throw new NotFoundException('Depreciation rule not found.');
      }
      const normalized = ctx.normalizeDepreciationRuleInput({
        assetClassKey: body.assetClassKey ?? existing.assetClassKey,
        assetClassName:
          body.assetClassName !== undefined
            ? body.assetClassName
            : existing.assetClassName,
        method: body.method ?? existing.method,
        linearYears:
          body.linearYears !== undefined ? body.linearYears : existing.linearYears,
        residualPercent:
          body.residualPercent !== undefined
            ? body.residualPercent
            : existing.residualPercent,
        annualSchedule:
          body.annualSchedule !== undefined
            ? body.annualSchedule
            : existing.annualSchedule,
      });
      if (
        storage.rules.some(
          (rule) =>
            rule.id !== ruleId && rule.assetClassKey === normalized.assetClassKey,
        )
      ) {
        throw new ConflictException(
          `Depreciation rule for class "${normalized.assetClassKey}" already exists.`,
        );
      }
      const nextRules = storage.rules.map((rule) =>
        rule.id === ruleId
          ? {
              ...normalized,
              id: normalized.assetClassKey,
            }
          : rule,
      );
      const updated =
        nextRules.find((rule) => rule.id === normalized.assetClassKey) ??
        nextRules.find((rule) => rule.id === ruleId);
      await ctx.saveScenarioDepreciationRules(orgId, scenarioId, nextRules);
      return ctx.mapScenarioDepreciationRule(updated!);
    },

    async deleteScenarioDepreciationRule(
      orgId: string,
      scenarioId: string,
      ruleId: string,
    ) {
      const scenario = await ctx.projectionsService.findById(orgId, scenarioId);
      const storage = await ctx.ensureScenarioDepreciationStorage(orgId, scenario);
      const nextRules = storage.rules.filter((rule) => rule.id !== ruleId);
      if (nextRules.length === storage.rules.length) {
        throw new NotFoundException('Depreciation rule not found.');
      }
      await ctx.saveScenarioDepreciationRules(orgId, scenarioId, nextRules);
      return { deleted: true };
    },

    async getScenarioClassAllocations(orgId: string, scenarioId: string) {
      const scenario = await ctx.projectionsService.findById(orgId, scenarioId);
      const overrides = ctx.normalizeYearOverrides(scenario?.vuosiYlikirjoitukset);

      const baseYear = Number.isFinite(Number(scenario?.talousarvio?.vuosi))
        ? Number(scenario.talousarvio.vuosi)
        : null;
      const horizonYears = Math.max(0, ctx.toNumber(scenario?.aikajaksoVuosia));

      const out: Array<{
        year: number;
        allocations: Array<{ classKey: string; sharePct: number }>;
      }> = [];

      if (baseYear != null) {
        for (let offset = 0; offset <= horizonYears; offset += 1) {
          const year = baseYear + offset;
          const allocations = ctx.normalizeScenarioYearAllocations(
            (overrides[year]?.investmentClassAllocations as
              | Record<string, unknown>
              | undefined) ?? {},
          );
          if (allocations.length > 0) {
            out.push({ year, allocations });
          }
        }
      }

      return {
        scenarioId,
        years: out,
      };
    },

    async updateScenarioClassAllocations(
      orgId: string,
      scenarioId: string,
      body: ScenarioClassAllocationInput,
    ) {
      const scenario = await ctx.projectionsService.findById(orgId, scenarioId);
      const baseYear = Number.isFinite(Number(scenario?.talousarvio?.vuosi))
        ? Number(scenario.talousarvio.vuosi)
        : null;
      const horizonYears = Math.max(0, ctx.toNumber(scenario?.aikajaksoVuosia));
      const lastScenarioYear =
        baseYear == null ? null : baseYear + Math.max(0, horizonYears);

      const overrides = ctx.normalizeYearOverrides(scenario?.vuosiYlikirjoitukset);

      for (const row of body.years ?? []) {
        const year = Math.round(ctx.toNumber(row.year));
        if (!Number.isFinite(year)) continue;

        if (
          baseYear != null &&
          lastScenarioYear != null &&
          (year < baseYear || year > lastScenarioYear)
        ) {
          throw new BadRequestException(
            `Year ${year} is outside scenario range ${baseYear}-${lastScenarioYear}.`,
          );
        }

        const allocations = ctx.normalizeScenarioYearAllocations(
          ctx.scenarioAllocationRecordFromArray(row.allocations ?? []),
        );
        const payload = { ...(overrides[year] ?? {}) };

        if (allocations.length === 0) {
          delete payload.investmentClassAllocations;
        } else {
          payload.investmentClassAllocations = Object.fromEntries(
            allocations.map((item) => [item.classKey, item.sharePct]),
          );
        }

        if (Object.keys(payload).length === 0) {
          delete overrides[year];
        } else {
          overrides[year] = payload;
        }
      }

      await ctx.prisma.ennuste.updateMany({
        where: { id: scenarioId, orgId },
        data: {
          vuosiYlikirjoitukset: overrides as unknown as Prisma.InputJsonValue,
          computedAt: null,
          computedFromUpdatedAt: null,
        },
      });

      return ctx.getScenarioClassAllocations(orgId, scenarioId);
    },
  };
}
