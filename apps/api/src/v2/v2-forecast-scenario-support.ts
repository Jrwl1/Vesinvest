import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ForecastScenarioContext = any;

export function createV2ForecastScenarioSupport(ctx: ForecastScenarioContext) {
  return {
    async listForecastScenarios(orgId: string) {
      const scenarios = await ctx.projectionsService.list(orgId);
      return scenarios.map((scenario: any) => ({
        id: scenario.id,
        name: scenario.nimi,
        onOletus: Boolean(scenario.onOletus),
        scenarioType: ctx.resolveScenarioType(
          scenario?.olettamusYlikirjoitukset,
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

    async createForecastScenario(orgId: string, body: any) {
      const acceptedBaselineBudgetIds =
        await ctx.resolveAcceptedPlanningBaselineBudgetIds(orgId);
      const baselineBudgetId =
        body.talousarvioId ?? (await ctx.resolveLatestAcceptedVeetiBudgetId(orgId));
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

      const name = body.name?.trim() || ctx.buildDefaultScenarioName(new Date());
      const payload: {
        talousarvioId: string;
        nimi: string;
        aikajaksoVuosia: number;
        olettamusYlikirjoitukset?: Record<string, number>;
        userInvestments?: any[];
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
      const existingBaseScenario = existingScenarios.find((row: any) =>
        Boolean(row.onOletus),
      );
      let sourceScenarioType: any = null;

      if (body.copyFromScenarioId) {
        const source = (await ctx.projectionsService.findById(
          orgId,
          body.copyFromScenarioId,
        )) as any;
        sourceScenarioType = ctx.resolveScenarioType(
          source?.olettamusYlikirjoitukset,
          Boolean(source?.onOletus),
        );
        const normalized = ctx.normalizeUserInvestments(source?.userInvestments);
        payload.userInvestments = normalized;
        const sourceAssumptionOverrides = ctx.normalizeAssumptionOverrides(
          source?.olettamusYlikirjoitukset,
        );
        if (Object.keys(sourceAssumptionOverrides).length > 0) {
          payload.olettamusYlikirjoitukset = sourceAssumptionOverrides;
        }
        const sourceBaseYear = Number.isFinite(Number(source?.talousarvio?.vuosi))
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

      return ctx.getForecastScenario(orgId, created.id);
    },

    async getForecastScenario(orgId: string, scenarioId: string) {
      const projection = (await ctx.projectionsService.findById(
        orgId,
        scenarioId,
      )) as any;
      return ctx.mapScenarioPayload(orgId, projection);
    },

    async updateForecastScenario(orgId: string, scenarioId: string, body: any) {
      const current = (await ctx.projectionsService.findById(
        orgId,
        scenarioId,
      )) as any;
      const scenarioDepreciationStorage =
        await ctx.ensureScenarioDepreciationStorage(orgId, current);
      const update: {
        nimi?: string;
        aikajaksoVuosia?: number;
        olettamusYlikirjoitukset?: Record<string, number>;
        userInvestments?: any[];
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
      const currentInvestmentByRowId = new Map<string, any>(
        ctx.normalizeUserInvestments(current.userInvestments).map((row: any) => [
          row.rowId ?? String(row.year),
          row,
        ]),
      );
      const scenarioRuleByKey = new Map(
        scenarioDepreciationStorage.rules.map((rule: any) => [
          rule.assetClassKey,
          rule,
        ] as const),
      );
      const enrichedInvestments = normalizedInvestments.map((row: any) => {
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
      return ctx.getForecastScenario(orgId, scenarioId);
    },

    async deleteForecastScenario(orgId: string, scenarioId: string) {
      return ctx.projectionsService.delete(orgId, scenarioId);
    },
  };
}
