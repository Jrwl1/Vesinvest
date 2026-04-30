import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { ProjectionsService } from '../projections/projections.service';
import type {
  NearTermExpenseAssumption,
  ScenarioPayload,
  ScenarioAssumptionKey,
  ScenarioStoredDepreciationRule,
  ScenarioType,
  YearlyInvestment,
} from './v2-forecast.types';

type ForecastScenarioListItem = Awaited<
  ReturnType<ProjectionsService['list']>
>[number];
type ForecastProjection = Awaited<ReturnType<ProjectionsService['findById']>>;
type ForecastCreateBody = {
  name?: string;
  talousarvioId?: string;
  horizonYears?: number;
  copyFromScenarioId?: string;
  scenarioType?: ScenarioType;
  compute?: boolean;
};
type ForecastUpdateBody = {
  name?: string;
  horizonYears?: number;
  scenarioType?: ScenarioType;
  yearlyInvestments?: Array<{ year: number; amount: number }>;
  allowVesinvestLinkedInvestmentUpdate?: boolean;
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
};
type ForecastScenarioStorage = {
  rules: ScenarioStoredDepreciationRule[];
};

type ForecastScenarioContext = {
  prisma: PrismaService;
  projectionsService: Pick<
    ProjectionsService,
    'list' | 'findById' | 'create' | 'compute' | 'update' | 'delete'
  >;
  resolveAcceptedPlanningBaselineBudgetIds: (
    orgId: string,
  ) => Promise<string[]>;
  resolveLatestAcceptedVeetiBudgetId: (orgId: string) => Promise<string | null>;
  buildDefaultScenarioName: (value: Date | string) => string;
  resolveScenarioType: (raw: unknown, onOletus: boolean) => ScenarioType;
  resolveScenarioTypeForCreate: (params: {
    requestedScenarioType?: ScenarioType;
    existingBaseScenarioExists: boolean;
    sourceScenarioType: ScenarioType | null;
  }) => ScenarioType;
  withScenarioTypeOverride: (
    overrides: Record<string, number> | undefined,
    scenarioType: ScenarioType,
  ) => Record<string, number>;
  normalizeUserInvestments: (raw: unknown) => YearlyInvestment[];
  normalizeAssumptionOverrides: (raw: unknown) => Record<string, number>;
  extractExplicitNearTermExpenseAssumptions: (
    baseYear: number | null,
    rawOverrides: unknown,
  ) => NearTermExpenseAssumption[];
  buildYearOverrides: (
    investments: YearlyInvestment[],
    nearTermExpenseAssumptions: NearTermExpenseAssumption[],
    rawExistingOverrides?: unknown,
  ) => Record<number, Record<string, unknown>>;
  mapScenarioPayload: (
    orgId: string,
    projection: ForecastProjection,
  ) => Promise<ScenarioPayload>;
  getForecastScenario?: (
    orgId: string,
    scenarioId: string,
  ) => Promise<ScenarioPayload>;
  ensureScenarioDepreciationStorage: (
    orgId: string,
    projection: ForecastProjection,
  ) => Promise<ForecastScenarioStorage>;
  normalizeScenarioAssumptionOverrides: (
    raw: Partial<Record<ScenarioAssumptionKey, unknown>>,
  ) => Partial<Record<ScenarioAssumptionKey, number>>;
  normalizeThereafterExpenseAssumptions: (raw: {
    personnelPct?: number;
    energyPct?: number;
    opexOtherPct?: number;
  }) => {
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  };
  normalizeNearTermExpenseAssumptions: (
    raw: Array<{
      year: number;
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    }>,
    baseYear: number | null,
  ) => NearTermExpenseAssumption[];
  round2: (value: number) => number;
  normalizeScenarioType: (raw: unknown) => ScenarioType;
  snapshotDepreciationRule: (
    rule: ScenarioStoredDepreciationRule,
  ) => YearlyInvestment['depreciationRuleSnapshot'];
};

