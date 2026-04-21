import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
type MockFn = any;
import en from '../../../i18n/locales/en.json';
import fi from '../../../i18n/locales/fi.json';
import sv from '../../../i18n/locales/sv.json';
import { OverviewImportBoard } from '../../OverviewImportBoard';
import { OverviewPageV2 } from '../../OverviewPageV2';
import { OverviewReviewBoard } from '../../OverviewReviewBoard';
import { OverviewSupportRail } from '../../OverviewSupportRail';
import { OverviewYearWorkspace } from '../../OverviewYearWorkspace';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from '../../OverviewWizardPanels';
import { submitWorkbookImportWorkflow } from '../../overviewImportWorkflows';
import {
  getPreviewPrefetchYears,
  pickDefaultBaselineYears,
} from '../../overviewSelectors';
import { buildImportYearSummaryRows } from '../../yearReview';
import { getExactEditedFieldLabels, useOverviewSetupState } from '../../useOverviewSetupState';
import { useOverviewImportController } from '../../useOverviewImportController';

const completeImportYearManuallyV2: MockFn = vi.fn();
const clearImportAndScenariosV2: MockFn = vi.fn();
const connectImportOrganizationV2: MockFn = vi.fn();
const createVesinvestPlanV2: MockFn = vi.fn();
const createForecastScenarioV2: MockFn = vi.fn();
const createPlanningBaselineV2: MockFn = vi.fn();
const deleteImportYearsBulkV2: MockFn = vi.fn();
const deleteImportYearV2: MockFn = vi.fn();
const excludeImportYearsV2: MockFn = vi.fn();
const getImportStatusV2: MockFn = vi.fn();
const getImportYearDataV2: MockFn = vi.fn();
const getTokenInfo: MockFn = vi.fn();
const importYearsV2: MockFn = vi.fn();
const getOpsFunnelV2: MockFn = vi.fn();
const getOverviewV2: MockFn = vi.fn();
const getPlanningContextV2: MockFn = vi.fn();
const listForecastScenariosV2: MockFn = vi.fn();
const listReportsV2: MockFn = vi.fn();
const previewWorkbookImportV2: MockFn = vi.fn();
const refreshOverviewPeerV2: MockFn = vi.fn();
const reconcileImportYearV2: MockFn = vi.fn();
const restoreImportYearsV2: MockFn = vi.fn();
const searchImportOrganizationsV2: MockFn = vi.fn();
const syncImportV2: MockFn = vi.fn();
const sendV2OpsEvent: MockFn = vi.fn();
const extractStatementFromPdf: MockFn = vi.fn();
const extractQdisFromPdf: MockFn = vi.fn();
const extractDocumentFromPdf: MockFn = vi.fn();

function pick(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const localeDataByCode = { fi, sv, en } as const;
let activeLocale: keyof typeof localeDataByCode = 'fi';

const translate = (
  key: string,
  defaultValueOrOptions?: string | Record<string, unknown>,
  maybeOptions?: Record<string, unknown>,
) => {
  const defaultValue =
    typeof defaultValueOrOptions === 'string' ? defaultValueOrOptions : undefined;
  const options =
    typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
      ? defaultValueOrOptions
      : maybeOptions;
  const resolved = pick(
    localeDataByCode[activeLocale] as Record<string, unknown>,
    key,
  );
  let out = typeof resolved === 'string' ? resolved : (defaultValue ?? key);
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
};

const localeText = (key: string, options?: Record<string, unknown>) =>
  translate(key, undefined, options);

const getPrimaryButtons = () =>
  Array.from(document.querySelectorAll('button.v2-btn-primary'))
    .filter(
      (button) =>
        !button.closest('.v2-reports-layout') &&
        !button.closest('.v2-forecast-layout') &&
        !button.closest('.v2-vesinvest-panel'),
    )
    .map((button) => button as HTMLButtonElement);

const expectPrimaryButtonLabels = (labels: string[]) => {
  const primaryButtons = getPrimaryButtons();
  expect(primaryButtons).toHaveLength(labels.length);
  expect(
    primaryButtons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim()),
  ).toEqual(labels);
};

