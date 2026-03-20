import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  connectImportOrganizationV2,
  excludeImportYearsV2,
  createPlanningBaselineV2,
  getImportYearDataV2,
  importYearsV2,
  getImportStatusV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  previewWorkbookImportV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  searchImportOrganizationsV2,
  syncImportV2,
  type V2ForecastScenarioListItem,
  type V2ImportYearDataResponse,
  type V2ManualYearPatchPayload,
  type V2OverrideProvenance,
  type V2PlanningContextResponse,
  type V2OverviewResponse,
  type V2ReportListItem,
  type V2WorkbookPreviewResponse,
  type VeetiOrganizationSearchHit,
} from '../api';
import { applyOrganizationDefaultLanguage } from '../i18n';
import { formatDateTime, formatEur, formatNumber, formatPrice } from './format';
import {
  getAvailableImportYears,
  getConfirmedImportedYears,
  getExcludedYears,
  getMissingSyncRequirements,
  resolvePreviousSetupStep,
  getSetupReadinessChecks,
  getSetupYearStatus,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  resolveSetupWizardState,
  type SetupWizardStep,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  extractQdisFromPdf,
  type QdisFieldKey,
  type QdisFieldMatch,
} from './qdisPdfImport';
import { extractStatementFromPdf } from './statementOcr';
import {
  buildStatementOcrComparisonRows,
  normalizeStatementOcrFieldValue,
  type StatementOcrFieldKey,
  type StatementOcrMatch,
} from './statementOcrParse';
import {
  buildFinancialComparisonRows,
  buildImportYearResultToZeroSignal,
  buildImportYearSourceLayers,
  buildImportYearSummaryRows,
  buildImportYearTrustSignal,
  buildPriceComparisonRows,
  buildVolumeComparisonRows,
  canReapplyDatasetVeeti,
  canReapplyFinancialVeeti,
  markPersistedReviewedImportYears,
  resolveApprovedYearStep,
  resolveNextReviewQueueYear,
  resolveReviewContinueTarget,
  syncPersistedReviewedImportYears,
  type ImportYearSummaryFieldKey,
} from './yearReview';

type Props = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
  setupBackSignal?: number;
};

type ManualPatchMode =
  | 'review'
  | 'manualEdit'
  | 'statementImport'
  | 'workbookImport'
  | 'qdisImport';

type InlineCardField =
  | 'liikevaihto'
  | 'aineetJaPalvelut'
  | 'henkilostokulut'
  | 'poistot'
  | 'liiketoiminnanMuutKulut'
  | 'tilikaudenYliJaama'
  | 'waterUnitPrice'
  | 'wastewaterUnitPrice'
  | 'soldWaterVolume'
  | 'soldWastewaterVolume';

const YEAR_PREVIEW_PREFETCH_LIMIT = 4;

type StatementImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<StatementOcrFieldKey, number>>;
  matches: StatementOcrMatch[];
  warnings: string[];
};

type QdisImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<QdisFieldKey, number>>;
  matches: QdisFieldMatch[];
  warnings: string[];
};

type ManualFinancialForm = {
  liikevaihto: number;
  aineetJaPalvelut: number;
  henkilostokulut: number;
  liiketoiminnanMuutKulut: number;
  poistot: number;
  arvonalentumiset: number;
  rahoitustuototJaKulut: number;
  tilikaudenYliJaama: number;
  omistajatuloutus: number;
  omistajanTukiKayttokustannuksiin: number;
};

type ManualPriceForm = {
  waterUnitPrice: number;
  wastewaterUnitPrice: number;
};

type ManualVolumeForm = {
  soldWaterVolume: number;
  soldWastewaterVolume: number;
};

type ManualInvestmentForm = {
  investoinninMaara: number;
  korvausInvestoinninMaara: number;
};

type ManualEnergyForm = {
  prosessinKayttamaSahko: number;
};

type ManualNetworkForm = {
  verkostonPituus: number;
};
type ImportWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

type WizardContextHelperTone = 'neutral' | 'positive' | 'warning';

type WizardContextHelper = {
  key: string;
  label: string;
  title: string;
  body: string;
  tone: WizardContextHelperTone;
};

const MANUAL_NUMERIC_EPSILON = 0.005;
const AUTO_SEARCH_MIN_QUERY_LENGTH = 3;
const AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH = 4;
const AUTO_SEARCH_DELAY_MS = 320;
const AUTO_SEARCH_BUSINESS_ID_DELAY_MS = 120;

const IMPORT_BOARD_CANON_ROWS: Array<{
  key: ImportYearSummaryFieldKey;
  labelKey: string;
  defaultLabel: string;
  emphasized?: boolean;
}> = [
  {
    key: 'revenue',
    labelKey: 'v2Overview.previewAccountingRevenueLabel',
    defaultLabel: 'Revenue',
  },
  {
    key: 'materialsCosts',
    labelKey: 'v2Overview.previewAccountingMaterialsLabel',
    defaultLabel: 'Materials and services',
  },
  {
    key: 'personnelCosts',
    labelKey: 'v2Overview.previewAccountingPersonnelLabel',
    defaultLabel: 'Personnel costs',
  },
  {
    key: 'depreciation',
    labelKey: 'v2Overview.previewAccountingDepreciationLabel',
    defaultLabel: 'Depreciation',
  },
  {
    key: 'otherOperatingCosts',
    labelKey: 'v2Overview.previewAccountingOtherOpexLabel',
    defaultLabel: 'Other operating costs',
  },
  {
    key: 'result',
    labelKey: 'v2Overview.previewAccountingResultLabel',
    defaultLabel: 'Result',
    emphasized: true,
  },
];

const CARD_SUMMARY_FIELD_TO_INLINE_FIELD: Record<
  ImportYearSummaryFieldKey,
  InlineCardField
> = {
  revenue: 'liikevaihto',
  materialsCosts: 'aineetJaPalvelut',
  personnelCosts: 'henkilostokulut',
  depreciation: 'poistot',
  otherOperatingCosts: 'liiketoiminnanMuutKulut',
  result: 'tilikaudenYliJaama',
};

const WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY: Record<
  V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
  keyof NonNullable<V2ManualYearPatchPayload['financials']>
> = {
  Liikevaihto: 'liikevaihto',
  AineetJaPalvelut: 'aineetJaPalvelut',
  Henkilostokulut: 'henkilostokulut',
  Poistot: 'poistot',
  LiiketoiminnanMuutKulut: 'liiketoiminnanMuutKulut',
  TilikaudenYliJaama: 'tilikaudenYliJaama',
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeOrganizationSearchQuery = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizeBusinessIdCandidate = (value: string): string =>
  normalizeOrganizationSearchQuery(value).replace(/[^\d]/g, '');

const isBusinessIdLikeQuery = (value: string): boolean =>
  /^[\d-\s]+$/.test(normalizeOrganizationSearchQuery(value)) &&
  normalizeBusinessIdCandidate(value).length > 0;

const getAutoSearchMinLength = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH
    : AUTO_SEARCH_MIN_QUERY_LENGTH;

const getAutoSearchDelayMs = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_DELAY_MS
    : AUTO_SEARCH_DELAY_MS;

const parseManualNumber = (value: unknown): number => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const numbersDiffer = (left: number, right: number): boolean =>
  Math.abs(left - right) > MANUAL_NUMERIC_EPSILON;

function getEffectiveFirstRow(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Record<string, unknown> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.effectiveRows?.[0] ??
    {}
  );
}

function getRawFirstRow(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Record<string, unknown> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.rawRows?.[0] ?? {}
  );
}

function getEffectiveRows(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Array<Record<string, unknown>> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.effectiveRows ?? []
  );
}

function buildFinancialForm(yearData: V2ImportYearDataResponse | undefined): ManualFinancialForm {
  const financials = getEffectiveFirstRow(yearData, 'tilinpaatos');
  return {
    liikevaihto: parseManualNumber((financials as any).Liikevaihto),
    aineetJaPalvelut: parseManualNumber((financials as any).AineetJaPalvelut),
    henkilostokulut: parseManualNumber((financials as any).Henkilostokulut),
    liiketoiminnanMuutKulut: parseManualNumber(
      (financials as any).LiiketoiminnanMuutKulut,
    ),
    poistot: parseManualNumber((financials as any).Poistot),
    arvonalentumiset: parseManualNumber((financials as any).Arvonalentumiset),
    rahoitustuototJaKulut: parseManualNumber(
      (financials as any).RahoitustuototJaKulut,
    ),
    tilikaudenYliJaama: parseManualNumber((financials as any).TilikaudenYliJaama),
    omistajatuloutus: parseManualNumber((financials as any).Omistajatuloutus),
    omistajanTukiKayttokustannuksiin: parseManualNumber(
      (financials as any).OmistajanTukiKayttokustannuksiin,
    ),
  };
}

function buildPriceForm(yearData: V2ImportYearDataResponse | undefined): ManualPriceForm {
  const taksaRows = getEffectiveRows(yearData, 'taksa');
  const waterPriceRow = taksaRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 1,
  );
  const wastewaterPriceRow = taksaRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 2,
  );
  return {
    waterUnitPrice: parseManualNumber((waterPriceRow as any)?.Kayttomaksu),
    wastewaterUnitPrice: parseManualNumber(
      (wastewaterPriceRow as any)?.Kayttomaksu,
    ),
  };
}

function buildVolumeForm(yearData: V2ImportYearDataResponse | undefined): ManualVolumeForm {
  const waterVolume = getEffectiveFirstRow(yearData, 'volume_vesi');
  const wastewaterVolume = getEffectiveFirstRow(yearData, 'volume_jatevesi');
  return {
    soldWaterVolume: parseManualNumber((waterVolume as any).Maara),
    soldWastewaterVolume: parseManualNumber((wastewaterVolume as any).Maara),
  };
}

function buildInvestmentForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualInvestmentForm {
  const investments = getEffectiveFirstRow(yearData, 'investointi');
  return {
    investoinninMaara: parseManualNumber((investments as any).InvestoinninMaara),
    korvausInvestoinninMaara: parseManualNumber(
      (investments as any).KorvausInvestoinninMaara,
    ),
  };
}

function buildEnergyForm(yearData: V2ImportYearDataResponse | undefined): ManualEnergyForm {
  const energy = getEffectiveFirstRow(yearData, 'energia');
  return {
    prosessinKayttamaSahko: parseManualNumber(
      (energy as any).ProsessinKayttamaSahko,
    ),
  };
}

function buildNetworkForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualNetworkForm {
  const network = getEffectiveFirstRow(yearData, 'verkko');
  return {
    verkostonPituus: parseManualNumber((network as any).VerkostonPituus),
  };
}

function formsDiffer<T extends Record<string, number>>(left: T, right: T): boolean {
  return Object.keys(left).some((key) =>
    numbersDiffer(left[key as keyof T], right[key as keyof T]),
  );
}