export function createV2ForecastScenarioSupport(ctx: ForecastScenarioContext) {
  const resolveScenarioPayload = async (
    orgId: string,
    scenarioId: string,
  ): Promise<ScenarioPayload> => {
    if (typeof ctx.projectionsService.findById === 'function') {
      const projection = await ctx.projectionsService.findById(
        orgId,
        scenarioId,
      );
      return ctx.mapScenarioPayload(orgId, projection);
    }
    if (ctx.getForecastScenario) {
      return ctx.getForecastScenario(orgId, scenarioId);
    }
    throw new BadRequestException(
      'Forecast scenario payload resolver is unavailable.',
    );
  };

  return {
    async listForecastScenarios(orgId: string) {
      const scenarios = await ctx.projectionsService.list(orgId);
      return scenarios.map((scenario: ForecastScenarioListItem) => ({
        id: scenario.id,
        name: scenario.nimi,
        onOletus: Boolean(scenario.onOletus),
        scenarioType: ctx.resolveScenarioType(
          scenario.olettamusYlikirjoitukset,
          Boolean(scenario.onOletus),
        ),
        horizonYears: Number(scenario.aikajaksoVuosia),
        baselineYear: scenario.talousarvio?.vuosi ?? null,
        talousarvioId: scenario.talousarvioId,
        updatedAt: scenario.updatedAt,
        computedAt: scenario.computedAt ?? null,
        computedFromUpdatedAt: scenario.computedFromUpdatedAt ?? null,
        computedYears: scenario._count?.vuodet ?? 0,
      }));
    },

    async createForecastScenario(orgId: string, body: ForecastCreateBody) {
      const acceptedBaselineBudgetIds =
        await ctx.resolveAcceptedPlanningBaselineBudgetIds(orgId);
      const baselineBudgetId =
        body.talousarvioId ??
        (await ctx.resolveLatestAcceptedVeetiBudgetId(orgId));
      if (!baselineBudgetId) {
        throw new BadRequestException(
          'No trusted baseline budget found. Complete Overview import and sync first.',
        );
      }
      if (
        body.talousarvioId &&
        acceptedBaselineBudgetIds.length > 0 &&
        !acceptedBaselineBudgetIds.includes(body.talousarvioId)
      ) {
        throw new BadRequestException(
          'Selected baseline budget is not part of the accepted planning baseline.',
        );
      }

      const name =
        body.name?.trim() || ctx.buildDefaultScenarioName(new Date());
      const payload: {
        talousarvioId: string;
        nimi: string;
        aikajaksoVuosia: number;
        olettamusYlikirjoitukset?: Record<string, number>;
        userInvestments?: YearlyInvestment[];
        vuosiYlikirjoitukset?: Record<number, Record<string, unknown>>;
        ajuriPolut?: Record<string, unknown>;
        onOletus?: boolean;
      } = {
        talousarvioId: baselineBudgetId,
        nimi: name,
        aikajaksoVuosia: Number.isInteger(body.horizonYears)
          ? Number(body.horizonYears)
          : 20,
      };

      const existingScenarios = await ctx.projectionsService.list(orgId);
      const existingBaseScenario = existingScenarios.find((row) =>
        Boolean(row.onOletus),
      );
      let sourceScenarioType: ScenarioType | null = null;

      if (body.copyFromScenarioId) {
        const source = await ctx.projectionsService.findById(
          orgId,
          body.copyFromScenarioId,
        );
        sourceScenarioType = ctx.resolveScenarioType(
          source?.olettamusYlikirjoitukset,
          Boolean(source?.onOletus),
        );
        const normalized = ctx.normalizeUserInvestments(
          source?.userInvestments,
        );
        payload.userInvestments = normalized;
        const sourceAssumptionOverrides = ctx.normalizeAssumptionOverrides(
          source?.olettamusYlikirjoitukset,
        );
        if (Object.keys(sourceAssumptionOverrides).length > 0) {
          payload.olettamusYlikirjoitukset = sourceAssumptionOverrides;
        }
        const sourceBaseYear = Number.isFinite(
          Number(source?.talousarvio?.vuosi),
        )
          ? Number(source.talousarvio.vuosi)
          : null;
        const sourceNearTerm = ctx.extractExplicitNearTermExpenseAssumptions(
          sourceBaseYear,
          source?.vuosiYlikirjoitukset,
        );
        payload.vuosiYlikirjoitukset = ctx.buildYearOverrides(
          normalized,
          sourceNearTerm,
          source?.vuosiYlikirjoitukset,
        );
      }

      const scenarioType = ctx.resolveScenarioTypeForCreate({
        requestedScenarioType: body.scenarioType,
        existingBaseScenarioExists: Boolean(existingBaseScenario),
        sourceScenarioType,
      });
      if (scenarioType === 'base') {
        payload.onOletus = true;
      }
      payload.olettamusYlikirjoitukset = ctx.withScenarioTypeOverride(
        payload.olettamusYlikirjoitukset,
        scenarioType,
      );

      const created = await ctx.projectionsService.create(orgId, payload);
      if (body.compute !== false) {
        await ctx.projectionsService.compute(orgId, created.id);
      }

      return resolveScenarioPayload(orgId, created.id);
    },

    async getForecastScenario(orgId: string, scenarioId: string) {
      return resolveScenarioPayload(orgId, scenarioId);
    },

    async updateForecastScenario(
      orgId: string,
      scenarioId: string,
      body: ForecastUpdateBody,
    ) {
      const current = await ctx.projectionsService.findById(orgId, scenarioId);
      const scenarioDepreciationStorage =
        await ctx.ensureScenarioDepreciationStorage(orgId, current);
      const update: {
        nimi?: string;
        aikajaksoVuosia?: number;
        olettamusYlikirjoitukset?: Record<string, number>;
        userInvestments?: YearlyInvestment[];
        vuosiYlikirjoitukset?: Record<number, Record<string, unknown>>;
        computedAt?: Date | null;
        computedFromUpdatedAt?: Date | null;
      } = {};

      if (body.name !== undefined) update.nimi = body.name;
      if (body.horizonYears !== undefined) {
        update.aikajaksoVuosia = body.horizonYears;
      }
      const assumptionOverrides = ctx.normalizeAssumptionOverrides(
        current?.olettamusYlikirjoitukset,
      );
      if (body.scenarioAssumptions) {
        const scenarioAssumptions = ctx.normalizeScenarioAssumptionOverrides(
          body.scenarioAssumptions,
        );
        for (const [key, value] of Object.entries(scenarioAssumptions)) {
          assumptionOverrides[key] = value as number;
        }
      }
      if (body.thereafterExpenseAssumptions) {
        const thereafter = ctx.normalizeThereafterExpenseAssumptions(
          body.thereafterExpenseAssumptions,
        );
        assumptionOverrides.henkilostokerroin = ctx.round2(
          thereafter.personnelPct / 100,
        );
        assumptionOverrides.energiakerroin = ctx.round2(
          thereafter.energyPct / 100,
        );
        assumptionOverrides.inflaatio = ctx.round2(
          thereafter.opexOtherPct / 100,
        );
      }
      if (body.scenarioType !== undefined) {
        const currentScenarioType = ctx.resolveScenarioType(
          current?.olettamusYlikirjoitukset,
          Boolean(current?.onOletus),
        );
        const nextScenarioType = ctx.normalizeScenarioType(body.scenarioType);
        if (current?.onOletus) {
          if (nextScenarioType !== 'base') {
            throw new BadRequestException(
              'Base scenario type cannot be changed.',
            );
          }
        } else if (nextScenarioType === 'base') {
          throw new BadRequestException(
            'Use the default scenario as the base branch.',
          );
        }
        if (nextScenarioType !== currentScenarioType) {
          Object.assign(
            assumptionOverrides,
            ctx.withScenarioTypeOverride(assumptionOverrides, nextScenarioType),
          );
        }
      }
      update.olettamusYlikirjoitukset = assumptionOverrides;

      const normalizedInvestments = Array.isArray(body.yearlyInvestments)
        ? ctx.normalizeUserInvestments(body.yearlyInvestments)
        : ctx.normalizeUserInvestments(current.userInvestments);
      if (
        Array.isArray(body.yearlyInvestments) &&
        body.allowVesinvestLinkedInvestmentUpdate !== true
      ) {
        assertVesinvestLinkedInvestmentsUnchanged(
          ctx.normalizeUserInvestments(current.userInvestments),
          normalizedInvestments,
        );
      }
      const currentInvestmentByRowId = new Map<string, YearlyInvestment>(
        ctx
          .normalizeUserInvestments(current.userInvestments)
          .map((row) => [row.rowId ?? String(row.year), row]),
      );
      const scenarioRuleByKey = new Map<string, ScenarioStoredDepreciationRule>(
        scenarioDepreciationStorage.rules.map((rule) => [
          rule.assetClassKey,
          rule,
        ]),
      );
      const enrichedInvestments = normalizedInvestments.map((row) => {
        if (!row.depreciationClassKey) {
          return { ...row, depreciationRuleSnapshot: null };
        }
        const currentRow = currentInvestmentByRowId.get(
          row.rowId ?? String(row.year),
        );
        if (
          currentRow?.depreciationRuleSnapshot &&
          currentRow.depreciationClassKey === row.depreciationClassKey
        ) {
          return {
            ...row,
            depreciationRuleSnapshot: currentRow.depreciationRuleSnapshot,
          };
        }
        const matchingRule = scenarioRuleByKey.get(row.depreciationClassKey);
        return {
          ...row,
          depreciationRuleSnapshot: matchingRule
            ? ctx.snapshotDepreciationRule(matchingRule)
            : null,
        };
      });

      const baseYear = Number.isFinite(Number(current?.talousarvio?.vuosi))
        ? Number(current.talousarvio.vuosi)
        : null;
      const nearTermExpenseAssumptions = Array.isArray(
        body.nearTermExpenseAssumptions,
      )
        ? ctx.normalizeNearTermExpenseAssumptions(
            body.nearTermExpenseAssumptions,
            baseYear,
          )
        : ctx.extractExplicitNearTermExpenseAssumptions(
            baseYear,
            current?.vuosiYlikirjoitukset,
          );

      update.userInvestments = enrichedInvestments;
      update.vuosiYlikirjoitukset = ctx.buildYearOverrides(
        enrichedInvestments,
        nearTermExpenseAssumptions,
        current?.vuosiYlikirjoitukset,
      );
      update.computedAt = null;
      update.computedFromUpdatedAt = null;

      await ctx.projectionsService.update(orgId, scenarioId, update);
      await ctx.prisma.ennuste.updateMany({
        where: { id: scenarioId, orgId },
        data: {
          ajuriPolut: Prisma.JsonNull,
          computedAt: null,
          computedFromUpdatedAt: null,
        },
      });
      return resolveScenarioPayload(orgId, scenarioId);
    },

    async deleteForecastScenario(orgId: string, scenarioId: string) {
      return ctx.projectionsService.delete(orgId, scenarioId);
    },
  };
}

