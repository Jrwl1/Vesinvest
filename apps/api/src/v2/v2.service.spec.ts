import { V2Service } from './v2.service';

describe('V2Service facade', () => {
  const buildFacade = () => {
    const importOverviewService = {
      searchOrganizations: jest.fn().mockResolvedValue(['org-hit']),
      connectOrganization: jest.fn().mockResolvedValue({ connected: true }),
      getPlanningContext: jest.fn().mockResolvedValue({
        canCreateScenario: true,
        baselineYears: [{ year: 2024 }],
      }),
    } as any;
    const forecastService = {
      listForecastScenarios: jest.fn().mockResolvedValue([{ id: 'scenario-1' }]),
    } as any;
    const reportService = {
      createReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
    } as any;
    const vesinvestService = {
      getPlanningContextSummary: jest.fn().mockResolvedValue({
        vesinvest: {
          hasPlan: true,
          planCount: 1,
          activePlan: { id: 'plan-1' },
        },
      }),
    } as any;

    return {
      service: new V2Service(
        importOverviewService,
        forecastService,
        reportService,
        vesinvestService,
      ),
      importOverviewService,
      forecastService,
      reportService,
      vesinvestService,
    };
  };

  it('merges planning context from import overview and Vesinvest summary', async () => {
    const { service, importOverviewService, vesinvestService } = buildFacade();

    await expect(service.getPlanningContext('org-1')).resolves.toEqual({
      canCreateScenario: true,
      baselineYears: [{ year: 2024 }],
      vesinvest: {
        hasPlan: true,
        planCount: 1,
        activePlan: { id: 'plan-1' },
      },
    });
    expect(importOverviewService.getPlanningContext).toHaveBeenCalledWith('org-1');
    expect(vesinvestService.getPlanningContextSummary).toHaveBeenCalledWith('org-1');
  });

  it('delegates import-overview methods through the facade', async () => {
    const { service, importOverviewService } = buildFacade();

    await expect(service.searchOrganizations('water', 5)).resolves.toEqual(['org-hit']);
    await expect(service.connectOrganization('org-1', 1535)).resolves.toEqual({
      connected: true,
    });
    expect(importOverviewService.searchOrganizations).toHaveBeenCalledWith('water', 5);
    expect(importOverviewService.connectOrganization).toHaveBeenCalledWith(
      'org-1',
      1535,
    );
  });

  it('delegates forecast and report methods through the facade', async () => {
    const { service, forecastService, reportService } = buildFacade();

    await expect(service.listForecastScenarios('org-1')).resolves.toEqual([
      { id: 'scenario-1' },
    ]);
    await expect(
      service.createReport('org-1', 'user-1', {
        vesinvestPlanId: 'plan-1',
        title: 'Report',
      } as any),
    ).resolves.toEqual({
      id: 'report-1',
    });
    expect(forecastService.listForecastScenarios).toHaveBeenCalledWith('org-1');
    expect(reportService.createReport).toHaveBeenCalledWith('org-1', 'user-1', {
      vesinvestPlanId: 'plan-1',
      title: 'Report',
    });
  });
});