const clickReviewGroupYear = async (year: number) => {
  const trigger = (await waitFor(() => {
    const button = document.querySelector(
      `[data-review-group-year$="-${year}"]`,
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    return button!;
  })) as HTMLButtonElement;
  fireEvent.click(trigger);
  await waitFor(() => {
    expect(
      document.querySelector(`[data-review-group-year$="-${year}"]`)?.getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
  });
};

const focusReviewWorkspaceYear = async (year: number) => {
  await clickReviewGroupYear(year);
  await waitFor(() => {
    expect(document.querySelector(`[data-review-workspace-year="${year}"]`)).toBeTruthy();
  });
};

const openReviewWorkspaceYear = async (year: number) => {
  await focusReviewWorkspaceYear(year);
  const yearWorkspace = (await waitFor(() => {
    const container = document.querySelector(
      `[data-review-workspace-year="${year}"]`,
    ) as HTMLElement | null;
    expect(container).toBeTruthy();
    return container!;
  })) as HTMLElement;
  fireEvent.click(
    await within(yearWorkspace).findByRole('button', {
      name: new RegExp(localeText('v2Overview.openReviewYearButton')),
    }),
  );
};

const openYearDecisionWorkspaceYear = async (year: number) => {
  await focusReviewWorkspaceYear(year);
  const yearWorkspace = (await waitFor(() => {
    const container = document.querySelector(
      `[data-review-workspace-year="${year}"]`,
    ) as HTMLElement | null;
    expect(container).toBeTruthy();
    return container!;
  })) as HTMLElement;
  const actionPattern = new RegExp(
    [
      localeText('v2Overview.yearDecisionAction'),
      localeText('v2Overview.openReviewYearButton'),
      localeText('v2Overview.fixYearValues'),
    ].join('|'),
  );
  const actionButton =
    within(yearWorkspace).queryByRole('button', {
      name: actionPattern,
    }) ??
    (await within(yearWorkspace).findByRole('button', {
      name: actionPattern,
    }));
  fireEvent.click(actionButton);
};

const openCurrentYearEstimateLane = async () => {
  const lane = (
    await screen.findByText(localeText('v2Overview.currentYearEstimateTitle'))
  ).closest('details') as HTMLDetailsElement | null;
  expect(lane).toBeTruthy();
  if (lane != null && !lane.open) {
    fireEvent.click(lane.querySelector('summary')!);
  }
  return lane;
};

const getLatestSetupWizardState = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls[mock.mock.calls.length - 1]?.[0];

const findSupportStatusItem = async (label: string) =>
  ((await waitFor(() => {
    const match = Array.from(
      document.querySelectorAll(
        '.v2-overview-support-summary-item-status, .v2-overview-support-status-item',
      ),
    ).find((node) => node.querySelector('span')?.textContent?.trim() === label);
    expect(match).toBeTruthy();
    return match as HTMLElement;
  })) as HTMLElement);

const findReviewWorkspaceYear = async (year: number) =>
  ((await waitFor(() => {
    const node = document.querySelector(
      `[data-review-workspace-year="${year}"]`,
    ) as HTMLElement | null;
    expect(node).toBeTruthy();
    return node!;
  })) as HTMLElement);

const seedReviewedYears = (years: number[], orgId = '1234567-8') => {
  window.localStorage.setItem(
    `v2.importYearReview.${orgId}`,
    JSON.stringify({ reviewedYears: years }),
  );
};

const buildOverviewResponse = (options?: {
  excludedYears?: number[];
  workspaceYears?: number[];
  years?: any[];
  planningBaselineYears?: number[];
}) => {
  const years =
    options?.years ??
    [
      {
        vuosi: 2024,
        planningRole: 'historical',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        baselineReady: true,
        baselineMissingRequirements: [],
        baselineWarnings: [],
        sourceStatus: 'MIXED',
        sourceBreakdown: {
          veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: ['tilinpaatos'],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: '2026-03-08T10:00:00.000Z',
        manualEditedBy: 'tester',
        manualReason: 'Statement-backed correction',
        manualProvenance: {
          kind: 'statement_import',
          fileName: 'bokslut-2024.pdf',
          pageNumber: 3,
          confidence: 98,
          matchedFields: ['liikevaihto'],
        },
      },
      {
        vuosi: 2023,
        planningRole: 'historical',
        completeness: {
          tilinpaatos: true,
          taksa: false,
          volume_vesi: true,
          volume_jatevesi: false,
        },
        baselineReady: false,
        baselineMissingRequirements: ['prices'],
        baselineWarnings: [],
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'volume_vesi'],
          manualDataTypes: [],
        },
        warnings: ['missing_prices'],
        datasetCounts: {
          tilinpaatos: 1,
          volume_vesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

  return {
    latestVeetiYear: 2024,
    importStatus: {
      connected: true,
      tariffScope: 'usage_fee_only',
      link: {
        nimi: 'Water Utility',
        ytunnus: '1234567-8',
        lastFetchedAt: '2026-03-08T10:00:00.000Z',
      },
      excludedYears: options?.excludedYears ?? [],
      planningBaselineYears: options?.planningBaselineYears ?? [],
      years,
      availableYears: years,
      workspaceYears: options?.workspaceYears,
    },
    kpis: {
      revenue: { current: 100000, deltaPct: 0 },
      operatingCosts: { current: 70000, deltaPct: 0 },
      costs: { current: 70000, deltaPct: 0 },
      financingNet: { current: 0, deltaPct: 0 },
      otherResultItems: { current: 0, deltaPct: 0 },
      yearResult: { current: 30000, deltaPct: 0 },
      result: { current: 30000, deltaPct: 0 },
      volume: { current: 50000, deltaPct: 0 },
      combinedPrice: { current: 2.5, deltaPct: 0 },
    },
    trendSeries: [
      {
        year: 2023,
        revenue: 95000,
        operatingCosts: 68000,
        yearResult: 27000,
        volume: 48000,
        combinedPrice: 2.4,
      },
      {
        year: 2024,
        revenue: 100000,
        operatingCosts: 70000,
        yearResult: 30000,
        volume: 50000,
        combinedPrice: 2.5,
      },
    ],
    peerSnapshot: {
      available: false,
      reason: 'No VEETI years imported.',
      year: null,
      kokoluokka: null,
      orgCount: 0,
      peerCount: 0,
      isStale: false,
      computedAt: null,
      metrics: [],
      peers: [],
    },
  } as any;
};

const buildPlanningContextResponse = (options?: {
  canCreateScenario?: boolean;
  baselineYears?: any[];
  activePlan?: Record<string, unknown> | null;
  selectedPlan?: Record<string, unknown> | null;
}) =>
  ({
    canCreateScenario: options?.canCreateScenario ?? false,
    vesinvest: {
      hasPlan: options?.activePlan != null || options?.selectedPlan != null,
      planCount:
        options?.activePlan != null || options?.selectedPlan != null ? 1 : 0,
      activePlan:
        options?.activePlan != null
          ? {
              id: 'plan-1',
              name: 'Vesinvest plan',
              utilityName: 'Water Utility',
              businessId: '1234567-8',
              veetiId: null,
              identitySource: 'manual',
              horizonYears: 20,
              versionNumber: 1,
              status: 'draft',
              baselineStatus: 'draft',
              pricingStatus: 'blocked',
              selectedScenarioId: null,
               projectCount: 1,
               totalInvestmentAmount: 100000,
               lastReviewedAt: null,
               reviewDueAt: null,
               classificationReviewRequired: false,
               baselineChangedSinceAcceptedRevision: false,
               investmentPlanChangedSinceFeeRecommendation: false,
               updatedAt: '2026-04-09T10:00:00.000Z',
              createdAt: '2026-04-09T10:00:00.000Z',
              ...options.activePlan,
            }
          : null,
      selectedPlan:
        options?.selectedPlan != null
          ? {
              id: 'plan-selected',
              name: 'Selected Vesinvest plan',
              utilityName: 'Water Utility',
              businessId: '1234567-8',
              veetiId: null,
              identitySource: 'manual',
              horizonYears: 20,
              versionNumber: 1,
              status: 'draft',
              baselineStatus: 'draft',
              pricingStatus: 'blocked',
              selectedScenarioId: null,
               projectCount: 1,
               totalInvestmentAmount: 100000,
               lastReviewedAt: null,
               reviewDueAt: null,
               classificationReviewRequired: false,
               baselineChangedSinceAcceptedRevision: false,
               investmentPlanChangedSinceFeeRecommendation: false,
               updatedAt: '2026-04-09T10:00:00.000Z',
              createdAt: '2026-04-09T10:00:00.000Z',
              ...options.selectedPlan,
            }
          : null,
    },
    baselineYears: options?.baselineYears ?? [],
    operations: {
      latestYear: 2024,
      energySeries: [],
      complianceYears: [],
      toimintakertomusCount: 0,
      toimintakertomusLatestYear: null,
      vedenottolupaCount: 0,
      activeVedenottolupaCount: 0,
      networkAssetsCount: 0,
    },
  }) as any;

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: translate,
    i18n: { language: activeLocale, resolvedLanguage: activeLocale },
  }),
}));