function assertVesinvestLinkedInvestmentsUnchanged(
  currentRows: YearlyInvestment[],
  nextRows: YearlyInvestment[],
) {
  const currentLinkedRows = currentRows.filter(isVesinvestLinkedInvestment);
  if (currentLinkedRows.length === 0) {
    return;
  }
  const nextByKey = new Map(
    nextRows
      .filter(isVesinvestLinkedInvestment)
      .map((row) => [vesinvestLinkedInvestmentKey(row), row]),
  );
  const currentByKey = new Map(
    currentLinkedRows.map((row) => [vesinvestLinkedInvestmentKey(row), row]),
  );
  for (const row of currentLinkedRows) {
    const next = nextByKey.get(vesinvestLinkedInvestmentKey(row));
    if (!next || !sameVesinvestLinkedInvestment(row, next)) {
      throw new BadRequestException({
        code: 'VESINVEST_LINKED_INVESTMENT_READONLY',
        message:
          'Vesinvest-synced investment rows must be edited in Asset Management.',
      });
    }
  }
  for (const row of nextRows.filter(isVesinvestLinkedInvestment)) {
    if (!currentByKey.has(vesinvestLinkedInvestmentKey(row))) {
      throw new BadRequestException({
        code: 'VESINVEST_LINKED_INVESTMENT_READONLY',
        message:
          'Vesinvest-synced investment rows must be edited in Asset Management.',
      });
    }
  }
}

