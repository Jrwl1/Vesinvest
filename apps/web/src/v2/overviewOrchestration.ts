import type { TFunction } from 'i18next';

import {
  connectImportOrganizationV2,
  createVesinvestPlanV2,
  getImportStatusV2,
  getOverviewV2,
  getPlanningContextV2,
  importYearsV2,
  listForecastScenariosV2,
  listReportsV2,
  searchImportOrganizationsV2,
  type V2ForecastScenarioListItem,
  type V2ImportStatus,
  type V2OverviewResponse,
  type V2PlanningContextResponse,
  type V2ReportListItem,
  type VeetiOrganizationSearchHit,
} from '../api';
import {
  getAvailableImportYears,
  getConfirmedImportedYears,
  getExcludedYears,
  type ImportYearLike,
} from './overviewWorkflow';
import { sendV2OpsEvent } from './opsTelemetry';

type PickDefaultSyncYears = (rows: ImportYearLike[]) => number[];

export type LoadOverviewOptions = {
  preserveVisibleState?: boolean;
  preserveSelectionState?: boolean;
  preserveReviewContinueStep?: boolean;
  deferSecondaryLoads?: boolean;
  refreshPlanningContext?: boolean;
  skipSecondaryLoads?: boolean;
};

export type LoadOverviewResult = {
  overview: V2OverviewResponse;
  planningContext: V2PlanningContextResponse | null;
  selectionState:
    | {
        selectedYears: number[];
        selectedYearsForDelete: number[];
        selectedYearsForRestore: number[];
        importedWorkspaceYears: number[];
      }
    | null;
  secondaryLoads:
    | Promise<{
        scenarioList: V2ForecastScenarioListItem[] | null;
        reportList: V2ReportListItem[] | null;
      }>
    | null;
  immediateSecondaryLoads:
    | {
        scenarioList: V2ForecastScenarioListItem[] | null;
        reportList: V2ReportListItem[] | null;
      }
    | null;
};

export async function loadOverviewOrchestration(params: {
  options?: LoadOverviewOptions;
  previousSelectedYears: number[];
  previousSelectedYearsForDelete: number[];
  previousSelectedYearsForRestore: number[];
  yearSelectionTouched: boolean;
  pickDefaultSyncYears: PickDefaultSyncYears;
}): Promise<LoadOverviewResult> {
  const {
    options,
    previousSelectedYears,
    previousSelectedYearsForDelete,
    previousSelectedYearsForRestore,
    yearSelectionTouched,
    pickDefaultSyncYears,
  } = params;
  const overview = await getOverviewV2();
  const planningContext =
    options?.refreshPlanningContext ?? true
      ? await getPlanningContextV2().catch(() => null)
      : null;

  if (options?.skipSecondaryLoads) {
    return {
      overview,
      planningContext,
      selectionState: null,
      secondaryLoads: null,
      immediateSecondaryLoads: null,
    };
  }

  const availableYears = getAvailableImportYears(overview.importStatus);
  const availableYearSet = new Set(availableYears.map((row) => row.vuosi));
  const excludedYearSet = new Set(getExcludedYears(overview.importStatus));
  const filteredSelectedYears = previousSelectedYears
    .filter((year) => availableYearSet.has(year) && !excludedYearSet.has(year))
    .sort((a, b) => a - b);

  const selectionState = {
    selectedYears:
      yearSelectionTouched && filteredSelectedYears.length === 0
        ? filteredSelectedYears
        : filteredSelectedYears.length > 0
        ? filteredSelectedYears
        : pickDefaultSyncYears(availableYears),
    selectedYearsForDelete: previousSelectedYearsForDelete
      .filter((year) => availableYearSet.has(year))
      .sort((a, b) => a - b),
    selectedYearsForRestore: previousSelectedYearsForRestore
      .filter((year) => excludedYearSet.has(year))
      .sort((a, b) => a - b),
    importedWorkspaceYears: [...getConfirmedImportedYears(overview.importStatus)]
      .map((year) => Number(year))
      .filter((year) => Number.isFinite(year) && availableYearSet.has(year))
      .sort((a, b) => b - a),
  };

  if (options?.deferSecondaryLoads ?? true) {
    return {
      overview,
      planningContext,
      selectionState,
      secondaryLoads: Promise.all([
        listForecastScenariosV2().catch(() => null),
        listReportsV2().catch(() => null),
      ]).then(([scenarioList, reportList]) => ({ scenarioList, reportList })),
      immediateSecondaryLoads: null,
    };
  }

  const [scenarioList, reportList] = await Promise.all([
    listForecastScenariosV2().catch(() => null),
    listReportsV2().catch(() => null),
  ]);

  return {
    overview,
    planningContext,
    selectionState,
    secondaryLoads: null,
    immediateSecondaryLoads: { scenarioList, reportList },
  };
}

