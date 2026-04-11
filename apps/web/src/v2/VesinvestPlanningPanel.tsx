import React from 'react';
import type { TFunction } from 'i18next';

import {
  connectImportOrganizationV2,
  cloneVesinvestPlanV2,
  createReportV2,
  createVesinvestPlanV2,
  getForecastScenarioV2,
  getVesinvestPlanV2,
  listDepreciationRulesV2,
  listVesinvestGroupsV2,
  listVesinvestPlansV2,
  searchImportOrganizationsV2,
  syncVesinvestPlanToForecastV2,
  updateDepreciationRuleV2,
  updateVesinvestGroupV2,
  updateVesinvestPlanV2,
  type V2DepreciationRule,
  type V2EditableDepreciationRuleMethod,
  type V2ForecastScenario,
  type V2PlanningContextResponse,
  type V2VesinvestBaselineSourceState,
  type V2VesinvestBaselineSnapshotYear,
  type V2VesinvestGroupDefinition,
  type V2VesinvestGroupUpdateInput,
  type V2VesinvestFeeRecommendation,
  type V2VesinvestPlan,
  type V2VesinvestPlanCreateInput,
  type V2VesinvestPlanInput,
  type V2VesinvestPlanSummary,
  type V2VesinvestProject,
} from '../api';
import { buildDefaultReportTitle } from './displayNames';
import { formatDateTime, formatEur, formatPercent, formatPrice } from './format';
import { toDepreciationRuleDraft, type DepreciationRuleDraft } from './forecastModel';
import {
  getDocumentImportEvidence,
  getImportedFileNameByKind,
  normalizeImportedFileName,
} from './provenanceDisplay';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';

type Props = {
  t: TFunction;
  isAdmin?: boolean;
  simplifiedSetup?: boolean;
  planningContext: V2PlanningContextResponse | null;
  linkedOrg:
    | {
        veetiId?: number | null;
        nimi?: string | null;
        ytunnus?: string | null;
      }
    | null
    | undefined;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  onPlansChanged?: () => Promise<void> | void;
};

const appendDetailSuffix = (
  base: string,
  suffixes: Array<string | null | undefined>,
): string => {
  const details = suffixes.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return details.length > 0 ? `${base} | ${details.join(' | ')}` : base;
};

type VesinvestDraft = {
  id?: string;
  name: string;
  utilityName: string;
  businessId: string | null;
  veetiId: number | null;
  identitySource: 'manual' | 'veeti' | 'mixed';
  horizonYears: number;
  status?: 'draft' | 'active' | 'archived';
  baselineStatus: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
  horizonYearsRange: number[];
  projects: V2VesinvestProject[];
};

type VesinvestBaselineYear =
  NonNullable<V2PlanningContextResponse>['baselineYears'][number];

type VesinvestGroupedMatrixSection = {
  groupKey: string;
  groupLabel: string;
  totalAmount: number;
  yearlyTotals: Array<{
    year: number;
    totalAmount: number;
  }>;
  projects: Array<{
    code: string;
    name: string;
    totalAmount: number;
    yearlyTotals: Array<{
      year: number;
      totalAmount: number;
    }>;
  }>;
};

type VesinvestWorkspaceView = 'investment' | 'depreciation';

const FALLBACK_GROUP_KEY = 'sanering_water_network';

const buildHorizonYears = (startYear: number, horizonYears: number) =>
  Array.from({ length: horizonYears }, (_, index) => startYear + index);

const resolveProjectGroup = (
  groups: V2VesinvestGroupDefinition[],
  preferredKey?: string | null,
) =>
  groups.find((item) => item.key === preferredKey) ??
  groups.find((item) => item.key === FALLBACK_GROUP_KEY) ??
  groups[0] ??
  null;

const buildDraftFromPlan = (
  plan: V2VesinvestPlan | null,
  linkedOrg: Props['linkedOrg'],
): VesinvestDraft => {
  if (plan) {
    return {
      id: plan.id,
      name: plan.name,
      utilityName: plan.utilityName,
      businessId: plan.businessId,
      veetiId: plan.veetiId,
      identitySource: plan.identitySource,
      horizonYears: plan.horizonYears,
      status: plan.status,
      baselineStatus: plan.baselineStatus,
      feeRecommendationStatus: plan.feeRecommendationStatus,
      lastReviewedAt: plan.lastReviewedAt,
      reviewDueAt: plan.reviewDueAt,
      horizonYearsRange: [...plan.horizonYearsRange],
      projects: plan.projects.map((project) => ({
        ...project,
        allocations: project.allocations.map((allocation) => ({ ...allocation })),
      })),
    };
  }
  const currentYear = new Date().getFullYear();
  return {
    name: linkedOrg?.nimi ? `${linkedOrg.nimi} Vesinvest` : 'Vesinvest',
    utilityName: linkedOrg?.nimi ?? '',
    businessId: linkedOrg?.ytunnus ?? null,
    veetiId: linkedOrg?.veetiId ?? null,
    identitySource: linkedOrg?.veetiId ? 'mixed' : 'manual',
    horizonYears: 20,
    baselineStatus: 'draft',
    feeRecommendationStatus: 'blocked',
    horizonYearsRange: buildHorizonYears(currentYear, 20),
    projects: [],
  };
};

const toPlanProjectInputs = (
  draft: VesinvestDraft,
) =>
  draft.projects.map((project) => ({
    id: project.id,
    code: project.code,
    name: project.name,
    investmentType: project.investmentType,
    groupKey: project.groupKey,
    depreciationClassKey: project.depreciationClassKey,
    accountKey: project.defaultAccountKey,
    reportGroupKey: project.reportGroupKey,
    subtype: project.subtype,
    notes: project.notes,
    waterAmount: project.waterAmount,
    wastewaterAmount: project.wastewaterAmount,
    allocations: project.allocations.map((allocation) => ({
      year: allocation.year,
      totalAmount: allocation.totalAmount,
      waterAmount: allocation.waterAmount,
      wastewaterAmount: allocation.wastewaterAmount,
    })),
  }));

const toCreatePlanInput = (
  draft: VesinvestDraft,
  baselineSourceState: V2VesinvestBaselineSourceState | null,
): V2VesinvestPlanCreateInput => ({
  name: draft.name,
  horizonYears: draft.horizonYears,
  baselineSourceState,
  projects: toPlanProjectInputs(draft),
});

const toUpdatePlanInput = (
  draft: VesinvestDraft,
  baselineSourceState: V2VesinvestBaselineSourceState | null,
): V2VesinvestPlanInput => ({
  name: draft.name,
  horizonYears: draft.horizonYears,
  status: draft.status,
  baselineStatus: draft.baselineStatus,
  feeRecommendationStatus: draft.feeRecommendationStatus,
  lastReviewedAt: draft.lastReviewedAt,
  reviewDueAt: draft.reviewDueAt,
  baselineSourceState,
  projects: toPlanProjectInputs(draft),
});

const createProject = (
  years: number[],
  groups: V2VesinvestGroupDefinition[],
  index: number,
  seed: {
    code: string;
    name: string;
    groupKey: string;
  },
): V2VesinvestProject => {
  const group = resolveProjectGroup(groups, seed.groupKey);
  const resolvedGroupKey = group?.key ?? seed.groupKey ?? FALLBACK_GROUP_KEY;
  return {
    code: seed.code.trim() || `P-${String(index + 1).padStart(3, '0')}`,
    name: seed.name.trim(),
    investmentType: resolveInvestmentTypeFromGroupKey(resolvedGroupKey),
    groupKey: resolvedGroupKey,
    groupLabel: group?.label ?? resolvedGroupKey,
    depreciationClassKey: group?.defaultDepreciationClassKey ?? group?.key ?? null,
    defaultAccountKey: group?.defaultAccountKey ?? null,
    reportGroupKey: group?.reportGroupKey ?? null,
    subtype: null,
    notes: null,
    waterAmount: 0,
    wastewaterAmount: 0,
    totalAmount: 0,
    allocations: years.map((year) => ({
      year,
      totalAmount: 0,
      waterAmount: 0,
      wastewaterAmount: 0,
    })),
  };
};

const resolveInvestmentTypeFromGroupKey = (
  groupKey: string,
): V2VesinvestProject['investmentType'] =>
  groupKey.startsWith('new_')
    ? 'nyanlaggning'
    : groupKey.startsWith('repair_')
    ? 'reparation'
    : 'sanering';

const typeLabel = (t: TFunction, value: V2VesinvestProject['investmentType']) =>
  value === 'nyanlaggning'
    ? t('v2Vesinvest.typeNewBuild', 'New build')
    : value === 'reparation'
    ? t('v2Vesinvest.typeRepair', 'Repair')
    : t('v2Vesinvest.typeSanering', 'Rehabilitation');