vi.mock('../../../api', () => ({
  completeImportYearManuallyV2: (...args: unknown[]) =>
    completeImportYearManuallyV2(...args),
  clearImportAndScenariosV2: (...args: unknown[]) =>
    clearImportAndScenariosV2(...args),
  connectImportOrganizationV2: (...args: unknown[]) =>
    connectImportOrganizationV2(...args),
  createVesinvestPlanV2: (...args: unknown[]) =>
    createVesinvestPlanV2(...args),
  createForecastScenarioV2: (...args: unknown[]) =>
    createForecastScenarioV2(...args),
  createPlanningBaselineV2: (...args: unknown[]) =>
    createPlanningBaselineV2(...args),
  deleteImportYearsBulkV2: (...args: unknown[]) =>
    deleteImportYearsBulkV2(...args),
  deleteImportYearV2: (...args: unknown[]) => deleteImportYearV2(...args),
  excludeImportYearsV2: (...args: unknown[]) => excludeImportYearsV2(...args),
  getImportStatusV2: (...args: unknown[]) => getImportStatusV2(...args),
  getImportYearDataV2: (...args: unknown[]) => getImportYearDataV2(...args),
  getTokenInfo: (...args: unknown[]) => getTokenInfo(...args),
  importYearsV2: (...args: unknown[]) => importYearsV2(...args),
  getOpsFunnelV2: (...args: unknown[]) => getOpsFunnelV2(...args),
  getOverviewV2: (...args: unknown[]) => getOverviewV2(...args),
  getPlanningContextV2: (...args: unknown[]) => getPlanningContextV2(...args),
  listForecastScenariosV2: (...args: unknown[]) =>
    listForecastScenariosV2(...args),
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
  previewWorkbookImportV2: (...args: unknown[]) => previewWorkbookImportV2(...args),
  refreshOverviewPeerV2: (...args: unknown[]) => refreshOverviewPeerV2(...args),
  reconcileImportYearV2: (...args: unknown[]) =>
    reconcileImportYearV2(...args),
  restoreImportYearsV2: (...args: unknown[]) => restoreImportYearsV2(...args),
  searchImportOrganizationsV2: (...args: unknown[]) =>
    searchImportOrganizationsV2(...args),
  syncImportV2: (...args: unknown[]) => syncImportV2(...args),
}));