export async function performOverviewOrganizationSearch(params: {
  searchValue: string;
  currentSelectedOrg: VeetiOrganizationSearchHit | null;
  t: TFunction;
}): Promise<{
  rows: VeetiOrganizationSearchHit[];
  selectedOrg: VeetiOrganizationSearchHit | null;
  info: string | null;
}> {
  const { searchValue, currentSelectedOrg, t } = params;
  const rows = await searchImportOrganizationsV2(searchValue, 25);
  const normalizedBusinessId = normalizeBusinessIdCandidate(searchValue);
  const exactBusinessIdMatch = isBusinessIdLikeQuery(searchValue)
    ? rows.find(
        (row) =>
          normalizeBusinessIdCandidate(row.YTunnus ?? '') === normalizedBusinessId,
      ) ?? null
    : null;

  const selectedOrg =
    exactBusinessIdMatch ??
    (currentSelectedOrg
      ? rows.find((row) => row.Id === currentSelectedOrg.Id) ?? null
      : rows.length === 1
      ? rows[0]
      : null);

  sendV2OpsEvent({
    event: 'veeti_search',
    status: 'ok',
    attrs: { queryLength: searchValue.length, resultCount: rows.length },
  });

  return {
    rows,
    selectedOrg,
    info:
      rows.length === 0
        ? t(
            'v2Overview.infoNoSearchResults',
            'No organizations found. Try a business ID or a longer name.',
          )
        : null,
  };
}

export function recordOverviewSearchFailure(searchValue: string): void {
  sendV2OpsEvent({
    event: 'veeti_search',
    status: 'error',
    attrs: { queryLength: searchValue.length },
  });
}

export async function connectOverviewOrganization(params: {
  targetOrg: VeetiOrganizationSearchHit;
  pickDefaultSyncYears: PickDefaultSyncYears;
  t: TFunction;
}): Promise<{
  status: V2ImportStatus;
  defaultSelectedYears: number[];
  importedWorkspaceYears: number[];
  info: string;
}> {
  const { targetOrg, pickDefaultSyncYears, t } = params;
  await connectImportOrganizationV2(targetOrg.Id);
  sendV2OpsEvent({
    event: 'veeti_connect_org',
    status: 'ok',
    attrs: { veetiId: targetOrg.Id },
  });
  const status = await getImportStatusV2();
  return {
    status,
    defaultSelectedYears: pickDefaultSyncYears(
      status.availableYears ?? status.years ?? [],
    ),
    importedWorkspaceYears: [...(status.workspaceYears ?? [])]
      .map((year) => Number(year))
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => b - a),
    info: t(
      'v2Overview.infoConnected',
      'Utility linked. Select historical years and continue building the baseline.',
    ),
  };
}

export function recordOverviewConnectFailure(targetOrg: VeetiOrganizationSearchHit): void {
  sendV2OpsEvent({
    event: 'veeti_connect_org',
    status: 'error',
    attrs: { veetiId: targetOrg.Id },
  });
}

export async function ensureOverviewPlanContext(): Promise<{
  planningContext: V2PlanningContextResponse | null;
  createdPlan: boolean;
}> {
  const planningContext = await getPlanningContextV2().catch(() => null);
  const hasPlan =
    planningContext?.vesinvest?.hasPlan === true ||
    planningContext?.vesinvest?.activePlan != null ||
    planningContext?.vesinvest?.selectedPlan != null;

  if (hasPlan) {
    return {
      planningContext,
      createdPlan: false,
    };
  }

  await createVesinvestPlanV2({
    projects: [],
  });

  return {
    planningContext: await getPlanningContextV2().catch(() => planningContext),
    createdPlan: true,
  };
}

export async function importOverviewYears(params: {
  selectedYears: number[];
  t: TFunction;
}): Promise<{
  importedWorkspaceYears: number[];
  info: string;
}> {
  const { selectedYears, t } = params;
  const result = await importYearsV2(selectedYears);
  sendV2OpsEvent({
    event: 'veeti_import_years',
    status: 'ok',
    attrs: {
      requestedYearCount: selectedYears.length,
      importedYearCount: result.importedYears.length,
      skippedYearCount: result.skippedYears.length,
    },
  });
  return {
    importedWorkspaceYears: [...result.importedYears].sort((a, b) => b - a),
    info: t('v2Overview.infoImportYearsDone', {
      years:
        result.importedYears.length > 0
          ? result.importedYears.join(', ')
          : t('v2Overview.noYearsSelected', 'None selected'),
    }),
  };
}

export function recordOverviewImportFailure(selectedYears: number[]): void {
  sendV2OpsEvent({
    event: 'veeti_import_years',
    status: 'error',
    attrs: { requestedYearCount: selectedYears.length },
  });
}

function normalizeBusinessIdCandidate(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[^\d]/g, '');
}

function isBusinessIdLikeQuery(value: string): boolean {
  return /^[\d-\s]+$/.test(value.trim().replace(/\s+/g, ' ')) &&
    normalizeBusinessIdCandidate(value).length > 0;
}
