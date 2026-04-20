type ForecastComputationContext = any;

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