vi.mock('../../opsTelemetry', () => ({
  sendV2OpsEvent: (...args: unknown[]) => sendV2OpsEvent(...args),
}));

vi.mock('../../statementOcr', () => ({
  extractStatementFromPdf: (...args: unknown[]) =>
    extractStatementFromPdf(...args),
}));

vi.mock('../../qdisPdfImport', () => ({
  extractQdisFromPdf: (...args: unknown[]) => extractQdisFromPdf(...args),
}));

vi.mock('../../documentPdfImport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../documentPdfImport')>();
  return {
    ...actual,
    extractDocumentFromPdf: (...args: unknown[]) => extractDocumentFromPdf(...args),
  };
});

vi.mock('../../VesinvestPlanningPanel', async () => {
  const React = await import('react');

  const VesinvestPlanningPanel = (props: {
    simplifiedSetup?: boolean;
    overviewFocusTarget?: { kind: 'saved_fee_path'; planId: string } | null;
    onOverviewFocusTargetConsumed?: () => void;
  }) => {
    const handledFocusTargetRef = React.useRef<string | null>(null);

    React.useEffect(() => {
      const focusTarget =
        props.overviewFocusTarget?.kind === 'saved_fee_path'
          ? props.overviewFocusTarget
          : null;

      if (!focusTarget || !props.onOverviewFocusTargetConsumed) {
        if (!focusTarget) {
          handledFocusTargetRef.current = null;
        }
        return;
      }

      if (handledFocusTargetRef.current === focusTarget.planId) {
        return;
      }

      handledFocusTargetRef.current = focusTarget.planId;
      props.onOverviewFocusTargetConsumed();
    }, [props.onOverviewFocusTargetConsumed, props.overviewFocusTarget]);

    return (
      <div
        data-testid="vesinvest-panel"
        data-simplified-setup={String(Boolean(props.simplifiedSetup))}
      />
    );
  };

  return { VesinvestPlanningPanel };
});


const setActiveLocale = (locale: keyof typeof localeDataByCode) => {
  activeLocale = locale;
};

