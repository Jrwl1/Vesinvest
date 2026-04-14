import { BadRequestException } from '@nestjs/common';
import { V2VesinvestService } from './v2-vesinvest.service';

const makePlanRecord = (overrides: Record<string, unknown> = {}) => {
  const now = new Date('2026-04-08T10:00:00.000Z');
  return {
    id: 'plan-1',
    orgId: 'org-1',
    seriesId: 'series-1',
    name: 'Water Utility Vesinvest',
    utilityName: 'Water Utility',
    businessId: '1234567-8',
    identitySource: 'veeti',
    veetiId: 1535,
    horizonYears: 20,
    versionNumber: 1,
    status: 'draft',
    baselineStatus: 'incomplete',
    feeRecommendationStatus: 'blocked',
    feeRecommendation: null,
    baselineSourceState: null,
    baselineFingerprint: null,
    scenarioFingerprint: null,
    selectedScenarioId: null,
    selectedScenario: null,
    sourcePlanId: null,
    sourcePlan: null,
    revisions: [],
    lastReviewedAt: null,
    reviewDueAt: new Date('2029-04-08T10:00:00.000Z'),
    baselineChangedSinceAcceptedRevision: false,
    investmentPlanChangedSinceFeeRecommendation: true,
    createdAt: now,
    updatedAt: now,
    projects: [
      {
        id: 'project-1',
        planId: 'plan-1',
        projectCode: 'P-001',
        projectName: 'Main rehabilitation',
        investmentType: 'sanering',
        groupKey: 'sanering_water_network',
        depreciationClassKey: 'water_network_post_1999',
        accountKey: 'sanering_water_network',
        reportGroupKey: 'network_rehabilitation',
        subtype: null,
        notes: null,
        waterAmount: 100,
        wastewaterAmount: 0,
        totalAmount: 100,
        createdAt: now,
        updatedAt: now,
        allocations: [
          {
            id: 'allocation-1',
            projectId: 'project-1',
            year: 2026,
            waterAmount: 100,
            wastewaterAmount: 0,
            totalAmount: 100,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
    ...overrides,
  };
};

const makeService = () => {
  const updatePlan = jest.fn();
  const updateManyPlans = jest.fn();
  const prisma = {
    vesinvestPlanSeries: {
      create: jest.fn().mockResolvedValue({ id: 'series-1' }),
    },
    vesinvestGroupDefinition: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    vesinvestGroupOverride: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    vesinvestPlan: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: updatePlan,
      updateMany: updateManyPlans,
    },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        vesinvestProjectAllocation: { deleteMany: jest.fn() },
        vesinvestProject: { deleteMany: jest.fn() },
        vesinvestPlan: {
          update: updatePlan,
          updateMany: updateManyPlans,
        },
      }),
    ),
  };
  const forecastService = {
    createForecastScenario: jest.fn(),
    updateForecastScenario: jest.fn(),
    computeForecastScenario: jest.fn(),
    getForecastScenario: jest.fn(),
  };
  const importOverviewService = {
    getPlanningContext: jest.fn().mockResolvedValue({ baselineYears: [] }),
    getBoundUtilityIdentity: jest.fn().mockResolvedValue({
      orgId: 'org-1',
      veetiId: 1535,
      utilityName: 'Water Utility',
      businessId: '1234567-8',
    }),
  };
  const service = new V2VesinvestService(
    prisma as any,
    forecastService as any,
    importOverviewService as any,
  );
  Object.defineProperty(service, 'planningWorkspaceSupport', {
    value: {
      resolveLatestAcceptedVeetiBudgetId: jest.fn().mockResolvedValue(null),
      resolvePlanningBaselineYears: jest.fn().mockResolvedValue([]),
    },
  });
  return { service, prisma, forecastService };
};