const parseNullableNumberInput = (value: string): number | undefined => {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const allocationFieldLabel = (
  t: TFunction,
  fieldKey: 'totalAmount' | 'waterAmount' | 'wastewaterAmount',
) =>
  fieldKey === 'totalAmount'
    ? t('v2Vesinvest.projectTotal', 'Total')
    : fieldKey === 'waterAmount'
    ? t('v2Vesinvest.projectWaterTotal', 'Water total')
    : t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total');

const toneClass = (status: 'draft' | 'incomplete' | 'verified' | 'blocked' | 'provisional') =>
  status === 'verified'
    ? 'v2-status-positive'
    : status === 'incomplete' || status === 'provisional'
    ? 'v2-status-warning'
    : 'v2-status-neutral';

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatPlanMatrixAmount = (value: number) =>
  Math.abs(value) > 0.004 ? formatEur(value) : '';

const syncProjectTotals = (project: V2VesinvestProject): V2VesinvestProject => {
  const waterAmount = round2(
    project.allocations.reduce((sum, allocation) => sum + (allocation.waterAmount ?? 0), 0),
  );
  const wastewaterAmount = round2(
    project.allocations.reduce((sum, allocation) => sum + (allocation.wastewaterAmount ?? 0), 0),
  );
  const totalAmount = round2(
    project.allocations.reduce((sum, allocation) => sum + (allocation.totalAmount ?? 0), 0),
  );
  return {
    ...project,
    waterAmount,
    wastewaterAmount,
    totalAmount,
  };
};

const sourceStatusLabel = (
  t: TFunction,
  status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE',
  planningRole?: 'historical' | 'current_year_estimate',
) => {
  let label =
    status === 'MANUAL'
      ? t('v2Reports.baselineStatusManual', 'Manual baseline')
      : status === 'MIXED'
      ? t('v2Reports.baselineStatusMixed', 'Mixed baseline')
      : status === 'INCOMPLETE'
      ? t('v2Reports.baselineStatusIncomplete', 'Incomplete baseline')
      : t('v2Reports.baselineStatusVeeti', 'VEETI baseline');
  if (planningRole === 'current_year_estimate') {
    label = `${label} · ${t('v2Overview.currentYearEstimateBadge', 'Estimate')}`;
  }
  return label;
};

const datasetSourceLabel = (
  t: TFunction,
  dataset: VesinvestBaselineYear['financials'],
) => {
  const documentEvidence = getDocumentImportEvidence(dataset.provenance);
  const documentFileName = normalizeImportedFileName(
    documentEvidence.fileName ?? dataset.provenance?.fileName,
    'PDF document',
  );
  const withDocumentEvidence = (value: string, extraDetails: string[] = []) =>
    appendDetailSuffix(value, [...extraDetails, documentEvidence.pageLabel]);
  const hasStatementImport =
    dataset.provenance?.kind === 'statement_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'statement_import',
    ) ?? false);
  const hasDocumentImport =
    dataset.provenance?.kind === 'document_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'document_import',
    ) ?? false);
  const hasWorkbookImport =
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) =>
        item.provenance.kind === 'kva_import' ||
        item.provenance.kind === 'excel_import',
    ) ?? false);
  if (hasDocumentImport && hasWorkbookImport) {
    return withDocumentEvidence(
      t(
        'v2Reports.baselineSourceDocumentWorkbookMixed',
        'Source document + workbook repair',
      ),
      [documentFileName],
    );
  }
  if (hasStatementImport && hasWorkbookImport) {
    return appendDetailSuffix(
      t(
        'v2Reports.baselineSourceStatementWorkbookMixed',
        'Statement PDF + workbook repair',
      ),
      [
        getImportedFileNameByKind(
          dataset.provenance,
          'statement_import',
          t('v2Reports.statementImportFallbackFile', 'statement PDF'),
        ),
      ],
    );
  }
  if (hasDocumentImport) {
    return withDocumentEvidence(
      t('v2Reports.baselineSourceDocumentImport', {
        defaultValue: 'Source document ({{fileName}})',
        fileName: documentFileName,
      }),
    );
  }
  if (dataset.provenance?.kind === 'statement_import') {
    return t('v2Reports.baselineSourceStatementImport', {
      defaultValue: 'Statement import ({{fileName}})',
      fileName: normalizeImportedFileName(
        dataset.provenance.fileName,
        t('v2Reports.statementImportFallbackFile', 'statement PDF'),
      ),
    });
  }
  if (dataset.provenance?.kind === 'qdis_import') {
    return t('v2Reports.baselineSourceQdisImport', {
      defaultValue: 'QDIS PDF ({{fileName}})',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'QDIS PDF'),
    });
  }
  if (
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import'
  ) {
    return t('v2Reports.baselineSourceWorkbookImport', {
      defaultValue: 'Workbook import ({{fileName}})',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'Excel workbook'),
    });
  }
  if (dataset.source === 'manual') {
    return t('v2Reports.baselineSourceManual', 'Manual review');
  }
  if (dataset.source === 'veeti') {
    return t('v2Reports.baselineSourceVeeti', 'VEETI');
  }
  return t('v2Reports.baselineSourceMissing', 'Missing');
};

const datasetSourceNote = (
  t: TFunction,
  dataset: VesinvestBaselineYear['financials'],
) => {
  const documentEvidence = getDocumentImportEvidence(dataset.provenance);
  const documentFileName = normalizeImportedFileName(
    documentEvidence.fileName ?? dataset.provenance?.fileName,
    'PDF document',
  );
  const documentEvidenceDetail = [
    documentEvidence.pageLabel,
    ...documentEvidence.sourceLines,
  ];
  const hasStatementImport =
    dataset.provenance?.kind === 'statement_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'statement_import',
    ) ?? false);
  const hasDocumentImport =
    dataset.provenance?.kind === 'document_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'document_import',
    ) ?? false);
  const hasWorkbookImport =
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) =>
        item.provenance.kind === 'kva_import' ||
        item.provenance.kind === 'excel_import',
    ) ?? false);
  if (hasDocumentImport && hasWorkbookImport) {
    return appendDetailSuffix(
      t(
      'v2Reports.baselineDocumentWorkbookDetail',
      'Document-backed values and workbook repairs both affect this year.',
      ),
      [documentFileName, ...documentEvidenceDetail],
    );
  }
  if (hasStatementImport && hasWorkbookImport) {
    return appendDetailSuffix(
      t(
        'v2Reports.baselineStatementWorkbookDetail',
        'Statement-backed values and workbook repairs both affect this year.',
      ),
      [
        getImportedFileNameByKind(
          dataset.provenance,
          'statement_import',
          t('v2Reports.statementImportFallbackFile', 'statement PDF'),
        ),
      ],
    );
  }
  if (hasDocumentImport) {
    return appendDetailSuffix(
      t('v2Reports.baselineDocumentImportDetail', {
      defaultValue: 'Values came from {{fileName}}',
      fileName: normalizeImportedFileName(
        documentEvidence.fileName ?? dataset.provenance?.fileName,
        'PDF document',
      ),
      }),
      documentEvidenceDetail,
    );
  }
  if (dataset.provenance?.kind === 'statement_import') {
    return t('v2Reports.baselineStatementImportDetail', {
      defaultValue: 'Financials came from {{fileName}}',
      fileName: normalizeImportedFileName(
        dataset.provenance.fileName,
        t('v2Reports.statementImportFallbackFile', 'statement PDF'),
      ),
    });
  }
  if (dataset.provenance?.kind === 'qdis_import') {
    return t('v2Reports.baselineQdisImportDetail', {
      defaultValue: 'Prices and volumes came from {{fileName}}',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'QDIS PDF'),
    });
  }
  if (
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import'
  ) {
    return t('v2Reports.baselineWorkbookImportDetail', {
      defaultValue: 'Workbook-backed values came from {{fileName}}',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'Excel workbook'),
    });
  }
  if (dataset.source === 'manual' && dataset.reason) {
    return t('v2Reports.baselineManualReason', 'Reason: {{reason}}', {
      reason: dataset.reason,
    });
  }
  if (dataset.source === 'manual' && dataset.editedAt) {
    return t('v2Reports.baselineManualEditedAt', 'Reviewed {{date}}', {
      date: formatDateTime(dataset.editedAt),
    });
  }
  if (dataset.source === 'veeti') {
    return t(
      'v2Reports.baselineSourceVeetiHint',
      'Current report snapshot follows VEETI for this dataset.',
    );
  }
  return t(
    'v2Reports.baselineSourceMissingHint',
    'No trusted dataset was available in the saved baseline.',
  );
};

const qualityLabel = (
  t: TFunction,
  quality: VesinvestBaselineYear['quality'],
) =>
  quality === 'complete'
    ? t('v2Vesinvest.qualityComplete', 'Complete')
    : quality === 'partial'
    ? t('v2Vesinvest.qualityPartial', 'Partial')
    : t('v2Vesinvest.qualityMissing', 'Missing');

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const readSavedBaselineYears = (
  state: V2VesinvestBaselineSourceState | null,
): V2VesinvestBaselineSnapshotYear[] => {
  if (!Array.isArray(state?.baselineYears)) {
    return [];
  }
  return cloneJson(state.baselineYears);
};

const buildBaselineSourceSnapshot = (
  planningContext: V2PlanningContextResponse | null,
  currentState: V2VesinvestBaselineSourceState | null,
): V2VesinvestBaselineSourceState | null => {
  const liveBaselineYears = Array.isArray(planningContext?.baselineYears)
    ? cloneJson(planningContext.baselineYears)
    : [];
  const fallbackBaselineYears = readSavedBaselineYears(currentState);
  const baselineYears =
    liveBaselineYears.length > 0 ? liveBaselineYears : fallbackBaselineYears;
  const acceptedYears = baselineYears
    .map((row) => Number(row.year))
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => left - right);
  if (baselineYears.length === 0 && !currentState) {
    return null;
  }
  return {
    ...(currentState ?? {}),
    source:
      planningContext?.canCreateScenario === true
        ? 'planning_context_verified'
        : currentState?.source ?? 'planning_context',
    acceptedYears,
    latestAcceptedBudgetId: currentState?.latestAcceptedBudgetId ?? null,
    snapshotCapturedAt: new Date().toISOString(),
    baselineYears,
  };
};

const VesinvestRevisionSurface: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <>{children}</>;