export const OverviewPageV2: React.FC<Props> = ({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  onSetupWizardStateChange,
  onSetupOrgNameChange,
  setupBackSignal,
}) => {
  const { t } = useTranslation();
  const [overview, setOverview] = React.useState<V2OverviewResponse | null>(
    null,
  );
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<
    VeetiOrganizationSearchHit[]
  >([]);
  const [selectedOrg, setSelectedOrg] =
    React.useState<VeetiOrganizationSearchHit | null>(null);

  const [selectedYears, setSelectedYears] = React.useState<number[]>([]);
  const [scenarioList, setScenarioList] = React.useState<
    V2ForecastScenarioListItem[] | null
  >(null);
  const [reportList, setReportList] = React.useState<V2ReportListItem[] | null>(
    null,
  );
  const [reviewedImportedYears, setReviewedImportedYears] = React.useState<
    number[]
  >([]);
  const [importedWorkspaceYears, setImportedWorkspaceYears] = React.useState<
    number[] | null
  >(null);
  const [latestPlanningBaselineSummary, setLatestPlanningBaselineSummary] =
    React.useState<{
      includedYears: number[];
      excludedYears: number[];
      correctedYears: number[];
    } | null>(null);
  const [reviewContinueStep, setReviewContinueStep] =
    React.useState<SetupWizardStep | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const [importingYears, setImportingYears] = React.useState(false);
  const [creatingPlanningBaseline, setCreatingPlanningBaseline] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [removingYear, setRemovingYear] = React.useState<number | null>(null);
  const [bulkDeletingYears, setBulkDeletingYears] = React.useState(false);
  const [bulkRestoringYears, setBulkRestoringYears] = React.useState(false);
  const [selectedYearsForDelete, setSelectedYearsForDelete] = React.useState<
    number[]
  >([]);
  const [selectedYearsForRestore, setSelectedYearsForRestore] = React.useState<
    number[]
  >([]);
  const syncYearSelectionTouchedRef = React.useRef(false);
  const searchRequestSeq = React.useRef(0);
  const previewFetchYearsRef = React.useRef<Set<number>>(new Set());
  const inlineCardFieldRefs = React.useRef<
    Partial<Record<InlineCardField, HTMLInputElement | null>>
  >({});
  const [manualPatchYear, setManualPatchYear] = React.useState<number | null>(
    null,
  );
  const [cardEditYear, setCardEditYear] = React.useState<number | null>(null);
  const [cardEditFocusField, setCardEditFocusField] =
    React.useState<InlineCardField | null>(null);
  const [cardEditContext, setCardEditContext] = React.useState<
    'step2' | 'step3' | null
  >(null);
  const [manualPatchMode, setManualPatchMode] =
    React.useState<ManualPatchMode>('review');
  const [manualPatchMissing, setManualPatchMissing] = React.useState<
    MissingRequirement[]
  >([]);
  const [manualPatchBusy, setManualPatchBusy] = React.useState(false);
  const [manualPatchError, setManualPatchError] = React.useState<string | null>(
    null,
  );
  const [statementImportBusy, setStatementImportBusy] = React.useState(false);
  const [statementImportStatus, setStatementImportStatus] = React.useState<
    string | null
  >(null);
  const [statementImportError, setStatementImportError] = React.useState<
    string | null
  >(null);
  const [statementImportPreview, setStatementImportPreview] =
    React.useState<StatementImportPreview | null>(null);
  const [workbookImportBusy, setWorkbookImportBusy] = React.useState(false);
  const [workbookImportStatus, setWorkbookImportStatus] = React.useState<
    string | null
  >(null);
  const [workbookImportError, setWorkbookImportError] = React.useState<
    string | null
  >(null);
  const [workbookImportPreview, setWorkbookImportPreview] =
    React.useState<V2WorkbookPreviewResponse | null>(null);
  const [workbookImportSelections, setWorkbookImportSelections] =
    React.useState<
      Record<
        number,
        Partial<
          Record<
            V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
            'keep_veeti' | 'apply_workbook'
          >
        >
      >
    >({});
  const [qdisImportBusy, setQdisImportBusy] = React.useState(false);
  const [qdisImportStatus, setQdisImportStatus] = React.useState<string | null>(
    null,
  );
  const [qdisImportError, setQdisImportError] = React.useState<string | null>(
    null,
  );
  const [qdisImportPreview, setQdisImportPreview] =
    React.useState<QdisImportPreview | null>(null);
  const [manualFinancials, setManualFinancials] = React.useState({
    liikevaihto: 0,
    aineetJaPalvelut: 0,
    henkilostokulut: 0,
    liiketoiminnanMuutKulut: 0,
    poistot: 0,
    arvonalentumiset: 0,
    rahoitustuototJaKulut: 0,
    tilikaudenYliJaama: 0,
    omistajatuloutus: 0,
    omistajanTukiKayttokustannuksiin: 0,
  });
  const [manualPrices, setManualPrices] = React.useState({
    waterUnitPrice: 0,
    wastewaterUnitPrice: 0,
  });
  const [manualVolumes, setManualVolumes] = React.useState({
    soldWaterVolume: 0,
    soldWastewaterVolume: 0,
  });
  const [manualInvestments, setManualInvestments] = React.useState({
    investoinninMaara: 0,
    korvausInvestoinninMaara: 0,
  });
  const [manualEnergy, setManualEnergy] = React.useState({
    prosessinKayttamaSahko: 0,
  });
  const [manualNetwork, setManualNetwork] = React.useState({
    verkostonPituus: 0,
  });
  const [manualReason, setManualReason] = React.useState('');
  const handledSetupBackSignalRef = React.useRef(0);
  const [yearDataCache, setYearDataCache] = React.useState<
    Record<number, V2ImportYearDataResponse>
  >({});
  const [loadingYearData, setLoadingYearData] = React.useState<number | null>(
    null,
  );
  const baselineReady = React.useMemo(
    () =>
      (planningContext?.canCreateScenario ??
        (planningContext?.baselineYears?.length ?? 0) > 0) ||
      (scenarioList?.length ?? 0) > 0 ||
      (reportList?.length ?? 0) > 0,
    [
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      reportList?.length,
      scenarioList?.length,
    ],
  );
  const statementFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const workbookFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const qdisFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const setInlineCardFieldRef = React.useCallback(
    (field: InlineCardField) => (node: HTMLInputElement | null) => {
      inlineCardFieldRefs.current[field] = node;
    },
    [],
  );

  const resolveSyncBlockReason = React.useCallback(
    (row: { completeness: Record<string, boolean> }): string | null => {
      const key = getSyncBlockReasonKey({
        vuosi: 0,
        completeness: row.completeness,
      });
      if (!key) return null;
      if (key === 'v2Overview.yearReasonMissingFinancials') {
        return t(key, 'Missing financial statement data.');
      }
      if (key === 'v2Overview.yearReasonMissingPrices') {
        return t(key, 'Missing price data (taksa).');
      }
      return t(key, 'Missing sold volume data.');
    },
    [t],
  );

  const pickDefaultSyncYears = React.useCallback(
    (rows: Array<{ vuosi: number; completeness: Record<string, boolean> }>) =>
      [...rows]
        .filter((row) => resolveSyncBlockReason(row) === null)
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((item) => item.vuosi),
    [resolveSyncBlockReason],
  );

  const loadOverview = React.useCallback(async (options?: {
    preserveVisibleState?: boolean;
    deferSecondaryLoads?: boolean;
    refreshPlanningContext?: boolean;
    skipSecondaryLoads?: boolean;
  }) => {
    let mainOverviewLoaded = false;
    if (!options?.preserveVisibleState) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getOverviewV2();
      mainOverviewLoaded = true;
      setOverview(data);
      const hasImportedWorkspaceYears =
        getConfirmedImportedYears(data.importStatus).length > 0;
      if ((options?.refreshPlanningContext ?? true) && hasImportedWorkspaceYears) {
        const context = await getPlanningContextV2().catch(() => null);
        setPlanningContext(context);
      } else if (!hasImportedWorkspaceYears) {
        setPlanningContext(null);
      }
      if (options?.skipSecondaryLoads) {
        if (!options?.preserveVisibleState) {
          setLoading(false);
        }
        return;
      }
      const shouldDeferSecondaryLoads = options?.deferSecondaryLoads ?? true;
      if (shouldDeferSecondaryLoads) {
        void listForecastScenariosV2()
          .catch(() => null)
          .then((scenarios) => {
            setScenarioList(scenarios);
          });
        void listReportsV2()
          .catch(() => null)
          .then((reports) => {
            setReportList(reports);
          });
      } else {
        const [scenarios, reports] = await Promise.all([
          listForecastScenariosV2().catch(() => null),
          listReportsV2().catch(() => null),
        ]);
        setScenarioList(scenarios);
        setReportList(reports);
      }
      const availableYears = getAvailableImportYears(data.importStatus);
      const availableYearSet = new Set(
        availableYears.map((row) => row.vuosi),
      );
      const excludedYearSet = new Set(
        getExcludedYears(data.importStatus),
      );

      setSelectedYears((prev) => {
        const filtered = prev
          .filter((year) => availableYearSet.has(year))
          .sort((a, b) => a - b);
        if (syncYearSelectionTouchedRef.current) {
          return filtered;
        }
        const defaults = pickDefaultSyncYears(availableYears);
        return filtered.length > 0 ? filtered : defaults;
      });
      setSelectedYearsForDelete((prev) =>
        prev.filter((year) => availableYearSet.has(year)).sort((a, b) => a - b),
      );
      setSelectedYearsForRestore((prev) =>
        prev.filter((year) => excludedYearSet.has(year)).sort((a, b) => a - b),
      );
      setReviewContinueStep(null);
        setImportedWorkspaceYears(
          [...getConfirmedImportedYears(data.importStatus)]
            .map((year) => Number(year))
            .filter((year) => Number.isFinite(year) && availableYearSet.has(year))
            .sort((a, b) => b - a),
        );
      if (!options?.preserveVisibleState) {
        setLoading(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorLoadFailed', 'Failed to load overview.'),
      );
    } finally {
      if (!options?.preserveVisibleState && !mainOverviewLoaded) {
        setLoading(false);
      }
    }
  }, [pickDefaultSyncYears, t]);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const performOrganizationSearch = React.useCallback(
    async (searchValue: string) => {
      if (searchValue.length < 2) return;

      const requestSeq = searchRequestSeq.current + 1;
      searchRequestSeq.current = requestSeq;
      setSearching(true);
      setError(null);
      setInfo(null);
      try {
        const rows = await searchImportOrganizationsV2(searchValue, 25);
        if (searchRequestSeq.current !== requestSeq) return;

        const exactBusinessIdMatch = isBusinessIdLikeQuery(searchValue)
          ? rows.find(
              (row) =>
                normalizeBusinessIdCandidate(row.YTunnus ?? '') ===
                normalizeBusinessIdCandidate(searchValue),
            ) ?? null
          : null;

        setSearchResults(rows);
        setSelectedOrg((current) => {
          if (exactBusinessIdMatch) {
            return exactBusinessIdMatch;
          }
          if (current) {
            const preserved = rows.find((row) => row.Id === current.Id);
            if (preserved) {
              return preserved;
            }
          }
          return rows.length === 1 ? rows[0] : null;
        });
        sendV2OpsEvent({
          event: 'veeti_search',
          status: 'ok',
          attrs: { queryLength: searchValue.length, resultCount: rows.length },
        });
        if (rows.length === 0) {
          setSelectedOrg(null);
          setInfo(
            t(
              'v2Overview.infoNoSearchResults',
              'No organizations found. Try a business ID or a longer name.',
            ),
          );
        }
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_search',
          status: 'error',
          attrs: { queryLength: searchValue.length },
        });
        setError(
          err instanceof Error
            ? err.message
            : t('v2Overview.errorSearchFailed', 'VEETI search failed.'),
        );
      } finally {
        if (searchRequestSeq.current === requestSeq) {
          setSearching(false);
        }
      }
    },
    [t],
  );

  React.useEffect(() => {
    const searchValue = normalizeOrganizationSearchQuery(query);
    const connected = overview?.importStatus.connected ?? false;

    if (connected || searchValue.length < getAutoSearchMinLength(searchValue)) {
      searchRequestSeq.current += 1;
      setSearching(false);
      setSearchResults([]);
      setInfo(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void performOrganizationSearch(searchValue);
    }, getAutoSearchDelayMs(searchValue));

    return () => {
      window.clearTimeout(timer);
    };
  }, [overview?.importStatus.connected, performOrganizationSearch, query]);

  React.useEffect(() => {
    const orgLanguage = overview?.importStatus.link?.uiLanguage;
    if (!orgLanguage) return;
    void applyOrganizationDefaultLanguage(orgLanguage);
  }, [overview?.importStatus.link?.uiLanguage]);

  const handleSearch = React.useCallback(async () => {
    const searchValue = normalizeOrganizationSearchQuery(query);
    if (searchValue.length < 2) return;
    await performOrganizationSearch(searchValue);
  }, [performOrganizationSearch, query]);

  const handleConnect = React.useCallback(async (org?: VeetiOrganizationSearchHit | null) => {
    const targetOrg = org ?? selectedOrg;
    if (!targetOrg) return;
    setConnecting(true);
    setError(null);
    setInfo(null);
    try {
      await connectImportOrganizationV2(targetOrg.Id);
      sendV2OpsEvent({
        event: 'veeti_connect_org',
        status: 'ok',
        attrs: { veetiId: targetOrg.Id },
      });
      const status = await getImportStatusV2();
      if (status.link?.uiLanguage) {
        await applyOrganizationDefaultLanguage(status.link.uiLanguage);
      }
      const years = pickDefaultSyncYears(
        status.availableYears ?? status.years ?? [],
      );
      syncYearSelectionTouchedRef.current = false;
      setSelectedYears(years);
      setSelectedYearsForDelete([]);
      setSelectedYearsForRestore([]);
      setReviewContinueStep(null);
      const workspaceYears =
        status.workspaceYears == null ? [] : status.workspaceYears;
      setImportedWorkspaceYears(
        [...workspaceYears]
          .map((year) => Number(year))
          .filter((year) => Number.isFinite(year))
          .sort((a, b) => b - a),
      );
      setOverview((current) =>
        current
          ? {
              ...current,
              importStatus: status,
            }
          : current,
      );
      setInfo(
        t(
          'v2Overview.infoConnected',
          'Organization connected. Select years and continue setup.',
        ),
      );
      void loadOverview({
        preserveVisibleState: true,
        deferSecondaryLoads: true,
      });
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_connect_org',
        status: 'error',
        attrs: { veetiId: targetOrg.Id },
      });
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.errorConnectFailed',
              'Failed to connect VEETI organization.',
            ),
      );
    } finally {
      setConnecting(false);
    }
  }, [selectedOrg, pickDefaultSyncYears, loadOverview, t]);

  const handleImportYears = React.useCallback(async () => {
    setImportingYears(true);
    setError(null);
    setInfo(null);
    try {
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
      setInfo(
        t('v2Overview.infoImportYearsDone', {
          years:
            result.importedYears.length > 0
              ? result.importedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        }),
      );
      setImportedWorkspaceYears([...result.importedYears].sort((a, b) => b - a));
      await loadOverview();
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_import_years',
        status: 'error',
        attrs: { requestedYearCount: selectedYears.length },
      });
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorImportYearsFailed', 'Year import failed.'),
      );
    } finally {
      setImportingYears(false);
    }
  }, [loadOverview, selectedYears, t]);

  const runSync = React.useCallback(
    async (years: number[]) => {
      const result = await syncImportV2(years);
      sendV2OpsEvent({
        event: 'veeti_sync',
        status: 'ok',
        attrs: {
          requestedYearCount: years.length,
          syncedCount: result.generatedBudgets.results.length,
          skippedCount: result.generatedBudgets.skipped?.length ?? 0,
        },
      });
      const syncedCount = result.generatedBudgets.results.length;
      const skippedCount = result.generatedBudgets.skipped?.length ?? 0;
      const mismatchYears = (result.sanity?.rows ?? [])
        .filter((row) => row.status === 'mismatch')
        .map((row) => row.year);
      if (skippedCount > 0) {
        setInfo(
          t(
            'v2Overview.infoSyncWithSkips',
            mismatchYears.length > 0
              ? 'Sync done: {{synced}} year(s) updated, {{skipped}} skipped. Sanity mismatches: {{years}}.'
              : 'Sync done: {{synced}} year(s) updated, {{skipped}} skipped. Check year notes below.',
            {
              synced: syncedCount,
              skipped: skippedCount,
              years: mismatchYears.join(', '),
            },
          ),
        );
      } else {
        setInfo(
          t(
            'v2Overview.infoSyncDone',
            mismatchYears.length > 0
              ? 'Sync done: {{count}} year(s) updated. Sanity mismatches: {{years}}.'
              : 'Sync done: {{count}} year(s) updated.',
            {
              count: syncedCount,
              years: mismatchYears.join(', '),
            },
          ),
        );
      }
      await loadOverview();
      const yearsToRefresh = [...new Set(years)]
        .map((year) => Math.round(Number(year)))
        .filter((year) => Number.isFinite(year));
      if (yearsToRefresh.length > 0) {
        const refreshedEntries = await Promise.all(
          yearsToRefresh.map(async (year) => {
            try {
              return [year, await getImportYearDataV2(year)] as const;
            } catch {
              return null;
            }
          }),
        );
        const nextEntries = refreshedEntries.filter(
          (entry): entry is readonly [number, V2ImportYearDataResponse] =>
            entry !== null,
        );
        if (nextEntries.length > 0) {
          setYearDataCache((prev) => ({
            ...prev,
            ...Object.fromEntries(nextEntries),
          }));
        }
      }
      return result;
    },
    [loadOverview, t],
  );

  const toggleYear = React.useCallback(
    (year: number, blockedReason: string | null) => {
      if (blockedReason) return;
      syncYearSelectionTouchedRef.current = true;
      setSelectedYears((prev) => {
        if (prev.includes(year)) return prev.filter((item) => item !== year);
        return [...prev, year].sort((a, b) => a - b);
      });
    },
    [],
  );

  const availableYearRows = React.useMemo(
    () => overview?.importStatus.availableYears ?? overview?.importStatus.years ?? [],
    [overview?.importStatus.availableYears, overview?.importStatus.years],
  );

  const syncYearRows = React.useMemo(
    () =>
      availableYearRows.map((row) => ({
        ...row,
        syncBlockedReason: resolveSyncBlockReason(row),
      })),
    [availableYearRows, resolveSyncBlockReason],
  );
  const selectableImportYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => ({
          ...row,
          missingRequirements: getMissingSyncRequirements(row),
        })),
    [syncYearRows],
  );
  const importableYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason == null),
    [selectableImportYearRows],
  );
  const repairOnlyYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason != null),
    [selectableImportYearRows],
  );

  const blockedYearCount = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason).length,
    [syncYearRows],
  );

  const blockedYearRows = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason),
    [syncYearRows],
  );

  const readyAvailableYearRows = React.useMemo(
    () => syncYearRows.filter((row) => !row.syncBlockedReason),
    [syncYearRows],
  );

  const recommendedYears = React.useMemo(
    () =>
      [...readyAvailableYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((row) => row.vuosi),
    [readyAvailableYearRows],
  );
  const importBoardMissingRequirementLabel = React.useCallback(
    (requirement: MissingRequirement) => {
      if (requirement === 'financials') {
        return t('v2Overview.datasetFinancials', 'Tilinpäätös');
      }
      if (requirement === 'prices') {
        return t('v2Overview.datasetPrices', 'Taksa');
      }
      return t('v2Overview.datasetWaterVolume', 'Volyymit');
    },
    [t],
  );
  const importYearSummaryLabel = React.useCallback(
    (key: ImportYearSummaryFieldKey) => {
      const row = IMPORT_BOARD_CANON_ROWS.find((item) => item.key === key);
      return row ? t(row.labelKey, row.defaultLabel) : key;
    },
    [t],
  );
  const importBoardRows = React.useMemo(() => {
    return selectableImportYearRows.map((row) => {
      const isSelectedForImport = selectedYears.includes(row.vuosi);
      const yearData = yearDataCache[row.vuosi];
      const summaryRows = buildImportYearSummaryRows(yearData);
      const summaryMap = new Map(summaryRows.map((item) => [item.key, item]));
      const trustSignal = buildImportYearTrustSignal(yearData);
      const resultToZero = buildImportYearResultToZeroSignal(yearData);
      const sourceLayers = buildImportYearSourceLayers(yearData);
      const missingPrimaryCosts = [
        summaryMap.get('materialsCosts')?.effectiveValue,
        summaryMap.get('personnelCosts')?.effectiveValue,
        summaryMap.get('depreciation')?.effectiveValue,
        summaryMap.get('otherOperatingCosts')?.effectiveValue,
      ].some((value) => value == null);
      const missingCanonRows = IMPORT_BOARD_CANON_ROWS.filter(
        (item) => summaryMap.get(item.key)?.effectiveValue == null,
      ).map((item) => importYearSummaryLabel(item.key));
      const missingRequiredInputs = [
        {
          present: row.completeness?.tilinpaatos,
          label: t('v2Overview.datasetFinancials', 'Tilinpäätös'),
        },
        {
          present: row.completeness?.taksa,
          label: t('v2Overview.datasetPrices', 'Taksa'),
        },
        {
          present: row.completeness?.volume_vesi,
          label: t('v2Overview.previewWaterVolumeLabel', 'Myyty vesi'),
        },
        {
          present: row.completeness?.volume_jatevesi,
          label: t('v2Overview.previewWastewaterVolumeLabel', 'Myyty jätevesi'),
        },
      ].filter((item) => !item.present);
      const incompleteSource =
        row.sourceStatus === 'INCOMPLETE' ||
        trustSignal.reasons.includes('incomplete_source');
      const missingCoreCostStructure = missingPrimaryCosts || incompleteSource;
      const suspiciousMargin =
        resultToZero.marginPct != null && Math.abs(resultToZero.marginPct) >= 10;
      const hasFallbackZero =
        row.warnings?.includes('fallback_zero_used');
      const hasLargeDiscrepancy = trustSignal.reasons.includes('statement_import');
      const needsHumanReview =
        row.sourceStatus === 'MIXED' ||
        row.sourceStatus === 'MANUAL' ||
        (row.sourceBreakdown?.manualDataTypes?.length ?? 0) > 0 ||
        (row.manualProvenance != null && !hasLargeDiscrepancy);
      const lane =
        row.syncBlockedReason != null
          ? 'blocked'
          : missingCoreCostStructure ||
            hasFallbackZero ||
            hasLargeDiscrepancy ||
            suspiciousMargin ||
            needsHumanReview
          ? 'suspicious'
          : 'ready';
      const boardLane =
        lane !== 'blocked' && !isSelectedForImport ? 'parked' : lane;
      const trustLabel =
        boardLane === 'parked'
          ? t('v2Overview.trustParkedYear', 'Not in this import')
          : lane === 'blocked'
          ? missingCoreCostStructure
            ? t('v2Overview.trustMissingKeyCosts', 'Missing key cost rows')
            : t('v2Overview.yearNeedsCompletion', 'Needs completion')
          : missingCoreCostStructure
          ? t('v2Overview.trustMissingKeyCosts', 'Missing key cost rows')
          : hasLargeDiscrepancy
          ? t(
              'v2Overview.trustLargeDiscrepancy',
              'Large discrepancy vs statement',
            )
          : hasFallbackZero
          ? t('v2Overview.trustFallbackZeros', 'Fallback zeros used')
          : suspiciousMargin
          ? t('v2Overview.trustSuspiciousResult', 'Suspicious result profile')
          : needsHumanReview
          ? t('v2Overview.trustNeedsReview', 'Needs human review')
          : t('v2Overview.trustLooksPlausible', 'Looks plausible');
      const trustToneClass =
        boardLane === 'ready'
          ? 'v2-status-positive'
          : boardLane === 'parked'
          ? 'v2-status-provenance'
          : 'v2-status-warning';
      const missingSummary =
        missingRequiredInputs.length > 0
          ? {
              count: missingRequiredInputs.length,
              total: 4,
              fields: missingRequiredInputs.map((item) => item.label).join(', '),
            }
          : missingCoreCostStructure && missingCanonRows.length > 0
            ? {
                count: missingCanonRows.length,
                total: IMPORT_BOARD_CANON_ROWS.length,
                fields: missingCanonRows.join(', '),
              }
            : null;
      const trustNote =
        boardLane === 'parked'
          ? t(
              'v2Overview.trustParkedYearHint',
              'This year stays available in the workspace, but it is not part of the current import selection.',
            )
          : missingSummary != null
          ? null
          : row.syncBlockedReason != null
          ? t('v2Overview.yearMissingLabel', 'Missing requirements: {{requirements}}', {
              requirements:
                row.missingRequirements.length > 0
                  ? row.missingRequirements
                      .map((item) => importBoardMissingRequirementLabel(item))
                      .join(', ')
                  : t('v2Overview.setupStatusNeedsAttention'),
            })
          : missingCoreCostStructure
          ? t(
              'v2Overview.trustMissingKeyCostsHint',
              'VEETI did not provide these card rows: {{fields}}.',
              {
                fields:
                  missingCanonRows.length > 0
                    ? missingCanonRows.join(', ')
                    : t('v2Overview.previewMissingValue', 'Missing data'),
              },
            )
          : hasLargeDiscrepancy
          ? t(
              'v2Overview.yearTrustStatementImport',
              'Tilinpäätöskorjaus muutti VEETI-rivejä: {{fields}}.',
              {
                fields: trustSignal.changedSummaryKeys
                  .map((key) => importYearSummaryLabel(key))
                  .join(', '),
              },
            )
          : hasFallbackZero
          ? t(
              'v2Overview.trustFallbackZerosHint',
              'Missing VEETI values still fall back to zero in the imported totals.',
            )
          : suspiciousMargin
          ? t(
              'v2Overview.trustSuspiciousResultHint',
              'Year result sits far from zero compared with revenue and should be reviewed before import.',
            )
          : needsHumanReview
          ? t(
              'v2Overview.trustNeedsReviewHint',
              'Mixed or manually corrected source data needs a human review before it becomes the planning baseline.',
            )
          : t(
              'v2Overview.trustLooksPlausibleHint',
              'Core rows are present and the result stays close enough to zero for a normal review pass.',
            );
      return {
        ...row,
        lane,
        boardLane,
        isSelectedForImport,
        summaryMap,
        trustLabel,
        trustToneClass,
        trustNote,
        resultToZero,
        missingCoreCostStructure,
        missingSummary,
      };
    });
  }, [
    selectedYears,
    selectableImportYearRows,
    yearDataCache,
    t,
    importBoardMissingRequirementLabel,
    importYearSummaryLabel,
  ]);
  const readyTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.boardLane === 'ready'),
    [importBoardRows],
  );
  const suspiciousTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.boardLane === 'suspicious'),
    [importBoardRows],
  );
  const parkedTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.boardLane === 'parked'),
    [importBoardRows],
  );
  const blockedTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.boardLane === 'blocked'),
    [importBoardRows],
  );

  const selectedOrgStillVisible = React.useMemo(
    () =>
      selectedOrg
        ? searchResults.some((row) => row.Id === selectedOrg.Id)
        : false,
    [searchResults, selectedOrg],
  );
  React.useEffect(() => {
    if (selectedOrg || searchResults.length !== 1) return;
    setSelectedOrg(searchResults[0] ?? null);
  }, [searchResults, selectedOrg]);
  const preferredSearchOrg = React.useMemo(
    () =>
      selectedOrg ?? (searchResults.length === 1 ? searchResults[0] : null),
    [searchResults, selectedOrg],
  );

  const confirmedImportedYears = React.useMemo(
    () => [...(importedWorkspaceYears ?? [])].sort((a, b) => b - a),
    [importedWorkspaceYears],
  );
  const reviewStorageOrgId = React.useMemo(
    () =>
      overview?.importStatus.link?.orgId ??
      overview?.importStatus.link?.ytunnus ??
      overview?.importStatus.link?.nimi ??
      null,
    [overview?.importStatus.link],
  );
  const persistedReviewedImportedYears = React.useMemo(
    () =>
      syncPersistedReviewedImportYears(
        reviewStorageOrgId,
        confirmedImportedYears,
      ),
    [confirmedImportedYears, reviewStorageOrgId],
  );
  const reviewedImportedYearSet = React.useMemo(
    () =>
      new Set(
        reviewedImportedYears.length > 0
          ? reviewedImportedYears
          : persistedReviewedImportedYears,
      ),
    [persistedReviewedImportedYears, reviewedImportedYears],
  );

  const hasMissingCanonFinancialRows = React.useCallback(
    (year: number) => {
      const yearData = yearDataCache[year];
      if (!yearData) return false;
      const summaryMap = new Map(
        buildImportYearSummaryRows(yearData).map((item) => [item.key, item]),
      );
      return IMPORT_BOARD_CANON_ROWS.some(
        (item) => summaryMap.get(item.key)?.effectiveValue == null,
      );
    },
    [yearDataCache],
  );

  React.useEffect(() => {
    setReviewedImportedYears(persistedReviewedImportedYears);
  }, [persistedReviewedImportedYears]);

  const importYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .filter((row) => confirmedImportedYears.includes(row.vuosi))
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => {
          const missingCanonFinancials = hasMissingCanonFinancialRows(row.vuosi);
          const effectiveRow =
            missingCanonFinancials && row.completeness.tilinpaatos
              ? {
                  ...row,
                  completeness: {
                    ...row.completeness,
                    tilinpaatos: false,
                  },
                }
              : row;
          const missingRequirements = getMissingSyncRequirements(effectiveRow);
          return {
            ...effectiveRow,
            missingRequirements,
            readinessChecks: getSetupReadinessChecks(effectiveRow),
            setupStatus: getSetupYearStatus(effectiveRow),
          };
        }),
    [confirmedImportedYears, hasMissingCanonFinancialRows, syncYearRows],
  );
  const excludedYearsSorted = React.useMemo(
    () =>
      [...(overview?.importStatus.excludedYears ?? [])]
        .map((year) => Number(year))
        .filter((year) => Number.isFinite(year))
        .sort((a, b) => b - a),
    [overview?.importStatus.excludedYears],
  );
  const reviewedImportedYearRows = React.useMemo(
    () =>
      importYearRows.filter(
        (row) =>
          getSetupYearStatus({
            ...row,
            reviewState: reviewedImportedYearSet.has(row.vuosi)
              ? 'reviewed'
              : 'pending_review',
          }, {
            excluded: excludedYearsSorted.includes(row.vuosi),
          }) === 'reviewed',
      ),
    [excludedYearsSorted, importYearRows, reviewedImportedYearSet],
  );
  const technicallyReadyImportedYearRows = React.useMemo(
    () =>
      importYearRows.filter(
        (row) =>
          getSetupYearStatus({
            ...row,
            reviewState: reviewedImportedYearSet.has(row.vuosi)
              ? 'reviewed'
              : 'pending_review',
          }, {
            excluded: excludedYearsSorted.includes(row.vuosi),
          }) === 'ready_for_review',
      ),
    [excludedYearsSorted, importYearRows, reviewedImportedYearSet],
  );
  const reviewStatusRows = React.useMemo(() => {
    const rows = importYearRows.map((row) => ({
      year: row.vuosi,
      sourceStatus: row.sourceStatus,
      readinessChecks: row.readinessChecks,
      missingRequirements: row.missingRequirements,
      warnings: (row.warnings ?? []) as ImportWarningCode[],
      setupStatus: getSetupYearStatus({
        ...row,
        reviewState: reviewedImportedYearSet.has(row.vuosi)
          ? 'reviewed'
          : 'pending_review',
      }, {
        excluded: excludedYearsSorted.includes(row.vuosi),
      }),
    }));
    const visibleYears = new Set(rows.map((row) => row.year));

    for (const year of excludedYearsSorted) {
      if (visibleYears.has(year)) continue;
      rows.push({
        year,
        sourceStatus: undefined,
        readinessChecks: [
          { key: 'financials', labelKey: 'v2Overview.datasetFinancials', ready: false },
          { key: 'prices', labelKey: 'v2Overview.datasetPrices', ready: false },
          { key: 'volumes', labelKey: 'v2Overview.datasetWaterVolume', ready: false },
        ],
        missingRequirements: [] as MissingRequirement[],
        warnings: [] as ImportWarningCode[],
        setupStatus: 'excluded_from_plan' as const,
      });
    }

    return rows.sort((a, b) => b.year - a.year);
  }, [excludedYearsSorted, importYearRows, reviewedImportedYearSet]);
  const importedBlockedYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter((row) => row.setupStatus === 'needs_attention')
        .length,
    [reviewStatusRows],
  );
  const pendingTechnicalReviewYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter((row) => row.setupStatus === 'ready_for_review')
        .length,
    [reviewStatusRows],
  );

  const toggleYearForDelete = React.useCallback((year: number) => {
    setSelectedYearsForDelete((prev) => {
      if (prev.includes(year)) return prev.filter((item) => item !== year);
      return [...prev, year].sort((a, b) => a - b);
    });
  }, []);

  const toggleYearForRestore = React.useCallback((year: number) => {
    setSelectedYearsForRestore((prev) => {
      if (prev.includes(year)) return prev.filter((item) => item !== year);
      return [...prev, year].sort((a, b) => a - b);
    });
  }, []);

  const handleBulkDeleteYears = React.useCallback(async () => {
    if (selectedYearsForDelete.length === 0) return;

    const yearsLabel = [...selectedYearsForDelete]
      .sort((a, b) => a - b)
      .join(', ');
    const confirmed = window.confirm(
      t(
        'v2Overview.excludeYearsBulkConfirm',
        'Rajataanko vuodet {{years}} pois suunnitelmasta? Vuodet säilyvät työtilassa ja ne voi palauttaa myöhemmin.',
        { years: yearsLabel },
      ),
    );
    if (!confirmed) return;

    setBulkDeletingYears(true);
    setError(null);
    setInfo(null);

    try {
      const result = await excludeImportYearsV2(selectedYearsForDelete);
      const skippedYears = result.results
        .filter((row) => row.reason !== null)
        .map((row) => row.vuosi);
      if (skippedYears.length > 0) {
        setInfo(
          t(
            'v2Overview.excludeYearsBulkPartial',
            'Rajattiin {{excluded}} vuosi/vuotta pois suunnitelmasta. {{skipped}} vuosi/vuotta oli jo rajattu: {{years}}.',
            {
              excluded: result.excludedCount,
              skipped: result.alreadyExcludedCount,
              years: skippedYears.join(', '),
            },
          ),
        );
      } else {
        setInfo(
          t(
            'v2Overview.excludeYearsBulkDone',
            'Vuodet rajattiin pois suunnitelmasta: {{count}}.',
            { count: result.excludedCount },
          ),
        );
      }
      setSelectedYearsForDelete([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.excludeYearsBulkFailed',
              'Valittujen vuosien rajaaminen pois suunnitelmasta epäonnistui.',
            ),
      );
    } finally {
      setBulkDeletingYears(false);
    }
  }, [selectedYearsForDelete, loadOverview, t]);

  const handleBulkRestoreYears = React.useCallback(async () => {
    if (selectedYearsForRestore.length === 0) return;

    setBulkRestoringYears(true);
    setError(null);
    setInfo(null);

    try {
      const result = await restoreImportYearsV2(selectedYearsForRestore);
      const notRestored = result.results.filter((row) => !row.restored);
      if (notRestored.length > 0) {
        setInfo(
          t(
            'v2Overview.restoreYearsBulkPartial',
            'Restored {{restored}} year(s). {{missing}} year(s) were not excluded.',
            {
              restored: result.restoredCount,
              missing: result.notExcludedCount,
            },
          ),
        );
      } else {
        setInfo(
          t('v2Overview.restoreYearsBulkDone', 'Restored {{count}} year(s).', {
            count: result.restoredCount,
          }),
        );
      }
      setSelectedYearsForRestore([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.restoreYearsBulkFailed',
              'Failed to restore selected years.',
            ),
      );
    } finally {
      setBulkRestoringYears(false);
    }
  }, [selectedYearsForRestore, loadOverview, t]);

  const searchTerm = query.trim();

  const renderHighlightedSearchMatch = React.useCallback(
    (value: string): React.ReactNode => {
      if (searchTerm.length < 2) return value;
      const matcher = new RegExp(`(${escapeRegExp(searchTerm)})`, 'ig');
      const parts = value.split(matcher);
      return parts.map((part, index) => {
        if (part.toLowerCase() === searchTerm.toLowerCase()) {
          return (
            <mark className="v2-search-mark" key={`${value}-${index}`}>
              {part}
            </mark>
          );
        }
        return (
          <React.Fragment key={`${value}-${index}`}>{part}</React.Fragment>
        );
      });
    },
    [searchTerm],
  );

  const handleGuideBlockedYears = React.useCallback(() => {
    document.getElementById('v2-import-years')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const populateManualEditorFromYearData = React.useCallback(
    (yearData: V2ImportYearDataResponse) => {
      setManualFinancials(buildFinancialForm(yearData));
      setManualPrices(buildPriceForm(yearData));
      setManualVolumes(buildVolumeForm(yearData));
      setManualInvestments(buildInvestmentForm(yearData));
      setManualEnergy(buildEnergyForm(yearData));
      setManualNetwork(buildNetworkForm(yearData));

      const latestReason = yearData.datasets
        .map((row) => row.overrideMeta?.reason ?? '')
        .find((reason) => reason.length > 0);
      setManualReason(latestReason ?? '');
    },
    [],
  );

  const loadYearIntoManualEditor = React.useCallback(
    async (year: number) => {
      setLoadingYearData(year);
      try {
        const yearData = await getImportYearDataV2(year);
        setYearDataCache((prev) => ({ ...prev, [year]: yearData }));
        populateManualEditorFromYearData(yearData);
      } catch (err) {
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchLoadFailed',
                'Failed to load year data for editing.',
              ),
        );
      } finally {
        setLoadingYearData(null);
      }
    },
    [populateManualEditorFromYearData, t],
  );

  const openManualPatchDialog = React.useCallback(
    async (
      year: number,
      missing: MissingRequirement[],
      mode: ManualPatchMode = 'review',
    ) => {
      setCardEditContext(null);
      setCardEditYear(null);
      setCardEditFocusField(null);
      setManualPatchYear(year);
      setManualPatchMode(mode);
      setManualPatchMissing(missing);
      setManualPatchError(null);
      setManualReason('');
      setManualFinancials({
        liikevaihto: 0,
        aineetJaPalvelut: 0,
        henkilostokulut: 0,
        liiketoiminnanMuutKulut: 0,
        poistot: 0,
        arvonalentumiset: 0,
        rahoitustuototJaKulut: 0,
        tilikaudenYliJaama: 0,
        omistajatuloutus: 0,
        omistajanTukiKayttokustannuksiin: 0,
      });
      setManualPrices({ waterUnitPrice: 0, wastewaterUnitPrice: 0 });
      setManualVolumes({ soldWaterVolume: 0, soldWastewaterVolume: 0 });
      setManualInvestments({
        investoinninMaara: 0,
        korvausInvestoinninMaara: 0,
      });
      setManualEnergy({ prosessinKayttamaSahko: 0 });
      setManualNetwork({ verkostonPituus: 0 });
      setStatementImportError(null);
      setStatementImportStatus(null);
      setStatementImportPreview(null);
      setQdisImportError(null);
      setQdisImportStatus(null);
      setQdisImportPreview(null);
      if (statementFileInputRef.current) {
        statementFileInputRef.current.value = '';
      }
      if (qdisFileInputRef.current) {
        qdisFileInputRef.current.value = '';
      }

      await loadYearIntoManualEditor(year);
    },
    [loadYearIntoManualEditor],
  );

  const closeInlineCardEditor = React.useCallback(() => {
    if (
      manualPatchBusy ||
      statementImportBusy ||
      workbookImportBusy ||
      qdisImportBusy
    )
      return;
    setCardEditYear(null);
    setCardEditFocusField(null);
    setCardEditContext(null);
    setManualPatchYear(null);
    setManualPatchMode('review');
    setManualPatchMissing([]);
    setManualPatchError(null);
      setStatementImportError(null);
      setStatementImportStatus(null);
      setStatementImportPreview(null);
      setWorkbookImportError(null);
      setWorkbookImportStatus(null);
      setWorkbookImportPreview(null);
      setWorkbookImportSelections({});
      setQdisImportError(null);
      setQdisImportStatus(null);
      setQdisImportPreview(null);
      if (statementFileInputRef.current) {
        statementFileInputRef.current.value = '';
      }
      if (workbookFileInputRef.current) {
        workbookFileInputRef.current.value = '';
      }
      if (qdisFileInputRef.current) {
        qdisFileInputRef.current.value = '';
      }
  }, [
    manualPatchBusy,
    qdisImportBusy,
    statementImportBusy,
    workbookImportBusy,
  ]);
  const isInlineCardDirty = React.useMemo(() => {
    if (cardEditYear == null) return false;
    const originalYearData = yearDataCache[cardEditYear];
    if (!originalYearData) return false;

    const originalReason =
      originalYearData.datasets
        .map((row) => row.overrideMeta?.reason ?? '')
        .find((reason) => reason.length > 0) ?? '';

    return (
      formsDiffer(manualFinancials, buildFinancialForm(originalYearData)) ||
      formsDiffer(manualPrices, buildPriceForm(originalYearData)) ||
      formsDiffer(manualVolumes, buildVolumeForm(originalYearData)) ||
      formsDiffer(manualInvestments, buildInvestmentForm(originalYearData)) ||
      formsDiffer(manualEnergy, buildEnergyForm(originalYearData)) ||
      formsDiffer(manualNetwork, buildNetworkForm(originalYearData)) ||
      manualReason.trim() !== originalReason.trim()
    );
  }, [
    cardEditYear,
    manualEnergy,
    manualFinancials,
    manualInvestments,
    manualNetwork,
    manualPrices,
    manualReason,
    manualVolumes,
    yearDataCache,
  ]);

  const dismissInlineCardEditor = React.useCallback(
    (forceDiscard = false) => {
      if (!forceDiscard && isInlineCardDirty) {
        setManualPatchError(
          t(
            'v2Overview.inlineCardDirtyGuard',
            'Save or cancel this year before moving to another card.',
          ),
        );
        return false;
      }
      closeInlineCardEditor();
      return true;
    },
    [closeInlineCardEditor, isInlineCardDirty, t],
  );

  const openInlineCardEditor = React.useCallback(
    async (
      year: number,
      focusField: InlineCardField | null = null,
      context: 'step2' | 'step3' = 'step2',
      missing: MissingRequirement[] = [],
      mode: ManualPatchMode = context === 'step3' ? 'review' : 'manualEdit',
    ) => {
      let resolvedFocusField = focusField;
      if (context === 'step2' && resolvedFocusField == null) {
        if (missing.includes('financials')) {
          const summaryRows = buildImportYearSummaryRows(yearDataCache[year]);
          const firstMissingFinancialRow = IMPORT_BOARD_CANON_ROWS.find((item) => {
            const summaryRow = summaryRows.find((row) => row.key === item.key);
            return summaryRow?.effectiveValue == null;
          });
          resolvedFocusField = firstMissingFinancialRow
            ? CARD_SUMMARY_FIELD_TO_INLINE_FIELD[firstMissingFinancialRow.key]
            : 'aineetJaPalvelut';
        } else if (missing.includes('prices')) {
          const priceRows = getEffectiveRows(yearDataCache[year], 'taksa');
          const hasWaterPrice = priceRows.some(
            (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
          );
          const hasWastewaterPrice = priceRows.some(
            (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
          );
          resolvedFocusField = !hasWaterPrice
            ? 'waterUnitPrice'
            : hasWastewaterPrice
              ? 'waterUnitPrice'
              : 'wastewaterUnitPrice';
        } else if (missing.includes('volumes')) {
          const waterVolumeRow = getEffectiveFirstRow(
            yearDataCache[year],
            'volume_vesi',
          );
          const wastewaterVolumeRow = getEffectiveFirstRow(
            yearDataCache[year],
            'volume_jatevesi',
          );
          resolvedFocusField =
            Object.keys(waterVolumeRow).length === 0
              ? 'soldWaterVolume'
              : Object.keys(wastewaterVolumeRow).length === 0
                ? 'soldWastewaterVolume'
                : 'soldWaterVolume';
        } else {
          resolvedFocusField = 'aineetJaPalvelut';
        }
      }
      setManualPatchYear(context === 'step3' ? year : null);
      setCardEditYear(year);
      setCardEditFocusField(resolvedFocusField);
      setCardEditContext(context);
      setManualPatchMode(mode);
      setManualPatchMissing(missing);
      setManualPatchError(null);
      setStatementImportError(null);
      setStatementImportStatus(null);
      setStatementImportPreview(null);
      setWorkbookImportError(null);
      setWorkbookImportStatus(null);
      setWorkbookImportPreview(null);
      setWorkbookImportSelections({});
      if (workbookFileInputRef.current) {
        workbookFileInputRef.current.value = '';
      }
      if (statementFileInputRef.current) {
        statementFileInputRef.current.value = '';
      }

      const cachedYearData = yearDataCache[year];
      if (cachedYearData) {
        populateManualEditorFromYearData(cachedYearData);
        return;
      }
      await loadYearIntoManualEditor(year);
    },
    [loadYearIntoManualEditor, populateManualEditorFromYearData, yearDataCache],
  );
  const attemptOpenInlineCardEditor = React.useCallback(
    async (
      year: number,
      focusField: InlineCardField | null = null,
      context: 'step2' | 'step3' = 'step2',
      missing: MissingRequirement[] = [],
      mode: ManualPatchMode = context === 'step3' ? 'review' : 'manualEdit',
    ) => {
      if (
        cardEditYear != null &&
        cardEditYear !== year &&
        !dismissInlineCardEditor()
      ) {
        return;
      }
      await openInlineCardEditor(year, focusField, context, missing, mode);
    },
    [cardEditYear, dismissInlineCardEditor, openInlineCardEditor],
  );
  const resolveRepairFocusField = React.useCallback(
    (year: number, target: 'prices' | 'volumes'): InlineCardField => {
      const yearData = yearDataCache[year];
      if (target === 'prices') {
        const priceRows = getEffectiveRows(yearData, 'taksa');
        const hasWaterPrice = priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
        );
        if (!hasWaterPrice) {
          return 'waterUnitPrice';
        }
        const hasWastewaterPrice = priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
        );
        return hasWastewaterPrice ? 'waterUnitPrice' : 'wastewaterUnitPrice';
      }
      const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
      if (Object.keys(waterVolumeRow).length === 0) {
        return 'soldWaterVolume';
      }
      const wastewaterVolumeRow = getEffectiveFirstRow(
        yearData,
        'volume_jatevesi',
      );
      return Object.keys(wastewaterVolumeRow).length === 0
        ? 'soldWastewaterVolume'
        : 'soldWaterVolume';
    },
    [yearDataCache],
  );
  const buildRepairActions = React.useCallback(
    (year: number, missingRequirements: MissingRequirement[]) => {
      const yearData = yearDataCache[year];
      const priceRows = getEffectiveRows(yearData, 'taksa');
      const hasMissingPrices =
        missingRequirements.includes('prices') ||
        !priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
        ) ||
        !priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
        );
      const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
      const wastewaterVolumeRow = getEffectiveFirstRow(
        yearData,
        'volume_jatevesi',
      );
      const hasMissingVolumes =
        missingRequirements.includes('volumes') ||
        Object.keys(waterVolumeRow).length === 0 ||
        Object.keys(wastewaterVolumeRow).length === 0;
      const actions: Array<{
        key: 'prices' | 'volumes';
        label: string;
        focusField: InlineCardField;
      }> = [];
      if (hasMissingPrices) {
        actions.push({
          key: 'prices',
          label: t('v2Overview.repairPricesButton', 'Repair prices'),
          focusField: resolveRepairFocusField(year, 'prices'),
        });
      }
      if (hasMissingVolumes) {
        actions.push({
          key: 'volumes',
          label: t('v2Overview.repairVolumesButton', 'Repair volumes'),
          focusField: resolveRepairFocusField(year, 'volumes'),
        });
      }
      return actions;
    },
    [resolveRepairFocusField, t],
  );

  React.useEffect(() => {
    if (cardEditYear == null || cardEditFocusField == null) return;
    if (loadingYearData === cardEditYear) return;
    const field = cardEditFocusField;
    const timer = window.setTimeout(() => {
      const input = inlineCardFieldRefs.current[field];
      input?.focus();
      input?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cardEditFocusField, cardEditYear, loadingYearData]);

  const resetManualPatchDialog = React.useCallback(() => {
    setManualPatchYear(null);
    setCardEditYear(null);
    setCardEditFocusField(null);
    setCardEditContext(null);
    setReviewContinueStep(null);
    setManualPatchMode('review');
    setManualPatchMissing([]);
    setManualPatchError(null);
    setManualReason('');
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    setWorkbookImportError(null);
    setWorkbookImportStatus(null);
    setWorkbookImportPreview(null);
    setWorkbookImportSelections({});
    setQdisImportError(null);
    setQdisImportStatus(null);
    setQdisImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
    if (workbookFileInputRef.current) {
      workbookFileInputRef.current.value = '';
    }
    if (qdisFileInputRef.current) {
      qdisFileInputRef.current.value = '';
    }
  }, []);

  const closeManualPatchDialog = React.useCallback(() => {
    if (manualPatchBusy || statementImportBusy || workbookImportBusy) return;
    resetManualPatchDialog();
  }, [
    manualPatchBusy,
    resetManualPatchDialog,
    statementImportBusy,
    workbookImportBusy,
  ]);

  const applyOcrFinancialMatch = React.useCallback(
    (match: StatementOcrMatch) => {
      const normalizedValue = normalizeStatementOcrFieldValue(
        match.key,
        match.value,
      );
      setManualFinancials((prev) => {
        switch (match.key) {
          case 'liikevaihto':
            return { ...prev, liikevaihto: normalizedValue ?? 0 };
          case 'henkilostokulut':
            return { ...prev, henkilostokulut: normalizedValue ?? 0 };
          case 'liiketoiminnanMuutKulut':
            return {
              ...prev,
              liiketoiminnanMuutKulut: normalizedValue ?? 0,
            };
          case 'poistot':
            return { ...prev, poistot: normalizedValue ?? 0 };
          case 'rahoitustuototJaKulut':
            return { ...prev, rahoitustuototJaKulut: normalizedValue ?? 0 };
          case 'tilikaudenYliJaama':
            return { ...prev, tilikaudenYliJaama: normalizedValue ?? 0 };
          default:
            return prev;
        }
      });
    },
    [],
  );

  const handleWorkbookSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setWorkbookImportBusy(true);
      setWorkbookImportError(null);
      setWorkbookImportPreview(null);
      setWorkbookImportSelections({});
      setWorkbookImportStatus(
        t(
          'v2Overview.workbookImportStarting',
          'Preparing workbook comparison from the uploaded Excel file...',
        ),
      );

      try {
        const preview = await previewWorkbookImportV2(file);
        if (!manualReason.trim()) {
          setManualReason(
            t(
              'v2Overview.workbookImportReasonDefault',
              'Imported from KVA workbook: {{fileName}}',
              { fileName: preview.document.fileName },
            ),
          );
        }
        setWorkbookImportPreview(preview);
        setWorkbookImportSelections(
          Object.fromEntries(
            preview.years.map((year) => [
              year.year,
              Object.fromEntries(
                year.rows.map((row) => [row.sourceField, row.suggestedAction]),
              ),
            ]),
          ),
        );

        const missingYears = preview.matchedYears.filter(
          (year) => yearDataCache[year] == null,
        );
        if (missingYears.length > 0) {
          const loadedYears = await Promise.all(
            missingYears.map(async (year) => [year, await getImportYearDataV2(year)] as const),
          );
          setYearDataCache((prev) => ({
            ...prev,
            ...Object.fromEntries(loadedYears),
          }));
        }

        setWorkbookImportStatus(
          t(
            'v2Overview.workbookImportDone',
            'Workbook comparison is ready. Review the matched years and choose which values to keep before saving.',
          ),
        );
      } catch (err) {
        setWorkbookImportError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.workbookImportFailed',
                'Workbook import preview failed.',
              ),
        );
        setWorkbookImportStatus(null);
      } finally {
        setWorkbookImportBusy(false);
      }
    },
    [manualReason, t, yearDataCache],
  );

  const handleStatementPdfSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || manualPatchYear == null) return;

      setStatementImportBusy(true);
      setStatementImportError(null);
      setStatementImportPreview(null);
      setStatementImportStatus(
        t(
          'v2Overview.statementImportStarting',
          'Preparing OCR import for the uploaded statement PDF...',
        ),
      );

      try {
        const result = await extractStatementFromPdf(file, (message) => {
          setStatementImportStatus(message);
        });
        for (const match of result.matches) {
          applyOcrFinancialMatch(match);
        }

        if (!manualReason.trim()) {
          setManualReason(
            t(
              'v2Overview.statementImportReasonDefault',
              'Imported from statement PDF: {{fileName}}',
              { fileName: result.fileName },
            ),
          );
        }

        setStatementImportPreview({
          fileName: result.fileName,
          pageNumber: result.pageNumber,
          confidence: result.confidence,
          scannedPageCount: result.scannedPageCount,
          fields: result.fields,
          matches: result.matches,
          warnings: result.warnings,
        });
        setStatementImportStatus(
          t(
            'v2Overview.statementImportDone',
            'OCR import finished. Review the prefilled values before saving.',
          ),
        );
        sendV2OpsEvent({
          event: 'statement_pdf_ocr',
          status: 'ok',
          attrs: {
            year: manualPatchYear,
            fileName: result.fileName,
            detectedPage: result.pageNumber,
            mappedFieldCount: result.matches.length,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.statementImportFailed',
                'Statement OCR import failed.',
              );
        setStatementImportError(message);
        setStatementImportStatus(null);
        sendV2OpsEvent({
          event: 'statement_pdf_ocr',
          status: 'error',
          attrs: {
            year: manualPatchYear,
            fileName: file.name,
          },
        });
      } finally {
        setStatementImportBusy(false);
      }
    },
    [applyOcrFinancialMatch, manualPatchYear, manualReason, t],
  );

  const handleQdisPdfSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || manualPatchYear == null) return;

      setQdisImportBusy(true);
      setQdisImportError(null);
      setQdisImportPreview(null);
      setQdisImportStatus(
        t(
          'v2Overview.qdisImportStarting',
          'Preparing QDIS import for the uploaded PDF...',
        ),
      );

      try {
        const result = await extractQdisFromPdf(file, (message) => {
          setQdisImportStatus(message);
        });

        setManualPrices((prev) => ({
          waterUnitPrice:
            result.fields.waterUnitPrice ?? prev.waterUnitPrice,
          wastewaterUnitPrice:
            result.fields.wastewaterUnitPrice ?? prev.wastewaterUnitPrice,
        }));
        setManualVolumes((prev) => ({
          soldWaterVolume:
            result.fields.soldWaterVolume ?? prev.soldWaterVolume,
          soldWastewaterVolume:
            result.fields.soldWastewaterVolume ?? prev.soldWastewaterVolume,
        }));

        if (!manualReason.trim()) {
          setManualReason(
            t(
              'v2Overview.qdisImportReasonDefault',
              'Imported from QDIS PDF: {{fileName}}',
              { fileName: result.fileName },
            ),
          );
        }

        setQdisImportPreview({
          fileName: result.fileName,
          pageNumber: result.pageNumber,
          confidence: result.confidence,
          scannedPageCount: result.scannedPageCount,
          fields: result.fields,
          matches: result.matches,
          warnings: result.warnings,
        });
        setQdisImportStatus(
          t(
            'v2Overview.qdisImportDone',
            'QDIS import finished. Review the detected prices and volumes before saving.',
          ),
        );
        sendV2OpsEvent({
          event: 'qdis_pdf_import',
          status: 'ok',
          attrs: {
            year: manualPatchYear,
            fileName: result.fileName,
            detectedPage: result.pageNumber,
            mappedFieldCount: result.matches.length,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.qdisImportFailed',
                'QDIS PDF import failed.',
              );
        setQdisImportError(message);
        setQdisImportStatus(null);
        sendV2OpsEvent({
          event: 'qdis_pdf_import',
          status: 'error',
          attrs: {
            year: manualPatchYear,
            fileName: file.name,
          },
        });
      } finally {
        setQdisImportBusy(false);
      }
    },
    [manualPatchYear, manualReason, t],
  );

  const buildManualPatchPayload = React.useCallback(
    (year: number): V2ManualYearPatchPayload | null => {
      if (manualFinancials.liikevaihto < 0) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchFinancialsRequired',
            'Revenue (Liikevaihto) cannot be negative.',
          ),
        );
        return null;
      }

      const originalYearData = yearDataCache[year];
      const originalFinancials = buildFinancialForm(originalYearData);
      const originalPrices = buildPriceForm(originalYearData);
      const originalVolumes = buildVolumeForm(originalYearData);
      const originalInvestments = buildInvestmentForm(originalYearData);
      const originalEnergy = buildEnergyForm(originalYearData);
      const originalNetwork = buildNetworkForm(originalYearData);

      const payload: V2ManualYearPatchPayload = {
        year,
        reason: manualReason.trim() || undefined,
      };

      const shouldPersistStatementImport =
        manualPatchMode === 'statementImport' && statementImportPreview != null;
      const shouldPersistQdisImport =
        manualPatchMode === 'qdisImport' && qdisImportPreview != null;

      if (
        formsDiffer(manualFinancials, originalFinancials) ||
        shouldPersistStatementImport
      ) {
        payload.financials = { ...manualFinancials };
      }
      if (formsDiffer(manualPrices, originalPrices) || shouldPersistQdisImport) {
        payload.prices = { ...manualPrices };
      }
      if (formsDiffer(manualVolumes, originalVolumes) || shouldPersistQdisImport) {
        payload.volumes = { ...manualVolumes };
      }
      if (formsDiffer(manualInvestments, originalInvestments)) {
        payload.investments = { ...manualInvestments };
      }
      if (formsDiffer(manualEnergy, originalEnergy)) {
        payload.energy = { ...manualEnergy };
      }
      if (formsDiffer(manualNetwork, originalNetwork)) {
        payload.network = { ...manualNetwork };
      }
      if (payload.financials && shouldPersistStatementImport) {
        payload.statementImport = {
          fileName: statementImportPreview.fileName,
          pageNumber: statementImportPreview.pageNumber ?? undefined,
          confidence: statementImportPreview.confidence ?? undefined,
          scannedPageCount: statementImportPreview.scannedPageCount,
          matchedFields: statementImportPreview.matches.map((item) => item.key),
          warnings: statementImportPreview.warnings,
        };
      }
      if ((payload.prices || payload.volumes) && shouldPersistQdisImport) {
        payload.qdisImport = {
          fileName: qdisImportPreview.fileName,
          pageNumber: qdisImportPreview.pageNumber ?? undefined,
          confidence: qdisImportPreview.confidence ?? undefined,
          scannedPageCount: qdisImportPreview.scannedPageCount,
          matchedFields: qdisImportPreview.matches.map((item) => item.key),
          warnings: qdisImportPreview.warnings,
        };
      }

      if (
        !payload.financials &&
        !payload.prices &&
        !payload.volumes &&
        !payload.investments &&
        !payload.energy &&
        !payload.network
      ) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchNoChanges',
            'No changes detected. Update at least one field before saving.',
          ),
        );
        return null;
      }

      return payload;
    },
    [
      manualEnergy,
      manualFinancials,
      manualInvestments,
      manualNetwork,
      manualPatchMode,
      manualPrices,
      manualReason,
      manualVolumes,
      qdisImportPreview,
      statementImportPreview,
      t,
      yearDataCache,
    ],
  );

  const buildWorkbookImportPayloads = React.useCallback(() => {
    if (!workbookImportPreview) {
      setManualPatchError(
        t(
          'v2Overview.workbookImportNoPreview',
          'Upload the KVA workbook and review the comparison before saving workbook choices.',
        ),
      );
      return null;
    }

    const payloads: Array<{ year: number; payload: V2ManualYearPatchPayload }> = [];
    for (const year of workbookImportPreview.years) {
      const candidateRows = year.rows
        .filter((row) => row.workbookValue != null)
        .map((row) => ({
          sourceField: row.sourceField,
          workbookValue: row.workbookValue,
          action:
            workbookImportSelections[year.year]?.[row.sourceField] ??
            row.suggestedAction,
        }));
      const confirmedRows = candidateRows.filter(
        (row) => row.action === 'apply_workbook' && row.workbookValue != null,
      );
      if (confirmedRows.length === 0) {
        continue;
      }

      const financials: NonNullable<V2ManualYearPatchPayload['financials']> = {};
      for (const row of confirmedRows) {
        financials[WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY[row.sourceField]] =
          row.workbookValue ?? undefined;
      }

      payloads.push({
        year: year.year,
        payload: {
          year: year.year,
          reason:
            manualReason.trim() ||
            t(
              'v2Overview.workbookImportReasonDefault',
              'Imported from KVA workbook: {{fileName}}',
              { fileName: workbookImportPreview.document.fileName },
            ),
          financials,
          workbookImport: {
            kind: 'kva_import',
            fileName: workbookImportPreview.document.fileName,
            sheetName: workbookImportPreview.sheetName,
            matchedYears: workbookImportPreview.matchedYears,
            matchedFields: candidateRows.map((row) => row.sourceField),
            confirmedSourceFields: confirmedRows.map((row) => row.sourceField),
            candidateRows,
            warnings: [],
          },
        },
      });
    }

    if (payloads.length === 0) {
      setManualPatchError(
        t(
          'v2Overview.workbookImportNoSelection',
          'Choose at least one workbook value to apply before saving workbook choices.',
        ),
      );
      return null;
    }

    return {
      payloads,
      matchedYears: workbookImportPreview.matchedYears,
      yearsToSync: payloads.map((item) => item.year),
    };
  }, [manualReason, t, workbookImportPreview, workbookImportSelections]);

  const submitWorkbookImport = React.useCallback(
    async (syncAfterSave: boolean) => {
      const built = buildWorkbookImportPayloads();
      if (!built) return;

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const results = await Promise.all(
          built.payloads.map((item) => completeImportYearManuallyV2(item.payload)),
        );
        const syncedYears = results
          .filter((result) => result.syncReady)
          .map((result) => result.year);
        const reviewedYears = built.matchedYears;
        const reviewedYearSet = new Set(reviewedYears);
        const nextRows = reviewStatusRows.map((row) => ({
          year: row.year,
          setupStatus: reviewedYearSet.has(row.year)
            ? ('reviewed' as const)
            : row.setupStatus,
          missingRequirements: row.missingRequirements,
        }));
        const nextQueueYear = resolveNextReviewQueueYear(nextRows);
        const nextQueueRow =
          nextQueueYear == null
            ? null
            : nextRows.find((row) => row.year === nextQueueYear) ?? null;

        setReviewedImportedYears(
          markPersistedReviewedImportYears(
            reviewStorageOrgId,
            reviewedYears,
            [...confirmedImportedYears, ...reviewedYears],
          ),
        );
        setYearDataCache((prev) => {
          const next = { ...prev };
          for (const year of built.yearsToSync) {
            delete next[year];
          }
          return next;
        });

        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            years: built.yearsToSync.join(','),
            syncReadyCount: syncedYears.length,
            patchedYearCount: built.payloads.length,
          },
        });

        if (syncAfterSave && syncedYears.length > 0) {
          await runSync(syncedYears);
        } else {
          await loadOverview();
          setInfo(
            t(
              'v2Overview.workbookImportSaved',
              'Workbook choices saved for {{count}} year(s).',
              { count: built.payloads.length },
            ),
          );
        }

        if (cardEditContext === 'step3' && nextQueueRow) {
          await openInlineCardEditor(
            nextQueueRow.year,
            null,
            'step3',
            nextQueueRow.missingRequirements,
          );
          return;
        }

        if (cardEditContext === 'step3') {
          closeInlineCardEditor();
            setReviewContinueStep(baselineReady ? 6 : 5);
          return;
        }

        if (nextQueueRow) {
          resetManualPatchDialog();
          await openManualPatchDialog(
            nextQueueRow.year,
            nextQueueRow.missingRequirements,
            'review',
          );
          return;
        }

        if (syncedYears.length > 0) {
          setReviewContinueStep(baselineReady ? 6 : 5);
        }
        resetManualPatchDialog();
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            syncAfterSave,
            mode: 'workbookImport',
          },
        });
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.workbookImportApplyFailed',
                'Applying workbook choices failed.',
              ),
        );
      } finally {
        setManualPatchBusy(false);
      }
    },
    [
      buildWorkbookImportPayloads,
      cardEditContext,
      closeInlineCardEditor,
      confirmedImportedYears,
      loadOverview,
      openInlineCardEditor,
      openManualPatchDialog,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      runSync,
      t,
    ],
  );

  const submitManualPatch = React.useCallback(
    async (syncAfterSave: boolean) => {
      if (manualPatchYear == null) return;
      const payload = buildManualPatchPayload(manualPatchYear);
      if (!payload) return;

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const currentYear = manualPatchYear;
        const result = await completeImportYearManuallyV2(payload);
        const reopenCurrentYearForFollowup =
          manualPatchMode === 'statementImport' && result.syncReady;
        const nextRows = reviewStatusRows.map((row) => ({
          year: row.year,
          setupStatus:
            row.year === currentYear && result.syncReady && !reopenCurrentYearForFollowup
              ? ('reviewed' as const)
              : row.setupStatus,
          missingRequirements: row.missingRequirements,
        }));
        const nextQueueYear = result.syncReady
          ? resolveNextReviewQueueYear(nextRows)
          : null;
        const nextQueueRow =
          nextQueueYear == null
            ? null
            : nextRows.find((row) => row.year === nextQueueYear) ?? null;
        if (!reopenCurrentYearForFollowup) {
          setReviewedImportedYears(
            markPersistedReviewedImportYears(
              reviewStorageOrgId,
              [currentYear],
              [...confirmedImportedYears, currentYear],
            ),
          );
        }
        setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[currentYear];
          return next;
        });
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            year: currentYear,
            syncReady: result.syncReady,
            patchedDataTypeCount: result.patchedDataTypes.length,
          },
        });
        if (syncAfterSave && result.syncReady) {
          await runSync([currentYear]);
        } else {
          await loadOverview();
          setInfo(t('v2Overview.manualPatchSaved', { year: currentYear }));
        }
        if (reopenCurrentYearForFollowup) {
          resetManualPatchDialog();
          await openInlineCardEditor(
            currentYear,
            null,
            'step3',
            manualPatchMissing,
          );
          return;
        }
        if (nextQueueRow) {
          resetManualPatchDialog();
          await openManualPatchDialog(
            nextQueueRow.year,
            nextQueueRow.missingRequirements,
            'review',
          );
          return;
        }
        if (result.syncReady) {
          setReviewContinueStep(baselineReady ? 6 : 5);
        }
        setManualPatchYear(null);
        setManualPatchMissing([]);
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            year: manualPatchYear,
            syncAfterSave,
          },
        });
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchFailed',
                'Manual year completion failed.',
              ),
        );
      } finally {
        setManualPatchBusy(false);
      }
    },
    [
      buildManualPatchPayload,
      loadOverview,
      manualPatchMissing,
      manualPatchMode,
      manualPatchYear,
      statementImportPreview,
      runSync,
      confirmedImportedYears,
      openManualPatchDialog,
      openInlineCardEditor,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      t,
    ],
  );

  const saveInlineCardEdit = React.useCallback(async (syncAfterSave = false) => {
    if (cardEditYear == null) return;
    const payload = buildManualPatchPayload(cardEditYear);
    if (!payload) return;

    setManualPatchBusy(true);
    setManualPatchError(null);
    setError(null);
    setInfo(null);
    try {
      const currentYear = cardEditYear;
      const result = await completeImportYearManuallyV2(payload);
      const reopenCurrentYearForFollowup =
        manualPatchMode === 'statementImport' &&
        cardEditContext === 'step3' &&
        result.syncReady;
      const nextRows = reviewStatusRows.map((row) => ({
        year: row.year,
        setupStatus:
          row.year === currentYear && result.syncReady && !reopenCurrentYearForFollowup
            ? ('reviewed' as const)
            : row.setupStatus,
        missingRequirements: row.missingRequirements,
      }));
      const nextQueueYear = result.syncReady
        ? resolveNextReviewQueueYear(nextRows)
        : null;
      const nextQueueRow =
        nextQueueYear == null
          ? null
          : nextRows.find((row) => row.year === nextQueueYear) ?? null;
      if (result.syncReady && !reopenCurrentYearForFollowup) {
        setReviewedImportedYears(
          markPersistedReviewedImportYears(
            reviewStorageOrgId,
            [currentYear],
            [...confirmedImportedYears, currentYear],
          ),
        );
      }
      if (syncAfterSave && result.syncReady) {
        await runSync([currentYear]);
      } else {
        const refreshedYearData = await getImportYearDataV2(currentYear);
        setYearDataCache((prev) => ({ ...prev, [currentYear]: refreshedYearData }));
        populateManualEditorFromYearData(refreshedYearData);
        await loadOverview({
          preserveVisibleState: true,
          refreshPlanningContext: false,
          skipSecondaryLoads: true,
        });
        setCardEditYear(currentYear);
      }
      if (reopenCurrentYearForFollowup) {
        await openInlineCardEditor(currentYear, null, 'step3', manualPatchMissing);
      } else if (cardEditContext === 'step3' && result.syncReady) {
        if (nextQueueRow) {
          await openInlineCardEditor(
            nextQueueRow.year,
            null,
            'step3',
            nextQueueRow.missingRequirements,
          );
        } else {
          closeInlineCardEditor();
          setReviewContinueStep(baselineReady ? 6 : 5);
        }
      } else {
        setCardEditYear(currentYear);
      }
      setInfo(
        syncAfterSave && result.syncReady
          ? t('v2Overview.manualPatchSaved', { year: currentYear })
          : t('v2Overview.manualPatchSaved', { year: currentYear }),
      );
      sendV2OpsEvent({
        event: 'veeti_manual_patch',
        status: 'ok',
        attrs: {
          year: currentYear,
          syncReady: result.syncReady,
          patchedDataTypeCount: result.patchedDataTypes.length,
          surface: cardEditContext === 'step3' ? 'review_card' : 'step2_card',
        },
      });
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_manual_patch',
        status: 'error',
        attrs: {
          year: cardEditYear,
          surface: cardEditContext === 'step3' ? 'review_card' : 'step2_card',
        },
      });
      setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.manualPatchFailed',
              'Manual year completion failed.',
            ),
      );
    } finally {
      setManualPatchBusy(false);
    }
  }, [
      buildManualPatchPayload,
      cardEditContext,
      cardEditYear,
      closeInlineCardEditor,
      confirmedImportedYears,
      loadOverview,
      manualPatchMissing,
      manualPatchMode,
      openInlineCardEditor,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
    populateManualEditorFromYearData,
    resolveNextReviewQueueYear,
    reviewStatusRows,
    reviewStorageOrgId,
    runSync,
    t,
  ]);
  const handleInlineCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissInlineCardEditor(true);
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA') return;
        event.preventDefault();
        void saveInlineCardEdit(false);
      }
    },
    [dismissInlineCardEditor, saveInlineCardEdit],
  );
  const renderStep2InlineFieldEditor = (field: InlineCardField) => {
    const actionButtons = (
      <div className="v2-inline-field-editor-actions">
        <button
          type="button"
          className="v2-btn v2-btn-small v2-btn-primary"
          onClick={() => void saveInlineCardEdit(false)}
          disabled={manualPatchBusy}
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : t('v2Overview.manualPatchSave', 'Save year data')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() => dismissInlineCardEditor(true)}
          disabled={manualPatchBusy}
        >
          {t('common.close', 'Close')}
        </button>
      </div>
    );

    const wrapEditor = (children: React.ReactNode) => (
      <div
        className="v2-inline-field-editor"
        onKeyDown={handleInlineCardKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
        {actionButtons}
      </div>
    );

    switch (field) {
      case 'liikevaihto':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)')}
            </span>
            <input
              ref={setInlineCardFieldRef('liikevaihto')}
              name={`inline-liikevaihto-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.liikevaihto}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  liikevaihto: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'aineetJaPalvelut':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialMaterials', 'Materials and services')}
            </span>
            <input
              ref={setInlineCardFieldRef('aineetJaPalvelut')}
              name={`inline-aineetJaPalvelut-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.aineetJaPalvelut}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  aineetJaPalvelut: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'henkilostokulut':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialPersonnel', 'Personnel costs')}
            </span>
            <input
              ref={setInlineCardFieldRef('henkilostokulut')}
              name={`inline-henkilostokulut-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.henkilostokulut}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  henkilostokulut: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'poistot':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialDepreciation', 'Depreciation')}
            </span>
            <input
              ref={setInlineCardFieldRef('poistot')}
              name={`inline-poistot-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.poistot}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  poistot: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'liiketoiminnanMuutKulut':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualFinancialOtherOpex',
                'Other operating costs',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('liiketoiminnanMuutKulut')}
              name={`inline-liiketoiminnanMuutKulut-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.liiketoiminnanMuutKulut}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  liiketoiminnanMuutKulut: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'tilikaudenYliJaama':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualFinancialYearResult',
                'Year result (Tilikauden ylijäämä/alijäämä)',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('tilikaudenYliJaama')}
              name={`inline-tilikaudenYliJaama-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              step="0.01"
              value={manualFinancials.tilikaudenYliJaama}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  tilikaudenYliJaama: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'waterUnitPrice':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)')}
            </span>
            <input
              ref={setInlineCardFieldRef('waterUnitPrice')}
              name={`inline-waterUnitPrice-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.001"
              value={manualPrices.waterUnitPrice}
              onChange={(event) =>
                setManualPrices((prev) => ({
                  ...prev,
                  waterUnitPrice: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'wastewaterUnitPrice':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualPriceWastewater',
                'Wastewater unit price (EUR/m3)',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('wastewaterUnitPrice')}
              name={`inline-wastewaterUnitPrice-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.001"
              value={manualPrices.wastewaterUnitPrice}
              onChange={(event) =>
                setManualPrices((prev) => ({
                  ...prev,
                  wastewaterUnitPrice: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'soldWaterVolume':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
            </span>
            <input
              ref={setInlineCardFieldRef('soldWaterVolume')}
              name={`inline-soldWaterVolume-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="1"
              value={manualVolumes.soldWaterVolume}
              onChange={(event) =>
                setManualVolumes((prev) => ({
                  ...prev,
                  soldWaterVolume: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'soldWastewaterVolume':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualVolumeWastewater',
                'Sold wastewater volume (m3)',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('soldWastewaterVolume')}
              name={`inline-soldWastewaterVolume-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="1"
              value={manualVolumes.soldWastewaterVolume}
              onChange={(event) =>
                setManualVolumes((prev) => ({
                  ...prev,
                  soldWastewaterVolume: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
    }
  };

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => {
      if (status === 'VEETI') return t('v2Overview.sourceVeeti', 'VEETI');
      if (status === 'MANUAL') return t('v2Overview.sourceManual', 'Manual');
      if (status === 'MIXED') return t('v2Overview.sourceMixed', 'Mixed');
      return t('v2Overview.sourceIncomplete', 'Incomplete');
    },
    [t],
  );
  const sourceStatusClassName = React.useCallback((status: string | undefined) => {
    if (status === 'VEETI') return 'v2-status-info';
    if (status === 'INCOMPLETE') return 'v2-status-warning';
    return 'v2-status-provenance';
  }, []);

  const financialComparisonLabel = React.useCallback(
    (key: string) => {
      if (key === 'liikevaihto') {
        return t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)');
      }
      if (key === 'aineetJaPalvelut') {
        return t(
          'v2Overview.manualFinancialMaterials',
          'Materials and services',
        );
      }
      if (key === 'henkilostokulut') {
        return t('v2Overview.manualFinancialPersonnel', 'Personnel costs');
      }
      if (key === 'liiketoiminnanMuutKulut') {
        return t(
          'v2Overview.manualFinancialOtherOpex',
          'Other operating costs',
        );
      }
      if (key === 'poistot') {
        return t('v2Overview.manualFinancialDepreciation', 'Depreciation');
      }
      if (key === 'arvonalentumiset') {
        return t('v2Overview.manualFinancialWriteDowns', 'Impairments');
      }
      if (key === 'rahoitustuototJaKulut') {
        return t(
          'v2Overview.manualFinancialFinanceNet',
          'Net financing result',
        );
      }
      if (key === 'tilikaudenYliJaama') {
        return t('v2Overview.manualFinancialYearResult', 'Year result');
      }
      if (key === 'omistajatuloutus') {
        return t(
          'v2Overview.manualFinancialOwnerWithdrawal',
          'Owner withdrawal',
        );
      }
      return t(
        'v2Overview.manualFinancialOwnerSupport',
        'Owner support for operating costs',
      );
    },
    [t],
  );

  const provenanceHasKind = (
    provenance: V2OverrideProvenance | null | undefined,
    kinds: Array<V2OverrideProvenance['kind']>,
  ): boolean =>
    (provenance != null && kinds.includes(provenance.kind)) ||
    (provenance?.fieldSources?.some((item) =>
      kinds.includes(item.provenance.kind),
    ) ??
      false);

  const hasMixedStatementWorkbookProvenance = (
    provenance: V2OverrideProvenance | null | undefined,
  ): boolean =>
    provenanceHasKind(provenance, ['statement_import']) &&
    provenanceHasKind(provenance, ['kva_import', 'excel_import']);

  const datasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: V2OverrideProvenance | null | undefined,
    ) => {
      if (hasMixedStatementWorkbookProvenance(provenance)) {
        return t(
          'v2Overview.datasetSourceStatementWorkbookMixed',
          'Statement PDF + workbook repair',
        );
      }
      if (provenance?.kind === 'statement_import') {
        return t(
          'v2Overview.datasetSourceStatementImport',
          'Statement import ({{fileName}})',
          {
            fileName:
              provenance.fileName ??
              t('v2Overview.statementImportFallbackFile', 'bokslut PDF'),
          },
        );
      }
      if (provenance?.kind === 'qdis_import') {
        return t(
          'v2Overview.datasetSourceQdisImport',
          'QDIS PDF ({{fileName}})',
          {
            fileName: provenance.fileName ?? 'QDIS PDF',
          },
        );
      }
      if (
        provenance?.kind === 'kva_import' ||
        provenance?.kind === 'excel_import'
      ) {
        return t(
          'v2Overview.datasetSourceWorkbookImport',
          'Workbook import ({{fileName}})',
          {
            fileName: provenance.fileName ?? 'Excel workbook',
          },
        );
      }
      if (source === 'manual') {
        return t('v2Overview.sourceManual', 'Manual');
      }
      if (source === 'veeti') {
        return t('v2Overview.sourceVeeti', 'VEETI');
      }
      return t('v2Overview.sourceIncomplete', 'Incomplete');
    },
    [t],
  );

  const datasetTypeLabel = React.useCallback(
    (datasetType: string) => {
      if (datasetType === 'tilinpaatos') {
        return t('v2Overview.datasetFinancials', 'Financial statement');
      }
      if (datasetType === 'taksa') {
        return t('v2Overview.datasetPrices', 'Unit prices');
      }
      if (datasetType === 'volume_vesi') {
        return t('v2Overview.datasetWaterVolume', 'Sold water volume');
      }
      if (datasetType === 'volume_jatevesi') {
        return t(
          'v2Overview.datasetWastewaterVolume',
          'Sold wastewater volume',
        );
      }
      if (datasetType === 'investointi') {
        return t('v2Overview.datasetInvestments', 'Investments');
      }
      if (datasetType === 'energia') {
        return t('v2Overview.datasetEnergy', 'Process electricity');
      }
      if (datasetType === 'verkko') {
        return t('v2Overview.datasetNetwork', 'Network');
      }
      return datasetType;
    },
    [t],
  );

  const renderDatasetTypeList = React.useCallback(
    (dataTypes?: string[]) => {
      if (!dataTypes || dataTypes.length === 0) return '-';
      return dataTypes.map((item) => datasetTypeLabel(item)).join(', ');
    },
    [datasetTypeLabel],
  );

  const importWarningLabel = React.useCallback(
    (warning: string) => {
      if (warning === 'missing_financials') {
        return t(
          'v2Overview.yearWarningMissingFinancials',
          'Financial statement data is missing.',
        );
      }
      if (warning === 'missing_prices') {
        return t(
          'v2Overview.yearWarningMissingPrices',
          'Price data is missing.',
        );
      }
      if (warning === 'missing_volumes') {
        return t(
          'v2Overview.yearWarningMissingVolumes',
          'Sold volume data is missing.',
        );
      }
      return t(
        'v2Overview.yearWarningFallbackZero',
        'Missing VEETI values default to 0 in calculations.',
      );
    },
    [t],
  );

  const renderDatasetCounts = React.useCallback(
    (counts?: Record<string, number>) => {
      if (!counts) return '-';
      const orderedKeys = [
        'tilinpaatos',
        'taksa',
        'volume_vesi',
        'volume_jatevesi',
        'investointi',
        'energia',
        'verkko',
      ];
      const parts = orderedKeys
        .map((key) => ({ key, count: Number(counts[key] ?? 0) }))
        .filter((item) => item.count > 0)
        .map((item) => `${datasetTypeLabel(item.key)}: ${item.count}`);
      return parts.length > 0 ? parts.join(', ') : '-';
    },
    [datasetTypeLabel],
  );
  const loadYearPreviewData = React.useCallback(
    async (year: number) => {
      if (
        yearDataCache[year] ||
        previewFetchYearsRef.current.has(year)
      ) {
        return;
      }
      previewFetchYearsRef.current.add(year);
      try {
        const yearData = await getImportYearDataV2(year);
        setYearDataCache((prev) =>
          prev[year] ? prev : { ...prev, [year]: yearData },
        );
      } catch {
        // Preview cards fall back gracefully when data is unavailable.
      } finally {
        previewFetchYearsRef.current.delete(year);
      }
    },
    [yearDataCache],
  );
  const renderYearValuePreview = React.useCallback(
    (
      year: number,
      availability?: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
    ) => {
      const yearData = yearDataCache[year];
      const accountingSummary = buildImportYearSummaryRows(yearData);
      const accountingSummaryMap = new Map(
        accountingSummary.map((row) => [row.key, row]),
      );
      const prices = buildPriceForm(yearData);
      const volumes = buildVolumeForm(yearData);
      const hasFinancials =
        availability?.financials ?? accountingSummaryMap.size > 0;
      const hasPrices =
        availability?.prices ??
        (prices.waterUnitPrice > 0 || prices.wastewaterUnitPrice > 0);
      const hasVolumes =
        availability?.volumes ??
        (volumes.soldWaterVolume > 0 || volumes.soldWastewaterVolume > 0);
      const trustSignal = buildImportYearTrustSignal(yearData);
      const resultToZero = buildImportYearResultToZeroSignal(yearData);
      const sourceLayers = buildImportYearSourceLayers(yearData);
      const summaryLabel = (key: string) => {
        if (key === 'revenue') {
          return t('v2Overview.previewAccountingRevenueLabel', 'Revenue');
        }
        if (key === 'materialsCosts') {
          return t(
            'v2Overview.previewAccountingMaterialsLabel',
            'Materials and services',
          );
        }
        if (key === 'personnelCosts') {
          return t('v2Overview.previewAccountingPersonnelLabel', 'Personnel costs');
        }
        if (key === 'depreciation') {
          return t('v2Overview.previewAccountingDepreciationLabel', 'Depreciation');
        }
        if (key === 'otherOperatingCosts') {
          return t(
            'v2Overview.previewAccountingOtherOpexLabel',
            'Other operating costs',
          );
        }
        return t('v2Overview.previewAccountingResultLabel', 'Result');
      };
      const changedSummaryFields = trustSignal.changedSummaryKeys
        .map((key) => summaryLabel(key))
        .join(', ');
      const discrepancyNote =
        trustSignal.level === 'material'
          ? trustSignal.reasons.includes('statement_import')
            ? t(
                'v2Overview.yearTrustStatementImport',
                'Tilinpäätöskorjaus muutti VEETI-rivejä: {{fields}}.',
                {
                  fields: changedSummaryFields,
                },
              )
            : t(
                'v2Overview.yearTrustMaterialChange',
                'Korjattu vuosi poikkeaa VEETIstä riveissä: {{fields}}.',
                {
                  fields: changedSummaryFields,
                },
              )
          : null;
      const resultToZeroNote =
        resultToZero.direction === 'missing'
          ? null
          : t('v2Overview.yearResultToZeroSignal', 'Tulos / 0: {{value}}', {
              value:
                resultToZero.marginPct == null
                  ? formatEur(resultToZero.effectiveValue ?? 0)
                  : `${formatEur(
                      resultToZero.effectiveValue ?? 0,
                    )} (${formatNumber(Math.abs(resultToZero.marginPct))} %)`,
            });
      const renderAccountingPreviewItem = (
        key:
          | 'revenue'
          | 'materialsCosts'
          | 'personnelCosts'
          | 'depreciation'
          | 'otherOperatingCosts'
          | 'result',
        labelKey: string,
        defaultLabel: string,
      ) => {
        const summaryRow = accountingSummaryMap.get(key);
        const value = summaryRow?.effectiveValue ?? null;
        const missing = !hasFinancials || value == null;
        const zero = !missing && value === 0;
        return (
          <div
            className={`v2-year-preview-item ${missing ? 'missing' : ''} ${
              zero ? 'zero' : ''
            }`.trim()}
          >
            <span>{t(labelKey, defaultLabel)}</span>
            <strong
              className={`${missing ? 'v2-year-preview-missing' : ''} ${
                zero ? 'v2-year-preview-zero' : ''
              }`.trim()}
            >
              {missing
                ? t(
                    'v2Overview.previewVeetiMissingValue',
                    'VEETI did not provide this value',
                  )
                : formatEur(value)}
            </strong>
          </div>
        );
      };

      return (
        <>
          <div className="v2-year-preview-grid">
            {renderAccountingPreviewItem(
              'revenue',
              'v2Overview.previewAccountingRevenueLabel',
              'Revenue',
            )}
            {renderAccountingPreviewItem(
              'materialsCosts',
              'v2Overview.previewAccountingMaterialsLabel',
              'Materials and services',
            )}
            {renderAccountingPreviewItem(
              'personnelCosts',
              'v2Overview.previewAccountingPersonnelLabel',
              'Personnel costs',
            )}
            {renderAccountingPreviewItem(
              'depreciation',
              'v2Overview.previewAccountingDepreciationLabel',
              'Depreciation',
            )}
            {renderAccountingPreviewItem(
              'otherOperatingCosts',
              'v2Overview.previewAccountingOtherOpexLabel',
              'Other operating costs',
            )}
            {renderAccountingPreviewItem(
              'result',
              'v2Overview.previewAccountingResultLabel',
              'Result',
            )}
          </div>
          <div className="v2-year-preview-secondary">
            <span className="v2-year-preview-secondary-label">
              {t(
                'v2Overview.previewSecondaryLabel',
                'Secondary checks before import',
              )}
            </span>
            <div className="v2-year-preview-secondary-grid">
              <div
                className={`v2-year-preview-item secondary ${hasPrices ? '' : 'missing'} ${
                  hasPrices &&
                  prices.waterUnitPrice === 0 &&
                  prices.wastewaterUnitPrice === 0
                    ? 'zero'
                    : ''
                }`.trim()}
              >
                <span>{t('v2Overview.previewPricesLabel', 'Yksikköhinnat')}</span>
                <strong
                  className={`${hasPrices ? '' : 'v2-year-preview-missing'} ${
                    hasPrices &&
                    prices.waterUnitPrice === 0 &&
                    prices.wastewaterUnitPrice === 0
                      ? 'v2-year-preview-zero'
                      : ''
                  }`.trim()}
                >
                  {hasPrices
                    ? `${formatPrice(prices.waterUnitPrice)} / ${formatPrice(
                        prices.wastewaterUnitPrice,
                      )}`
                    : t(
                        'v2Overview.previewVeetiMissingValue',
                        'VEETI did not provide this value',
                      )}
                </strong>
              </div>
              <div
                className={`v2-year-preview-item secondary ${hasVolumes ? '' : 'missing'} ${
                  hasVolumes &&
                  volumes.soldWaterVolume === 0 &&
                  volumes.soldWastewaterVolume === 0
                    ? 'zero'
                    : ''
                }`.trim()}
              >
                <span>{t('v2Overview.previewVolumesLabel', 'Myydyt määrät')}</span>
                <strong
                  className={`${hasVolumes ? '' : 'v2-year-preview-missing'} ${
                    hasVolumes &&
                    volumes.soldWaterVolume === 0 &&
                    volumes.soldWastewaterVolume === 0
                      ? 'v2-year-preview-zero'
                      : ''
                  }`.trim()}
                >
                  {hasVolumes
                    ? `${formatNumber(volumes.soldWaterVolume)} / ${formatNumber(
                        volumes.soldWastewaterVolume,
                      )} m3`
                    : t(
                        'v2Overview.previewVeetiMissingValue',
                        'VEETI did not provide this value',
                      )}
                </strong>
              </div>
            </div>
          </div>
          <div className="v2-year-source-list">
            {sourceLayers.map((layer) => (
              <span key={`${year}-${layer.key}`} className="v2-year-source-pill">
                {sourceLayerText(layer)}
              </span>
            ))}
          </div>
          {discrepancyNote ? (
            <p
              className={
                trustSignal.level === 'material'
                  ? 'v2-year-readiness-missing'
                  : 'v2-muted'
              }
            >
              {discrepancyNote}
            </p>
          ) : null}
          {resultToZeroNote ? <p className="v2-muted">{resultToZeroNote}</p> : null}
        </>
      );
    },
    [t, yearDataCache],
  );

  const renderReviewValueSummary = React.useCallback(
    (
      year: number,
      availability: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
    ) => {
      const yearData = yearDataCache[year];
      const accountingSummary = buildImportYearSummaryRows(yearData);
      const summaryMap = new Map(accountingSummary.map((row) => [row.key, row]));
      const prices = buildPriceForm(yearData);
      const volumes = buildVolumeForm(yearData);
      const revenue = summaryMap.get('revenue')?.effectiveValue ?? null;
      const materials = summaryMap.get('materialsCosts')?.effectiveValue ?? null;
      const result = summaryMap.get('result')?.effectiveValue ?? null;

      const financialSummary =
        availability.financials && revenue != null && result != null
          ? `${t('v2Overview.previewAccountingRevenueLabel')}: ${formatEur(
              revenue,
            )} | ${t('v2Overview.previewAccountingMaterialsLabel')}: ${
              materials == null ? t('v2Overview.checkMissing', 'Missing') : formatEur(materials)
            } | ${t('v2Overview.previewAccountingResultLabel')}: ${formatEur(
              result,
            )}`
          : t('v2Overview.checkMissing', 'Missing');
      const priceSummary = availability.prices
        ? `${formatPrice(prices.waterUnitPrice)} / ${formatPrice(
            prices.wastewaterUnitPrice,
          )}`
        : t('v2Overview.checkMissing', 'Missing');
      const volumeSummary = availability.volumes
        ? `${formatNumber(volumes.soldWaterVolume)} / ${formatNumber(
            volumes.soldWastewaterVolume,
          )} m3`
        : t('v2Overview.checkMissing', 'Missing');

      return (
        <div className="v2-year-status-summary-grid">
          <div className="v2-year-preview-item secondary">
            <span>{t('v2Overview.reviewFinancialSummaryLabel', 'Bokslut')}</span>
            <strong>{financialSummary}</strong>
          </div>
          <div className="v2-year-preview-item secondary">
            <span>{t('v2Overview.reviewPriceSummaryLabel', 'Prices')}</span>
            <strong>{priceSummary}</strong>
          </div>
          <div className="v2-year-preview-item secondary">
            <span>{t('v2Overview.reviewVolumeSummaryLabel', 'Volumes')}</span>
            <strong>{volumeSummary}</strong>
          </div>
        </div>
      );
    },
    [t, yearDataCache],
  );

  const handleDeleteYear = React.useCallback(
    async (year: number) => {
      const confirmed = window.confirm(
        t(
          'v2Overview.excludeYearConfirm',
          'Rajataanko vuosi {{year}} pois suunnitelmasta? Vuosi säilyy työtilassa ja sen voi palauttaa myöhemmin.',
          { year },
        ),
      );
      if (!confirmed) return;

      setRemovingYear(year);
      setError(null);
      setInfo(null);
      try {
        await excludeImportYearsV2([year]);
        setInfo(
          t(
            'v2Overview.excludeYearDoneSingle',
            'Vuosi {{year}} on nyt pois suunnitelmasta.',
            { year },
          ),
        );
        await loadOverview();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.excludeYearFailedSingle',
                'Vuoden rajaaminen pois suunnitelmasta epäonnistui.',
              ),
        );
      } finally {
        setRemovingYear(null);
      }
    },
    [loadOverview, t],
  );

  const handleApplyVeetiReconcile = React.useCallback(
    async (year: number, dataTypes: string[]) => {
      setError(null);
      setInfo(null);
      try {
        await reconcileImportYearV2(year, {
          action: 'apply_veeti',
          dataTypes,
        });
        setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[year];
          return next;
        });
        await loadOverview();
        setInfo(
          t(
            'v2Overview.reconcileApplied',
            'VEETI values restored for year {{year}}.',
            { year },
          ),
        );
        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.reconcileFailed',
                'Failed to apply VEETI values for the selected year.',
              ),
        );
        return false;
      }
    },
    [loadOverview, t],
  );

  const handleKeepCurrentYearValues = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    const approvedYear = manualPatchYear;
    const nextRows = reviewStatusRows.map((row) => ({
      year: row.year,
      setupStatus:
        row.year === approvedYear && row.setupStatus === 'ready_for_review'
          ? ('reviewed' as const)
          : row.setupStatus,
      missingRequirements: row.missingRequirements,
    }));
    const nextReviewedYears = markPersistedReviewedImportYears(
      reviewStorageOrgId,
      [approvedYear],
      [...confirmedImportedYears, approvedYear],
    );
    const nextStep = resolveApprovedYearStep(nextRows, approvedYear);
    const nextQueueYear = resolveNextReviewQueueYear(nextRows);
    const nextQueueRow =
      nextQueueYear == null
        ? null
        : nextRows.find((row) => row.year === nextQueueYear) ?? null;

    setReviewedImportedYears(nextReviewedYears);
    if (nextQueueRow) {
      if (cardEditContext === 'step3') {
        await openInlineCardEditor(
          nextQueueRow.year,
          null,
          'step3',
          nextQueueRow.missingRequirements,
        );
      } else {
        resetManualPatchDialog();
        await openManualPatchDialog(
          nextQueueRow.year,
          nextQueueRow.missingRequirements,
          'review',
        );
      }
      setInfo(
        t(
          'v2Overview.keepCurrentYearValuesInfo',
          'No changes were applied for this year.',
        ),
      );
      return;
    }
    if (cardEditContext === 'step3') {
      closeInlineCardEditor();
    } else {
      resetManualPatchDialog();
    }
    setReviewContinueStep(nextStep === 5 ? (baselineReady ? 6 : 5) : null);
    setInfo(
      t(
        'v2Overview.keepCurrentYearValuesInfo',
        'No changes were applied for this year.',
      ),
    );
  }, [
    confirmedImportedYears,
    cardEditContext,
    closeInlineCardEditor,
    manualPatchYear,
    planningContext?.baselineYears?.length,
    planningContext?.canCreateScenario,
    openInlineCardEditor,
    openManualPatchDialog,
    resetManualPatchDialog,
    reviewStatusRows,
    reviewStorageOrgId,
    t,
  ]);

  const handleSwitchToStatementImportMode = React.useCallback(() => {
    setManualPatchMode('statementImport');
    setManualPatchError(null);
    setStatementImportError(null);
    setWorkbookImportError(null);
    setQdisImportError(null);
    statementFileInputRef.current?.click();
  }, []);

  const handleSwitchToWorkbookImportMode = React.useCallback(() => {
    setManualPatchMode('workbookImport');
    setManualPatchError(null);
    setWorkbookImportError(null);
    workbookFileInputRef.current?.click();
  }, []);

  const handleSwitchToQdisImportMode = React.useCallback(() => {
    setManualPatchMode('qdisImport');
    setManualPatchError(null);
    setQdisImportError(null);
    qdisFileInputRef.current?.click();
  }, []);

  const handleSwitchToManualEditMode = React.useCallback(() => {
    setManualPatchMode('manualEdit');
    setManualPatchError(null);
  }, []);

  const handleExcludeManualYearFromPlan = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    setManualPatchBusy(true);
    setManualPatchError(null);
    setError(null);
    setInfo(null);
    try {
      await excludeImportYearsV2([manualPatchYear]);
      setInfo(
        t(
          'v2Overview.excludeYearDone',
          'Vuosi {{year}} on nyt pois suunnitelmasta.',
          { year: manualPatchYear },
        ),
      );
      resetManualPatchDialog();
      await loadOverview();
    } catch (err) {
      setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.excludeYearFailed',
              'Vuoden rajaaminen pois suunnitelmasta epäonnistui.',
            ),
      );
    } finally {
      setManualPatchBusy(false);
    }
  }, [loadOverview, manualPatchYear, resetManualPatchDialog, t]);

  const handleRestoreManualYearToPlan = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    setManualPatchBusy(true);
    setManualPatchError(null);
    setError(null);
    setInfo(null);
    try {
      await restoreImportYearsV2([manualPatchYear]);
      setInfo(
        t(
          'v2Overview.restoreYearDone',
          'Vuosi {{year}} on palautettu takaisin suunnitelmaan.',
          { year: manualPatchYear },
        ),
      );
      resetManualPatchDialog();
      await loadOverview();
    } catch (err) {
      setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.restoreYearFailed',
              'Vuoden palauttaminen suunnitelmaan epäonnistui.',
            ),
      );
    } finally {
      setManualPatchBusy(false);
    }
  }, [loadOverview, manualPatchYear, resetManualPatchDialog, t]);

  const handleModalApplyVeetiFinancials = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    const applied = await handleApplyVeetiReconcile(manualPatchYear, [
      'tilinpaatos',
    ]);
    if (!applied) return;
    setManualPatchYear(null);
    setManualPatchMissing([]);
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
  }, [handleApplyVeetiReconcile, manualPatchYear]);
  const handleModalApplyVeetiPrices = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    await handleApplyVeetiReconcile(manualPatchYear, ['taksa']);
  }, [handleApplyVeetiReconcile, manualPatchYear]);
  const handleModalApplyVeetiVolumes = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    await handleApplyVeetiReconcile(manualPatchYear, [
      'volume_vesi',
      'volume_jatevesi',
    ]);
  }, [handleApplyVeetiReconcile, manualPatchYear]);

  const setupCheckLabel = React.useCallback(
    (checkKey: MissingRequirement) => {
      if (checkKey === 'financials') {
        return t('v2Overview.datasetFinancials', 'Tilinpäätös');
      }
      if (checkKey === 'prices') {
        return t('v2Overview.datasetPrices', 'Taksa');
      }
      return t('v2Overview.datasetWaterVolume', 'Volyymit');
    },
    [t],
  );
  const setupStatusLabel = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return t('v2Overview.setupStatusReviewed', 'Reviewed');
      }
      if (status === 'ready_for_review') {
        return t('v2Overview.setupStatusTechnicalReady', 'Ready for review');
      }
      if (status === 'excluded_from_plan') {
        return t('v2Overview.setupStatusExcluded');
      }
      return t('v2Overview.setupStatusNeedsAttention');
    },
    [t],
  );
  const setupStatusClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') return 'v2-status-positive';
      if (status === 'ready_for_review') return 'v2-status-info';
      if (status === 'excluded_from_plan') return 'v2-status-provenance';
      return 'v2-status-warning';
    },
    [],
  );
  const yearStatusRowClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      return status;
    },
    [],
  );
  const handleContinueFromReview = React.useCallback(async () => {
    const target = resolveReviewContinueTarget(
      reviewStatusRows.map((row) => ({
        year: row.year,
        setupStatus: row.setupStatus,
      })),
    );
    if (target.selectedProblemYear != null) {
      setReviewContinueStep(null);
      const selectedYear = reviewStatusRows.find(
        (row) => row.year === target.selectedProblemYear,
      );
      if (selectedYear) {
        await openInlineCardEditor(
          selectedYear.year,
          null,
          'step3',
          selectedYear.missingRequirements,
        );
        return;
      }
      handleGuideBlockedYears();
      return;
    }

    setReviewContinueStep(target.nextStep);
    setInfo(
      t('v2Overview.reviewContinueReadyHint'),
    );
  }, [
    handleGuideBlockedYears,
    openInlineCardEditor,
    planningContext,
    reportList,
    reviewStatusRows,
    scenarioList,
    t,
  ]);
  const includedPlanningYears = React.useMemo(
    () =>
      reviewStatusRows
        .filter((row) => row.setupStatus === 'reviewed')
        .map((row) => row.year)
        .sort((a, b) => b - a),
    [reviewStatusRows],
  );
  const acceptedPlanningYearRows = React.useMemo(
    () =>
      importYearRows
        .filter((row) => includedPlanningYears.includes(row.vuosi))
        .sort((a, b) => b.vuosi - a.vuosi),
    [importYearRows, includedPlanningYears],
  );
  const correctedPlanningYears = React.useMemo(
    () =>
      importYearRows
        .filter(
          (row) =>
            (row.sourceBreakdown?.manualDataTypes?.length ?? 0) > 0 ||
            row.manualEditedAt != null ||
            row.manualReason != null,
        )
        .map((row) => row.vuosi)
        .sort((a, b) => b - a),
    [importYearRows],
  );
  const correctedPlanningYearRows = React.useMemo(
    () =>
      importYearRows.filter((row) => correctedPlanningYears.includes(row.vuosi)),
    [correctedPlanningYears, importYearRows],
  );
  const correctedPlanningManualDataTypes = React.useMemo(
    () =>
      [...new Set(
        correctedPlanningYearRows.flatMap(
          (row) => row.sourceBreakdown?.manualDataTypes ?? [],
        ),
      )].sort(),
    [correctedPlanningYearRows],
  );
  const correctedPlanningVeetiDataTypes = React.useMemo(
    () =>
      [...new Set(
        correctedPlanningYearRows.flatMap(
          (row) => row.sourceBreakdown?.veetiDataTypes ?? [],
        ),
      )].sort(),
    [correctedPlanningYearRows],
  );
  const handleCreatePlanningBaseline = React.useCallback(async () => {
    if (includedPlanningYears.length === 0) return;
    setCreatingPlanningBaseline(true);
    setError(null);
    setInfo(null);
    try {
      const result = await createPlanningBaselineV2(includedPlanningYears);
      setLatestPlanningBaselineSummary({
        includedYears: [...result.includedYears].sort((a, b) => b - a),
        excludedYears: [...excludedYearsSorted],
        correctedYears: [...correctedPlanningYears],
      });
      setInfo(
        t('v2Overview.planningBaselineDone', {
          years:
            result.includedYears.length > 0
              ? result.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        }),
      );
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.planningBaselineFailed',
              'Suunnittelupohjan luonti epäonnistui.',
            ),
      );
    } finally {
      setCreatingPlanningBaseline(false);
    }
  }, [correctedPlanningYears, excludedYearsSorted, includedPlanningYears, loadOverview, t]);
  const handleOpenForecastHandoff = React.useCallback(() => {
    onGoToForecast();
  }, [onGoToForecast]);

  const missingRequirementLabel = React.useCallback(
    (requirement: MissingRequirement) => {
      if (requirement === 'financials') {
        return t(
          'v2Overview.requirementFinancials',
          'Financial statement data',
        );
      }
      if (requirement === 'prices') {
        return t('v2Overview.requirementPrices', 'Price data (taksa)');
      }
      return t('v2Overview.requirementVolumes', 'Sold volume data');
    },
    [t],
  );
  const sourceLayerText = React.useCallback(
    (
      layer: ReturnType<typeof buildImportYearSourceLayers>[number],
    ): string => {
      const datasetLabel =
        layer.key === 'financials'
          ? t('v2Overview.datasetFinancials', 'Financial statement')
          : layer.key === 'prices'
          ? t('v2Overview.datasetPrices', 'Unit prices')
          : t('v2Overview.datasetWaterVolume', 'Sold volumes');
      const sourceLabel =
        layer.provenanceKinds?.includes('statement_import') &&
        (layer.provenanceKinds?.includes('kva_import') ||
          layer.provenanceKinds?.includes('excel_import'))
          ? t(
              'v2Overview.datasetSourceStatementWorkbookMixed',
              'Statement PDF + workbook repair',
            )
          : layer.provenanceKind === 'qdis_import'
          ? t('v2Overview.datasetSourceQdisImport', 'QDIS PDF')
          : layer.provenanceKind === 'statement_import'
          ? t('v2Overview.datasetSourceStatementImport', 'Statement import')
          : layer.provenanceKind === 'kva_import' ||
            layer.provenanceKind === 'excel_import'
          ? t('v2Overview.datasetSourceWorkbookImport', 'Workbook import')
          : layer.source === 'manual'
          ? t('v2Overview.sourceManual', 'Manual')
          : layer.source === 'veeti'
          ? t('v2Overview.sourceVeeti', 'VEETI')
          : t('v2Overview.sourceIncomplete', 'Incomplete');
      return `${datasetLabel}: ${sourceLabel}`;
    },
    [t],
  );
  const priceComparisonLabel = React.useCallback(
    (key: 'waterUnitPrice' | 'wastewaterUnitPrice') => {
      if (key === 'waterUnitPrice') {
        return t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)');
      }
      return t(
        'v2Overview.manualPriceWastewater',
        'Wastewater unit price (EUR/m3)',
      );
    },
    [t],
  );
  const volumeComparisonLabel = React.useCallback(
    (key: 'soldWaterVolume' | 'soldWastewaterVolume') => {
      if (key === 'soldWaterVolume') {
        return t('v2Overview.manualVolumeWater', 'Sold water volume (m3)');
      }
      return t(
        'v2Overview.manualVolumeWastewater',
        'Sold wastewater volume (m3)',
      );
    },
    [t],
  );

  const isReviewMode = manualPatchMode === 'review';
  const showAllManualSections =
    manualPatchMode === 'manualEdit' && manualPatchMissing.length === 0;
  const isStatementImportMode = manualPatchMode === 'statementImport';
  const isWorkbookImportMode = manualPatchMode === 'workbookImport';
  const isQdisImportMode = manualPatchMode === 'qdisImport';
  const showFinancialSection =
    manualPatchMode !== 'review' &&
    manualPatchMode !== 'qdisImport' &&
    manualPatchMode !== 'workbookImport';
  const showPricesSection =
    manualPatchMode !== 'review' && manualPatchMode !== 'workbookImport';
  const showVolumesSection =
    manualPatchMode !== 'review' && manualPatchMode !== 'workbookImport';
  const financialComparisonRows = React.useMemo(() => {
    if (manualPatchYear == null) return [];
    return buildFinancialComparisonRows(yearDataCache[manualPatchYear]).map(
      (row) => ({
        ...row,
        label: financialComparisonLabel(row.key),
      }),
    );
  }, [financialComparisonLabel, manualPatchYear, yearDataCache]);
  const hasFinancialComparisonDiffs = financialComparisonRows.some(
    (row) => row.changed,
  );
  const priceComparisonRows = React.useMemo(() => {
    if (manualPatchYear == null) return [];
    return buildPriceComparisonRows(yearDataCache[manualPatchYear]).map(
      (row) => ({
        ...row,
        label: priceComparisonLabel(row.key),
      }),
    );
  }, [manualPatchYear, priceComparisonLabel, yearDataCache]);
  const hasPriceComparisonDiffs = priceComparisonRows.some((row) => row.changed);
  const volumeComparisonRows = React.useMemo(() => {
    if (manualPatchYear == null) return [];
    return buildVolumeComparisonRows(yearDataCache[manualPatchYear]).map(
      (row) => ({
        ...row,
        label: volumeComparisonLabel(row.key),
      }),
    );
  }, [manualPatchYear, volumeComparisonLabel, yearDataCache]);
  const hasVolumeComparisonDiffs = volumeComparisonRows.some((row) => row.changed);
  const currentYearData =
    manualPatchYear != null ? yearDataCache[manualPatchYear] : undefined;
  const statementImportComparisonRows = React.useMemo(() => {
    if (!statementImportPreview) return [];
    return buildStatementOcrComparisonRows({
      fields: statementImportPreview.fields,
      matches: statementImportPreview.matches,
      veetiFinancials: getRawFirstRow(currentYearData, 'tilinpaatos'),
      currentFinancials: getEffectiveFirstRow(currentYearData, 'tilinpaatos'),
    });
  }, [currentYearData, statementImportPreview]);
  const hasStatementImportPreviewValues = statementImportComparisonRows.some(
    (row) => row.pdfValue != null,
  );
  const qdisImportComparisonRows = React.useMemo(() => {
    if (!qdisImportPreview || manualPatchYear == null) return [];
    const rawPriceRows =
      currentYearData?.datasets.find((dataset) => dataset.dataType === 'taksa')
        ?.rawRows ?? [];
    const currentPrices = buildPriceForm(currentYearData);
    const rawWaterPrice = rawPriceRows.find(
      (row) => parseManualNumber((row as any).Tyyppi_Id) === 1,
    );
    const rawWastewaterPrice = rawPriceRows.find(
      (row) => parseManualNumber((row as any).Tyyppi_Id) === 2,
    );
    const rawWaterVolume = getRawFirstRow(currentYearData, 'volume_vesi');
    const rawWastewaterVolume = getRawFirstRow(currentYearData, 'volume_jatevesi');
    const currentVolumes = buildVolumeForm(currentYearData);
    return [
      {
        key: 'waterUnitPrice',
        label: t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)'),
        veetiValue: parseManualNumber((rawWaterPrice as any)?.Kayttomaksu),
        pdfValue: qdisImportPreview.fields.waterUnitPrice ?? null,
        currentValue: currentPrices.waterUnitPrice,
      },
      {
        key: 'wastewaterUnitPrice',
        label: t(
          'v2Overview.manualPriceWastewater',
          'Wastewater unit price (EUR/m3)',
        ),
        veetiValue: parseManualNumber((rawWastewaterPrice as any)?.Kayttomaksu),
        pdfValue: qdisImportPreview.fields.wastewaterUnitPrice ?? null,
        currentValue: currentPrices.wastewaterUnitPrice,
      },
      {
        key: 'soldWaterVolume',
        label: t('v2Overview.manualVolumeWater', 'Sold water volume (m3)'),
        veetiValue: parseManualNumber((rawWaterVolume as any).Maara),
        pdfValue: qdisImportPreview.fields.soldWaterVolume ?? null,
        currentValue: currentVolumes.soldWaterVolume,
      },
      {
        key: 'soldWastewaterVolume',
        label: t(
          'v2Overview.manualVolumeWastewater',
          'Sold wastewater volume (m3)',
        ),
        veetiValue: parseManualNumber((rawWastewaterVolume as any).Maara),
        pdfValue: qdisImportPreview.fields.soldWastewaterVolume ?? null,
        currentValue: currentVolumes.soldWastewaterVolume,
      },
    ].map((row) => ({
      ...row,
      changedFromCurrent:
        row.pdfValue != null && numbersDiffer(row.pdfValue, row.currentValue),
    }));
  }, [currentYearData, manualPatchYear, qdisImportPreview, t]);
  const hasQdisPreviewValues = qdisImportComparisonRows.some(
    (row) => row.pdfValue != null,
  );
  const workbookImportComparisonYears = React.useMemo(() => {
    if (!workbookImportPreview) return [];
    return workbookImportPreview.years.map((year) => {
      const summaryRows = buildImportYearSummaryRows(yearDataCache[year.year]);
      return {
        ...year,
        rows: year.rows.map((row) => ({
          ...row,
          label: financialComparisonLabel(row.key),
          veetiValue:
            summaryRows.find(
              (summaryRow) => summaryRow.sourceField === row.sourceField,
            )?.rawValue ?? null,
          selection:
            workbookImportSelections[year.year]?.[row.sourceField] ??
            row.suggestedAction,
        })),
      };
    });
  }, [
    financialComparisonLabel,
    workbookImportPreview,
    workbookImportSelections,
    yearDataCache,
  ]);
  const hasWorkbookImportPreviewValues = workbookImportComparisonYears.some(
    (year) => year.rows.some((row) => row.workbookValue != null),
  );
  const hasWorkbookApplySelections = workbookImportComparisonYears.some((year) =>
    year.rows.some(
      (row) => row.selection === 'apply_workbook' && row.workbookValue != null,
    ),
  );
  const canConfirmStatementImport =
    !isStatementImportMode ||
    (statementImportPreview != null && hasStatementImportPreviewValues);
  const canConfirmQdisImport =
    !isQdisImportMode || (qdisImportPreview != null && hasQdisPreviewValues);
  const canConfirmImportWorkflow =
    canConfirmStatementImport && canConfirmQdisImport;
  const canReapplyPricesForYear = canReapplyDatasetVeeti(
    currentYearData,
    ['taksa'],
    isAdmin,
  );
  const canReapplyVolumesForYear = canReapplyDatasetVeeti(
    currentYearData,
    ['volume_vesi', 'volume_jatevesi'],
    isAdmin,
  );
  const pendingReviewYearCount = pendingTechnicalReviewYearCount;
  const setupWizardState = React.useMemo(() => {
    if (!overview) return null;

    return resolveSetupWizardState({
      connected: overview.importStatus.connected,
      importedYearCount: confirmedImportedYears.length,
      reviewedYearCount: reviewedImportedYearRows.length,
      blockedYearCount: importedBlockedYearCount,
      pendingReviewCount: pendingTechnicalReviewYearCount,
      excludedYearCount: excludedYearsSorted.length,
      baselineReady,
      selectedProblemYear: cardEditContext === 'step3' ? null : manualPatchYear,
    });
  }, [
    baselineReady,
    cardEditContext,
    confirmedImportedYears.length,
    excludedYearsSorted.length,
    importedBlockedYearCount,
    manualPatchYear,
    overview,
    pendingTechnicalReviewYearCount,
    reviewedImportedYearRows.length,
  ]);
  const wizardDisplayStep =
    cardEditContext === 'step3' && cardEditYear != null
      ? 3
      : manualPatchYear != null && cardEditContext !== 'step3'
      ? 4
      : reviewContinueStep ?? setupWizardState?.activeStep ?? 1;
  const displaySetupWizardState = React.useMemo(() => {
    if (!setupWizardState) return null;
    return {
      ...setupWizardState,
      currentStep: wizardDisplayStep,
      recommendedStep: setupWizardState.recommendedStep,
      activeStep: wizardDisplayStep,
      selectedProblemYear:
        wizardDisplayStep === 4 && manualPatchYear != null
          ? manualPatchYear
          : null,
    };
  }, [manualPatchYear, setupWizardState, wizardDisplayStep]);
  const wizardBackStep = displaySetupWizardState
    ? resolvePreviousSetupStep(displaySetupWizardState)
    : null;
  const previewPrefetchYears = React.useMemo(() => {
    const prioritizedYears: number[] = [];
    const pushYear = (year: number | null | undefined) => {
      if (year == null || prioritizedYears.includes(year)) return;
      prioritizedYears.push(year);
    };

    pushYear(cardEditYear);
    pushYear(manualPatchYear);

    if (wizardDisplayStep === 2) {
      for (const year of [...selectedYears].sort((a, b) => b - a)) {
        pushYear(year);
      }
      for (const row of selectableImportYearRows) {
        pushYear(row.vuosi);
      }
      return prioritizedYears.slice(0, YEAR_PREVIEW_PREFETCH_LIMIT);
    }

    if (wizardDisplayStep !== 3) {
      return prioritizedYears.slice(0, YEAR_PREVIEW_PREFETCH_LIMIT);
    }

    const reviewPriorityRows = [...reviewStatusRows]
      .filter((row) => row.setupStatus !== 'excluded_from_plan')
      .sort((left, right) => {
        const priority = (status: typeof left.setupStatus) => {
          if (status === 'needs_attention') return 0;
          if (status === 'ready_for_review') return 1;
          return 2;
        };
        const statusDiff =
          priority(left.setupStatus) - priority(right.setupStatus);
        if (statusDiff !== 0) return statusDiff;
        return right.year - left.year;
      });

    for (const row of reviewPriorityRows) {
      pushYear(row.year);
    }

    return prioritizedYears.slice(0, YEAR_PREVIEW_PREFETCH_LIMIT);
  }, [
    cardEditYear,
    manualPatchYear,
    reviewStatusRows,
    selectableImportYearRows,
    selectedYears,
    wizardDisplayStep,
  ]);
  const wizardBackLabel =
    wizardBackStep === 1
      ? t('v2Overview.wizardBackStep1', 'Back to connection')
      : wizardBackStep === 2
      ? t('v2Overview.wizardBackStep2', 'Back to year selection')
      : wizardBackStep === 3
      ? t('v2Overview.wizardBackStep3', 'Back to review')
      : wizardBackStep === 5
      ? t('v2Overview.wizardBackStep5', 'Back to baseline')
      : null;
  const handleWizardBack = React.useCallback(() => {
    if (wizardBackStep == null) return;
    closeInlineCardEditor();
    setInfo(null);
    setReviewContinueStep(wizardBackStep);
  }, [closeInlineCardEditor, wizardBackStep]);

  React.useEffect(() => {
    for (const year of previewPrefetchYears) {
      void loadYearPreviewData(year);
    }
  }, [loadYearPreviewData, previewPrefetchYears]);

  React.useEffect(() => {
    if (!displaySetupWizardState) return;
    onSetupWizardStateChange?.(displaySetupWizardState);
  }, [displaySetupWizardState, onSetupWizardStateChange]);

  React.useEffect(() => {
    if (!setupBackSignal) return;
    if (setupBackSignal === handledSetupBackSignalRef.current) return;
    handledSetupBackSignalRef.current = setupBackSignal;
    handleWizardBack();
  }, [handleWizardBack, setupBackSignal]);

  React.useEffect(() => {
    onSetupOrgNameChange?.(overview?.importStatus.link?.nimi ?? null);
  }, [onSetupOrgNameChange, overview?.importStatus.link?.nimi]);

  if (loading)
    return (
      <div className="v2-loading">
        {t('v2Overview.loading', 'Loading overview...')}
      </div>
    );
  if (!overview)
    return (
      <div className="v2-error">
        {t('v2Overview.loadFailed', 'Overview data is not available.')}
      </div>
    );

  const { importStatus } = overview;

  const hasBaselineBudget = baselineReady;

  const includedPlanningYearsLabel =
    includedPlanningYears.length > 0
      ? includedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const importedYearsLabel =
    confirmedImportedYears.length > 0
      ? confirmedImportedYears.join(', ')
      : t('v2Overview.noImportedYears', 'No imported years available yet.');
  const readyYearsLabel =
    reviewedImportedYearRows.length > 0
      ? reviewedImportedYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const technicalReadyYearsLabel =
    technicallyReadyImportedYearRows.length > 0
      ? technicallyReadyImportedYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const excludedYearsLabel =
    excludedYearsSorted.length > 0
      ? excludedYearsSorted.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const correctedYearsLabel =
    correctedPlanningYears.length > 0
      ? correctedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const selectedConnectedOrg = overview?.importStatus.link ?? null;
  const selectedOrgName =
    selectedOrg?.Nimi ??
    selectedConnectedOrg?.nimi ??
    t('v2Overview.organizationNotSelected', 'Not selected');
  const selectedOrgBusinessId =
    selectedOrg?.YTunnus ?? selectedConnectedOrg?.ytunnus ?? '-';
  const importStep = Math.min(setupWizardState?.activeStep ?? 1, 3) as 1 | 2 | 3;
  const baselineReadyForSummary = setupWizardState?.wizardComplete === true;
  const planningBaselineSummaryDetail = baselineReadyForSummary
    ? latestPlanningBaselineSummary
      ? t('v2Overview.wizardBaselineReadyDetail', {
          included:
            latestPlanningBaselineSummary.includedYears.length > 0
              ? latestPlanningBaselineSummary.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          excluded:
            latestPlanningBaselineSummary.excludedYears.length > 0
              ? latestPlanningBaselineSummary.excludedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          corrected:
            latestPlanningBaselineSummary.correctedYears.length > 0
              ? latestPlanningBaselineSummary.correctedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        })
      : t('v2Overview.wizardBaselineReadyHint')
    : t('v2Overview.wizardBaselinePendingHint');
  const wizardSummaryItems = [
    {
      label: t('v2Overview.wizardSummaryCompany'),
      value: importStatus.link?.nimi ?? selectedOrgName,
      detail: importStatus.link?.ytunnus ?? selectedOrgBusinessId,
    },
    {
      label: t('v2Overview.wizardSummaryImportedYears'),
      value: String(importYearRows.length),
      detail: importedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryReadyYears', 'Ready years'),
      value: String(reviewedImportedYearRows.length),
      detail: readyYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryExcludedYears'),
      value: String(excludedYearsSorted.length),
      detail: excludedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryBaselineReady'),
      value: baselineReadyForSummary
        ? t('v2Overview.wizardSummaryYes')
        : t('v2Overview.wizardSummaryNo'),
      detail: planningBaselineSummaryDetail,
    },
  ] as const;
  const wizardStepContent: Record<
    number,
    { title: string; body: string; badge: string }
  > = {
    1: {
      title: t('v2Overview.wizardQuestionConnect'),
      body: t('v2Overview.wizardBodyConnect'),
      badge: t('v2Overview.disconnected', 'Not connected'),
    },
    2: {
      title: t('v2Overview.wizardQuestionImportYears'),
      body: t('v2Overview.wizardBodyImportYears'),
      badge: t('v2Overview.importTitle', 'Import VEETI'),
    },
    3: {
      title: t('v2Overview.wizardQuestionReviewYears'),
      body: t('v2Overview.wizardBodyReviewYears'),
      badge: t('v2Overview.needsReviewBadge'),
    },
    4: {
      title: t('v2Overview.wizardQuestionFixYear'),
      body: t('v2Overview.wizardBodyFixYear'),
      badge: t('v2Overview.needsReviewBadge'),
    },
    5: {
      title: t('v2Overview.wizardQuestionBaseline'),
      body: t('v2Overview.wizardBodyBaseline'),
      badge: t('v2Overview.createPlanningBaseline'),
    },
    6: {
      title: t('v2Overview.wizardQuestionForecast'),
      body: t('v2Overview.wizardBodyForecast'),
      badge: t('v2Overview.openForecast'),
    },
  };
  const wizardHero = wizardStepContent[wizardDisplayStep];
  const isStep2SupportChrome = wizardDisplayStep === 2;
  const summaryMetaBlocks = isStep2SupportChrome
    ? [
        {
          label: t('v2Overview.organizationLabel', 'Organization'),
          value: importStatus.link?.nimi ?? '-',
        },
        {
          label: t('v2Overview.businessIdLabel', 'Business ID'),
          value: importStatus.link?.ytunnus ?? '-',
        },
        {
          label: t('v2Overview.lastFetchLabel', 'Last fetch'),
          value: formatDateTime(importStatus.link?.lastFetchedAt),
        },
        {
          label: t('v2Overview.wizardContextImportedWorkspaceYears'),
          value: importedYearsLabel,
        },
      ]
    : [
        {
          label: t('v2Overview.organizationLabel', 'Organization'),
          value: importStatus.link?.nimi ?? '-',
        },
        {
          label: t('v2Overview.businessIdLabel', 'Business ID'),
          value: importStatus.link?.ytunnus ?? '-',
        },
        {
          label: t('v2Overview.lastFetchLabel', 'Last fetch'),
          value: formatDateTime(importStatus.link?.lastFetchedAt),
        },
        {
          label: t('v2Overview.wizardCurrentFocus'),
          value: wizardHero.badge,
        },
      ];
  const wizardContextHelpers: WizardContextHelper[] = (() => {
    const priorLabel = t('v2Overview.wizardContextEarlier');
    const nextLabel = t('v2Overview.wizardContextNext');

    if (wizardDisplayStep === 1) {
      return [
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Overview.wizardContextStep2'),
          body: t('v2Overview.wizardContextConnectNextBody'),
          tone: 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 2) {
      return [
        {
          key: 'prior',
          label: t('v2Overview.wizardContextNow'),
          title: t('v2Overview.wizardContextImportedWorkspaceYears'),
          body: t('v2Overview.wizardContextImportedWorkspaceYearsBody', {
            years: importedYearsLabel,
          }),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Overview.wizardContextStep3'),
          body: t('v2Overview.wizardContextImportNextBody'),
          tone: 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 3) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Overview.wizardContextImportedWorkspaceYears'),
          body: t('v2Overview.wizardContextImportedWorkspaceYearsBody', {
            years: importedYearsLabel,
          }),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title:
            pendingReviewYearCount > 0
              ? t('v2Overview.wizardContextStep4')
              : t('v2Overview.wizardContextStep5'),
          body:
            pendingReviewYearCount === 1
              ? t('v2Overview.wizardContextReviewNextOneBody')
              : pendingReviewYearCount > 1
                ? t('v2Overview.wizardContextReviewNextManyBody', {
                    count: pendingReviewYearCount,
                  })
                : t('v2Overview.wizardContextReviewNextReadyBody'),
          tone: pendingReviewYearCount > 0 ? 'warning' : 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 4) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Overview.wizardContextReviewQueue'),
          body: t('v2Overview.wizardContextReviewQueueBody', {
            year: manualPatchYear ?? '-',
          }),
          tone: 'warning',
        },
        {
          key: 'next',
          label: nextLabel,
          title:
            pendingReviewYearCount > 1
              ? t('v2Overview.wizardContextBackToReview')
              : t('v2Overview.wizardContextStep5'),
          body:
            pendingReviewYearCount > 1
              ? t('v2Overview.wizardContextFixNextReviewBody')
              : t('v2Overview.wizardContextFixNextBaselineBody'),
          tone: 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 5) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Overview.wizardContextReviewSummary'),
          body: t('v2Overview.wizardContextReviewSummaryBody', {
            ready: includedPlanningYearsLabel,
            excluded: excludedYearsLabel,
          }),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Overview.wizardContextStep6'),
          body: t('v2Overview.wizardContextBaselineNextBody'),
          tone: 'neutral',
        },
      ];
    }

    return wizardDisplayStep === 6
      ? []
      : [
          {
            key: 'prior',
            label: priorLabel,
            title: t('v2Overview.wizardContextBaselineSummary'),
            body: planningBaselineSummaryDetail,
            tone: 'positive',
          },
        ];
  })();
  const connectButtonClass =
    wizardDisplayStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const importYearsButtonClass =
    wizardDisplayStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reviewContinueButtonClass =
    wizardDisplayStep === 3 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const planningBaselineButtonClass =
    wizardDisplayStep === 5 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const openForecastButtonClass =
    wizardDisplayStep === 6 ? 'v2-btn v2-btn-primary' : 'v2-btn';

  const statementImportImpact = (() => {
    if (manualPatchYear == null) {
      return {
        currentFinancialSource: null as string | null,
        keepVeeti: [] as string[],
        keepManual: [] as string[],
        keepEmpty: [] as string[],
      };
    }

    const yearData = yearDataCache[manualPatchYear];
    const datasets = yearData?.datasets ?? [];
    return {
      currentFinancialSource:
        datasets.find((dataset) => dataset.dataType === 'tilinpaatos')?.source ??
        null,
      keepVeeti: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'veeti',
        )
        .map((dataset) => dataset.dataType),
      keepManual: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'manual',
        )
        .map((dataset) => dataset.dataType),
      keepEmpty: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'none',
        )
        .map((dataset) => dataset.dataType),
    };
  })();
  const setWorkbookSelection = (
    year: number,
    sourceField: V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
    action: 'keep_veeti' | 'apply_workbook',
  ) => {
    setWorkbookImportSelections((prev) => ({
      ...prev,
      [year]: {
        ...(prev[year] ?? {}),
        [sourceField]: action,
      },
    }));
  };
  const renderWorkbookImportWorkflow = (yearLabel: number | string) => (
    <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
      <div className="v2-manual-section-head">
        <h4>
          {t(
            'v2Overview.workbookImportWorkflowTitle',
            'Import KVA workbook for year {{year}}',
            { year: yearLabel },
          )}
        </h4>
      </div>
      <p className="v2-muted">
        {t(
          'v2Overview.workbookImportWorkflowBody',
          'Upload one KVA workbook, review the matched years, and choose row by row whether to keep VEETI or apply workbook values before saving.',
        )}
      </p>
      <div className="v2-statement-import-actions">
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() => workbookFileInputRef.current?.click()}
          disabled={workbookImportBusy || manualPatchBusy}
        >
          {t(
            workbookImportPreview
              ? 'v2Overview.workbookImportReplaceFile'
              : 'v2Overview.workbookImportUploadFile',
            workbookImportPreview
              ? 'Choose another workbook'
              : 'Upload KVA workbook',
          )}
        </button>
        {workbookImportPreview ? (
          <span className="v2-muted">
            {workbookImportPreview.document.fileName}
          </span>
        ) : null}
      </div>
      {workbookImportStatus ? <p className="v2-muted">{workbookImportStatus}</p> : null}
      {workbookImportError ? (
        <div className="v2-alert v2-alert-error">{workbookImportError}</div>
      ) : null}
      {workbookImportPreview && hasWorkbookImportPreviewValues ? (
        <section className="v2-manual-section v2-statement-import-diff-panel">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.workbookImportDiffTitle',
                'VEETI and workbook values by year',
              )}
            </h4>
          </div>
          {workbookImportComparisonYears.map((year) => (
            <div key={year.year} className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>{year.year}</h4>
                <span className="v2-badge v2-status-provenance">
                  {sourceStatusLabel(year.sourceStatus)}
                </span>
              </div>
              <div className="v2-statement-import-diff-table">
                <div className="v2-statement-import-diff-head">
                  <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
                  <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
                  <span>
                    {t('v2Overview.workbookImportDiffWorkbook', 'Workbook')}
                  </span>
                  <span>{t('v2Overview.workbookImportChoice', 'Choice')}</span>
                </div>
                {year.rows.map((row) => (
                  <div
                    key={`${year.year}-${row.sourceField}`}
                    data-testid={`workbook-compare-${year.year}-${row.sourceField}`}
                    className={`v2-statement-import-diff-row ${
                      row.differs ? 'v2-statement-import-diff-row-changed' : ''
                    }`}
                  >
                    <span>
                      <strong>{row.label}</strong>
                    </span>
                    <span>
                      {row.veetiValue == null
                        ? t('v2Overview.previewMissingValue', 'Missing data')
                        : formatEur(row.veetiValue)}
                    </span>
                    <span>
                      {row.workbookValue == null
                        ? t(
                            'v2Overview.workbookImportMissingValue',
                            'Not found in workbook',
                          )
                        : formatEur(row.workbookValue)}
                    </span>
                    <span className="v2-actions-row">
                      <button
                        type="button"
                        className={`v2-btn v2-btn-small ${
                          row.selection === 'keep_veeti' ? 'v2-btn-primary' : ''
                        }`}
                        aria-pressed={row.selection === 'keep_veeti'}
                        onClick={() =>
                          setWorkbookSelection(year.year, row.sourceField, 'keep_veeti')
                        }
                      >
                        {t(
                          'v2Overview.workbookChoiceKeepVeeti',
                          'Keep VEETI',
                        )}
                      </button>
                      <button
                        type="button"
                        className={`v2-btn v2-btn-small ${
                          row.selection === 'apply_workbook' ? 'v2-btn-primary' : ''
                        }`}
                        aria-pressed={row.selection === 'apply_workbook'}
                        onClick={() =>
                          setWorkbookSelection(
                            year.year,
                            row.sourceField,
                            'apply_workbook',
                          )
                        }
                      >
                        {t(
                          'v2Overview.workbookChoiceApply',
                          'Apply workbook',
                        )}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <p className="v2-muted v2-statement-import-placeholder">
          {t(
            'v2Overview.workbookImportAwaitingFile',
            'Upload the KVA workbook to populate the year-by-year comparison before saving any workbook choices.',
          )}
        </p>
      )}
      <div className="v2-inline-card-editor-actions">
        <button
          type="button"
          className="v2-btn"
          onClick={() => void submitWorkbookImport(false)}
          disabled={
            manualPatchBusy || workbookImportBusy || !hasWorkbookApplySelections
          }
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : t(
                'v2Overview.workbookImportConfirm',
                'Apply workbook choices',
              )}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          onClick={() => void submitWorkbookImport(true)}
          disabled={
            manualPatchBusy || workbookImportBusy || !hasWorkbookApplySelections
          }
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : t(
                'v2Overview.workbookImportConfirmAndSync',
                'Apply workbook choices and sync years',
              )}
        </button>
      </div>
    </section>
  );
  const renderQdisImportWorkflow = (yearLabel: number | string) => (
    <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
      <div className="v2-manual-section-head">
        <h4>
          {t(
            'v2Overview.qdisImportWorkflowTitle',
            'Import QDIS PDF for year {{year}}',
            { year: yearLabel },
          )}
        </h4>
      </div>
      <p className="v2-muted">
        {t(
          'v2Overview.qdisImportWorkflowBody',
          'Upload the QDIS PDF, review the detected prices and sold volumes, and confirm them into the year patch flow.',
        )}
      </p>
      <div className="v2-statement-import-actions">
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() => qdisFileInputRef.current?.click()}
          disabled={qdisImportBusy || manualPatchBusy}
        >
          {t(
            qdisImportPreview
              ? 'v2Overview.qdisImportReplaceFile'
              : 'v2Overview.qdisImportUploadFile',
            qdisImportPreview ? 'Choose another QDIS PDF' : 'Upload QDIS PDF',
          )}
        </button>
        {qdisImportPreview ? (
          <span className="v2-muted">{qdisImportPreview.fileName}</span>
        ) : null}
      </div>
      {qdisImportStatus ? <p className="v2-muted">{qdisImportStatus}</p> : null}
      {qdisImportError ? (
        <div className="v2-alert v2-alert-error">{qdisImportError}</div>
      ) : null}
      {qdisImportPreview ? (
        <section className="v2-manual-section v2-statement-import-diff-panel">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.qdisImportDiffTitle',
                'VEETI, QDIS PDF, and current values',
              )}
            </h4>
          </div>
          {qdisImportComparisonRows.length > 0 ? (
            <div className="v2-statement-import-diff-table">
              <div className="v2-statement-import-diff-head">
                <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
                <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
                <span>
                  {t('v2Overview.qdisImportDiffPdf', 'QDIS PDF')}
                </span>
                <span>
                  {t('v2Overview.statementImportDiffCurrent', 'Current')}
                </span>
              </div>
              {qdisImportComparisonRows.map((row) => (
                <div
                  key={row.key}
                  className={`v2-statement-import-diff-row ${
                    row.changedFromCurrent
                      ? 'v2-statement-import-diff-row-changed'
                      : ''
                  }`}
                >
                  <span>
                    <strong>{row.label}</strong>
                  </span>
                  <span>
                    {row.veetiValue == null
                      ? t('v2Overview.previewMissingValue', 'Missing data')
                      : row.key.includes('Price')
                      ? formatPrice(row.veetiValue)
                      : `${formatNumber(row.veetiValue)} m3`}
                  </span>
                  <span>
                    {row.pdfValue == null
                      ? t('v2Overview.previewMissingValue', 'Missing data')
                      : row.key.includes('Price')
                      ? formatPrice(row.pdfValue)
                      : `${formatNumber(row.pdfValue)} m3`}
                  </span>
                  <span>
                    {row.key.includes('Price')
                      ? formatPrice(row.currentValue)
                      : `${formatNumber(row.currentValue)} m3`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="v2-muted">
              {t(
                'v2Overview.qdisImportNoMappedValues',
                'QDIS PDF import did not detect prices or sold volumes yet. Upload another PDF before confirming the import.',
              )}
            </p>
          )}
          {qdisImportPreview.warnings.length > 0 ? (
            <div className="v2-statement-import-warnings">
              {qdisImportPreview.warnings.map((warning) => (
                <p key={warning} className="v2-muted">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="v2-muted v2-statement-import-placeholder">
          {t(
            'v2Overview.qdisImportAwaitingFile',
            'Upload the QDIS PDF to populate the price and volume comparison before confirming the import.',
          )}
        </p>
      )}
    </section>
  );
  const currentFinancialDataset =
    manualPatchYear != null
      ? yearDataCache[manualPatchYear]?.datasets.find(
          (dataset) => dataset.dataType === 'tilinpaatos',
        ) ?? null
      : null;
  const financialSourceFieldLabel = (sourceField: string) => {
    if (sourceField === 'Liikevaihto') {
      return t('v2Overview.previewAccountingRevenueLabel', 'Revenue');
    }
    if (sourceField === 'AineetJaPalvelut') {
      return t(
        'v2Overview.previewAccountingMaterialsLabel',
        'Materials and services',
      );
    }
    if (sourceField === 'Henkilostokulut') {
      return t('v2Overview.previewAccountingPersonnelLabel', 'Personnel costs');
    }
    if (sourceField === 'Poistot') {
      return t('v2Overview.previewAccountingDepreciationLabel', 'Depreciation');
    }
    if (sourceField === 'LiiketoiminnanMuutKulut') {
      return t(
        'v2Overview.previewAccountingOtherOpexLabel',
        'Other operating costs',
      );
    }
    if (sourceField === 'TilikaudenYliJaama') {
      return t('v2Overview.previewAccountingResultLabel', 'Result');
    }
    return sourceField;
  };
  const currentFinancialFieldSources = (() => {
    const fieldSources = currentFinancialDataset?.overrideMeta?.provenance?.fieldSources;
    if (!fieldSources || fieldSources.length === 0) {
      return [];
    }
    return fieldSources.map((fieldSource) => ({
      sourceField: fieldSource.sourceField,
      label: financialSourceFieldLabel(fieldSource.sourceField),
      owner: datasetSourceLabel('manual', fieldSource.provenance),
    }));
  })();
  const canReapplyFinancialVeetiForYear =
    manualPatchYear != null &&
    canReapplyFinancialVeeti(yearDataCache[manualPatchYear], isAdmin);
  const currentFinancialSourceLabel = currentFinancialDataset
    ? datasetSourceLabel(
        currentFinancialDataset.source,
        currentFinancialDataset.overrideMeta?.provenance,
      )
    : t('v2Overview.sourceIncomplete', 'Incomplete');
  const isManualYearExcluded =
    manualPatchYear != null && excludedYearsSorted.includes(manualPatchYear);
  const currentManualYearStatus =
    manualPatchYear != null
      ? reviewStatusRows.find((row) => row.year === manualPatchYear)?.setupStatus ??
        (isManualYearExcluded ? 'excluded_from_plan' : 'ready_for_review')
      : 'needs_attention';
  const isCurrentYearReadyForReview =
    currentManualYearStatus === 'ready_for_review' ||
    currentManualYearStatus === 'reviewed';
  const manualPatchDialogTitle = isCurrentYearReadyForReview
    ? t('v2Overview.wizardQuestionReviewYear')
    : t('v2Overview.wizardQuestionFixYear');
  const manualPatchDialogBody = isManualYearExcluded
    ? t('v2Overview.manualPatchExcludedBody')
    : isCurrentYearReadyForReview
      ? t('v2Overview.wizardBodyReviewYear')
      : t('v2Overview.wizardBodyFixYear');
  const yearActionsBody = isManualYearExcluded
    ? t(
        'v2Overview.yearActionsExcludedBody',
        'Review the imported values, then restore the year to the plan or keep it excluded.',
      )
    : isCurrentYearReadyForReview
      ? t(
          'v2Overview.yearActionsReviewBody',
          'Approve the year as-is after reviewing the comparison, or open editing only if something needs to change.',
        )
      : t(
          'v2Overview.yearActionsFixBody',
          'Choose whether to correct the year, restore VEETI values, or exclude the year from the planning baseline.',
        );
  const keepYearButtonClass =
    isCurrentYearReadyForReview && manualPatchMode === 'review'
    ? 'v2-btn v2-btn-small v2-btn-primary'
    : 'v2-btn v2-btn-small';
  const fixYearButtonClass =
    currentManualYearStatus === 'needs_attention' &&
    manualPatchMode === 'review'
      ? 'v2-btn v2-btn-small v2-btn-primary'
      : 'v2-btn v2-btn-small';
  const connectSurface =
    wizardDisplayStep === 1 ? (
      <section>
        <article className="v2-card v2-overview-step-card">
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardProgress', { step: 1 })}
              </p>
              <h2>{t('v2Overview.wizardQuestionConnect')}</h2>
            </div>
            <span className="v2-chip v2-status-warning">
              {t('v2Overview.disconnected', 'Not connected')}
            </span>
          </div>

          <p className="v2-muted v2-overview-review-body">
            {t('v2Overview.wizardBodyConnect')}
          </p>
          <div className="v2-inline-form">
            <input
              id="v2-overview-org-search"
              name="orgSearch"
              className="v2-input"
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedOrg(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return;
                }
                event.preventDefault();
                void handleSearch();
              }}
              disabled={connecting || importingYears || syncing}
              placeholder={t(
                'v2Overview.searchPlaceholder',
                'Search by name or business ID',
              )}
            />
            <button
              className="v2-btn"
              type="button"
              onClick={handleSearch}
              disabled={
                searching ||
                connecting ||
                importingYears ||
                syncing ||
                query.trim().length < 2
              }
            >
              {searching
                ? t('v2Overview.searchingButton', 'Searching...')
                : t('v2Overview.searchButton', 'Search')}
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="v2-result-list">
              {searchResults.map((org) => {
                const isActive = selectedOrg?.Id === org.Id;
                const orgName =
                  org.Nimi ??
                  t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                    id: org.Id,
                  });
                return (
                  <button
                    type="button"
                    key={org.Id}
                    className={`v2-result-row ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedOrg(org);
                    }}
                    disabled={connecting || importingYears || syncing}
                  >
                    <div className="v2-result-main">
                      <strong>{renderHighlightedSearchMatch(orgName)}</strong>
                      <span>
                        {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                        {renderHighlightedSearchMatch(org.YTunnus ?? '-')}
                      </span>
                    </div>
                    <div className="v2-result-meta">
                      <span>
                        {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                        {renderHighlightedSearchMatch(org.Kunta ?? '-')}
                      </span>
                      {isActive ? (
                        <span className="v2-result-selected">
                          {t('v2Overview.resultSelected', 'Selected')}
                        </span>
                      ) : null}
                      {!isActive ? (
                        <span className="v2-result-selected">
                          {t('v2Overview.connectButton', 'Yhdistä organisaatio')}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedOrgStillVisible ? (
            <div className="v2-import-org-summary">
              <div>
                <strong>
                  {t('v2Overview.organizationLabel', 'Organization')}:{' '}
                  {selectedOrgName}
                </strong>
                <span>
                  {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                  {selectedOrgBusinessId}
                </span>
                {selectedOrg?.Kunta ? (
                  <span>
                    {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                    {selectedOrg?.Kunta}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="v2-btn v2-btn-small"
                onClick={() => setSelectedOrg(null)}
                disabled={connecting || importingYears || syncing}
              >
                {t('v2Overview.clearSelectionButton', 'Clear selection')}
              </button>
            </div>
          ) : null}

          <div className="v2-actions-row">
            <button
              type="button"
              className={connectButtonClass}
              onClick={() => void handleConnect(preferredSearchOrg)}
              disabled={
                !preferredSearchOrg ||
                searching ||
                connecting ||
                importingYears ||
                syncing
              }
            >
              {connecting
                ? t('v2Overview.connectingButton', 'Connecting...')
                : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
            </button>
          </div>
        </article>
      </section>
    ) : null;
  const importYearsSurface =
    wizardDisplayStep === 2 ? (
      <section>
        <article id="v2-import-years" className="v2-card v2-overview-step-card">
          <div className="v2-section-header">
            <div>
              {wizardBackLabel ? (
                <button
                  type="button"
                  className="v2-step-back-btn"
                  onClick={handleWizardBack}
                >
                  {wizardBackLabel}
                </button>
              ) : null}
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardProgress', { step: 2 })}
              </p>
              <h2>{t('v2Overview.wizardQuestionImportYears')}</h2>
            </div>
            <span className="v2-chip">
              {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
              {selectedYears.length}
            </span>
          </div>

          <p className="v2-muted v2-overview-review-body">
            {t('v2Overview.wizardBodyImportYears')}
          </p>

          {selectableImportYearRows.length === 0 ? (
            <p className="v2-muted">
              {t(
                'v2Overview.noImportedYears',
                'No imported years available yet.',
              )}
            </p>
          ) : (
            <>
              <div className="v2-import-board">
                {[
                  {
                    key: 'ready',
                    title: t('v2Overview.trustLaneReadyTitle', 'Ready to review'),
                    body: t(
                      'v2Overview.trustLaneReadyBody',
                      'These years look plausible enough to select now and verify after import.',
                    ),
                    rows: readyTrustBoardRows,
                  },
                  {
                    key: 'suspicious',
                    title: t(
                      'v2Overview.trustLaneSuspiciousTitle',
                      'Suspicious but salvageable',
                    ),
                    body: t(
                      'v2Overview.trustLaneSuspiciousBody',
                      'These years can still be selected, but the trust signals call for a human check before they become the planning baseline.',
                    ),
                    rows: suspiciousTrustBoardRows,
                  },
                  {
                    key: 'blocked',
                    title: t(
                      'v2Overview.trustLaneBlockedTitle',
                      'Blocked until completed',
                    ),
                    body: t(
                      'v2Overview.trustLaneBlockedBody',
                      'These years are missing key inputs and should stay out of the import selection until the gaps are fixed.',
                    ),
                    rows: blockedTrustBoardRows,
                  },
                  {
                    key: 'parked',
                    title: t(
                      'v2Overview.trustLaneParkedTitle',
                      'Not in this import',
                    ),
                    body: t(
                      'v2Overview.trustLaneParkedBody',
                      'These years stay available, but they are intentionally parked outside the current import selection.',
                    ),
                    rows: parkedTrustBoardRows,
                  },
                ].map((lane) => {
                  if (lane.rows.length === 0) {
                    return null;
                  }
                  const laneHeader = (
                    <div className="v2-import-board-summary">
                      <div className="v2-year-readiness-section-head">
                        <h3>{lane.title}</h3>
                        <p className="v2-muted">{lane.body}</p>
                      </div>
                      <span className="v2-import-board-count">{lane.rows.length}</span>
                    </div>
                  );
                  const laneGrid = (
                    <div className="v2-import-board-grid">
                      {lane.rows.map((row) => {
                          const yearData = yearDataCache[row.vuosi];
                          const canonRows = IMPORT_BOARD_CANON_ROWS.map((item) => ({
                            ...item,
                            value: row.summaryMap.get(item.key)?.effectiveValue ?? null,
                          }));
                          const priceForm = buildPriceForm(yearData);
                          const volumeForm = buildVolumeForm(yearData);
                          const priceRows = getEffectiveRows(yearData, 'taksa');
                          const waterPriceRow = priceRows.find(
                            (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
                          );
                          const wastewaterPriceRow = priceRows.find(
                            (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
                          );
                          const waterVolumeRow = getEffectiveFirstRow(
                            yearData,
                            'volume_vesi',
                          );
                          const wastewaterVolumeRow = getEffectiveFirstRow(
                            yearData,
                            'volume_jatevesi',
                          );
                          const secondaryStats = [
                            {
                              label: t(
                                'v2Overview.previewWaterPriceLabel',
                                'Water price',
                              ),
                              focusField: 'waterUnitPrice' as InlineCardField,
                              missing: !row.completeness.taksa || waterPriceRow == null,
                              zero:
                                waterPriceRow != null &&
                                priceForm.waterUnitPrice === 0,
                              value: formatPrice(priceForm.waterUnitPrice),
                            },
                            {
                              label: t(
                                'v2Overview.previewWastewaterPriceLabel',
                                'Wastewater price',
                              ),
                              focusField: 'wastewaterUnitPrice' as InlineCardField,
                              missing:
                                !row.completeness.taksa ||
                                wastewaterPriceRow == null,
                              zero:
                                wastewaterPriceRow != null &&
                                priceForm.wastewaterUnitPrice === 0,
                              value: formatPrice(priceForm.wastewaterUnitPrice),
                            },
                            {
                              label: t(
                                'v2Overview.previewWaterVolumeLabel',
                                'Sold water',
                              ),
                              focusField: 'soldWaterVolume' as InlineCardField,
                              missing:
                                !row.completeness.volume_vesi ||
                                Object.keys(waterVolumeRow).length === 0,
                              zero:
                                Object.keys(waterVolumeRow).length > 0 &&
                                volumeForm.soldWaterVolume === 0,
                              value: `${formatNumber(volumeForm.soldWaterVolume)} m3`,
                            },
                            {
                              label: t(
                                'v2Overview.previewWastewaterVolumeLabel',
                                'Sold wastewater',
                              ),
                              focusField: 'soldWastewaterVolume' as InlineCardField,
                              missing:
                                !row.completeness.volume_jatevesi ||
                                Object.keys(wastewaterVolumeRow).length === 0,
                              zero:
                                Object.keys(wastewaterVolumeRow).length > 0 &&
                                volumeForm.soldWastewaterVolume === 0,
                              value: `${formatNumber(volumeForm.soldWastewaterVolume)} m3`,
                            },
                          ];
                          const repairActions = isAdmin
                            ? buildRepairActions(row.vuosi, row.missingRequirements)
                            : [];
                          const sourceLayers = buildImportYearSourceLayers(yearData);
                          const isInlineCardActive = cardEditYear === row.vuosi;
                          const activeStep2Field =
                            isInlineCardActive && cardEditContext === 'step2'
                              ? cardEditFocusField
                              : null;
                          const quietOtherCards =
                            cardEditYear != null && cardEditYear !== row.vuosi;
                          return (
                            <article
                              key={`${lane.key}-${row.vuosi}`}
                              className={`v2-year-readiness-row ${lane.key} ${
                                isInlineCardActive ? 'active-edit' : ''
                              } ${quietOtherCards ? 'quiet' : ''}`.trim()}
                            >
                              <div className="v2-year-readiness-head">
                                {lane.key === 'blocked' ? (
                                  <div className="v2-year-checkbox v2-year-select-disabled">
                                    <strong>{row.vuosi}</strong>
                                  </div>
                                ) : (
                                  <label
                                    className="v2-year-checkbox"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      name={`syncYear-${row.vuosi}`}
                                      checked={selectedYears.includes(row.vuosi)}
                                      onChange={() => toggleYear(row.vuosi, null)}
                                      disabled={syncing}
                                    />
                                    <strong>{row.vuosi}</strong>
                                  </label>
                                )}
                                <div className="v2-badge-row">
                                  <span className={`v2-badge ${row.trustToneClass}`}>
                                    {row.trustLabel}
                                  </span>
                                  <span
                                    className={`v2-badge ${sourceStatusClassName(
                                      row.sourceStatus,
                                    )}`}
                                  >
                                    {sourceStatusLabel(row.sourceStatus)}
                                  </span>
                                </div>
                              </div>

                              {row.missingSummary ? (
                                <div className={`v2-year-gap-summary ${lane.key}`}>
                                  <strong>
                                    {t(
                                      'v2Overview.yearMissingCountLabel',
                                      'Missing {{count}}/{{total}} required items',
                                      {
                                        count: row.missingSummary.count,
                                        total: row.missingSummary.total,
                                      },
                                    )}
                                  </strong>
                                  <span>
                                    {t(
                                      'v2Overview.yearMissingFieldsLabel',
                                      'Missing: {{fields}}',
                                      { fields: row.missingSummary.fields },
                                    )}
                                  </span>
                                </div>
                              ) : null}

                              <div className="v2-year-canon-rows">
                                {canonRows.map((item) => {
                                  const missing = item.value == null;
                                  const zero = !missing && item.value === 0;
                                  const resultToneClass =
                                    item.key === 'result' && item.value != null
                                      ? item.value >= 0
                                        ? 'positive'
                                        : 'negative'
                                      : '';
                                  return (
                                    <div
                                      key={`${row.vuosi}-${item.key}`}
                                      className={`v2-year-canon-row ${
                                        item.emphasized ? 'result' : ''
                                      } ${missing ? 'missing' : ''} ${
                                        zero ? 'zero' : ''
                                      } ${
                                        activeStep2Field ===
                                        CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key]
                                          ? 'editing-field'
                                          : ''
                                      }`.trim()}
                                    >
                                      <span>{t(item.labelKey, item.defaultLabel)}</span>
                                      <button
                                        type="button"
                                        data-edit-field={CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key]}
                                        className={`v2-year-canon-value ${
                                          missing ? 'v2-year-preview-missing' : ''
                                        } ${zero ? 'v2-year-preview-zero' : ''} ${resultToneClass}`.trim()}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (!isAdmin) return;
                                          void attemptOpenInlineCardEditor(
                                            row.vuosi,
                                            CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key],
                                          );
                                        }}
                                      >
                                        {missing
                                          ? t(
                                              'v2Overview.checkMissing',
                                              'Missing',
                                            )
                                          : formatEur(item.value ?? 0)}
                                      </button>
                                      {activeStep2Field ===
                                      CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key]
                                        ? renderStep2InlineFieldEditor(
                                            CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key],
                                          )
                                        : null}
                                    </div>
                                  );
                                })}
                              </div>

                              {row.trustNote ? (
                                <p
                                  className={
                                    lane.key === 'blocked'
                                      ? 'v2-year-readiness-missing'
                                      : 'v2-muted'
                                  }
                                >
                                  {row.trustNote}
                                </p>
                              ) : null}
                              {row.resultToZero.direction !== 'missing' ? (
                                <p className="v2-muted">
                                  {t(
                                    'v2Overview.yearResultToZeroSignal',
                                    'Tulos / 0: {{value}}',
                                    {
                                      value:
                                        row.resultToZero.marginPct == null
                                          ? formatEur(
                                              row.resultToZero.effectiveValue ?? 0,
                                            )
                                          : `${formatEur(
                                              row.resultToZero.effectiveValue ?? 0,
                                            )} (${formatNumber(
                                              Math.abs(row.resultToZero.marginPct),
                                            )} %)`,
                                    },
                                  )}
                                </p>
                              ) : null}

                              <div className="v2-year-card-secondary">
                                <span className="v2-year-preview-secondary-label">
                                  {t(
                                    'v2Overview.previewSecondaryLabel',
                                    'Secondary main stats',
                                  )}
                                </span>
                                <div className="v2-year-card-secondary-grid compact">
                                  {secondaryStats.map((item) => {
                                    const isSecondaryFieldActive =
                                      activeStep2Field === item.focusField;
                                    return isAdmin ? (
                                      <div
                                        key={`${row.vuosi}-${item.label}`}
                                        className={`v2-year-preview-item secondary ${
                                          item.missing ? 'missing' : ''
                                        } ${item.zero ? 'zero' : ''} ${
                                          isSecondaryFieldActive ? 'editing-field' : ''
                                        }`.trim()}
                                      >
                                        <button
                                          type="button"
                                          data-edit-field={item.focusField}
                                          className="v2-year-preview-item-button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void attemptOpenInlineCardEditor(
                                              row.vuosi,
                                              item.focusField,
                                              'step2',
                                              row.missingRequirements,
                                              'manualEdit',
                                            );
                                          }}
                                        >
                                          <span>{item.label}</span>
                                          <strong
                                            className={`${item.missing ? 'v2-year-preview-missing' : ''} ${
                                              item.zero ? 'v2-year-preview-zero' : ''
                                            }`.trim()}
                                          >
                                            {item.missing
                                              ? t('v2Overview.checkMissing', 'Missing')
                                              : item.value}
                                          </strong>
                                        </button>
                                        {isSecondaryFieldActive
                                          ? renderStep2InlineFieldEditor(item.focusField)
                                          : null}
                                      </div>
                                    ) : (
                                      <div
                                        key={`${row.vuosi}-${item.label}`}
                                        className={`v2-year-preview-item secondary ${
                                          item.missing ? 'missing' : ''
                                        } ${item.zero ? 'zero' : ''}`.trim()}
                                      >
                                        <span>{item.label}</span>
                                        <strong
                                          className={`${item.missing ? 'v2-year-preview-missing' : ''} ${
                                            item.zero ? 'v2-year-preview-zero' : ''
                                          }`.trim()}
                                        >
                                          {item.missing
                                            ? t('v2Overview.checkMissing', 'Missing')
                                            : item.value}
                                        </strong>
                                      </div>
                                    );
                                  })}
                                </div>
                                {repairActions.length > 0 ? (
                                  <div className="v2-year-card-repair-actions">
                                    {repairActions.map((action) => (
                                      <button
                                        key={`${row.vuosi}-${action.key}`}
                                        type="button"
                                        className="v2-btn v2-btn-small"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void openInlineCardEditor(
                                            row.vuosi,
                                            action.focusField,
                                            'step2',
                                            row.missingRequirements,
                                            'manualEdit',
                                          );
                                        }}
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                                {isAdmin ? (
                                  <div className="v2-year-card-repair-actions">
                                    <button
                                      type="button"
                                      className="v2-btn v2-btn-small"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void openManualPatchDialog(
                                          row.vuosi,
                                          row.missingRequirements,
                                          'qdisImport',
                                        );
                                      }}
                                    >
                                      {t(
                                        'v2Overview.qdisImportAction',
                                        'Import QDIS PDF',
                                      )}
                                    </button>
                                  </div>
                                ) : null}
                                <div className="v2-year-source-list">
                                  {sourceLayers.map((layer) => (
                                    <span
                                      key={`${row.vuosi}-${layer.key}`}
                                      className="v2-year-source-pill"
                                    >
                                      {sourceLayerText(layer)}
                                    </span>
                                  ))}
                                </div>
                                <div className="v2-year-card-meta">
                                  <span>
                                    {t('v2Overview.sourceLabel', 'Source')}:{' '}
                                    {sourceStatusLabel(row.sourceStatus)}
                                  </span>
                                  <span>
                                    {renderDatasetCounts(
                                      row.datasetCounts as
                                        | Record<string, number>
                                        | undefined,
                                    )}
                                  </span>
                                </div>
                              </div>

                              {isInlineCardActive ? (
                                <div className="v2-inline-card-editor">
                                  {loadingYearData === row.vuosi ? (
                                    <p className="v2-muted">
                                      {t('common.loading', 'Loading...')}
                                    </p>
                                  ) : (
                                    <>
                                      {manualPatchError ? (
                                        <div className="v2-alert v2-alert-error">
                                          {manualPatchError}
                                        </div>
                                      ) : null}
                                      {row.missingRequirements.length > 0 ? (
                                        <p className="v2-manual-required-note">
                                          {t(
                                            'v2Overview.manualPatchRequiredHint',
                                            'Required for sync readiness: {{requirements}}',
                                            {
                                              requirements: row.missingRequirements
                                                .map((item) =>
                                                  missingRequirementLabel(item),
                                                )
                                                .join(', '),
                                            },
                                          )}
                                        </p>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              ) : null}

                              {lane.key === 'blocked' && isAdmin ? (
                                <button
                                  type="button"
                                  className="v2-btn v2-btn-small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void openInlineCardEditor(
                                      row.vuosi,
                                      null,
                                      'step2',
                                      row.missingRequirements,
                                      'manualEdit',
                                    );
                                  }}
                                >
                                  {t(
                                    'v2Overview.manualPatchButton',
                                    'Complete manually',
                                  )}
                                </button>
                              ) : null}
                            </article>
                          );
                        })}
                    </div>
                  );
                  if (lane.key === 'blocked') {
                    return (
                      <details
                        key={lane.key}
                        className={`v2-import-board-lane v2-import-board-lane-${lane.key}`}
                      >
                        <summary>{laneHeader}</summary>
                        {laneGrid}
                      </details>
                    );
                  }
                  return (
                    <section
                      key={lane.key}
                      className={`v2-import-board-lane v2-import-board-lane-${lane.key}`}
                    >
                      {laneHeader}
                      {laneGrid}
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {blockedYearCount > 0 && !isAdmin ? (
            <p className="v2-muted">
              {t(
                'v2Overview.manualPatchAdminOnlyHint',
                'Manual completion is available for admins only.',
              )}
            </p>
          ) : null}

          <div className="v2-actions-row">
            <button
              type="button"
              className={importYearsButtonClass}
              onClick={handleImportYears}
              disabled={
                !importStatus.connected ||
                importingYears ||
                syncing ||
                selectedYears.length === 0
              }
            >
              {importingYears
                ? t('v2Overview.importingYearsButton')
                : t('v2Overview.importYearsButton')}
            </button>
          </div>
        </article>
      </section>
    ) : null;

  const shouldLeadWithActionSurface =
    wizardDisplayStep === 1 ||
    wizardDisplayStep === 2 ||
    wizardDisplayStep === 3;
  const compactSupportingChrome = shouldLeadWithActionSurface;
  const supportingChromeEyebrow = compactSupportingChrome
    ? t('v2Overview.wizardSummaryTitle')
    : t('v2Overview.wizardLabel');
  const supportingChromeTitle = compactSupportingChrome
    ? t('v2Overview.wizardSummarySubtitle')
    : wizardHero.title;

  const heroGrid = (
    <section
      className={`v2-overview-hero-grid ${
        isStep2SupportChrome ? 'step2-support' : ''
      }`}
    >
        <article
          className={`v2-card v2-overview-summary-card v2-overview-wizard-card ${
            compactSupportingChrome ? 'compact' : ''
          } ${isStep2SupportChrome ? 'v2-overview-step2-support-card' : ''}`}
        >
          <div className="v2-overview-summary-head">
            <div>
              <p className="v2-overview-eyebrow">
                {supportingChromeEyebrow}
              </p>
              <h2>{supportingChromeTitle}</h2>
            </div>
            <span className="v2-chip v2-status-info">
              {t('v2Overview.wizardProgress', { step: wizardDisplayStep })}
            </span>
          </div>

          {!compactSupportingChrome ? (
            <p className="v2-muted v2-overview-summary-body">{wizardHero.body}</p>
          ) : null}

          <div className="v2-overview-summary-meta">
            {summaryMetaBlocks.map((block) => (
              <div key={block.label} className="v2-overview-meta-block">
                <span>{block.label}</span>
                <strong>{block.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <aside
          className={`v2-card v2-overview-progress-card ${
            compactSupportingChrome ? 'compact' : ''
          } ${isStep2SupportChrome ? 'step2-support' : ''}`}
        >
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardSummaryTitle')}
              </p>
              <h3>
                {isStep2SupportChrome
                  ? t('v2Overview.wizardContextImportedWorkspaceYears')
                  : t('v2Overview.wizardSummarySubtitle')}
              </h3>
            </div>
            <span className="v2-chip v2-status-provenance">
              {t('v2Overview.wizardProgress', { step: wizardDisplayStep })}
            </span>
          </div>

          <div className="v2-overview-progress-list">
            {wizardSummaryItems.map((item) => (
              <article key={item.label} className="v2-overview-progress-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>

          {wizardContextHelpers.length > 0 ? (
            <div
              className={`v2-overview-helper-list ${
                isStep2SupportChrome ? 'step2-support' : ''
              }`}
            >
              {wizardContextHelpers.map((helper) => (
                <article
                  key={helper.key}
                  className={`v2-overview-helper-card v2-overview-helper-card-${helper.tone}`}
                >
                  <div className="v2-overview-helper-head">
                    <span>{helper.label}</span>
                    <strong>{helper.title}</strong>
                  </div>
                  <p>{helper.body}</p>
                </article>
              ))}
            </div>
          ) : null}
        </aside>
      </section>
  );

  const activeSurface = (
    <div className="v2-overview-active-surface">
        {connectSurface}

        {importYearsSurface}

      {false ? (
      <section>
        <article className="v2-card">
          <div className="v2-section-header">
            <h2>{t('v2Overview.importTitle', 'Import VEETI')}</h2>
            <strong className="v2-import-progress">
              {t('v2Overview.importStepProgress', 'Step {{step}} / 3', {
                step: importStep,
              })}
            </strong>
          </div>
          <p className="v2-muted">
            {t(
              'v2Overview.wizardBodyImportYears',
              'Choose the years you want in this workspace. After import you will immediately see which years are included.',
            )}
          </p>

          <ol className="v2-import-stepper" aria-label="VEETI import steps">
            <li className={!importStatus.connected ? 'current' : 'done'}>
              <strong>
                {t(
                  'v2Overview.wizardQuestionConnect',
                  'Minkä vesilaitoksen tiedoilla työskentelet?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardStepOneHelp',
                  'Search by name or business ID and connect the imported organization.',
                )}
              </span>
            </li>
            <li
              className={
                !importStatus.connected
                  ? 'pending'
                  : importStep === 2
                  ? 'current'
                  : 'done'
              }
            >
              <strong>
                {t(
                  'v2Overview.wizardQuestionImportYears',
                  'Mitkä vuodet haluat tuoda sisään?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardStepTwoHelp',
                  'Select the years you want to bring into this workspace.',
                )}
              </span>
            </li>
            <li className={importStep === 3 ? 'current' : 'pending'}>
              <strong>
                {t(
                  'v2Overview.wizardQuestionReviewYears',
                  'Mitkä vuodet ovat käyttövalmiita?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardBodyReviewYears',
                  'Tarkista jokainen vuosi yhdestä paikasta. Tässä vaiheessa tarkoitus on ymmärtää vuosien tila ennen korjauksia tai rajauksia.',
                )}
              </span>
            </li>
          </ol>

          <section
            className={`v2-import-panel ${
              importStatus.connected ? 'done' : 'current'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionConnect',
                  'Minkä vesilaitoksen tiedoilla työskentelet?',
                )}
              </h3>
              <span
                className={`v2-chip ${
                  importStatus.connected
                    ? 'v2-status-positive'
                    : 'v2-status-warning'
                }`}
              >
                {importStatus.connected
                  ? t('v2Overview.connected', 'Connected')
                  : t('v2Overview.disconnected', 'Not connected')}
              </span>
            </div>

            <div className="v2-import-org-summary">
              <div>
                <strong>
                  {t('v2Overview.organizationLabel', 'Organization')}:{' '}
                  {selectedOrgName}
                </strong>
                <span>
                  {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                  {selectedOrgBusinessId}
                </span>
                {selectedOrg?.Kunta ? (
                  <span>
                    {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                    {selectedOrg?.Kunta}
                  </span>
                ) : null}
              </div>
              {selectedOrgStillVisible ? (
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={() => setSelectedOrg(null)}
                  disabled={connecting || importingYears || syncing}
                >
                  {t('v2Overview.clearSelectionButton', 'Clear selection')}
                </button>
              ) : null}
            </div>

            <div className="v2-inline-form">
              <input
                id="v2-overview-org-search"
                name="orgSearch"
                className="v2-input"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedOrg(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  if (preferredSearchOrg) {
                    void handleConnect(preferredSearchOrg);
                    return;
                  }
                  void handleSearch();
                }}
                disabled={connecting || importingYears || syncing}
                placeholder={t(
                  'v2Overview.searchPlaceholder',
                  'Search by name or business ID',
                )}
              />
              <button
                className="v2-btn"
                type="button"
                onClick={handleSearch}
                disabled={
                  searching ||
                  connecting ||
                  importingYears ||
                  syncing ||
                  query.trim().length < 2
                }
              >
                {searching
                  ? t('v2Overview.searchingButton', 'Searching...')
                  : t('v2Overview.searchButton', 'Search')}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="v2-result-list">
                {searchResults.map((org) => {
                  const isActive = selectedOrg?.Id === org.Id;
                  const orgName =
                    org.Nimi ??
                    t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                      id: org.Id,
                    });
                  return (
                    <button
                      type="button"
                      key={org.Id}
                      className={`v2-result-row ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedOrg(org);
                        void handleConnect(org);
                      }}
                      disabled={connecting || importingYears || syncing}
                    >
                      <div className="v2-result-main">
                        <strong>{renderHighlightedSearchMatch(orgName)}</strong>
                        <span>
                          {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                          {renderHighlightedSearchMatch(org.YTunnus ?? '-')}
                        </span>
                      </div>
                      <div className="v2-result-meta">
                        <span>
                          {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                          {renderHighlightedSearchMatch(org.Kunta ?? '-')}
                        </span>
                        {isActive ? (
                          <span className="v2-result-selected">
                            {t('v2Overview.resultSelected', 'Selected')}
                          </span>
                        ) : null}
                        {!isActive ? (
                          <span className="v2-result-selected">
                            {t('v2Overview.connectButton', 'Yhdistä organisaatio')}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="v2-actions-row">
              <button
                type="button"
                className={connectButtonClass}
                onClick={() => void handleConnect(preferredSearchOrg)}
                disabled={
                  !preferredSearchOrg ||
                  searching ||
                  connecting ||
                  importingYears ||
                  syncing
                }
              >
                {connecting
                  ? t('v2Overview.connectingButton', 'Connecting...')
                  : importStatus.connected
                  ? t(
                      'v2Overview.connectSelectedButton',
                      'Yhdistä organisaatio',
                    )
                  : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
              </button>
            </div>
          </section>

          <section
            id="v2-import-years"
            className={`v2-import-panel ${
              !importStatus.connected
                ? 'disabled'
                : importStep === 2
                ? 'current'
                : 'done'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionImportYears',
                  'Mitkä vuodet haluat tuoda sisään?',
                )}
              </h3>
              <span className="v2-chip">
                {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
                {selectedYears.length}
              </span>
            </div>

            {!importStatus.connected ? (
              <p className="v2-muted">
                {t(
                  'v2Overview.yearSelectionLocked',
                  'Connect an organization first to review and select years.',
                )}
              </p>
            ) : (
              <>
                {recommendedYears.length > 0 ? (
                  <p className="v2-muted">
                    {t('v2Overview.availableYearsHint', 'Available years: {{years}}', {
                      years: recommendedYears.join(', '),
                    })}
                  </p>
                ) : null}

                {importYearRows.length === 0 ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.noImportedYears',
                      'No imported years available yet.',
                    )}
                  </p>
                ) : (
                  <div className="v2-year-readiness-table">
                    {importYearRows.map((row) => {
                      const isBlocked = row.syncBlockedReason != null;
                      return (
                        <div
                          key={row.vuosi}
                          className={`v2-year-readiness-row ${
                            isBlocked ? 'blocked' : 'ready'
                          }`}
                        >
                          <div className="v2-year-readiness-head">
                            <label
                              className={`v2-year-checkbox ${
                                isBlocked ? 'v2-year-select-disabled' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                name={`syncYear-${row.vuosi}`}
                                checked={selectedYears.includes(row.vuosi)}
                                onChange={() =>
                                  toggleYear(row.vuosi, row.syncBlockedReason)
                                }
                                disabled={syncing || isBlocked}
                              />
                              <strong>{row.vuosi}</strong>
                            </label>
                            <span
                              className={`v2-chip ${isBlocked ? 'warn' : 'ok'}`}
                            >
                              {isBlocked
                                ? t(
                                    'v2Overview.yearNeedsCompletion',
                                    'Needs completion',
                                  )
                                : row.setupStatus === 'reviewed'
                                  ? t('v2Overview.yearReviewed', 'Tarkistettu')
                                  : t('v2Overview.yearReadyForReview', 'Tarkista')}
                            </span>
                            <span
                              className={`v2-badge ${sourceStatusClassName(
                                row.sourceStatus,
                              )}`}
                            >
                              {sourceStatusLabel(row.sourceStatus)}
                            </span>
                          </div>

                          {isBlocked ? (
                            <p className="v2-year-readiness-missing">
                              {t(
                                'v2Overview.yearMissingLabel',
                                'Missing requirements: {{requirements}}',
                                {
                                  requirements: row.missingRequirements
                                    .map((item) =>
                                      missingRequirementLabel(item),
                                    )
                                    .join(', '),
                                },
                              )}
                            </p>
                          ) : null}

                          {row.warnings && row.warnings.length > 0 ? (
                            <p className="v2-muted">
                              {row.warnings
                                .map((warning) => importWarningLabel(warning))
                                .join(' ')}
                            </p>
                          ) : null}

                          {renderYearValuePreview(row.vuosi, {
                            financials:
                              row.readinessChecks.find(
                                (check) => check.key === 'financials',
                              )?.ready === true,
                            prices:
                              row.readinessChecks.find(
                                (check) => check.key === 'prices',
                              )?.ready === true,
                            volumes:
                              row.readinessChecks.find(
                                (check) => check.key === 'volumes',
                              )?.ready === true,
                          })}

                          <p className="v2-muted">
                            {t(
                              'v2Overview.datasetCountsSecondaryLabel',
                              'Imported rows in background data',
                            )}
                            :{' '}
                            {renderDatasetCounts(
                              row.datasetCounts as
                                | Record<string, number>
                                | undefined,
                            )}
                          </p>

                          {isAdmin
                            ? buildRepairActions(
                                row.vuosi,
                                row.missingRequirements,
                              ).map((action) => (
                                <button
                                  key={`${row.vuosi}-${action.key}`}
                                  type="button"
                                  className="v2-btn v2-btn-small"
                                  onClick={() =>
                                    void openInlineCardEditor(
                                      row.vuosi,
                                      action.focusField,
                                      'step3',
                                      row.missingRequirements,
                                      'manualEdit',
                                    )
                                  }
                                >
                                  {action.label}
                                </button>
                              ))
                            : null}
                          {isBlocked && isAdmin ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step3',
                                  row.missingRequirements,
                                )
                              }
                            >
                              {t(
                                'v2Overview.manualPatchButton',
                                'Complete manually',
                              )}
                            </button>
                          ) : null}
                          {!isBlocked ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step3',
                                  row.missingRequirements,
                                )
                              }
                            >
                              {t(
                                'v2Overview.openReviewYearButton',
                                'Avaa ja tarkista',
                              )}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {blockedYearCount > 0 && !isAdmin ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.manualPatchAdminOnlyHint',
                      'Manual completion is available for admins only.',
                    )}
                  </p>
                ) : null}
                <div className="v2-actions-row">
                  <button
                    type="button"
                    className={importYearsButtonClass}
                    onClick={handleImportYears}
                    disabled={
                      !importStatus.connected ||
                      importingYears ||
                      syncing ||
                      selectedYears.length === 0
                    }
                  >
                    {importingYears
                      ? t('v2Overview.importingYearsButton', 'Tuodaan vuosia...')
                      : t('v2Overview.importYearsButton', 'Tuo valitut vuodet')}
                  </button>
                </div>
              </>
            )}
          </section>

          <section
            className={`v2-import-panel ${
              !importStatus.connected
                ? 'disabled'
                : importStep === 3
                ? 'current'
                : 'pending'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionReviewYears',
                  'Mitkä vuodet ovat käyttövalmiita?',
                )}
              </h3>
            </div>
            {!importStatus.connected ? (
              <p className="v2-muted">
                {t(
                  'v2Overview.importReviewLocked',
                  'Connect an organization before starting import.',
                )}
              </p>
            ) : (
              <>
                {selectedYears.length === 0 ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.importedYearsPending',
                      'Valitse ainakin yksi vuosi vaiheessa 2, jotta näet mitä työtilassa on mukana.',
                    )}
                  </p>
                ) : (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.wizardContextImportedWorkspaceYearsBody',
                      'Imported workspace years: {{years}}. Review them in the same setup flow before building the planning baseline.',
                      {
                        years:
                          confirmedImportedYears.length > 0
                            ? confirmedImportedYears.join(', ')
                            : t('v2Overview.noYearsSelected', 'None selected'),
                      },
                    )}
                  </p>
                )}
              </>
            )}
          </section>
        </article>
      </section>
      ) : null}

      <input
        ref={statementFileInputRef}
        type="file"
        data-import-kind="statement"
        accept="application/pdf"
        onChange={handleStatementPdfSelected}
        disabled={statementImportBusy || manualPatchBusy}
        hidden
      />
      <input
        ref={workbookFileInputRef}
        type="file"
        data-import-kind="workbook"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleWorkbookSelected}
        disabled={workbookImportBusy || manualPatchBusy}
        hidden
      />
      <input
        ref={qdisFileInputRef}
        type="file"
        data-import-kind="qdis"
        accept="application/pdf"
        onChange={handleQdisPdfSelected}
        disabled={qdisImportBusy || manualPatchBusy}
        hidden
      />

      {wizardDisplayStep === 4 &&
      manualPatchYear != null &&
      cardEditContext !== 'step3' ? (
        <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="v2-modal-card">
            {wizardBackLabel ? (
              <button
                type="button"
                className="v2-step-back-btn"
                onClick={handleWizardBack}
              >
                {wizardBackLabel}
              </button>
            ) : null}
            <h3>{manualPatchDialogTitle}</h3>
            <p className="v2-muted">{manualPatchDialogBody}</p>
            <span className="v2-chip v2-status-provenance">
              {manualPatchYear}
            </span>
            {manualPatchError ? (
              <div className="v2-alert v2-alert-error">{manualPatchError}</div>
            ) : null}
            {loadingYearData === manualPatchYear ? (
              <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
            ) : null}

            {manualPatchMissing.length > 0 ? (
              <p className="v2-manual-required-note">
                {t(
                  'v2Overview.manualPatchRequiredHint',
                  'Required for sync readiness: {{requirements}}',
                  {
                    requirements: manualPatchMissing
                      .map((item) => missingRequirementLabel(item))
                      .join(', '),
                  },
                )}
              </p>
            ) : null}

            <section className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>
                  {t(
                    'v2Overview.yearDetailTitle',
                    'Year review surface',
                  )}
                </h4>
                <span className="v2-required-pill v2-required-pill-optional">
                  {currentFinancialSourceLabel}
                </span>
              </div>
              <p className="v2-muted">
                {isManualYearExcluded
                  ? t(
                      'v2Overview.yearDetailExcludedBody',
                      'This year is excluded from the planning baseline, but you can still review the imported values and restore it when needed.',
                    )
                  : t(
                      'v2Overview.yearDetailBody',
                      'Review the imported year calmly before deciding what to edit, restore from VEETI, or keep as-is.',
                    )}
              </p>
              {isReviewMode && !isStatementImportMode ? (
                <p className="v2-manual-review-note">
                  {t(
                    'v2Overview.reviewModeHint',
                    'Edit fields stay hidden until you choose "Fix values". Start by reviewing the comparison and deciding what to do with the year.',
                  )}
                </p>
              ) : null}
                <div className="v2-keyvalue-list">
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Overview.yearDetailStatus', 'Current status')}</span>
                    <span>{setupStatusLabel(currentManualYearStatus)}</span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Overview.yearDetailSource', 'Current source')}</span>
                  <span>{currentFinancialSourceLabel}</span>
                </div>
                {currentFinancialFieldSources.length > 0 ? (
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.yearDetailFinancialOwnership',
                        'Financial field ownership',
                      )}
                    </span>
                    <span>
                      {currentFinancialFieldSources
                        .map((field) => `${field.label}: ${field.owner}`)
                        .join(' | ')}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            {isStatementImportMode ? (
              <section className="v2-manual-section v2-statement-impact-panel">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.statementImportEffectTitle',
                      'What this import changes',
                    )}
                  </h4>
                </div>
                <div className="v2-keyvalue-list">
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectChanged',
                        'Will update',
                      )}
                    </span>
                    <span>
                      {t(
                        'v2Overview.datasetFinancials',
                        'Financial statement',
                      )}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectCurrentFinancialSource',
                        'Current financial source',
                      )}
                    </span>
                    <span>
                      {statementImportImpact.currentFinancialSource === 'manual'
                        ? t('v2Overview.sourceManual', 'Manual')
                        : statementImportImpact.currentFinancialSource ===
                          'veeti'
                        ? t('v2Overview.sourceVeeti', 'VEETI')
                        : t('v2Overview.sourceIncomplete', 'Incomplete')}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectKeepsVeeti',
                        'Keeps from VEETI',
                      )}
                    </span>
                    <span>
                      {renderDatasetTypeList(statementImportImpact.keepVeeti)}
                    </span>
                  </div>
                  {statementImportImpact.keepManual.length > 0 ? (
                    <div className="v2-keyvalue-row">
                      <span>
                        {t(
                          'v2Overview.statementImportEffectKeepsManual',
                          'Keeps manual',
                        )}
                      </span>
                      <span>
                        {renderDatasetTypeList(statementImportImpact.keepManual)}
                      </span>
                    </div>
                  ) : null}
                  {statementImportImpact.keepEmpty.length > 0 ? (
                    <div className="v2-keyvalue-row">
                      <span>
                        {t(
                          'v2Overview.statementImportEffectStillMissing',
                          'Still missing',
                        )}
                      </span>
                      <span>
                        {renderDatasetTypeList(statementImportImpact.keepEmpty)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
            {isWorkbookImportMode
              ? renderWorkbookImportWorkflow(manualPatchYear ?? '-')
              : null}
            {isQdisImportMode ? renderQdisImportWorkflow(manualPatchYear ?? '-') : null}

            {financialComparisonRows.length > 0 ||
            priceComparisonRows.length > 0 ||
            volumeComparisonRows.length > 0 ? (
              <details className="v2-manual-optional">
                <summary>
                  {t(
                    'v2Overview.yearSecondaryTools',
                    'Additional tools and restore actions',
                  )}
                </summary>
            {financialComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.financialComparisonTitle',
                      'VEETI vs effective financial values',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasFinancialComparisonDiffs
                        ? ''
                        : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasFinancialComparisonDiffs
                      ? t(
                          'v2Overview.financialComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.financialComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.financialComparisonBody',
                    'Review how the current effective year differs from the original VEETI financial row before saving changes.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {financialComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatEur(row.veetiValue)} |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatEur(row.effectiveValue)}
                        {row.changed
                          ? ` | ${t(
                              'v2Overview.financialComparisonDelta',
                              'Delta',
                            )}: ${formatEur(row.effectiveValue - row.veetiValue)}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyFinancialVeetiForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiFinancials}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiFinancials',
                      'Restore VEETI financials',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {priceComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.priceComparisonTitle',
                      'VEETI vs current unit prices',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasPriceComparisonDiffs ? '' : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasPriceComparisonDiffs
                      ? t(
                          'v2Overview.priceComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.priceComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.priceComparisonBody',
                    'Review raw VEETI prices against the current effective prices before saving or restoring this section.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {priceComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatPrice(row.veetiValue)} |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatPrice(row.effectiveValue)}
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyPricesForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiPrices}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiPrices',
                      'Restore VEETI prices',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {volumeComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.volumeComparisonTitle',
                      'VEETI vs current sold volumes',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasVolumeComparisonDiffs ? '' : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasVolumeComparisonDiffs
                      ? t(
                          'v2Overview.volumeComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.volumeComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.volumeComparisonBody',
                    'Review raw VEETI sold volumes against the current effective values before saving or restoring this section.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {volumeComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatNumber(row.veetiValue)} m3 |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatNumber(row.effectiveValue)} m3
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyVolumesForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiVolumes}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiVolumes',
                      'Restore VEETI volumes',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}
              </details>
            ) : null}

            <input
              ref={statementFileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleStatementPdfSelected}
              disabled={statementImportBusy || manualPatchBusy}
              hidden
            />

            {isStatementImportMode ? (
              <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.statementImportWorkflowTitle',
                      'Import statement PDF for year {{year}}',
                      { year: manualPatchYear ?? '-' },
                    )}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.statementImportWorkflowBody',
                    'Upload the bookkeeping PDF, review the detected financial statement values, and confirm the import. Other datasets keep their current source.',
                  )}
                </p>
                <div className="v2-statement-import-actions">
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => statementFileInputRef.current?.click()}
                    disabled={statementImportBusy || manualPatchBusy}
                  >
                    {t(
                      statementImportPreview
                        ? 'v2Overview.statementImportReplaceFile'
                        : 'v2Overview.statementImportUploadFile',
                      statementImportPreview
                        ? 'Choose another PDF'
                        : 'Upload statement PDF',
                    )}
                  </button>
                  {statementImportPreview ? (
                    <span className="v2-muted">
                      {statementImportPreview.fileName}
                    </span>
                  ) : null}
                </div>
                {statementImportStatus ? (
                  <p className="v2-muted">{statementImportStatus}</p>
                ) : null}
                {statementImportError ? (
                  <div className="v2-alert v2-alert-error">
                    {statementImportError}
                  </div>
                ) : null}
                {statementImportPreview ? (
                  <div className="v2-statement-import-preview">
                    <div className="v2-keyvalue-list v2-statement-import-meta-grid">
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaFile',
                            'Detected file',
                          )}
                        </span>
                        <span>{statementImportPreview.fileName}</span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaPage',
                            'Detected page',
                          )}
                        </span>
                        <span>
                          {statementImportPreview.pageNumber != null
                            ? statementImportPreview.pageNumber
                            : t(
                                'v2Overview.previewMissingValue',
                                'Missing data',
                              )}
                        </span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaConfidence',
                            'OCR confidence',
                          )}
                        </span>
                        <span>
                          {statementImportPreview.confidence != null
                            ? t(
                                'v2Overview.statementImportConfidence',
                                'confidence {{value}}%',
                                {
                                  value: Math.round(
                                    statementImportPreview.confidence,
                                  ),
                                },
                              )
                            : t(
                                'v2Overview.previewMissingValue',
                                'Missing data',
                              )}
                        </span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaScannedPages',
                            'Scanned pages',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Overview.statementImportScannedPages',
                            'scanned {{count}} pages',
                            {
                              count: statementImportPreview.scannedPageCount,
                            },
                          )}
                        </span>
                      </div>
                    </div>
                    <section className="v2-manual-section v2-statement-import-diff-panel">
                      <div className="v2-manual-section-head">
                        <h4>
                          {t(
                            'v2Overview.statementImportDiffTitle',
                            'VEETI, PDF, and current values',
                          )}
                        </h4>
                      </div>
                      <p className="v2-muted">
                        {t(
                          'v2Overview.statementImportDiffBody',
                          'Check what the PDF proposes against the original VEETI row and the current effective year before you confirm or sync.',
                        )}
                      </p>
                      {statementImportComparisonRows.length > 0 ? (
                        <div className="v2-statement-import-diff-table">
                          <div className="v2-statement-import-diff-head">
                            <span>
                              {t('v2Overview.statementImportDiffField', 'Field')}
                            </span>
                            <span>
                              {t('v2Overview.statementImportDiffVeeti', 'VEETI')}
                            </span>
                            <span>
                              {t('v2Overview.statementImportDiffPdf', 'PDF')}
                            </span>
                            <span>
                              {t(
                                'v2Overview.statementImportDiffCurrent',
                                'Current',
                              )}
                            </span>
                          </div>
                          {statementImportComparisonRows.map((row) => (
                            <div
                              key={row.key}
                              className={`v2-statement-import-diff-row ${
                                row.changedFromCurrent
                                  ? 'v2-statement-import-diff-row-changed'
                                  : ''
                              }`}
                            >
                              <span>
                                <strong>{row.label}</strong>
                                {row.sourceLine ? (
                                  <small className="v2-muted">
                                    {row.sourceLine}
                                  </small>
                                ) : null}
                              </span>
                              <span>
                                {row.veetiValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.veetiValue)}
                              </span>
                              <span>
                                {row.pdfValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.pdfValue)}
                              </span>
                              <span>
                                {row.currentValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.currentValue)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="v2-muted">
                          {t(
                            'v2Overview.statementImportNoMappedValues',
                            'OCR did not produce mapped financial values yet. Upload another PDF before confirming the import.',
                          )}
                        </p>
                      )}
                    </section>
                    {statementImportPreview.warnings.length > 0 ? (
                      <div className="v2-statement-import-warnings">
                        {statementImportPreview.warnings.map((warning) => (
                          <p key={warning} className="v2-muted">
                            {warning}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="v2-muted v2-statement-import-placeholder">
                    {t(
                      'v2Overview.statementImportAwaitingFile',
                      'Upload the statement PDF to populate the OCR comparison before confirming the import.',
                    )}
                  </p>
                )}
              </section>
            ) : null}

            {showFinancialSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.manualSectionFinancials',
                      'Financial statement data',
                    )}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualFinancialRevenue',
                      'Revenue (Liikevaihto)',
                    )}
                    <input
                      name="manual-financials-liikevaihto"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.liikevaihto}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          liikevaihto: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialMaterials',
                      'Materials and services',
                    )}
                    <input
                      name="manual-financials-aineetJaPalvelut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.aineetJaPalvelut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          aineetJaPalvelut: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialPersonnel',
                      'Personnel costs',
                    )}
                    <input
                      name="manual-financials-henkilostokulut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.henkilostokulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          henkilostokulut: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialOtherOpex',
                      'Other operating costs',
                    )}
                    <input
                      name="manual-financials-liiketoiminnanMuutKulut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.liiketoiminnanMuutKulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          liiketoiminnanMuutKulut: Number(
                            event.target.value || 0,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialDepreciation',
                      'Depreciation',
                    )}
                    <input
                      name="manual-financials-poistot"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.poistot}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          poistot: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('v2Overview.manualFinancialWriteDowns', 'Write-downs')}
                    <input
                      name="manual-financials-arvonalentumiset"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.arvonalentumiset}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          arvonalentumiset: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('v2Overview.manualFinancialNetFinance', 'Net finance')}
                    <input
                      name="manual-financials-rahoitustuototJaKulut"
                      className="v2-input"
                      type="number"
                      step="0.01"
                      value={manualFinancials.rahoitustuototJaKulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          rahoitustuototJaKulut: Number(
                            event.target.value || 0,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialYearResult',
                      'Year result (Tilikauden ylijäämä/alijäämä)',
                    )}
                    <input
                      name="manual-financials-tilikaudenYliJaama"
                      className="v2-input"
                      type="number"
                      step="0.01"
                      value={manualFinancials.tilikaudenYliJaama}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          tilikaudenYliJaama: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {showPricesSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>{t('v2Overview.manualSectionPrices', 'Unit prices')}</h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualPriceWater',
                      'Water unit price (EUR/m3)',
                    )}
                    <input
                      name="manual-prices-waterUnitPrice"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.001"
                      value={manualPrices.waterUnitPrice}
                      onChange={(event) =>
                        setManualPrices((prev) => ({
                          ...prev,
                          waterUnitPrice: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualPriceWastewater',
                      'Wastewater unit price (EUR/m3)',
                    )}
                    <input
                      name="manual-prices-wastewaterUnitPrice"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.001"
                      value={manualPrices.wastewaterUnitPrice}
                      onChange={(event) =>
                        setManualPrices((prev) => ({
                          ...prev,
                          wastewaterUnitPrice: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {showVolumesSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t('v2Overview.manualSectionVolumes', 'Sold volumes')}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualVolumeWater',
                      'Sold water volume (m3)',
                    )}
                    <input
                      name="manual-volumes-soldWaterVolume"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="1"
                      value={manualVolumes.soldWaterVolume}
                      onChange={(event) =>
                        setManualVolumes((prev) => ({
                          ...prev,
                          soldWaterVolume: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualVolumeWastewater',
                      'Sold wastewater volume (m3)',
                    )}
                    <input
                      name="manual-volumes-soldWastewaterVolume"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="1"
                      value={manualVolumes.soldWastewaterVolume}
                      onChange={(event) =>
                        setManualVolumes((prev) => ({
                          ...prev,
                          soldWastewaterVolume: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {manualPatchMode === 'manualEdit' ? (
            <details
              className="v2-manual-optional"
              open={showAllManualSections}
            >
              <summary>
                {t(
                  'v2Overview.manualOptionalSection',
                  'Optional context fields and note',
                )}
              </summary>
              <div className="v2-manual-grid">
                <label>
                  {t('v2Overview.manualInvestmentAmount', 'Investment amount')}
                  <input
                    name="manual-investments-investoinninMaara"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualInvestments.investoinninMaara}
                    onChange={(event) =>
                      setManualInvestments((prev) => ({
                        ...prev,
                        investoinninMaara: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>
                <label>
                  {t(
                    'v2Overview.manualReplacementInvestmentAmount',
                    'Replacement investment amount',
                  )}
                  <input
                    name="manual-investments-korvausInvestoinninMaara"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualInvestments.korvausInvestoinninMaara}
                    onChange={(event) =>
                      setManualInvestments((prev) => ({
                        ...prev,
                        korvausInvestoinninMaara: Number(
                          event.target.value || 0,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  {t(
                    'v2Overview.manualProcessElectricity',
                    'Process electricity',
                  )}
                  <input
                    name="manual-energy-prosessinKayttamaSahko"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualEnergy.prosessinKayttamaSahko}
                    onChange={(event) =>
                      setManualEnergy({
                        prosessinKayttamaSahko: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
                <label>
                  {t('v2Overview.manualNetworkLength', 'Network length')}
                  <input
                    name="manual-network-verkostonPituus"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualNetwork.verkostonPituus}
                    onChange={(event) =>
                      setManualNetwork({
                        verkostonPituus: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
              </div>

              <label>
                {t('v2Overview.manualPatchReason', 'Reason for manual change')}
                <textarea
                  name="manual-reason"
                  className="v2-input"
                  rows={3}
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  placeholder={t(
                    'v2Overview.manualPatchReasonPlaceholder',
                    'Optional note describing why this year is edited manually',
                  )}
                />
              </label>
            </details>
            ) : null}

            <section className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>{t('v2Overview.yearActionsTitle', 'Year actions')}</h4>
              </div>
              <p className="v2-muted">
                {yearActionsBody}
              </p>
              <div className="v2-year-card-actions">
                <button
                  type="button"
                  className={keepYearButtonClass}
                  onClick={handleKeepCurrentYearValues}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t('v2Overview.keepYearInPlan')}
                </button>
                <button
                  type="button"
                  className={fixYearButtonClass}
                  onClick={handleSwitchToManualEditMode}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t('v2Overview.fixYearValues')}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleSwitchToStatementImportMode}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t(
                    'v2Overview.statementImportAction',
                    'Import statement PDF',
                  )}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleSwitchToWorkbookImportMode}
                  disabled={manualPatchBusy || workbookImportBusy}
                >
                  {t(
                    'v2Overview.workbookImportAction',
                    'Import KVA workbook',
                  )}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleSwitchToQdisImportMode}
                  disabled={manualPatchBusy || qdisImportBusy}
                >
                  {t(
                    'v2Overview.qdisImportAction',
                    'Import QDIS PDF',
                  )}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={
                    isManualYearExcluded
                      ? handleRestoreManualYearToPlan
                      : handleExcludeManualYearFromPlan
                  }
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t(
                    isManualYearExcluded
                      ? 'v2Overview.restoreYearToPlan'
                      : 'v2Overview.excludeYearFromPlan',
                    isManualYearExcluded
                      ? 'Palauta suunnitelmaan'
                      : 'Pois suunnitelmasta',
                  )}
                </button>
              </div>
            </section>

            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeManualPatchDialog}
                disabled={manualPatchBusy || statementImportBusy || workbookImportBusy}
              >
                {t(
                  isReviewMode ? 'common.close' : 'common.cancel',
                  isReviewMode ? 'Close' : 'Cancel',
                )}
              </button>
              {isReviewMode || isWorkbookImportMode ? null : (
                <>
              <button
                type="button"
                className="v2-btn"
                onClick={() => submitManualPatch(false)}
                disabled={
                  manualPatchBusy ||
                  statementImportBusy ||
                  !canConfirmImportWorkflow
                }
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirm',
                      'Confirm statement import',
                    )
                  : isQdisImportMode
                  ? t(
                      'v2Overview.qdisImportConfirm',
                      'Confirm QDIS import',
                    )
                  : t('v2Overview.manualPatchSave', 'Save year data')}
              </button>
              <button
                type="button"
                className={wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'}
                onClick={() => submitManualPatch(true)}
                disabled={
                  manualPatchBusy ||
                  statementImportBusy ||
                  !canConfirmImportWorkflow
                }
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirmAndSync',
                      'Confirm import and sync year',
                    )
                  : isQdisImportMode
                  ? t(
                      'v2Overview.qdisImportConfirmAndSync',
                      'Confirm QDIS import and sync year',
                    )
                  : t(
                      'v2Overview.manualPatchSaveAndSync',
                      'Save and sync year',
                    )}
              </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {wizardDisplayStep === 3 ? (
      <section className="v2-card">
        <div className="v2-section-header">
          <div>
            {wizardBackLabel ? (
              <button
                type="button"
                className="v2-step-back-btn"
                onClick={handleWizardBack}
              >
                {wizardBackLabel}
              </button>
            ) : null}
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', { step: 3 })}
            </p>
            <h2>{t('v2Overview.wizardQuestionReviewYears')}</h2>
          </div>
          <span className="v2-badge v2-status-provenance">
            {t('v2Overview.reviewYearsCount', {
              count: reviewStatusRows.length,
            })}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t('v2Overview.wizardBodyReviewYears')}
        </p>

        {reviewStatusRows.length === 0 ? (
          <div className="v2-empty-state">
            <p>{t('v2Overview.reviewYearsEmpty')}</p>
          </div>
        ) : (
          <div className="v2-year-status-list">
            {reviewStatusRows.map((row) => {
              const isInlineReviewActive =
                cardEditContext === 'step3' &&
                cardEditYear === row.year &&
                manualPatchYear === row.year;
              const helperText =
                row.setupStatus === 'excluded_from_plan'
                  ? t('v2Overview.setupStatusExcludedHint')
                  : row.setupStatus === 'reviewed'
                    ? t(
                        'v2Overview.setupStatusReviewedHint',
                        'Tämä vuosi on tarkistettu ja hyväksytty mukaan suunnittelupohjaan.',
                      )
                    : row.setupStatus === 'ready_for_review'
                      ? t(
                          'v2Overview.setupStatusTechnicalReadyHint',
                          'Vuosi näyttää valmiilta. Tarkista vertailu ja hyväksy vuosi suunnittelupohjaan.',
                        )
                      : t('v2Overview.setupStatusNeedsAttentionHint', {
                        requirements:
                          row.missingRequirements.length > 0
                            ? row.missingRequirements
                                .map((item) => missingRequirementLabel(item))
                                .join(', ')
                            : t('v2Overview.setupStatusNeedsAttention'),
                      });

              return (
                <article
                  key={row.year}
                  className={`v2-year-status-row ${yearStatusRowClassName(row.setupStatus)}`}
                >
                  <div className="v2-year-status-head">
                    <div className="v2-year-status-labels">
                      <strong>{row.year}</strong>
                      <span
                        className={`v2-badge ${sourceStatusClassName(
                          row.sourceStatus,
                        )}`}
                      >
                        {row.setupStatus === 'excluded_from_plan'
                          ? t('v2Overview.setupStatusExcludedShort')
                          : sourceStatusLabel(row.sourceStatus)}
                      </span>
                    </div>
                    <span
                      className={`v2-badge ${setupStatusClassName(row.setupStatus)}`}
                    >
                      {setupStatusLabel(row.setupStatus)}
                    </span>
                  </div>

                  {renderReviewValueSummary(row.year, {
                    financials:
                      row.readinessChecks.find(
                        (check) => check.key === 'financials',
                      )?.ready === true,
                    prices:
                      row.readinessChecks.find(
                        (check) => check.key === 'prices',
                      )?.ready === true,
                    volumes:
                      row.readinessChecks.find(
                        (check) => check.key === 'volumes',
                      )?.ready === true,
                  })}

                  {renderYearValuePreview(row.year, {
                    financials:
                      row.readinessChecks.find(
                        (check) => check.key === 'financials',
                      )?.ready === true,
                    prices:
                      row.readinessChecks.find(
                        (check) => check.key === 'prices',
                      )?.ready === true,
                    volumes:
                      row.readinessChecks.find(
                        (check) => check.key === 'volumes',
                      )?.ready === true,
                  })}

                  <p className="v2-year-status-note">{helperText}</p>

                  {row.warnings.length > 0 ? (
                    <p className="v2-muted v2-year-status-note">
                      {row.warnings
                        .map((warning) => importWarningLabel(warning))
                        .join(' ')}
                    </p>
                  ) : null}

                  <div className="v2-year-status-actions">
                    {isInlineReviewActive ? (
                      <>
                        {isCurrentYearReadyForReview ? (
                          <button
                            type="button"
                            className={keepYearButtonClass}
                            onClick={handleKeepCurrentYearValues}
                            disabled={manualPatchBusy || statementImportBusy}
                          >
                            {t('v2Overview.keepYearInPlan')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={fixYearButtonClass}
                          onClick={handleSwitchToManualEditMode}
                          disabled={manualPatchBusy || statementImportBusy}
                        >
                          {t('v2Overview.fixYearValues')}
                        </button>
                        <button
                          type="button"
                          className="v2-btn v2-btn-small"
                          onClick={handleSwitchToStatementImportMode}
                          disabled={manualPatchBusy || statementImportBusy}
                        >
                          {t(
                            'v2Overview.statementImportAction',
                            'Import statement PDF',
                          )}
                        </button>
                        <button
                          type="button"
                          className="v2-btn v2-btn-small"
                          onClick={handleSwitchToWorkbookImportMode}
                          disabled={manualPatchBusy || workbookImportBusy}
                        >
                          {t(
                            'v2Overview.workbookImportAction',
                            'Import KVA workbook',
                          )}
                        </button>
                        <button
                          type="button"
                          className="v2-btn v2-btn-small"
                          onClick={handleSwitchToQdisImportMode}
                          disabled={manualPatchBusy || qdisImportBusy}
                        >
                          {t(
                            'v2Overview.qdisImportAction',
                            'Import QDIS PDF',
                          )}
                        </button>
                        <button
                          type="button"
                          className="v2-btn v2-btn-small"
                          onClick={
                            isManualYearExcluded
                              ? handleRestoreManualYearToPlan
                              : handleExcludeManualYearFromPlan
                          }
                          disabled={manualPatchBusy || statementImportBusy}
                        >
                          {t(
                            isManualYearExcluded
                              ? 'v2Overview.restoreYearToPlan'
                              : 'v2Overview.excludeYearFromPlan',
                            isManualYearExcluded
                              ? 'Palauta suunnitelmaan'
                              : 'Pois suunnitelmasta',
                          )}
                        </button>
                        {canReapplyFinancialVeetiForYear ? (
                          <button
                            type="button"
                            className="v2-btn v2-btn-small"
                            onClick={handleModalApplyVeetiFinancials}
                            disabled={manualPatchBusy || statementImportBusy}
                          >
                            {t(
                              'v2Overview.reapplyVeetiFinancials',
                              'Restore VEETI financials',
                            )}
                          </button>
                        ) : null}
                        {canReapplyPricesForYear ? (
                          <button
                            type="button"
                            className="v2-btn v2-btn-small"
                            onClick={handleModalApplyVeetiPrices}
                            disabled={manualPatchBusy || statementImportBusy}
                          >
                            {t(
                              'v2Overview.reapplyVeetiPrices',
                              'Restore VEETI prices',
                            )}
                          </button>
                        ) : null}
                        {canReapplyVolumesForYear ? (
                          <button
                            type="button"
                            className="v2-btn v2-btn-small"
                            onClick={handleModalApplyVeetiVolumes}
                            disabled={manualPatchBusy || statementImportBusy}
                          >
                            {t(
                              'v2Overview.reapplyVeetiVolumes',
                              'Restore VEETI volumes',
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="v2-btn v2-btn-small"
                          onClick={closeInlineCardEditor}
                          disabled={manualPatchBusy || statementImportBusy}
                        >
                          {t('common.close', 'Close')}
                        </button>
                      </>
                    ) : (
                      <>
                        {isAdmin
                          ? buildRepairActions(row.year, row.missingRequirements).map(
                              (action) => (
                                <button
                                  key={`${row.year}-${action.key}`}
                                  type="button"
                                  className="v2-btn v2-btn-small"
                                  onClick={() =>
                                    void openInlineCardEditor(
                                      row.year,
                                      action.focusField,
                                      'step3',
                                      row.missingRequirements,
                                      'manualEdit',
                                    )
                                  }
                                >
                                  {action.label}
                                </button>
                              ),
                            )
                          : null}
                        <button
                          type="button"
                          className="v2-btn v2-btn-small"
                          onClick={() =>
                            void openInlineCardEditor(
                              row.year,
                              null,
                              'step3',
                              row.missingRequirements,
                            )
                          }
                        >
                          {row.setupStatus === 'ready_for_review' ||
                          row.setupStatus === 'reviewed'
                            ? t(
                                'v2Overview.openReviewYearButton',
                                'Avaa ja tarkista',
                              )
                            : t('v2Overview.yearDecisionAction')}
                        </button>
                      </>
                    )}
                  </div>

                  {isInlineReviewActive && manualPatchMode !== 'review' ? (
                    <div className="v2-inline-card-editor">
                      {manualPatchError ? (
                        <div className="v2-alert v2-alert-error">
                          {manualPatchError}
                        </div>
                      ) : null}
                      {row.missingRequirements.length > 0 ? (
                        <p className="v2-manual-required-note">
                          {t(
                            'v2Overview.manualPatchRequiredHint',
                            'Required for sync readiness: {{requirements}}',
                            {
                              requirements: row.missingRequirements
                                .map((item) => missingRequirementLabel(item))
                                .join(', '),
                            },
                          )}
                        </p>
                      ) : null}

                      {isStatementImportMode ? (
                        <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
                          <div className="v2-manual-section-head">
                            <h4>
                              {t(
                                'v2Overview.statementImportWorkflowTitle',
                                'Import statement PDF for year {{year}}',
                                { year: row.year },
                              )}
                            </h4>
                          </div>
                          <div className="v2-statement-import-actions">
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() => statementFileInputRef.current?.click()}
                              disabled={statementImportBusy || manualPatchBusy}
                            >
                              {t(
                                statementImportPreview
                                  ? 'v2Overview.statementImportReplaceFile'
                                  : 'v2Overview.statementImportUploadFile',
                                statementImportPreview
                                  ? 'Choose another PDF'
                                  : 'Upload statement PDF',
                              )}
                            </button>
                            {statementImportPreview ? (
                              <span className="v2-muted">
                                {statementImportPreview.fileName}
                              </span>
                            ) : null}
                          </div>
                          {statementImportStatus ? (
                            <p className="v2-muted">{statementImportStatus}</p>
                          ) : null}
                          {statementImportPreview ? (
                            <section className="v2-manual-section v2-statement-import-diff-panel">
                              <div className="v2-manual-section-head">
                                <h4>
                                  {t(
                                    'v2Overview.statementImportDiffTitle',
                                    'VEETI, PDF, and current values',
                                  )}
                                </h4>
                              </div>
                              {statementImportComparisonRows.length > 0 ? (
                                <div className="v2-statement-import-diff-table">
                                  <div className="v2-statement-import-diff-head">
                                    <span>
                                      {t(
                                        'v2Overview.statementImportDiffField',
                                        'Field',
                                      )}
                                    </span>
                                    <span>
                                      {t(
                                        'v2Overview.statementImportDiffVeeti',
                                        'VEETI',
                                      )}
                                    </span>
                                    <span>
                                      {t(
                                        'v2Overview.statementImportDiffPdf',
                                        'PDF',
                                      )}
                                    </span>
                                    <span>
                                      {t(
                                        'v2Overview.statementImportDiffCurrent',
                                        'Current',
                                      )}
                                    </span>
                                  </div>
                                  {statementImportComparisonRows.map((diffRow) => (
                                    <div
                                      key={diffRow.key}
                                      className={`v2-statement-import-diff-row ${
                                        diffRow.changedFromCurrent
                                          ? 'v2-statement-import-diff-row-changed'
                                          : ''
                                      }`}
                                    >
                                      <span>
                                        <strong>{diffRow.label}</strong>
                                        {diffRow.sourceLine ? (
                                          <small className="v2-muted">
                                            {diffRow.sourceLine}
                                          </small>
                                        ) : null}
                                      </span>
                                      <span>
                                        {diffRow.veetiValue == null
                                          ? t(
                                              'v2Overview.previewMissingValue',
                                              'Missing data',
                                            )
                                          : formatEur(diffRow.veetiValue)}
                                      </span>
                                      <span>
                                        {diffRow.pdfValue == null
                                          ? t(
                                              'v2Overview.previewMissingValue',
                                              'Missing data',
                                            )
                                          : formatEur(diffRow.pdfValue)}
                                      </span>
                                      <span>
                                        {diffRow.currentValue == null
                                          ? t(
                                              'v2Overview.previewMissingValue',
                                              'Missing data',
                                            )
                                          : formatEur(diffRow.currentValue)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </section>
                          ) : (
                            <p className="v2-muted v2-statement-import-placeholder">
                              {t(
                                'v2Overview.statementImportAwaitingFile',
                                'Upload the statement PDF to populate the OCR comparison before confirming the import.',
                              )}
                            </p>
                          )}
                          <div className="v2-inline-card-editor-actions">
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => void saveInlineCardEdit(false)}
                              disabled={
                                manualPatchBusy ||
                                statementImportBusy ||
                                !canConfirmImportWorkflow
                              }
                            >
                              {manualPatchBusy
                                ? t('common.loading', 'Loading...')
                                : t(
                                    isQdisImportMode
                                      ? 'v2Overview.qdisImportConfirm'
                                      : 'v2Overview.statementImportConfirm',
                                    isQdisImportMode
                                      ? 'Confirm QDIS import'
                                      : 'Confirm statement import',
                                  )}
                            </button>
                            <button
                              type="button"
                              className="v2-btn v2-btn-primary"
                              onClick={() => void saveInlineCardEdit(true)}
                              disabled={
                                manualPatchBusy ||
                                statementImportBusy ||
                                qdisImportBusy ||
                                !canConfirmImportWorkflow
                              }
                            >
                              {manualPatchBusy
                                ? t('common.loading', 'Loading...')
                                : t(
                                    isQdisImportMode
                                      ? 'v2Overview.qdisImportConfirmAndSync'
                                      : 'v2Overview.statementImportConfirmAndSync',
                                    isQdisImportMode
                                      ? 'Confirm QDIS import and sync year'
                                      : 'Confirm import and sync year',
                                  )}
                            </button>
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={closeInlineCardEditor}
                              disabled={manualPatchBusy || statementImportBusy || qdisImportBusy}
                            >
                              {t('common.close', 'Close')}
                            </button>
                          </div>
                        </section>
                      ) : null}
                      {isWorkbookImportMode
                        ? renderWorkbookImportWorkflow(row.year)
                        : null}
                      {isQdisImportMode ? renderQdisImportWorkflow(row.year) : null}

                      {manualPatchMode === 'manualEdit' ? (
                        <>
                          <div className="v2-inline-card-editor-grid">
                            <label>
                              {t(
                                'v2Overview.manualFinancialRevenue',
                                'Revenue (Liikevaihto)',
                              )}
                              <input
                                ref={setInlineCardFieldRef('liikevaihto')}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={manualFinancials.liikevaihto}
                                onChange={(event) =>
                                  setManualFinancials((prev) => ({
                                    ...prev,
                                    liikevaihto: Number(event.target.value || 0),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualFinancialMaterials',
                                'Materials and services',
                              )}
                              <input
                                ref={setInlineCardFieldRef('aineetJaPalvelut')}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={manualFinancials.aineetJaPalvelut}
                                onChange={(event) =>
                                  setManualFinancials((prev) => ({
                                    ...prev,
                                    aineetJaPalvelut: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualFinancialPersonnel',
                                'Personnel costs',
                              )}
                              <input
                                ref={setInlineCardFieldRef('henkilostokulut')}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={manualFinancials.henkilostokulut}
                                onChange={(event) =>
                                  setManualFinancials((prev) => ({
                                    ...prev,
                                    henkilostokulut: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualFinancialDepreciation',
                                'Depreciation',
                              )}
                              <input
                                ref={setInlineCardFieldRef('poistot')}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={manualFinancials.poistot}
                                onChange={(event) =>
                                  setManualFinancials((prev) => ({
                                    ...prev,
                                    poistot: Number(event.target.value || 0),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualFinancialOtherOpex',
                                'Other operating costs',
                              )}
                              <input
                                ref={setInlineCardFieldRef(
                                  'liiketoiminnanMuutKulut',
                                )}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.01"
                                value={manualFinancials.liiketoiminnanMuutKulut}
                                onChange={(event) =>
                                  setManualFinancials((prev) => ({
                                    ...prev,
                                    liiketoiminnanMuutKulut: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualFinancialYearResult',
                                'Year result (Tilikauden ylijäämä/alijäämä)',
                              )}
                              <input
                                ref={setInlineCardFieldRef(
                                  'tilikaudenYliJaama',
                                )}
                                className="v2-input"
                                type="number"
                                step="0.01"
                                value={manualFinancials.tilikaudenYliJaama}
                                onChange={(event) =>
                                  setManualFinancials((prev) => ({
                                    ...prev,
                                    tilikaudenYliJaama: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualPriceWater',
                                'Water unit price (EUR/m3)',
                              )}
                              <input
                                ref={setInlineCardFieldRef('waterUnitPrice')}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.001"
                                value={manualPrices.waterUnitPrice}
                                onChange={(event) =>
                                  setManualPrices((prev) => ({
                                    ...prev,
                                    waterUnitPrice: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualPriceWastewater',
                                'Wastewater unit price (EUR/m3)',
                              )}
                              <input
                                ref={setInlineCardFieldRef(
                                  'wastewaterUnitPrice',
                                )}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="0.001"
                                value={manualPrices.wastewaterUnitPrice}
                                onChange={(event) =>
                                  setManualPrices((prev) => ({
                                    ...prev,
                                    wastewaterUnitPrice: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualVolumeWater',
                                'Sold water volume (m3)',
                              )}
                              <input
                                ref={setInlineCardFieldRef('soldWaterVolume')}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="1"
                                value={manualVolumes.soldWaterVolume}
                                onChange={(event) =>
                                  setManualVolumes((prev) => ({
                                    ...prev,
                                    soldWaterVolume: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              {t(
                                'v2Overview.manualVolumeWastewater',
                                'Sold wastewater volume (m3)',
                              )}
                              <input
                                ref={setInlineCardFieldRef(
                                  'soldWastewaterVolume',
                                )}
                                className="v2-input"
                                type="number"
                                min={0}
                                step="1"
                                value={manualVolumes.soldWastewaterVolume}
                                onChange={(event) =>
                                  setManualVolumes((prev) => ({
                                    ...prev,
                                    soldWastewaterVolume: Number(
                                      event.target.value || 0,
                                    ),
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="v2-inline-card-editor-actions">
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => void saveInlineCardEdit(false)}
                              disabled={manualPatchBusy}
                            >
                              {manualPatchBusy
                                ? t('common.loading', 'Loading...')
                                : t(
                                    'v2Overview.manualPatchSave',
                                    'Save year data',
                                  )}
                            </button>
                            <button
                              type="button"
                              className="v2-btn v2-btn-primary"
                              onClick={() => void saveInlineCardEdit(true)}
                              disabled={manualPatchBusy}
                            >
                              {manualPatchBusy
                                ? t('common.loading', 'Loading...')
                                : t(
                                    'v2Overview.manualPatchSaveAndSync',
                                    'Save and sync year',
                                  )}
                            </button>
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={closeInlineCardEditor}
                              disabled={manualPatchBusy}
                            >
                              {t('common.close', 'Close')}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        <div className="v2-overview-review-actions">
          <button
            type="button"
            className={reviewContinueButtonClass}
            onClick={handleContinueFromReview}
            disabled={reviewStatusRows.length === 0}
          >
            {t('v2Overview.reviewContinue')}
          </button>
          <p className="v2-muted">
            {importedBlockedYearCount > 0
              ? t('v2Overview.reviewContinueBlockedHint')
              : pendingReviewYearCount > 0
                ? t(
                    'v2Overview.reviewContinueTechnicalReadyBody',
                    'Nämä vuodet odottavat vielä tarkistusta ja hyväksyntää: {{years}}.',
                    { years: technicalReadyYearsLabel },
                  )
                : t('v2Overview.reviewContinueReadyBody')}
          </p>
        </div>
      </section>
      ) : null}

      {wizardDisplayStep === 5 ? (
      <section className="v2-card">
        <div className="v2-section-header">
          <div>
            {wizardBackLabel ? (
              <button
                type="button"
                className="v2-step-back-btn"
                onClick={handleWizardBack}
              >
                {wizardBackLabel}
              </button>
            ) : null}
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', { step: 5 })}
            </p>
            <h2>{t('v2Overview.wizardQuestionBaseline')}</h2>
          </div>
          <span className="v2-badge v2-status-provenance">
            {includedPlanningYears.length}{' '}
            {t('v2Overview.wizardSummaryImportedYears')}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t('v2Overview.wizardBodyBaseline')}
        </p>

        <div className="v2-planning-baseline-grid">
          <article className="v2-planning-baseline-card">
            <span>{t('v2Overview.baselineIncludedYears')}</span>
            <strong>
              {includedPlanningYears.length > 0
                ? includedPlanningYears.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected')}
            </strong>
          </article>
          <article className="v2-planning-baseline-card">
            <span>{t('v2Overview.baselineExcludedYears')}</span>
            <strong>
              {excludedYearsSorted.length > 0
                ? excludedYearsSorted.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected')}
            </strong>
          </article>
          <article className="v2-planning-baseline-card">
            <span>{t('v2Overview.baselineCorrectedYears')}</span>
            <strong>
              {correctedPlanningYears.length > 0
                ? correctedPlanningYears.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected')}
            </strong>
          </article>
        </div>

        <section className="v2-manual-section">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.baselineClosureTitle',
                'Before Forecast and Reports unlock',
              )}
            </h4>
          </div>
          <div className="v2-keyvalue-list">
            <div className="v2-keyvalue-row">
              <span>
                {t('v2Overview.baselineClosureChanged', 'Changed in review')}
              </span>
              <span>
                {correctedPlanningYears.length > 0 &&
                correctedPlanningManualDataTypes.length > 0
                  ? t(
                      'v2Overview.baselineClosureChangedBody',
                      'Years {{years}} now use {{datasets}}.',
                      {
                        years: correctedYearsLabel,
                        datasets: renderDatasetTypeList(
                          correctedPlanningManualDataTypes,
                        ),
                      },
                    )
                  : t(
                      'v2Overview.baselineClosureNoCorrections',
                      'No corrected years are queued right now.',
                    )}
              </span>
            </div>
            <div className="v2-keyvalue-row">
              <span>
                {t(
                  'v2Overview.baselineClosureStillVeeti',
                  'Still from VEETI',
                )}
              </span>
              <span>
                {correctedPlanningVeetiDataTypes.length > 0
                  ? renderDatasetTypeList(correctedPlanningVeetiDataTypes)
                  : t(
                      'v2Overview.baselineClosureNoVeetiCarryForward',
                      'No VEETI carry-forward remains for the corrected years.',
                    )}
              </span>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2Overview.baselineClosureQueued', 'Still queued')}</span>
              <span>
                {t(
                  'v2Overview.baselineClosureQueuedBody',
                  'Create the planning baseline for {{years}}. Forecast and Reports stay locked until that happens.',
                  { years: includedPlanningYearsLabel },
                )}
              </span>
            </div>
          </div>
        </section>

        <div className="v2-overview-review-actions">
          <button
            type="button"
            className={planningBaselineButtonClass}
            onClick={handleCreatePlanningBaseline}
            disabled={
              creatingPlanningBaseline ||
              includedPlanningYears.length === 0 ||
              importedBlockedYearCount > 0
            }
          >
            {creatingPlanningBaseline
              ? t('common.loading', 'Loading...')
              : t('v2Overview.createPlanningBaseline')}
          </button>
          <p className="v2-muted">
            {importedBlockedYearCount > 0
              ? t('v2Overview.baselineBlockedHint')
              : t('v2Overview.baselineReadyHint')}
          </p>
        </div>
      </section>
      ) : null}

      {wizardDisplayStep === 6 && hasBaselineBudget ? (
        <section className="v2-card">
          <div className="v2-section-header">
            <div>
              {wizardBackLabel ? (
                <button
                  type="button"
                  className="v2-step-back-btn"
                  onClick={handleWizardBack}
                >
                  {wizardBackLabel}
                </button>
              ) : null}
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardProgress', { step: 6 })}
              </p>
              <h2>{t('v2Overview.baselineIncludedYears')}</h2>
            </div>
          <span className="v2-badge v2-status-positive">
            {t('v2Overview.wizardSummaryYes')}
          </span>
        </div>

          {acceptedPlanningYearRows.length > 0 ? (
            <div className="v2-year-status-list">
              {acceptedPlanningYearRows.map((row) => {
                const corrected = correctedPlanningYears.includes(row.vuosi);
                return (
                  <article
                    key={`accepted-${row.vuosi}`}
                    className="v2-year-status-row ready"
                  >
                    <div className="v2-year-status-head">
                      <div className="v2-year-status-labels">
                        <strong>{row.vuosi}</strong>
                        <span>
                          {corrected
                            ? t(
                                'v2Overview.baselineClosureChanged',
                                'Changed in review',
                              )
                            : t(
                                'v2Overview.baselineClosureStillVeeti',
                                'Still from VEETI',
                              )}
                        </span>
                      </div>
                      <div className="v2-badge-row">
                        <span className="v2-badge v2-status-positive">
                          {t('v2Overview.wizardSummaryReadyYears', 'Ready years')}
                        </span>
                        <span
                          className={`v2-badge ${sourceStatusClassName(
                            row.sourceStatus,
                          )}`}
                        >
                          {sourceStatusLabel(row.sourceStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="v2-year-status-checks">
                      <div className="v2-year-status-check ready">
                        <span>{t('v2Overview.sourceLabel', 'Source')}</span>
                        <span className="v2-year-status-check-badge">
                          {corrected
                            ? t(
                                'v2Overview.baselineClosureChanged',
                                'Changed in review',
                              )
                            : t(
                                'v2Overview.baselineClosureStillVeeti',
                                'Still from VEETI',
                              )}
                        </span>
                      </div>
                      <div className="v2-year-status-check ready">
                        <span>
                          {t(
                            'v2Overview.wizardSummaryBaselineReady',
                            'Baseline ready',
                          )}
                        </span>
                        <span className="v2-year-status-check-badge">
                          {t('v2Overview.wizardSummaryYes', 'Yes')}
                        </span>
                      </div>
                      <div className="v2-year-status-check ready">
                        <span>{t('v2Overview.datasetCountLabel', 'Datasets')}</span>
                        <span className="v2-year-status-check-badge">
                          {renderDatasetCounts(
                            row.datasetCounts as
                              | Record<string, number>
                              | undefined,
                          )}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          <div className="v2-overview-review-actions">
            <button
              type="button"
              className={openForecastButtonClass}
              onClick={handleOpenForecastHandoff}
            >
              {t('v2Overview.openForecast')}
            </button>
            <p className="v2-muted">
              {t(
                'v2Forecast.selectScenarioHint',
                'Choose an existing scenario or create a new one to continue.',
              )}
            </p>
          </div>
        </section>
      ) : null}
      </div>
  );

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}
      {shouldLeadWithActionSurface ? activeSurface : heroGrid}
      {shouldLeadWithActionSurface ? heroGrid : activeSurface}
    </div>
  );
};