describe('V2VesinvestService', () => {
  it('allows admins to save org-scoped group overrides', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestGroupOverride.upsert.mockResolvedValue({
      key: 'sanering_water_network',
      label: 'Updated group',
      defaultAccountKey: 'updated_account',
      defaultDepreciationClassKey: 'sanering_water_network',
      reportGroupKey: 'treatment',
      serviceSplit: 'mixed',
    });

    const result = await service.updateInvestmentGroupDefinition(
      'org-1',
      'sanering_water_network',
      {
        label: 'Updated group',
        defaultAccountKey: 'updated_account',
        defaultDepreciationClassKey: 'updated_depreciation',
        reportGroupKey: 'treatment',
        serviceSplit: 'mixed',
      },
      ['ADMIN'],
    );

    expect(prisma.vesinvestGroupOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId_key: {
            orgId: 'org-1',
            key: 'sanering_water_network',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      key: 'sanering_water_network',
      label: 'Updated group',
      defaultAccountKey: 'updated_account',
      defaultDepreciationClassKey: 'sanering_water_network',
      reportGroupKey: 'treatment',
      serviceSplit: 'mixed',
    });
  });

  it('returns the authoritative 10-class catalog in customer order', async () => {
    const { service } = makeService();

    const result = await service.getInvestmentGroupDefinitions('org-1');

    expect(result.map((item: any) => item.key)).toEqual([
      'sanering_water_network',
      'sanering_wastewater_network',
      'new_water_network',
      'new_wastewater_network',
      'repair_water_network',
      'repair_wastewater_network',
      'waterworks_equipment',
      'wastewater_equipment',
      'water_production',
      'wastewater_treatment',
    ]);
    expect(result.every((item: any) => item.defaultDepreciationClassKey === item.key)).toBe(
      true,
    );
  });

  it('rejects non-admin group override updates', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.updateInvestmentGroupDefinition(
        'org-1',
        'sanering_water_network',
        { label: 'Blocked group' },
        ['USER'],
      ),
    ).rejects.toThrow(/Only admins can update Vesinvest group definitions/i);
    expect(prisma.vesinvestGroupOverride.upsert).not.toHaveBeenCalled();
  });

  it('assigns the next revision number across the whole Vesinvest revision family', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestPlan.findFirst.mockResolvedValue(makePlanRecord());
    prisma.vesinvestPlan.findMany.mockResolvedValue([
      { id: 'plan-1', sourcePlanId: null, versionNumber: 1 },
      { id: 'plan-2', sourcePlanId: 'plan-1', versionNumber: 2 },
      { id: 'plan-3', sourcePlanId: 'plan-2', versionNumber: 3 },
      { id: 'other-plan', sourcePlanId: null, versionNumber: 1 },
    ]);
    prisma.vesinvestPlan.create.mockImplementation(async (args: any) =>
      makePlanRecord({
        id: 'plan-4',
        versionNumber: args.data.versionNumber,
        sourcePlanId: 'plan-1',
      }),
    );

    const cloned = await service.clonePlan('org-1', 'plan-1');

    expect(prisma.vesinvestPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 4,
          sourcePlanId: 'plan-1',
        }),
      }),
    );
    expect(cloned.versionNumber).toBe(4);
  });

  it('rejects duplicate project codes within one plan payload', async () => {
    const { service } = makeService();

    await expect(
      service.createPlan('org-1', {
        utilityName: 'Water Utility',
        projects: [
          {
            code: 'P-001',
            name: 'First',
            investmentType: 'sanering',
            groupKey: 'sanering_water_network',
            allocations: [{ year: 2026, totalAmount: 100 }],
          },
          {
            code: 'P-001',
            name: 'Second',
            investmentType: 'sanering',
            groupKey: 'sanering_water_network',
            allocations: [{ year: 2027, totalAmount: 50 }],
          },
        ],
      }),
    ).rejects.toThrow(/Project codes must be unique/i);
  });

  it('blocks fee-path sync when the plan has no investment projects', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlanRecord({ projects: [] }),
    );

    await expect(service.syncPlanToForecast('org-1', 'plan-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.syncPlanToForecast('org-1', 'plan-1')).rejects.toThrow(
      /Create at least one investment project/i,
    );
  });

  it('persists baseline source metadata when syncing a Vesinvest plan into pricing', async () => {
    const { service, prisma, forecastService } = makeService();
    const support = (service as any).planningWorkspaceSupport;
    support.resolveLatestAcceptedVeetiBudgetId.mockResolvedValue('budget-2024');
    support.resolvePlanningBaselineYears.mockResolvedValue([2023, 2024]);
    prisma.vesinvestPlan.findFirst
      .mockResolvedValueOnce(makePlanRecord())
      .mockResolvedValueOnce(
        makePlanRecord({
          status: 'active',
          baselineStatus: 'verified',
          feeRecommendationStatus: 'verified',
          feeRecommendation: {
            requiredPriceToday: 3.2,
          },
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2023, 2024],
            latestAcceptedBudgetId: 'budget-2024',
          },
          selectedScenarioId: 'scenario-1',
          selectedScenario: {
            id: 'scenario-1',
            updatedAt: new Date('2026-04-08T10:30:00.000Z'),
            computedAt: new Date('2026-04-08T10:30:00.000Z'),
          },
          lastReviewedAt: new Date('2026-04-08T10:30:00.000Z'),
        }),
      );
    forecastService.createForecastScenario.mockResolvedValue({ id: 'scenario-1' });
    forecastService.updateForecastScenario.mockResolvedValue(undefined);
    forecastService.computeForecastScenario.mockResolvedValue({
      id: 'scenario-1',
      baselinePriceTodayCombined: 2.8,
      requiredPriceTodayCombinedAnnualResult: 3.2,
      requiredAnnualIncreasePctAnnualResult: 4.1,
      requiredPriceTodayCombinedCumulativeCash: 3.4,
      requiredAnnualIncreasePctCumulativeCash: 4.7,
      feeSufficiency: {
        cumulativeCash: {
          peakGap: 150000,
        },
      },
      investmentSeries: [{ amount: 100 }],
    });
    prisma.vesinvestPlan.update.mockResolvedValue(makePlanRecord());

    const result = await service.syncPlanToForecast('org-1', 'plan-1', {
      baselineSourceState: {
        baselineYears: [{ year: 2024, sourceStatus: 'MANUAL' }],
        snapshotCapturedAt: '2026-04-08T09:00:00.000Z',
      },
    });

    expect(prisma.vesinvestPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          baselineSourceState: expect.objectContaining({
            source: 'accepted_planning_baseline',
            acceptedYears: [2023, 2024],
            latestAcceptedBudgetId: 'budget-2024',
            snapshotCapturedAt: '2026-04-08T09:00:00.000Z',
            verifiedAt: expect.any(String),
            baselineFingerprint: expect.any(String),
          }),
          feeRecommendationStatus: 'verified',
        }),
      }),
    );
    expect(result.scenarioId).toBe('scenario-1');
  });

  it('maps an unambiguous Vesinvest year into forecast category and depreciation defaults', async () => {
    const { service, prisma, forecastService } = makeService();
    const support = (service as any).planningWorkspaceSupport;
    support.resolveLatestAcceptedVeetiBudgetId.mockResolvedValue('budget-2024');
    support.resolvePlanningBaselineYears.mockResolvedValue([2024]);
    prisma.vesinvestPlan.findFirst
      .mockResolvedValueOnce(makePlanRecord())
      .mockResolvedValueOnce(
        makePlanRecord({
          status: 'active',
          baselineStatus: 'verified',
          feeRecommendationStatus: 'verified',
          selectedScenarioId: 'scenario-1',
          selectedScenario: {
            id: 'scenario-1',
            updatedAt: new Date('2026-04-08T10:30:00.000Z'),
            computedAt: new Date('2026-04-08T10:30:00.000Z'),
          },
        }),
      );
    forecastService.createForecastScenario.mockResolvedValue({ id: 'scenario-1' });
    forecastService.updateForecastScenario.mockResolvedValue(undefined);
    forecastService.computeForecastScenario.mockResolvedValue({
      id: 'scenario-1',
      baselinePriceTodayCombined: 2.8,
      requiredPriceTodayCombinedAnnualResult: 3.2,
      requiredAnnualIncreasePctAnnualResult: 4.1,
      requiredPriceTodayCombinedCumulativeCash: 3.4,
      requiredAnnualIncreasePctCumulativeCash: 4.7,
      feeSufficiency: {
        cumulativeCash: {
          peakGap: 150000,
        },
      },
      investmentSeries: [{ amount: 100 }],
    });
    prisma.vesinvestPlan.update.mockResolvedValue(makePlanRecord());

    await service.syncPlanToForecast('org-1', 'plan-1');

    expect(forecastService.updateForecastScenario).toHaveBeenCalledWith(
      'org-1',
      'scenario-1',
      expect.objectContaining({
        yearlyInvestments: [
          expect.objectContaining({
            year: 2026,
            category: 'Sanering / vattennätverk',
            depreciationClassKey: 'sanering_water_network',
            investmentType: 'replacement',
            confidence: 'high',
          }),
        ],
      }),
    );
  });

  it('marks a saved Vesinvest revision as baseline-drifted when the accepted baseline changes', async () => {
    const { service, prisma } = makeService();
    const support = (service as any).planningWorkspaceSupport;
    support.resolvePlanningBaselineYears.mockResolvedValue([2025]);
    support.resolveLatestAcceptedVeetiBudgetId.mockResolvedValue('budget-2025');
    prisma.vesinvestPlan.findMany.mockResolvedValue([
      makePlanRecord({
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2024],
          latestAcceptedBudgetId: 'budget-2024',
        },
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);

    const plans = await service.listPlans('org-1');

    expect(plans[0]).toMatchObject({
      baselineStatus: 'incomplete',
      pricingStatus: 'blocked',
      baselineChangedSinceAcceptedRevision: true,
    });
  });

  it('blocks activating a legacy revision that has pricing history but no saved baseline snapshot', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlanRecord({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        baselineFingerprint: null,
        baselineSourceState: null,
      }),
    );

    await expect(
      service.updatePlan('org-1', 'plan-1', { status: 'active' }),
    ).rejects.toThrow(/re-verified against the current accepted baseline/i);
  });

  it('allows saving an already-active legacy revision without re-activation conflict', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlanRecord({
        status: 'active',
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        baselineFingerprint: null,
        baselineSourceState: null,
      }),
    );
    prisma.vesinvestPlan.update.mockResolvedValue(makePlanRecord());

    await expect(
      service.updatePlan('org-1', 'plan-1', { name: 'Updated active revision' }),
    ).resolves.toBeTruthy();
    expect(prisma.vesinvestPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          name: 'Updated active revision',
          status: 'active',
        }),
      }),
    );
  });

  it('allows idempotent active saves for an already-active legacy revision', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlanRecord({
        status: 'active',
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        baselineFingerprint: null,
        baselineSourceState: null,
      }),
    );
    prisma.vesinvestPlan.update.mockResolvedValue(makePlanRecord());

    await expect(
      service.updatePlan('org-1', 'plan-1', {
        name: 'Updated active revision',
        status: 'active',
      }),
    ).resolves.toBeTruthy();
    expect(prisma.vesinvestPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          name: 'Updated active revision',
          status: 'active',
        }),
      }),
    );
  });

  it('treats a legacy active revision without a saved baseline snapshot as drifted', async () => {
    const { service, prisma } = makeService();
    prisma.vesinvestPlan.findMany.mockResolvedValue([
      makePlanRecord({
        status: 'active',
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
        baselineFingerprint: null,
        baselineSourceState: null,
      }),
    ]);

    const plans = await service.listPlans('org-1');

    expect(plans[0]).toMatchObject({
      baselineStatus: 'incomplete',
      pricingStatus: 'blocked',
      baselineChangedSinceAcceptedRevision: true,
    });
  });

  it('aggregates yearly water and wastewater allocations when syncing into the forecast engine', async () => {
    const { service, prisma, forecastService } = makeService();
    const support = (service as any).planningWorkspaceSupport;
    support.resolveLatestAcceptedVeetiBudgetId.mockResolvedValue('budget-2024');
    support.resolvePlanningBaselineYears.mockResolvedValue([2024]);
    prisma.vesinvestPlan.findFirst
      .mockResolvedValueOnce(
        makePlanRecord({
          projects: [
            {
              ...makePlanRecord().projects[0],
              allocations: [
                {
                  id: 'allocation-1',
                  projectId: 'project-1',
                  year: 2026,
                  waterAmount: 100,
                  wastewaterAmount: 0,
                  totalAmount: 100,
                  createdAt: new Date('2026-04-08T10:00:00.000Z'),
                  updatedAt: new Date('2026-04-08T10:00:00.000Z'),
                },
              ],
            },
            {
              ...makePlanRecord().projects[0],
              id: 'project-2',
              projectCode: 'P-002',
              projectName: 'Wastewater extension',
              groupKey: 'new_wastewater_network',
              accountKey: 'new_wastewater_network',
              reportGroupKey: 'new_network',
              depreciationClassKey: null,
              investmentType: 'nyanlaggning',
              waterAmount: 0,
              wastewaterAmount: 75,
              totalAmount: 75,
              allocations: [
                {
                  id: 'allocation-2',
                  projectId: 'project-2',
                  year: 2026,
                  waterAmount: 0,
                  wastewaterAmount: 75,
                  totalAmount: 75,
                  createdAt: new Date('2026-04-08T10:00:00.000Z'),
                  updatedAt: new Date('2026-04-08T10:00:00.000Z'),
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        makePlanRecord({
          status: 'active',
          baselineStatus: 'verified',
          feeRecommendationStatus: 'verified',
          selectedScenarioId: 'scenario-1',
          selectedScenario: {
            id: 'scenario-1',
            updatedAt: new Date('2026-04-08T10:30:00.000Z'),
            computedAt: new Date('2026-04-08T10:30:00.000Z'),
          },
        }),
      );
    forecastService.createForecastScenario.mockResolvedValue({ id: 'scenario-1' });
    forecastService.updateForecastScenario.mockResolvedValue(undefined);
    forecastService.computeForecastScenario.mockResolvedValue({
      id: 'scenario-1',
      baselinePriceTodayCombined: 2.8,
      requiredPriceTodayCombinedAnnualResult: 3.2,
      requiredAnnualIncreasePctAnnualResult: 4.1,
      requiredPriceTodayCombinedCumulativeCash: 3.4,
      requiredAnnualIncreasePctCumulativeCash: 4.7,
      feeSufficiency: {
        cumulativeCash: {
          peakGap: 150000,
        },
      },
      investmentSeries: [{ amount: 175 }],
    });
    prisma.vesinvestPlan.update.mockResolvedValue(makePlanRecord());

    await service.syncPlanToForecast('org-1', 'plan-1');

    expect(forecastService.updateForecastScenario).toHaveBeenCalledWith(
      'org-1',
      'scenario-1',
      expect.objectContaining({
        yearlyInvestments: expect.arrayContaining([
          expect.objectContaining({
            year: 2026,
            projectCode: 'P-001',
            category: 'Sanering / vattennätverk',
            depreciationClassKey: 'sanering_water_network',
            investmentType: 'replacement',
            confidence: 'high',
            amount: 100,
            waterAmount: 100,
            wastewaterAmount: null,
          }),
          expect.objectContaining({
            year: 2026,
            projectCode: 'P-002',
            category: 'Nyanläggning / avloppsnätverk',
            depreciationClassKey: 'new_wastewater_network',
            investmentType: 'new',
            confidence: 'high',
            amount: 75,
            waterAmount: null,
            wastewaterAmount: 75,
          }),
        ]),
      }),
    );
  });

  it('flags conflicting legacy overrides and blocks pricing sync until class review', async () => {
    const { service, prisma } = makeService();
    const support = (service as any).planningWorkspaceSupport;
    support.resolveLatestAcceptedVeetiBudgetId.mockResolvedValue('budget-2024');
    support.resolvePlanningBaselineYears.mockResolvedValue([2024]);
    const conflictingProjects = [
      {
        ...makePlanRecord().projects[0],
        accountKey: 'sanering_water_network',
        depreciationClassKey: 'water_network_post_1999',
      },
      {
        ...makePlanRecord().projects[0],
        id: 'project-2',
        projectCode: 'P-002',
        accountKey: 'legacy_custom_account',
        depreciationClassKey: 'sanering_water_network',
      },
    ];
    prisma.vesinvestPlan.findMany.mockResolvedValue([
      makePlanRecord({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
        projects: conflictingProjects,
      }),
    ]);
    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlanRecord({
        projects: conflictingProjects,
      }),
    );

    const plans = await service.listPlans('org-1');

    expect(plans[0]).toMatchObject({
      classificationReviewRequired: true,
      pricingStatus: 'blocked',
    });
    await expect(service.syncPlanToForecast('org-1', 'plan-1')).rejects.toThrow(
      /Legacy class overrides require review/i,
    );
  });

  it('flags consistent legacy class overrides that differ from the class-owned defaults', async () => {
    const { service, prisma } = makeService();
    const support = (service as any).planningWorkspaceSupport;
    support.resolveLatestAcceptedVeetiBudgetId.mockResolvedValue('budget-2024');
    support.resolvePlanningBaselineYears.mockResolvedValue([2024]);
    const overriddenProjects = [
      {
        ...makePlanRecord().projects[0],
        accountKey: 'legacy_custom_account',
        depreciationClassKey: 'water_network_post_1999',
      },
      {
        ...makePlanRecord().projects[0],
        id: 'project-2',
        projectCode: 'P-002',
        accountKey: 'legacy_custom_account',
        depreciationClassKey: 'water_network_post_1999',
      },
    ];
    prisma.vesinvestPlan.findMany.mockResolvedValue([
      makePlanRecord({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
        projects: overriddenProjects,
      }),
    ]);
    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlanRecord({
        projects: overriddenProjects,
      }),
    );

    const plans = await service.listPlans('org-1');

    expect(plans[0]).toMatchObject({
      classificationReviewRequired: true,
      pricingStatus: 'blocked',
    });
    await expect(service.syncPlanToForecast('org-1', 'plan-1')).rejects.toThrow(
      /Legacy class overrides require review/i,
    );
  });
});