const VesinvestIdentitySurface: React.FC<{
  t: TFunction;
  badge: React.ReactNode;
  children: React.ReactNode;
}> = ({ t, badge, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.identityLock', 'Identity guardrail')}
        </p>
        <h3>{t('v2Vesinvest.utilityName', 'Utility name')}</h3>
      </div>
      {badge}
    </div>
    {children}
  </section>
);

const VesinvestDepreciationPlanSurface: React.FC<{
  t: TFunction;
  children: React.ReactNode;
}> = ({ t, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.depreciationPlan', 'Depreciation plan')}
        </p>
        <h3>{t('v2Vesinvest.classPlanHeading', 'Class-owned depreciation plan')}</h3>
      </div>
    </div>
    {children}
  </section>
);

const VesinvestBaselineReviewSurface: React.FC<{
  t: TFunction;
  badge: React.ReactNode;
  statusStrip?: React.ReactNode;
  feePath: React.ReactNode;
  children: React.ReactNode;
}> = ({ t, badge, statusStrip, feePath, children }) => (
  <>
    {statusStrip ?? null}
    <section className="v2-vesinvest-section">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">
            {t('v2Vesinvest.evidenceEyebrow', 'Baseline & evidence')}
          </p>
          <h3>{t('v2Vesinvest.evidenceTitle', 'Accepted baseline years')}</h3>
        </div>
        {badge}
      </div>
      {children}
    </section>
    {feePath}
  </>
);

const VesinvestMatrixSurface: React.FC<{
  t: TFunction;
  children: React.ReactNode;
}> = ({ t, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.investmentPlan', 'Investment plan')}
        </p>
        <h3>{t('v2Vesinvest.groupedLayout', 'Grouped horizon layout')}</h3>
      </div>
    </div>
    {children}
  </section>
);

const VesinvestRegisterSurface: React.FC<{
  t: TFunction;
  children: React.ReactNode;
}> = ({ t, children }) => (
  <section className="v2-vesinvest-section">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Vesinvest.projectRegister', 'Project register')}
        </p>
        <h3>{t('v2Vesinvest.editableProjects', 'Editable project rows')}</h3>
      </div>
    </div>
    {children}
  </section>
);

const VesinvestProjectDetailsSurface: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <div className="v2-vesinvest-project-details">{children}</div>
);

export const VesinvestPlanningPanel: React.FC<Props> = ({
  t,
  isAdmin = false,
  simplifiedSetup = false,
  planningContext,
  linkedOrg,
  onGoToForecast,
  onGoToReports,
  onPlansChanged,
}) => {
  const [groups, setGroups] = React.useState<V2VesinvestGroupDefinition[]>([]);
  const [groupDrafts, setGroupDrafts] = React.useState<V2VesinvestGroupDefinition[]>(
    [],
  );
  const [depreciationRules, setDepreciationRules] = React.useState<V2DepreciationRule[]>(
    [],
  );
  const [depreciationRuleDrafts, setDepreciationRuleDrafts] = React.useState<
    DepreciationRuleDraft[]
  >([]);
  const [plans, setPlans] = React.useState<V2VesinvestPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(
    planningContext?.vesinvest?.selectedPlan?.id ??
      planningContext?.vesinvest?.activePlan?.id ??
      null,
  );
  const [plan, setPlan] = React.useState<V2VesinvestPlan | null>(null);
  const [draft, setDraft] = React.useState(() => buildDraftFromPlan(null, linkedOrg));
  const [loading, setLoading] = React.useState(true);
  const [loadingPlan, setLoadingPlan] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [veetiSearchQuery, setVeetiSearchQuery] = React.useState('');
  const [veetiSearchResults, setVeetiSearchResults] = React.useState<
    Array<{
      id: number;
      name: string;
      businessId: string | null;
      municipality: string | null;
    }>
  >([]);
  const [searchingVeeti, setSearchingVeeti] = React.useState(false);
  const [savingClassKey, setSavingClassKey] = React.useState<string | null>(null);
  const [linkedScenario, setLinkedScenario] =
    React.useState<V2ForecastScenario | null>(null);
  const [loadingLinkedScenario, setLoadingLinkedScenario] =
    React.useState(false);
  const [activeWorkspaceView, setActiveWorkspaceView] =
    React.useState<VesinvestWorkspaceView>('investment');
  const [projectComposer, setProjectComposer] = React.useState<{
    open: boolean;
    code: string;
    groupKey: string;
    name: string;
  }>({
    open: false,
    code: '',
    groupKey: FALLBACK_GROUP_KEY,
    name: '',
  });
  const useSimplifiedSetup = simplifiedSetup && isAdmin;

  const refreshSummaries = React.useCallback(async (preferredId?: string | null) => {
    const [groupRows, depreciationRuleRows, planRows] = await Promise.all([
      listVesinvestGroupsV2(),
      listDepreciationRulesV2(),
      listVesinvestPlansV2(),
    ]);
    setGroups(groupRows);
    setGroupDrafts(groupRows.map((item) => ({ ...item })));
    setDepreciationRules(depreciationRuleRows);
    setDepreciationRuleDrafts(
      depreciationRuleRows.map((item) => toDepreciationRuleDraft(item)),
    );
    setPlans(planRows);
    setSelectedPlanId((current) => {
      if (preferredId && planRows.some((item) => item.id === preferredId)) return preferredId;
      if (current && planRows.some((item) => item.id === current)) return current;
      const contextSelectedId = planningContext?.vesinvest?.selectedPlan?.id;
      if (
        contextSelectedId &&
        planRows.some((item) => item.id === contextSelectedId)
      ) {
        return contextSelectedId;
      }
      const contextActiveId = planningContext?.vesinvest?.activePlan?.id;
      if (
        contextActiveId &&
        planRows.some((item) => item.id === contextActiveId)
      ) {
        return contextActiveId;
      }
      return planRows[0]?.id ?? null;
    });
  }, [planningContext?.vesinvest?.activePlan?.id, planningContext?.vesinvest?.selectedPlan?.id]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void refreshSummaries()
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : t('v2Vesinvest.errorLoad', 'Failed to load Vesinvest plans.'),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshSummaries, t]);

  React.useEffect(() => {
    if (!selectedPlanId) {
      setPlan(null);
      setDraft(buildDraftFromPlan(null, linkedOrg));
      return;
    }
    let active = true;
    setLoadingPlan(true);
    void getVesinvestPlanV2(selectedPlanId)
      .then((data) => {
        if (!active) return;
        setPlan(data);
        setDraft(buildDraftFromPlan(data, linkedOrg));
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : t('v2Vesinvest.errorLoadPlan', 'Failed to load the selected plan.'),
        );
      })
      .finally(() => {
        if (active) setLoadingPlan(false);
      });
    return () => {
      active = false;
    };
  }, [linkedOrg, selectedPlanId, t]);

  React.useEffect(() => {
    if (!plan?.selectedScenarioId) {
      setLinkedScenario(null);
      setLoadingLinkedScenario(false);
      return;
    }
    let active = true;
    setLoadingLinkedScenario(true);
    void getForecastScenarioV2(plan.selectedScenarioId)
      .then((scenario) => {
        if (!active) return;
        setLinkedScenario(scenario);
      })
      .catch(() => {
        if (!active) return;
        setLinkedScenario(null);
      })
      .finally(() => {
        if (active) setLoadingLinkedScenario(false);
      });
    return () => {
      active = false;
    };
  }, [plan?.selectedScenarioId]);

  const yearTotals = React.useMemo(
    () =>
      draft.horizonYearsRange.map((year) => ({
        year,
        totalAmount: draft.projects.reduce((sum, project) => {
          const allocation = project.allocations.find((item) => item.year === year);
          return sum + (allocation?.totalAmount ?? 0);
        }, 0),
      })),
    [draft],
  );
  const fiveYearBands = React.useMemo(() => {
    const bands: Array<{ startYear: number; endYear: number; totalAmount: number }> = [];
    for (let index = 0; index < yearTotals.length; index += 5) {
      const slice = yearTotals.slice(index, index + 5);
      if (slice.length === 0) continue;
      bands.push({
        startYear: slice[0]!.year,
        endYear: slice[slice.length - 1]!.year,
        totalAmount: slice.reduce((sum, item) => sum + item.totalAmount, 0),
      });
    }
    return bands;
  }, [yearTotals]);
  const totalInvestments = React.useMemo(
    () => yearTotals.reduce((sum, item) => sum + item.totalAmount, 0),
    [yearTotals],
  );
  const groupedPlanMatrix = React.useMemo<VesinvestGroupedMatrixSection[]>(() => {
    const groupOrder = new Map(groups.map((group, index) => [group.key, index]));
    const groupLabelByKey = new Map(
      groups.map((group) => [
        group.key,
        resolveVesinvestGroupLabel(t, group.key, group.label),
      ]),
    );
    const sections = new Map<
      string,
      {
        groupKey: string;
        groupLabel: string;
        projects: VesinvestGroupedMatrixSection['projects'];
      }
    >();

    for (const project of draft.projects) {
      const groupKey = project.groupKey || FALLBACK_GROUP_KEY;
      const groupLabel =
        groupLabelByKey.get(groupKey) ??
        resolveVesinvestGroupLabel(t, groupKey, project.groupLabel ?? groupKey);
      const yearlyTotals = draft.horizonYearsRange.map((year) => ({
        year,
        totalAmount: round2(
          project.allocations.find((allocation) => allocation.year === year)?.totalAmount ?? 0,
        ),
      }));
      const totalAmount = round2(
        yearlyTotals.reduce((sum, item) => sum + item.totalAmount, 0),
      );
      const current = sections.get(groupKey) ?? {
        groupKey,
        groupLabel,
        projects: [],
      };
      current.projects.push({
        code: project.code,
        name: project.name,
        totalAmount,
        yearlyTotals,
      });
      sections.set(groupKey, current);
    }

    return [...sections.values()]
      .sort((left, right) => {
        const leftOrder = groupOrder.get(left.groupKey) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = groupOrder.get(right.groupKey) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.groupLabel.localeCompare(right.groupLabel);
      })
      .map((section) => {
        const yearlyTotals = draft.horizonYearsRange.map((year) => ({
          year,
          totalAmount: round2(
            section.projects.reduce(
              (sum, project) =>
                sum +
                (project.yearlyTotals.find((item) => item.year === year)?.totalAmount ?? 0),
              0,
            ),
          ),
        }));
        return {
          groupKey: section.groupKey,
          groupLabel: section.groupLabel,
          totalAmount: round2(
            yearlyTotals.reduce((sum, item) => sum + item.totalAmount, 0),
          ),
          yearlyTotals,
          projects: section.projects,
        };
      });
  }, [draft.horizonYearsRange, draft.projects, groups]);
  const savedBaselineSource = React.useMemo(() => {
    const current = plan?.baselineSourceState;
    return current && typeof current === 'object'
      ? (current as V2VesinvestBaselineSourceState)
      : null;
  }, [plan?.baselineSourceState]);
  const loadedPlanDraft = React.useMemo(
    () => (plan ? buildDraftFromPlan(plan, linkedOrg) : null),
    [linkedOrg, plan],
  );
  const hasUnsavedChanges = React.useMemo(() => {
    if (!loadedPlanDraft) return false;
    const baselineSnapshot = buildBaselineSourceSnapshot(
      planningContext,
      savedBaselineSource,
    );
    return (
      JSON.stringify(toUpdatePlanInput(draft, baselineSnapshot)) !==
      JSON.stringify(toUpdatePlanInput(loadedPlanDraft, baselineSnapshot))
    );
  }, [draft, loadedPlanDraft, planningContext, savedBaselineSource]);
  const liveBaselineVerified = planningContext?.canCreateScenario === true;
  const selectedSummary = plans.find((item) => item.id === selectedPlanId) ?? null;
  const utilityBindingMissing = !linkedOrg?.veetiId;
  const utilityBindingMismatch =
    !!plan?.id &&
    ((linkedOrg?.veetiId ?? null) !== (plan.veetiId ?? null) ||
      ((linkedOrg?.ytunnus?.trim() ?? null) !== null &&
        (plan.businessId ?? null) !== null &&
        (linkedOrg?.ytunnus?.trim() ?? null) !== (plan.businessId ?? null)));
  const baselineVerified = plan
    ? selectedSummary?.baselineStatus === 'verified'
    : liveBaselineVerified;
  const baselineYears = React.useMemo(
    () =>
      [
        ...(
          plan?.id
            ? readSavedBaselineYears(savedBaselineSource)
            : planningContext?.baselineYears?.length
            ? planningContext.baselineYears
            : readSavedBaselineYears(savedBaselineSource)
        ),
      ]
        .sort((left, right) => right.year - left.year),
    [plan?.id, planningContext?.baselineYears, savedBaselineSource],
  );
  const pricingReady =
    !utilityBindingMissing &&
    !utilityBindingMismatch &&
    baselineVerified &&
    draft.projects.length > 0 &&
    totalInvestments > 0;
  const feeRecommendation = React.useMemo(() => {
    const snapshot = plan?.feeRecommendation ?? null;
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      'combined' in snapshot &&
      'water' in snapshot &&
      'wastewater' in snapshot &&
      'baseFee' in snapshot
    ) {
      return snapshot as V2VesinvestFeeRecommendation;
    }
    return null;
  }, [plan?.feeRecommendation]);
  const revisionStatusMessage = React.useMemo(() => {
    if (!plan?.id || !selectedSummary) {
      return t(
        'v2Vesinvest.planUnsavedDraft',
        'This revision is still a local draft until you save it.',
      );
    }
    if (utilityBindingMissing) {
      return t(
        'v2Vesinvest.baselineLinkPending',
        'Not yet linked',
      );
    }
    if (utilityBindingMismatch) {
      return t(
        'v2Vesinvest.pricingBlockedHint',
        'Fee-path and financing output stay blocked until the baseline is verified.',
      );
    }
    if (!feeRecommendation || !selectedSummary.selectedScenarioId) {
      return t(
        'v2Vesinvest.planNotYetSynced',
        'Fee-path has not been opened from this revision yet.',
      );
    }
    if (selectedSummary.baselineChangedSinceAcceptedRevision) {
      return t(
        'v2Vesinvest.baselineChangedSincePricing',
        'Accepted baseline changed after the saved fee-path result.',
      );
    }
    if (selectedSummary.investmentPlanChangedSinceFeeRecommendation) {
      return t(
        'v2Vesinvest.planChangedSincePricing',
        'Investment plan changed since the last fee-path result.',
      );
    }
    return t(
      'v2Vesinvest.planAlignedWithPricing',
      'Saved fee-path result still matches this revision.',
    );
  }, [
    feeRecommendation,
    plan?.id,
    selectedSummary,
    t,
    utilityBindingMismatch,
    utilityBindingMissing,
  ]);
  const reportReadinessReason = React.useMemo(() => {
    if (!plan?.selectedScenarioId || !linkedScenario) {
      return 'missingScenario' as const;
    }
    if (selectedSummary?.classificationReviewRequired) {
      return 'classificationReviewRequired' as const;
    }
    if (selectedSummary?.pricingStatus !== 'verified') {
      return 'staleComputeToken' as const;
    }
    if (hasUnsavedChanges) {
      return 'unsavedChanges' as const;
    }
    if (
      !linkedScenario.computedFromUpdatedAt ||
      linkedScenario.computedFromUpdatedAt !== linkedScenario.updatedAt
    ) {
      if (linkedScenario.years.length === 0) {
        return 'missingComputeResults' as const;
      }
      return 'staleComputeToken' as const;
    }
    if (
      linkedScenario.yearlyInvestments.some(
        (row) => row.amount > 0 && !row.depreciationRuleSnapshot,
      )
    ) {
      return 'missingDepreciationSnapshots' as const;
    }
    return null;
  }, [
    hasUnsavedChanges,
    linkedScenario,
    plan?.selectedScenarioId,
    selectedSummary?.classificationReviewRequired,
    selectedSummary?.pricingStatus,
  ]);
  const canCreateReport =
    reportReadinessReason == null && !loadingLinkedScenario && !!plan?.id;

  const updateProject = React.useCallback(
    (index: number, updater: (project: V2VesinvestProject) => V2VesinvestProject) => {
      setDraft((current) => ({
        ...current,
        projects: current.projects.map((project, projectIndex) =>
          projectIndex === index ? syncProjectTotals(updater(project)) : project,
        ),
      }));
    },
    [],
  );

  const updateGroupDraft = React.useCallback(
    (
      key: string,
      updater: (
        group: V2VesinvestGroupDefinition,
      ) => V2VesinvestGroupDefinition,
    ) => {
      setGroupDrafts((current) =>
        current.map((group) => (group.key === key ? updater(group) : group)),
      );
    },
    [],
  );

  const updateDepreciationRuleDraft = React.useCallback(
    (
      key: string,
      updater: (rule: DepreciationRuleDraft) => DepreciationRuleDraft,
    ) => {
      setDepreciationRuleDrafts((current) =>
        current.map((rule) => (rule.assetClassKey === key ? updater(rule) : rule)),
      );
    },
    [],
  );

  const handleSaveClassDefinition = React.useCallback(
    async (key: string) => {
      const groupDraft = groupDrafts.find((group) => group.key === key);
      const ruleDraft = depreciationRuleDrafts.find((rule) => rule.assetClassKey === key);
      if (!groupDraft || !ruleDraft) {
        return;
      }
      const payload: V2VesinvestGroupUpdateInput = {
        label: groupDraft.label,
        defaultAccountKey: groupDraft.defaultAccountKey,
        reportGroupKey: groupDraft.reportGroupKey,
        serviceSplit: groupDraft.serviceSplit,
      };
      setSavingClassKey(key);
      setError(null);
      try {
        const [updatedGroup, updatedRule] = await Promise.all([
          updateVesinvestGroupV2(key, payload),
          updateDepreciationRuleV2(key, {
            assetClassKey: key,
            assetClassName: groupDraft.label,
            method: ruleDraft.method as V2EditableDepreciationRuleMethod,
            linearYears: parseNullableNumberInput(ruleDraft.linearYears),
            residualPercent: parseNullableNumberInput(ruleDraft.residualPercent),
          }),
        ]);
        setGroups((current) =>
          current.map((group) => (group.key === key ? updatedGroup : group)),
        );
        setGroupDrafts((current) =>
          current.map((group) => (group.key === key ? updatedGroup : group)),
        );
        setDepreciationRules((current) =>
          current.map((rule) => (rule.assetClassKey === key ? updatedRule : rule)),
        );
        setDepreciationRuleDrafts((current) =>
          current.map((rule) =>
            rule.assetClassKey === key ? toDepreciationRuleDraft(updatedRule) : rule,
          ),
        );
        setDraft((current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.groupKey === key
              ? {
                  ...project,
                  groupLabel: updatedGroup.label,
                  depreciationClassKey: updatedGroup.key,
                  defaultAccountKey: updatedGroup.defaultAccountKey,
                  reportGroupKey: updatedGroup.reportGroupKey,
                }
              : project,
          ),
        }));
        setPlan((current) =>
          current
            ? {
                ...current,
                projects: current.projects.map((project) =>
                  project.groupKey === key
                    ? {
                        ...project,
                        groupLabel: updatedGroup.label,
                        depreciationClassKey: updatedGroup.key,
                        defaultAccountKey: updatedGroup.defaultAccountKey,
                        reportGroupKey: updatedGroup.reportGroupKey,
                      }
                    : project,
                ),
              }
            : current,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Vesinvest.errorLoad', 'Failed to load Vesinvest plans.'),
        );
      } finally {
        setSavingClassKey(null);
      }
    },
    [depreciationRuleDrafts, groupDrafts, t],
  );

  const updateProjectAllocation = React.useCallback(
    (
      projectIndex: number,
      year: number,
      field: 'totalAmount' | 'waterAmount' | 'wastewaterAmount',
      value: number,
    ) => {
      updateProject(projectIndex, (current) => {
        const serviceSplit =
          groups.find((group) => group.key === current.groupKey)?.serviceSplit ?? 'mixed';
        const allocations = current.allocations.map((allocation) => {
          if (allocation.year !== year) return allocation;
          if (field === 'totalAmount') {
            const totalAmount = round2(value);
            if (serviceSplit === 'water') {
              return {
                ...allocation,
                totalAmount,
                waterAmount: totalAmount,
                wastewaterAmount: 0,
              };
            }
            if (serviceSplit === 'wastewater') {
              return {
                ...allocation,
                totalAmount,
                waterAmount: 0,
                wastewaterAmount: totalAmount,
              };
            }
            const existingWater = allocation.waterAmount ?? 0;
            const existingWastewater = allocation.wastewaterAmount ?? 0;
            const existingTotal = existingWater + existingWastewater;
            if (existingTotal > 0) {
              const waterAmount = round2((existingWater / existingTotal) * totalAmount);
              return {
                ...allocation,
                totalAmount,
                waterAmount,
                wastewaterAmount: round2(totalAmount - waterAmount),
              };
            }
            return {
              ...allocation,
              totalAmount,
              waterAmount: totalAmount,
              wastewaterAmount: 0,
            };
          }
          if (field === 'waterAmount') {
            const waterAmount = round2(value);
            const wastewaterAmount = round2(allocation.wastewaterAmount ?? 0);
            return {
              ...allocation,
              waterAmount,
              totalAmount: round2(waterAmount + wastewaterAmount),
            };
          }
          const wastewaterAmount = round2(value);
          const waterAmount = round2(allocation.waterAmount ?? 0);
          return {
            ...allocation,
            wastewaterAmount,
            totalAmount: round2(waterAmount + wastewaterAmount),
          };
        });
        return {
          ...current,
          allocations,
        };
      });
    },
    [groups, updateProject],
  );

  const runVeetiLookup = React.useCallback(async () => {
    const query = veetiSearchQuery.trim();
    if (query.length < 2) {
      setError(
        t(
          'v2Vesinvest.veetiLookupQueryRequired',
          'Enter at least two characters before searching VEETI.',
        ),
      );
      setInfo(null);
      return;
    }
    setSearchingVeeti(true);
    setError(null);
    try {
      const rows = await searchImportOrganizationsV2(query, 8);
      setVeetiSearchResults(
        rows.map((row) => ({
          id: row.Id,
          name: row.Nimi?.trim() || `VEETI ${row.Id}`,
          businessId: row.YTunnus?.trim() || null,
          municipality: row.Kunta?.trim() || null,
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Vesinvest.veetiLookupFailed', 'VEETI lookup failed.'),
      );
      setInfo(null);
    } finally {
      setSearchingVeeti(false);
    }
  }, [t, veetiSearchQuery]);

  const applyVeetiSearchHit = React.useCallback(
    async (hit: { id: number; name: string; businessId: string | null }) => {
      if (linkedOrg?.veetiId) {
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await connectImportOrganizationV2(hit.id);
        await onPlansChanged?.();
        setInfo(
          t(
            'v2Overview.infoConnected',
            'Organization connected. Create the first Vesinvest plan to continue.',
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Vesinvest.veetiLookupFailed', 'VEETI lookup failed.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [linkedOrg?.veetiId, onPlansChanged, t],
  );

  const persist = React.useCallback(
    async (mode: 'create' | 'save' | 'clone' | 'sync') => {
      const invalidProject = draft.projects.find(
        (project) =>
          project.code.trim().length === 0 || project.name.trim().length === 0,
      );
      if (invalidProject) {
        setError(
          t(
            'v2Vesinvest.errorProjectRequired',
            'Project code and name are required.',
          ),
        );
        setInfo(null);
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const baselineSnapshot = buildBaselineSourceSnapshot(
          planningContext,
          savedBaselineSource,
        );
        if (mode === 'create') {
          const created = await createVesinvestPlanV2(
            toCreatePlanInput(draft, baselineSnapshot),
          );
          setPlan(created);
          setDraft(buildDraftFromPlan(created, linkedOrg));
          await refreshSummaries(created.id);
          await onPlansChanged?.();
          setInfo(t('v2Vesinvest.infoCreated', 'Vesinvest plan created.'));
          return;
        }
        if (!plan?.id) return;
        const payload = toUpdatePlanInput(draft, baselineSnapshot);
        if (mode === 'save') {
          const saved = await updateVesinvestPlanV2(plan.id, payload);
          setPlan(saved);
          setDraft(buildDraftFromPlan(saved, linkedOrg));
          await refreshSummaries(saved.id);
          await onPlansChanged?.();
          setInfo(t('v2Vesinvest.infoSaved', 'Vesinvest plan saved.'));
          return;
        }
        if (mode === 'clone') {
          const saved = await updateVesinvestPlanV2(plan.id, payload);
          const cloned = await cloneVesinvestPlanV2(saved.id);
          setPlan(cloned);
          setDraft(buildDraftFromPlan(cloned, linkedOrg));
          await refreshSummaries(cloned.id);
          await onPlansChanged?.();
          setInfo(t('v2Vesinvest.infoCloned', 'New Vesinvest revision created.'));
          return;
        }
        const saved = await updateVesinvestPlanV2(plan.id, payload);
        const synced = await syncVesinvestPlanToForecastV2(saved.id, {
          compute: true,
          baselineSourceState: baselineSnapshot,
        });
        setPlan(synced.plan);
        setDraft(buildDraftFromPlan(synced.plan, linkedOrg));
        await refreshSummaries(synced.plan.id);
        await onPlansChanged?.();
        onGoToForecast(synced.scenarioId);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('v2Vesinvest.errorSave', 'Failed to save Vesinvest plan.'));
      } finally {
        setBusy(false);
      }
    },
    [
      draft,
      linkedOrg,
      onGoToForecast,
      onPlansChanged,
      plan?.id,
      planningContext,
      refreshSummaries,
      savedBaselineSource,
      t,
    ],
  );

  const handleCreateReport = React.useCallback(async () => {
    if (!plan?.id || !plan.selectedScenarioId || !linkedScenario) {
      setError(
        t(
          'v2Forecast.computeBeforeReport',
          'Recompute results before creating report.',
        ),
      );
      setInfo(null);
      return;
    }
    if (!canCreateReport) {
      const message =
        reportReadinessReason === 'unsavedChanges'
          ? t(
              'v2Forecast.unsavedHint',
              'You have unsaved changes. Save and compute results before creating report.',
            )
          : reportReadinessReason === 'classificationReviewRequired'
          ? t(
              'v2Forecast.classificationReviewRequired',
              'Review and save the Vesinvest class plan before creating a report.',
            )
          : reportReadinessReason === 'missingDepreciationSnapshots'
          ? t(
              'v2Forecast.depreciationSnapshotsMissingHint',
              'Refresh the synced Vesinvest class plan and recompute results before creating report.',
            )
          : reportReadinessReason === 'staleComputeToken'
          ? t(
              'v2Forecast.staleComputeHint',
              'Saved inputs changed after the last calculation. Recompute results before creating report.',
            )
          : t(
              'v2Forecast.computeBeforeReport',
              'Recompute results before creating report.',
            );
      setError(message);
      setInfo(null);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await createReportV2({
        vesinvestPlanId: plan.id,
        ennusteId: plan.selectedScenarioId,
        title: buildDefaultReportTitle(t, linkedScenario.name),
      });
      setInfo(t('v2Forecast.infoReportCreated', 'Report created.'));
      onGoToReports();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorReportFailed', 'Failed to create report.'),
      );
    } finally {
      setBusy(false);
    }
  }, [
    canCreateReport,
    linkedScenario,
    onGoToReports,
    plan?.id,
    plan?.selectedScenarioId,
    reportReadinessReason,
    t,
  ]);

  const setDraftField = React.useCallback(
    <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) =>
      setDraft((current) => ({ ...current, [field]: value })),
    [],
  );

  const projectComposerGroupKey =
    resolveProjectGroup(groups, projectComposer.groupKey)?.key ?? FALLBACK_GROUP_KEY;

  const openProjectComposer = React.useCallback(() => {
    if (loading || loadingPlan || groups.length === 0) {
      return;
    }
    const defaultGroupKey = resolveProjectGroup(groups, null)?.key ?? FALLBACK_GROUP_KEY;
    setProjectComposer({
      open: true,
      code: '',
      groupKey: defaultGroupKey,
      name: '',
    });
  }, [groups, loading, loadingPlan]);

  const closeProjectComposer = React.useCallback(() => {
    setProjectComposer((current) => ({
      ...current,
      open: false,
      code: '',
      name: '',
    }));
  }, []);

  const handleCreateProjectDraft = React.useCallback(() => {
    const projectCode = projectComposer.code.trim();
    const projectName = projectComposer.name.trim();
    const resolvedGroup = resolveProjectGroup(groups, projectComposerGroupKey);
    if (!projectCode || !projectName || resolvedGroup == null) {
      return;
    }
    setDraft((current) => ({
      ...current,
      projects: [
        ...current.projects,
        createProject(current.horizonYearsRange, groups, current.projects.length, {
          code: projectCode,
          name: projectName,
          groupKey: resolvedGroup.key,
        }),
      ],
    }));
    setProjectComposer({
      open: false,
      code: '',
      groupKey: resolvedGroup.key,
      name: '',
    });
  }, [groups, projectComposer.code, projectComposer.name, projectComposerGroupKey]);

  const actionRow = (
    <div className="v2-actions-row">
      {activeWorkspaceView === 'investment' ? (
        <button
          type="button"
          className="v2-btn"
          onClick={openProjectComposer}
          disabled={busy || loading || loadingPlan || groups.length === 0}
        >
          {t('v2Vesinvest.addProject', 'Add project')}
        </button>
      ) : null}
      <button
        type="button"
        className="v2-btn"
        onClick={() => void persist(plan ? 'save' : 'create')}
        disabled={busy || (!plan && utilityBindingMissing)}
      >
        {plan
          ? t('v2Vesinvest.savePlan', 'Save Vesinvest')
          : t('v2Vesinvest.createPlan', 'Create Vesinvest plan')}
      </button>
      <button
        type="button"
        className="v2-btn"
        onClick={() => void persist('clone')}
        disabled={busy || !plan}
      >
        {t('v2Vesinvest.clonePlan', 'New revision')}
      </button>
      <button
        type="button"
        className="v2-btn"
        onClick={() => void persist('sync')}
        disabled={busy || !plan || !pricingReady}
      >
        {t('v2Vesinvest.openPricing', 'Open fee path')}
      </button>
      <button
        type="button"
        className="v2-btn"
        onClick={() => void handleCreateReport()}
        disabled={busy || !canCreateReport}
      >
        {t('v2Forecast.createReport', 'Create report')}
      </button>
    </div>
  );

  const workspaceTabs = (
    <section className="v2-vesinvest-section">
      <div className="v2-actions-row" role="tablist" aria-label={t('v2Vesinvest.workspaceTabs', 'Vesinvest workspace views')}>
        <button
          type="button"
          className={`v2-btn ${activeWorkspaceView === 'investment' ? 'v2-btn-primary' : ''}`}
          aria-pressed={activeWorkspaceView === 'investment'}
          onClick={() => setActiveWorkspaceView('investment')}
        >
          {t('v2Vesinvest.investmentPlanTab', 'Investment plan')}
        </button>
        <button
          type="button"
          className={`v2-btn ${activeWorkspaceView === 'depreciation' ? 'v2-btn-primary' : ''}`}
          aria-pressed={activeWorkspaceView === 'depreciation'}
          onClick={() => setActiveWorkspaceView('depreciation')}
        >
          {t('v2Vesinvest.depreciationPlanTab', 'Depreciation plan')}
        </button>
      </div>
    </section>
  );

  const utilityBindingSection = (
    <VesinvestIdentitySurface
      t={t}
      badge={
        <span
          className={`v2-badge ${toneClass(
            utilityBindingMissing
              ? 'blocked'
              : utilityBindingMismatch
              ? 'provisional'
              : 'verified',
          )}`}
        >
          {utilityBindingMissing
            ? t('v2Vesinvest.baselineLinkPending', 'Not yet linked')
            : utilityBindingMismatch
            ? t('v2Vesinvest.pricingBlocked', 'Blocked')
            : t('v2Vesinvest.baselineVerified', 'Baseline verified')}
        </span>
      }
    >
      {utilityBindingMissing ? (
        <>
          <div className="v2-inline-form">
            <label className="v2-field v2-field-wide">
              <span>{t('v2Vesinvest.veetiLookupLabel', 'VEETI lookup')}</span>
              <input
                id="vesinvest-veeti-lookup"
                name="vesinvest-veeti-lookup"
                className="v2-input"
                value={veetiSearchQuery}
                placeholder={t(
                  'v2Vesinvest.veetiLookupPlaceholder',
                  'Search by business ID or utility name',
                )}
                onChange={(event) => setVeetiSearchQuery(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="v2-btn"
              onClick={() => void runVeetiLookup()}
              disabled={busy || searchingVeeti}
            >
              {searchingVeeti
                ? t('v2Overview.searchingButton', 'Searching...')
                : t('v2Overview.searchButton', 'Search')}
            </button>
          </div>
          {veetiSearchResults.length > 0 ? (
            <div className="v2-inline-list">
              {veetiSearchResults.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="v2-btn v2-btn-secondary"
                  onClick={() => applyVeetiSearchHit(hit)}
                >
                  {hit.name}
                  {hit.businessId ? ` · ${hit.businessId}` : ''}
                  {hit.municipality ? ` · ${hit.municipality}` : ''}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="v2-overview-year-summary-grid">
          <div>
            <span>{t('v2Vesinvest.utilityName', 'Utility name')}</span>
            <strong>{linkedOrg?.nimi ?? draft.utilityName ?? '-'}</strong>
          </div>
          <div>
            <span>{t('v2Vesinvest.businessId', 'Business ID')}</span>
            <strong>{linkedOrg?.ytunnus ?? draft.businessId ?? '-'}</strong>
          </div>
          <div>
            <span>{t('v2Vesinvest.identityVeeti', 'VEETI')}</span>
            <strong>{linkedOrg?.veetiId ?? draft.veetiId ?? '-'}</strong>
          </div>
          <div>
            <span>{t('v2Vesinvest.identitySource', 'Identity source')}</span>
            <strong>{t('v2Vesinvest.identityVeeti', 'VEETI')}</strong>
          </div>
          </div>
        )}
    </VesinvestIdentitySurface>
  );

  const depreciationPlanSection =
    activeWorkspaceView === 'depreciation' ? (
    <VesinvestDepreciationPlanSurface t={t}>
      <div className="v2-vesinvest-table-wrap">
        <table className="v2-vesinvest-table">
          <thead>
            <tr>
              <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
              <th>{t('v2Vesinvest.projectAccount', 'Account')}</th>
              <th>{t('v2Vesinvest.allocationMetric', 'Split')}</th>
              <th>{t('v2Forecast.depreciationMethod', 'Depreciation method')}</th>
              <th>{t('v2Vesinvest.writeOffTime', 'Write-off time')}</th>
              <th>{t('v2Vesinvest.residualShare', 'Residual share')}</th>
              <th>{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {groupDrafts.map((group) => {
              const ruleDraft =
                depreciationRuleDrafts.find(
                  (rule) => rule.assetClassKey === group.key,
                ) ?? null;
              return (
              <tr key={group.key}>
                <td>
                  <input
                    id={`vesinvest-group-label-${group.key}`}
                    name={`vesinvest-group-label-${group.key}`}
                    className="v2-input"
                    value={group.label}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateGroupDraft(group.key, (current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    id={`vesinvest-group-account-${group.key}`}
                    name={`vesinvest-group-account-${group.key}`}
                    className="v2-input"
                    value={group.defaultAccountKey}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateGroupDraft(group.key, (current) => ({
                        ...current,
                        defaultAccountKey: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <select
                    id={`vesinvest-group-split-${group.key}`}
                    name={`vesinvest-group-split-${group.key}`}
                    className="v2-input"
                    value={group.serviceSplit}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateGroupDraft(group.key, (current) => ({
                        ...current,
                        serviceSplit:
                          event.target.value as V2VesinvestGroupDefinition['serviceSplit'],
                      }))
                    }
                  >
                    <option value="water">
                      {t('v2Forecast.investmentServiceSplitWater', 'Water')}
                    </option>
                    <option value="wastewater">
                      {t(
                        'v2Forecast.investmentServiceSplitWastewater',
                        'Wastewater',
                      )}
                    </option>
                    <option value="mixed">
                      {t('v2Forecast.investmentServiceSplitMixed', 'Mixed')}
                    </option>
                  </select>
                </td>
                <td>
                  <select
                    id={`vesinvest-group-method-${group.key}`}
                    name={`vesinvest-group-method-${group.key}`}
                    className="v2-input"
                    value={ruleDraft?.method ?? 'none'}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateDepreciationRuleDraft(group.key, (current) => ({
                        ...current,
                        method: event.target.value as V2EditableDepreciationRuleMethod,
                      }))
                    }
                  >
                    <option value="none">{t('v2Vesinvest.none', 'None')}</option>
                    <option value="straight-line">
                      {t('v2Forecast.methodStraightLine', 'Straight-line')}
                    </option>
                    <option value="residual">
                      {t('v2Forecast.methodResidual', 'Residual')}
                    </option>
                  </select>
                </td>
                <td>
                  <input
                    id={`vesinvest-group-years-${group.key}`}
                    name={`vesinvest-group-years-${group.key}`}
                    className="v2-input"
                    type="number"
                    min={0}
                    value={ruleDraft?.linearYears ?? ''}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateDepreciationRuleDraft(group.key, (current) => ({
                        ...current,
                        linearYears: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    id={`vesinvest-group-residual-${group.key}`}
                    name={`vesinvest-group-residual-${group.key}`}
                    className="v2-input"
                    type="number"
                    min={0}
                    value={ruleDraft?.residualPercent ?? ''}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateDepreciationRuleDraft(group.key, (current) => ({
                        ...current,
                        residualPercent: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => void handleSaveClassDefinition(group.key)}
                    disabled={!isAdmin || savingClassKey === group.key}
                  >
                    {t('common.save', 'Save')}
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {depreciationRules.length === 0 ? (
        <p className="v2-muted">
          {t('common.loading', 'Loading...')}
        </p>
      ) : null}
    </VesinvestDepreciationPlanSurface>
  ) : null;

  const feePathSection = feeRecommendation ? (
    <section className="v2-vesinvest-section">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">{t('v2Vesinvest.feePathEyebrow', 'Fee path')}</p>
          <h3>{t('v2Vesinvest.feePathTitle', 'Saved fee-path recommendation')}</h3>
        </div>
        <span className={`v2-badge ${toneClass(selectedSummary?.pricingStatus ?? 'blocked')}`}>
          {selectedSummary?.pricingStatus === 'verified'
            ? t('v2Vesinvest.pricingVerified', 'Verified')
            : selectedSummary?.pricingStatus === 'provisional'
            ? t('v2Vesinvest.pricingProvisional', 'Provisional')
            : t('v2Vesinvest.pricingBlocked', 'Blocked')}
        </span>
      </div>
      <div className="v2-overview-year-summary-grid">
        <div>
          <span>{t('projection.v2.kpiCombinedWeighted', 'Combined price')}</span>
          <strong>{formatPrice(feeRecommendation.combined.baselinePriceToday ?? null)}</strong>
        </div>
        <div>
          <span>{t('v2Reports.requiredCombinedPriceToday', 'Required combined price today')}</span>
          <strong>
            {formatPrice(feeRecommendation.combined.annualResult.requiredPriceToday ?? null)}
          </strong>
        </div>
        <div>
          <span>{t('v2Forecast.requiredIncreaseFromToday', 'Required increase from current combined price')}</span>
          <strong>
            {formatPercent(
              feeRecommendation.combined.annualResult.requiredAnnualIncreasePct ?? null,
            )}
          </strong>
        </div>
        <div>
          <span>{t('v2Forecast.requiredPriceCumulativeCash', 'Required price today (cumulative cash >= 0)')}</span>
          <strong>
            {formatPrice(
              feeRecommendation.combined.cumulativeCash.requiredPriceToday ?? null,
            )}
          </strong>
        </div>
        <div>
          <span>{t('v2Forecast.peakGapCompare', 'Peak cumulative gap')}</span>
          <strong>{formatEur(feeRecommendation.combined.cumulativeCash.peakGap ?? 0)}</strong>
        </div>
        <div>
          <span>{t('v2Vesinvest.feePathInvestmentTotal', 'Synced investment total')}</span>
          <strong>{formatEur(feeRecommendation.totalInvestments ?? 0)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.waterPricePerM3', 'Water price')}</span>
          <strong>{formatPrice(feeRecommendation.water.currentPrice ?? null)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.wastewaterPricePerM3', 'Wastewater price')}</span>
          <strong>{formatPrice(feeRecommendation.wastewater.currentPrice ?? null)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.baseFeeRevenue', 'Base-fee revenue')}</span>
          <strong>{formatEur(feeRecommendation.baseFee.currentRevenue ?? 0)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.connectionCount', 'Connections')}</span>
          <strong>{(feeRecommendation.baseFee.connectionCount ?? 0).toLocaleString()}</strong>
        </div>
      </div>
    </section>
  ) : null;

  const planStatusStrip = (
    <div className="v2-kpi-strip v2-kpi-strip-three">
      <article>
        <h3>{t('v2Vesinvest.planState', 'Plan state')}</h3>
        <p>
          <span
            className={`v2-badge ${toneClass(
              draft.projects.length > 0 ? 'incomplete' : 'draft',
            )}`}
          >
            {draft.projects.length > 0
              ? t('v2Vesinvest.planDraftExists', 'Plan draft exists')
              : t('v2Vesinvest.planDraftMissing', 'No plan rows yet')}
          </span>
        </p>
      </article>
      <article>
        <h3>{t('v2Vesinvest.baselineState', 'Baseline & evidence')}</h3>
        <p>
          <span
            className={`v2-badge ${toneClass(
              baselineVerified ? 'verified' : 'incomplete',
            )}`}
          >
            {baselineVerified
              ? t('v2Vesinvest.baselineVerified', 'Baseline verified')
              : t('v2Vesinvest.baselineIncomplete', 'Baseline incomplete')}
          </span>
        </p>
        <small>
          {baselineVerified
            ? t(
                'v2Vesinvest.baselineVerifiedHint',
                'Pricing can now be synced from the plan.',
              )
            : t(
                'v2Vesinvest.baselineIncompleteHint',
                'VEETI, PDF, or manual corrections are still needed before pricing is final.',
              )}
        </small>
      </article>
      <article>
        <h3>{t('v2Vesinvest.pricingState', 'Pricing output')}</h3>
        <p>
          <span
            className={`v2-badge ${toneClass(
              selectedSummary?.pricingStatus ?? 'blocked',
            )}`}
          >
            {selectedSummary?.pricingStatus === 'verified'
              ? t('v2Vesinvest.pricingVerified', 'Verified')
              : selectedSummary?.pricingStatus === 'provisional'
              ? t('v2Vesinvest.pricingProvisional', 'Provisional')
              : t('v2Vesinvest.pricingBlocked', 'Blocked')}
          </span>
        </p>
        <small>
          {pricingReady
            ? t(
                'v2Vesinvest.pricingReadyHint',
                'Sync the plan to open fee-path and financing results.',
              )
            : baselineVerified
            ? t(
                'v2Vesinvest.pricingPlanMissingHint',
                'Add investment rows and yearly allocations before fee-path and financing output can be opened.',
              )
            : t(
                'v2Vesinvest.pricingBlockedHint',
                'Fee-path and financing output stay blocked until the baseline is verified.',
              )}
        </small>
      </article>
    </div>
  );

  const loadingState =
    loading || loadingPlan ? (
      <div className="v2-loading-state">
        <p>{t('common.loading', 'Loading...')}</p>
        <div className="v2-skeleton-line" />
      </div>
    ) : null;

  return (
    <section className="v2-card v2-vesinvest-panel">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">{t('v2Vesinvest.eyebrow', 'Vesinvest')}</p>
          <h2>{t('v2Vesinvest.title', 'Vesinvest VEETI-first workspace')}</h2>
        </div>
        {!useSimplifiedSetup ? (
        <div className="v2-actions-row">
          {plans.length > 0 ? (
            <label className="v2-field">
              <span>{t('v2Vesinvest.planSelector', 'Plan revision')}</span>
              <select
                id="v2-vesinvest-plan-selector"
                name="vesinvestPlanSelector"
                className="v2-input"
                value={selectedPlanId ?? ''}
                onChange={(event) => {
                  const nextPlanId = event.target.value || null;
                  if (
                    nextPlanId !== selectedPlanId &&
                    hasUnsavedChanges &&
                    !window.confirm(
                      t(
                        'v2Vesinvest.unsavedChangesConfirm',
                        'Discard unsaved Vesinvest changes and switch to another revision?',
                      ),
                    )
                  ) {
                    return;
                  }
                  setSelectedPlanId(nextPlanId);
                }}
                disabled={loading || busy}
              >
                {plans.map((item) => (
                  <option key={item.id} value={item.id}>{`${item.utilityName} / v${item.versionNumber}`}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        ) : null}
      </div>

      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      {projectComposer.open ? (
        <div className="v2-modal-backdrop" onClick={closeProjectComposer}>
          <div
            className="v2-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vesinvest-project-composer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="v2-section-header">
              <div>
                <p className="v2-overview-eyebrow">
                  {t('v2Vesinvest.investmentPlan', 'Investment plan')}
                </p>
                <h3 id="vesinvest-project-composer-title">
                  {t('v2Vesinvest.addProject', 'Add project')}
                </h3>
              </div>
            </div>
            <div className="v2-inline-form">
              <label className="v2-field">
                <span>{t('v2Vesinvest.projectCode', 'Code')}</span>
                <input
                  id="vesinvest-project-composer-code"
                  name="vesinvest-project-composer-code"
                  className="v2-input"
                  value={projectComposer.code}
                  onChange={(event) =>
                    setProjectComposer((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="v2-field">
                <span>{t('v2Vesinvest.projectClass', 'Class')}</span>
                <select
                  id="vesinvest-project-composer-group"
                  name="vesinvest-project-composer-group"
                  className="v2-input"
                  value={projectComposerGroupKey}
                  onChange={(event) =>
                    setProjectComposer((current) => ({
                      ...current,
                      groupKey: event.target.value,
                    }))
                  }
                >
                  {groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {resolveVesinvestGroupLabel(t, group.key, group.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="v2-field v2-field-wide">
                <span>{t('v2Vesinvest.projectName', 'Project')}</span>
                <input
                  id="vesinvest-project-composer-name"
                  name="vesinvest-project-composer-name"
                  className="v2-input"
                  value={projectComposer.name}
                  onChange={(event) =>
                    setProjectComposer((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeProjectComposer}
                disabled={busy}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-primary"
                onClick={handleCreateProjectDraft}
                disabled={
                  busy ||
                  loading ||
                  loadingPlan ||
                  groups.length === 0 ||
                  projectComposer.code.trim().length === 0 ||
                  projectComposer.name.trim().length === 0
                }
              >
                {t('v2Vesinvest.addProject', 'Add project')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {utilityBindingSection}

      {loadingState}

      {planStatusStrip}

      {workspaceTabs}

      {depreciationPlanSection}

      {useSimplifiedSetup ? null : (
        <>
          <VesinvestRevisionSurface>
            {actionRow}

            <div className="v2-overview-year-summary-grid">
              <div>
                <span>{t('v2Vesinvest.totalInvestments', 'Horizon total')}</span>
                <strong>{formatEur(totalInvestments)}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.projectCount', 'Projects')}</span>
                <strong>{draft.projects.length}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.reviewDue', 'Next review due')}</span>
                <strong>
                  {formatDateTime(selectedSummary?.reviewDueAt ?? draft.reviewDueAt ?? null)}
                </strong>
              </div>
            </div>

            <div className="v2-inline-form v2-vesinvest-identity-form">
              <label className="v2-field">
                <span>{t('v2Vesinvest.planName', 'Plan name')}</span>
                <input
                  id="vesinvest-plan-name"
                  name="vesinvest-plan-name"
                  className="v2-input"
                  value={draft.name ?? ''}
                  onChange={(event) => setDraftField('name', event.target.value)}
                />
              </label>
              <label className="v2-field">
                <span>{t('v2Vesinvest.horizonYears', 'Horizon years')}</span>
                <input
                  id="vesinvest-horizon-years"
                  name="vesinvest-horizon-years"
                  className="v2-input"
                  type="number"
                  min={20}
                  max={50}
                  value={draft.horizonYears ?? 20}
                  onChange={(event) => {
                    const nextHorizon = Math.min(
                      50,
                      Math.max(20, Number(event.target.value || 20)),
                    );
                    const firstYear =
                      draft.horizonYearsRange[0] ?? new Date().getFullYear();
                    const years = buildHorizonYears(firstYear, nextHorizon);
                    setDraft((current) => ({
                      ...current,
                      horizonYears: nextHorizon,
                      horizonYearsRange: years,
                      projects: current.projects.map((project) => ({
                        ...project,
                        allocations: years.map(
                          (year) =>
                            project.allocations.find((item) => item.year === year) ?? {
                              year,
                              totalAmount: 0,
                              waterAmount: 0,
                              wastewaterAmount: 0,
                            },
                        ),
                      })),
                    }));
                  }}
                />
              </label>
            </div>
          </VesinvestRevisionSurface>

      {false && veetiSearchResults.length > 0 ? (
        <div className="v2-inline-list">
          {veetiSearchResults.map((hit) => (
            <button
              key={hit.id}
              type="button"
              className="v2-btn v2-btn-secondary"
              onClick={() => applyVeetiSearchHit(hit)}
            >
              {hit.name}
              {hit.businessId ? ` · ${hit.businessId}` : ''}
              {hit.municipality ? ` · ${hit.municipality}` : ''}
            </button>
          ))}
        </div>
      ) : null}

      {false ? (
      <section className="v2-vesinvest-section">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Vesinvest.identityLock', 'Identity guardrail')}
            </p>
            <h3>{t('v2Vesinvest.utilityName', 'Utility name')}</h3>
          </div>
          <span
            className={`v2-badge ${toneClass(
              utilityBindingMissing
                ? 'blocked'
                : utilityBindingMismatch
                ? 'provisional'
                : 'verified',
            )}`}
          >
            {utilityBindingMissing
              ? t('v2Vesinvest.baselineLinkPending', 'Not yet linked')
              : utilityBindingMismatch
              ? t('v2Vesinvest.pricingBlocked', 'Blocked')
              : t('v2Vesinvest.baselineVerified', 'Baseline verified')}
          </span>
        </div>
        {utilityBindingMissing ? (
          <>
            <div className="v2-inline-form">
              <label className="v2-field v2-field-wide">
                <span>{t('v2Vesinvest.veetiLookupLabel', 'VEETI lookup')}</span>
                <input
                  id="vesinvest-veeti-lookup"
                  name="vesinvest-veeti-lookup"
                  className="v2-input"
                  value={veetiSearchQuery}
                  placeholder={t(
                    'v2Vesinvest.veetiLookupPlaceholder',
                    'Search by business ID or utility name',
                  )}
                  onChange={(event) => setVeetiSearchQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="v2-btn"
                onClick={() => void runVeetiLookup()}
                disabled={busy || searchingVeeti}
              >
                {searchingVeeti
                  ? t('v2Overview.searchingButton', 'Searching...')
                  : t('v2Overview.searchButton', 'Search')}
              </button>
            </div>
            {veetiSearchResults.length > 0 ? (
              <div className="v2-inline-list">
                {veetiSearchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="v2-btn v2-btn-secondary"
                    onClick={() => applyVeetiSearchHit(hit)}
                  >
                    {hit.name}
                    {hit.businessId ? ` · ${hit.businessId}` : ''}
                    {hit.municipality ? ` · ${hit.municipality}` : ''}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="v2-overview-year-summary-grid">
            <div>
              <span>{t('v2Vesinvest.utilityName', 'Utility name')}</span>
              <strong>{linkedOrg?.nimi ?? draft.utilityName ?? '-'}</strong>
            </div>
            <div>
              <span>{t('v2Vesinvest.businessId', 'Business ID')}</span>
              <strong>{linkedOrg?.ytunnus ?? draft.businessId ?? '-'}</strong>
            </div>
            <div>
              <span>{t('v2Vesinvest.identitySource', 'Identity source')}</span>
              <strong>{t('v2Vesinvest.identityVeeti', 'VEETI')}</strong>
            </div>
          </div>
        )}
      </section>
      ) : null}

      <div className="v2-kpi-strip v2-kpi-strip-three">
        <article>
          <h3>{t('v2Vesinvest.reviewStatus', 'Revision status')}</h3>
          <p>
            <span className={`v2-badge ${toneClass(selectedSummary?.status === 'active' ? 'verified' : 'draft')}`}>
              {selectedSummary?.status === 'active'
                ? t('v2Vesinvest.planActive', 'Active revision')
                : t('v2Vesinvest.planDraftLabel', 'Draft revision')}
            </span>
          </p>
          <small>{revisionStatusMessage}</small>
        </article>
        <article>
          <h3>{t('v2Vesinvest.identityLock', 'Identity guardrail')}</h3>
          <p>{t('v2Vesinvest.identityGuardrailHint', 'Utility name, business ID, and identity source stay visible before pricing is opened.')}</p>
          <small>{selectedSummary?.updatedAt ? t('v2Vesinvest.lastSaved', 'Last saved {{time}}', { time: formatDateTime(selectedSummary.updatedAt) }) : t('v2Vesinvest.notSavedYet', 'Not saved yet')}</small>
        </article>
        <article>
          <h3>{t('v2Vesinvest.baselineLink', 'Accepted baseline link')}</h3>
          <p>
            {savedBaselineSource?.acceptedYears?.length
              ? savedBaselineSource.acceptedYears.join(', ')
              : t('v2Vesinvest.baselineLinkPending', 'Not yet linked')}
          </p>
          <small>
            {savedBaselineSource?.latestAcceptedBudgetId
              ? t('v2Vesinvest.baselineBudgetLinked', 'Linked accepted budget {{id}}', {
                  id: savedBaselineSource.latestAcceptedBudgetId,
                })
              : t('v2Vesinvest.baselineBudgetPending', 'Fee-path link is created when pricing is opened from a verified baseline.')}
          </small>
        </article>
      </div>

      {loading || loadingPlan ? (
        <div className="v2-loading-state">
          <p>{t('common.loading', 'Loading...')}</p>
          <div className="v2-skeleton-line" />
        </div>
      ) : null}

      <VesinvestBaselineReviewSurface
        t={t}
        badge={
          <span className={`v2-badge ${toneClass(baselineVerified ? 'verified' : 'incomplete')}`}>
            {baselineYears.length > 0
              ? t('v2Vesinvest.baselineYearCount', '{{count}} year(s)', {
                  count: baselineYears.length,
                })
              : t('v2Vesinvest.baselineLinkPending', 'Not yet linked')}
          </span>
        }
        feePath={feePathSection}
      >
        {baselineYears.length === 0 ? (
          <p className="v2-muted">
            {t(
              'v2Vesinvest.evidenceEmpty',
              'No accepted baseline years yet. Finish VEETI, PDF, or manual verification before pricing is treated as final.',
            )}
          </p>
        ) : (
          <div className="v2-vesinvest-evidence-grid">
            {baselineYears.map((yearRow) => (
              <article key={yearRow.year} className="v2-vesinvest-evidence-card">
                <div className="v2-section-header">
                  <div>
                    <h4>{yearRow.year}</h4>
                    <p className="v2-muted">
                      {sourceStatusLabel(t, yearRow.sourceStatus, yearRow.planningRole)}
                    </p>
                  </div>
                  <span className={`v2-badge ${toneClass(yearRow.sourceStatus === 'INCOMPLETE' ? 'incomplete' : yearRow.sourceStatus === 'MIXED' ? 'provisional' : 'verified')}`}>
                    {qualityLabel(t, yearRow.quality)}
                  </span>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.baselineFinancials', 'Financials')}</span>
                  <strong>{datasetSourceLabel(t, yearRow.financials)}</strong>
                </div>
                <small>{datasetSourceNote(t, yearRow.financials)}</small>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                  <strong>{datasetSourceLabel(t, yearRow.prices)}</strong>
                </div>
                <small>{datasetSourceNote(t, yearRow.prices)}</small>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.baselineVolumes', 'Sold volumes')}</span>
                  <strong>{datasetSourceLabel(t, yearRow.volumes)}</strong>
                </div>
                <small>{datasetSourceNote(t, yearRow.volumes)}</small>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Vesinvest.baselineYearVolume', 'Combined sold volume')}</span>
                  <strong>{yearRow.combinedSoldVolume.toLocaleString()} m3</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </VesinvestBaselineReviewSurface>

      {activeWorkspaceView === 'investment' ? (
      <>
      <VesinvestMatrixSurface t={t}>
        <div className="v2-vesinvest-table-wrap v2-vesinvest-matrix-wrap" data-testid="vesinvest-grouped-plan">
          <table className="v2-vesinvest-table v2-vesinvest-plan-matrix">
            <thead>
              <tr>
                <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                {draft.horizonYearsRange.map((year) => (
                  <th key={`matrix-head-${year}`}>{year}</th>
                ))}
                <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {groupedPlanMatrix.length === 0 ? (
                <tr>
                  <td
                    colSpan={draft.horizonYearsRange.length + 3}
                    className="v2-muted"
                  >
                    {t(
                      'v2Vesinvest.projectEmpty',
                      'No projects yet. Add the investment plan first, then connect baseline evidence later.',
                    )}
                  </td>
                </tr>
              ) : null}
              {groupedPlanMatrix.map((section) => (
                <React.Fragment key={section.groupKey}>
                  <tr className="v2-vesinvest-matrix-group-row">
                    <td />
                    <td className="v2-vesinvest-matrix-label">{section.groupLabel}</td>
                    {section.yearlyTotals.map((item) => (
                      <td key={`${section.groupKey}-${item.year}`}>
                        {formatPlanMatrixAmount(item.totalAmount)}
                      </td>
                    ))}
                    <td>{formatPlanMatrixAmount(section.totalAmount)}</td>
                  </tr>
                  {section.projects.map((project) => (
                    <tr
                      key={`${section.groupKey}-${project.code}`}
                      className="v2-vesinvest-matrix-project-row"
                    >
                      <td>{project.code}</td>
                      <td>{project.name || t('v2Vesinvest.projectUnnamed', 'Unnamed project')}</td>
                      {project.yearlyTotals.map((item) => (
                        <td key={`${project.code}-${item.year}`}>
                          {formatPlanMatrixAmount(item.totalAmount)}
                        </td>
                      ))}
                      <td>{formatPlanMatrixAmount(project.totalAmount)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {groupedPlanMatrix.length > 0 ? (
                <tr className="v2-vesinvest-matrix-total-row">
                  <td />
                  <td className="v2-vesinvest-matrix-label">
                    {t('v2Vesinvest.totalInvestments', 'Horizon total')}
                  </td>
                  {yearTotals.map((item) => (
                    <td key={`matrix-total-${item.year}`}>
                      {formatPlanMatrixAmount(item.totalAmount)}
                    </td>
                  ))}
                  <td>{formatPlanMatrixAmount(totalInvestments)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </VesinvestMatrixSurface>

      <VesinvestRegisterSurface t={t}>
        <div className="v2-vesinvest-table-wrap">
          <table className="v2-vesinvest-table">
            <thead>
              <tr>
                <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                <th>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</th>
                <th>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</th>
                <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                <th>{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="v2-muted">
                    {t(
                      'v2Vesinvest.projectEmpty',
                      'No projects yet. Add the investment plan first, then connect baseline evidence later.',
                    )}
                  </td>
                </tr>
              ) : null}
              {draft.projects.map((project, index) => (
                <tr key={project.id ?? `draft-project-row-${index}`}>
                  <td>
                    <input
                      id={`vesinvest-project-code-${index}`}
                      name={`vesinvest-project-code-${index}`}
                      className="v2-input"
                      value={project.code}
                      onChange={(event) =>
                        updateProject(index, (current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      id={`vesinvest-project-name-${index}`}
                      name={`vesinvest-project-name-${index}`}
                      className="v2-input"
                      value={project.name}
                      onChange={(event) =>
                        updateProject(index, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      id={`vesinvest-project-group-${index}`}
                      name={`vesinvest-project-group-${index}`}
                      className="v2-input"
                      value={project.groupKey}
                      onChange={(event) => {
                        const group = groups.find((item) => item.key === event.target.value);
                        updateProject(index, (current) => ({
                          ...current,
                          groupKey: event.target.value,
                          groupLabel: group?.label,
                          investmentType: resolveInvestmentTypeFromGroupKey(
                            event.target.value,
                          ),
                          depreciationClassKey:
                            group?.defaultDepreciationClassKey ?? group?.key ?? null,
                          defaultAccountKey: group?.defaultAccountKey ?? null,
                          reportGroupKey: group?.reportGroupKey ?? null,
                        }));
                      }}
                    >
                      {groups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {resolveVesinvestGroupLabel(t, group.key, group.label)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatEur(project.waterAmount ?? 0)}</td>
                  <td>{formatEur(project.wastewaterAmount ?? 0)}</td>
                  <td>{formatEur(project.totalAmount ?? 0)}</td>
                  <td><button type="button" className="v2-btn v2-btn-small v2-btn-danger" onClick={() => setDraft((current) => ({ ...current, projects: current.projects.filter((_, projectIndex) => projectIndex !== index) }))}>{t('common.delete', 'Delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VesinvestRegisterSurface>

      {draft.projects.length > 0 ? (
        <VesinvestProjectDetailsSurface>
          {draft.projects.map((project, projectIndex) => (
            <section
              key={project.id ?? `draft-project-details-${projectIndex}`}
              className="v2-vesinvest-project-card"
            >
              <div className="v2-section-header">
                <div>
                  <p className="v2-overview-eyebrow">{project.code}</p>
                  <h3>{project.name || t('v2Vesinvest.projectUnnamed', 'Unnamed project')}</h3>
                  <p className="v2-muted">
                    {`${typeLabel(t, project.investmentType)} · ${resolveVesinvestGroupLabel(
                      t,
                      project.groupKey,
                      project.groupLabel,
                    )}`}
                  </p>
                </div>
                <div className="v2-overview-year-summary-grid v2-vesinvest-project-meta">
                  <div>
                    <span>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</span>
                    <strong>{formatEur(project.waterAmount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</span>
                    <strong>{formatEur(project.wastewaterAmount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Vesinvest.projectTotal', 'Total')}</span>
                    <strong>{formatEur(project.totalAmount ?? 0)}</strong>
                  </div>
                </div>
              </div>
              <div className="v2-inline-form">
                <label className="v2-field">
                  <span>{t('v2Vesinvest.projectSubtype', 'Subtype')}</span>
                  <input
                    id={`vesinvest-project-subtype-${projectIndex}`}
                    name={`vesinvest-project-subtype-${projectIndex}`}
                    className="v2-input"
                    value={project.subtype ?? ''}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        subtype: event.target.value || null,
                      }))
                    }
                  />
                </label>
                <label className="v2-field v2-field-wide">
                  <span>{t('v2Vesinvest.projectNotes', 'Notes')}</span>
                  <input
                    id={`vesinvest-project-notes-${projectIndex}`}
                    name={`vesinvest-project-notes-${projectIndex}`}
                    className="v2-input"
                    value={project.notes ?? ''}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        notes: event.target.value || null,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="v2-vesinvest-table-wrap">
                <table className="v2-vesinvest-table v2-vesinvest-allocation-table">
                  <thead>
                    <tr>
                      <th>{t('v2Vesinvest.allocationMetric', 'Split')}</th>
                      {draft.horizonYearsRange.map((year) => <th key={year}>{year}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(['totalAmount', 'waterAmount', 'wastewaterAmount'] as const).map((fieldKey) => (
                      <tr key={`${project.code}-${fieldKey}`}>
                        <td>
                          {allocationFieldLabel(t, fieldKey)}
                        </td>
                        {draft.horizonYearsRange.map((year) => {
                          const allocation =
                            project.allocations.find((item) => item.year === year) ?? null;
                          return (
                            <td key={`${project.code}-${fieldKey}-${year}`}>
                              <input
                                id={`vesinvest-allocation-${projectIndex}-${fieldKey}-${year}`}
                                name={`vesinvest-allocation-${projectIndex}-${fieldKey}-${year}`}
                                aria-label={`${project.code} ${year} ${allocationFieldLabel(
                                  t,
                                  fieldKey,
                                )}`}
                                className="v2-input"
                                type="number"
                                min={0}
                                value={allocation?.[fieldKey] ?? 0}
                                onChange={(event) =>
                                  updateProjectAllocation(
                                    projectIndex,
                                    year,
                                    fieldKey,
                                    Number(event.target.value || 0),
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </VesinvestProjectDetailsSurface>
      ) : null}
      </>
      ) : null}

      <div className="v2-kpi-strip v2-kpi-strip-three">
        <article><h3>{t('v2Vesinvest.yearlySummary', 'Annual derived totals')}</h3><p>{yearTotals.filter((item) => item.totalAmount > 0).slice(0, 3).map((item) => `${item.year}: ${formatEur(item.totalAmount)}`).join(' | ') || t('v2Vesinvest.none', 'None')}</p></article>
        <article><h3>{t('v2Vesinvest.fiveYearBands', 'Five-year bands')}</h3><p>{fiveYearBands.slice(0, 3).map((band) => `${band.startYear}-${band.endYear}: ${formatEur(band.totalAmount)}`).join(' | ') || t('v2Vesinvest.none', 'None')}</p></article>
        <article><h3>{t('v2Vesinvest.allocationSummary', 'Service split')}</h3><p>{draft.projects.slice(0, 3).map((project) => `${project.code}: ${formatEur(project.waterAmount ?? 0)} / ${formatEur(project.wastewaterAmount ?? 0)}`).join(' | ') || t('v2Vesinvest.none', 'None')}</p><small>{t('v2Vesinvest.allocationSummaryHint', 'Water and wastewater totals are derived from the yearly allocation split above.')}</small></article>
      </div>
        </>
      )}
    </section>
  );
};