const resetOverviewTestState = () => {
    activeLocale = 'fi';
    window.localStorage.clear();
    window.sessionStorage.clear();
    completeImportYearManuallyV2.mockReset();
    clearImportAndScenariosV2.mockReset();
    connectImportOrganizationV2.mockReset();
    createVesinvestPlanV2.mockReset();
    createForecastScenarioV2.mockReset();
    createPlanningBaselineV2.mockReset();
    deleteImportYearsBulkV2.mockReset();
    deleteImportYearV2.mockReset();
    excludeImportYearsV2.mockReset();
    getImportStatusV2.mockReset();
    getImportYearDataV2.mockReset();
    getTokenInfo.mockReset();
    importYearsV2.mockReset();
    getOpsFunnelV2.mockReset();
    getOverviewV2.mockReset();
    getPlanningContextV2.mockReset();
    listForecastScenariosV2.mockReset();
    listReportsV2.mockReset();
    previewWorkbookImportV2.mockReset();
    refreshOverviewPeerV2.mockReset();
    reconcileImportYearV2.mockReset();
    restoreImportYearsV2.mockReset();
    searchImportOrganizationsV2.mockReset();
    syncImportV2.mockReset();
    sendV2OpsEvent.mockReset();
    extractStatementFromPdf.mockReset();
    extractQdisFromPdf.mockReset();
    extractDocumentFromPdf.mockReset();

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );

    getPlanningContextV2.mockResolvedValue(buildPlanningContextResponse());
    getTokenInfo.mockReturnValue(null);

    listForecastScenariosV2.mockResolvedValue([
      { id: 'scenario-1', nimi: 'Scenario 1', computedYears: 20 },
    ]);
    listReportsV2.mockResolvedValue([
      { id: 'report-1', title: 'Report 1', createdAt: '2026-03-08T10:00:00.000Z' },
    ]);
    createVesinvestPlanV2.mockResolvedValue({ id: 'plan-1' } as any);
    clearImportAndScenariosV2.mockResolvedValue({
      deletedScenarios: 1,
      deletedVeetiBudgets: 2,
      deletedVeetiSnapshots: 3,
      deletedVesinvestPlanSeries: 1,
      deletedVeetiLinks: 1,
      status: {
        connected: false,
        link: null,
        years: [],
        availableYears: [],
        excludedYears: [],
        workspaceYears: [],
      },
    } as any);
    getOpsFunnelV2.mockResolvedValue(null);
    importYearsV2.mockResolvedValue({
      selectedYears: [2024],
      importedYears: [2024],
      skippedYears: [],
      sync: { linked: { orgId: 'org-1', veetiId: 1535, nimi: 'Water Utility', ytunnus: '1234567-8' }, fetchedAt: '2026-03-08T10:00:00.000Z', years: [2024], snapshotUpserts: 4 },
      status: { connected: true, link: { nimi: 'Water Utility', ytunnus: '1234567-8', lastFetchedAt: '2026-03-08T10:00:00.000Z' }, years: [], excludedYears: [] },
    });
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2024 ? 'MIXED' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: year === 2024,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: year === 2024,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 95000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 30000,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'Statement-backed correction',
            provenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    }));
};

export {
  React,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  OverviewImportBoard,
  OverviewPageV2,
  OverviewReviewBoard,
  OverviewSupportRail,
  OverviewYearWorkspace,
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
  submitWorkbookImportWorkflow,
  getPreviewPrefetchYears,
  pickDefaultBaselineYears,
  buildImportYearSummaryRows,
  getExactEditedFieldLabels,
  useOverviewSetupState,
  useOverviewImportController,
  completeImportYearManuallyV2,
  clearImportAndScenariosV2,
  connectImportOrganizationV2,
  createVesinvestPlanV2,
  createForecastScenarioV2,
  createPlanningBaselineV2,
  deleteImportYearsBulkV2,
  deleteImportYearV2,
  excludeImportYearsV2,
  getImportStatusV2,
  getImportYearDataV2,
  getTokenInfo,
  importYearsV2,
  getOpsFunnelV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  previewWorkbookImportV2,
  refreshOverviewPeerV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  searchImportOrganizationsV2,
  syncImportV2,
  sendV2OpsEvent,
  extractStatementFromPdf,
  extractQdisFromPdf,
  extractDocumentFromPdf,
  translate,
  localeText,
  getPrimaryButtons,
  expectPrimaryButtonLabels,
  clickReviewGroupYear,
  focusReviewWorkspaceYear,
  openReviewWorkspaceYear,
  openYearDecisionWorkspaceYear,
  openCurrentYearEstimateLane,
  getLatestSetupWizardState,
  findSupportStatusItem,
  findReviewWorkspaceYear,
  seedReviewedYears,
  buildOverviewResponse,
  buildPlanningContextResponse,
  setActiveLocale,
  resetOverviewTestState,
};
