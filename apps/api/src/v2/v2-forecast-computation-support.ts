import type { ProjectionsService } from '../projections/projections.service';
import type { ScenarioPayload, ScenarioType } from './v2-forecast.types';

type ForecastScenarioUpdateBody = {
  name?: string;
  horizonYears?: number;
  scenarioType?: ScenarioType;
  yearlyInvestments?: Array<{ year: number; amount: number }>;
  scenarioAssumptions?: Record<string, number>;
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

type ForecastComputationContext = {
  projectionsService: Pick<ProjectionsService, 'compute'>;
  updateForecastScenario: (
    orgId: string,
    scenarioId: string,
    body: ForecastScenarioUpdateBody,
  ) => Promise<ScenarioPayload>;
  getForecastScenario: (
    orgId: string,
    scenarioId: string,
  ) => Promise<ScenarioPayload>;
};

export function createV2ForecastComputationSupport(
  ctx: ForecastComputationContext,
) {
  return {
    async computeForecastScenario(orgId: string, scenarioId: string) {
      await ctx.updateForecastScenario(orgId, scenarioId, {});
      await ctx.projectionsService.compute(orgId, scenarioId);
      return ctx.getForecastScenario(orgId, scenarioId);
    },
  };
}