function isVesinvestLinkedInvestment(row: YearlyInvestment) {
  return Boolean(
    row.vesinvestPlanId || row.vesinvestProjectId || row.allocationId,
  );
}

function vesinvestLinkedInvestmentKey(row: YearlyInvestment) {
  return (
    row.allocationId ||
    row.rowId ||
    `${row.vesinvestPlanId ?? ''}:${row.vesinvestProjectId ?? ''}:${row.year}:${
      row.projectCode ?? ''
    }`
  );
}

function sameVesinvestLinkedInvestment(
  left: YearlyInvestment,
  right: YearlyInvestment,
) {
  return (
    left.year === right.year &&
    moneyEqual(left.amount, right.amount) &&
    moneyEqual(left.waterAmount, right.waterAmount) &&
    moneyEqual(left.wastewaterAmount, right.wastewaterAmount) &&
    nullableText(left.target) === nullableText(right.target) &&
    nullableText(left.category) === nullableText(right.category) &&
    nullableText(left.depreciationClassKey) ===
      nullableText(right.depreciationClassKey) &&
    nullableText(left.investmentType) === nullableText(right.investmentType) &&
    nullableText(left.confidence) === nullableText(right.confidence) &&
    nullableText(left.note) === nullableText(right.note) &&
    nullableText(left.vesinvestPlanId) ===
      nullableText(right.vesinvestPlanId) &&
    nullableText(left.vesinvestProjectId) ===
      nullableText(right.vesinvestProjectId) &&
    nullableText(left.allocationId) === nullableText(right.allocationId) &&
    nullableText(left.projectCode) === nullableText(right.projectCode) &&
    nullableText(left.groupKey) === nullableText(right.groupKey) &&
    nullableText(left.accountKey) === nullableText(right.accountKey) &&
    nullableText(left.reportGroupKey) === nullableText(right.reportGroupKey)
  );
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function moneyEqual(left: unknown, right: unknown) {
  return Math.abs(toMoney(left) - toMoney(right)) < 0.01;
}

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}
