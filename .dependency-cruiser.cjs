/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-production-to-test-support',
      severity: 'error',
      from: {
        path: '^(apps/web/src|apps/api/src|packages/domain/src)',
        pathNot: '(^|/)(test-support|__tests__)/|\\.(test|spec)\\.[jt]sx?$',
      },
      to: {
        path: '(^|/)(test-support|__tests__)/',
      },
    },
    {
      name: 'no-api-module-backthrough-barrels',
      severity: 'error',
      from: {
        path: '^apps/web/src/api/(?!v2(?:/types)?\\.ts$).+\\.[jt]s$',
      },
      to: {
        path: '^apps/web/src/api(?:\\.ts|/v2\\.ts|/v2/types\\.ts)$',
      },
    },
    {
      name: 'no-web-controllers-and-models-to-page-shells',
      severity: 'error',
      from: {
        path:
          '^apps/web/src/v2/(?:.*(?:Model|Selectors?|Labels|Provenance|Persistence|Workflow|Orchestration|Parsing|Parse|DerivedState|DerivedRows|Payload|Save|Presentation|BrowserEffects|ReviewModel|PageViewModel|YearWorkspaceModel|ImportWorkflows)|use[A-Z].*(?:Controller|DerivedState|DerivedRows|BrowserEffects))\\.(?:ts|tsx)$',
      },
      to: {
        path:
          '^apps/web/src/v2/(?:AppShellV2|OverviewPageV2|EnnustePageV2|ReportsPageV2|VesinvestPlanningPanel|OverviewImportBoard|OverviewReviewBoard|OverviewYearWorkspace|ForecastCockpitSurface|OverviewWizardPanels|OverviewSupportRail|appShellV2Chrome|vesinvestPlanningChrome|vesinvestPlanningInvestmentWorkspace|vesinvestPlanningReviewSections)\\.tsx$',
      },
    },
    {
      name: 'no-api-support-to-services-or-controllers',
      severity: 'error',
      from: {
        path:
          '^apps/api/src/v2/(?:.*(?:support|model|types|constants))\\.ts$',
      },
      to: {
        path:
          '^apps/api/src/(?:v2/.*service|v2/.*controller)\\.ts$',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    exclude: {
      path: 'node_modules|dist|build|coverage',
    },
    tsConfig: {
      fileName: 'tsconfig.depcruise.json',
    },
  },
};
