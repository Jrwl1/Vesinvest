// API Response Types

export interface Site {
  id: string;
  orgId: string;
  name: string;
  address: string | null;
  createdAt: string;
}

export interface AssetType {
  id: string;
  orgId: string;
  code: string;
  name: string;
  defaultLifeYears: number | null;
  createdAt: string;
}

export type AssetStatus = 'active' | 'inactive' | 'retired';
export type Criticality = 'low' | 'medium' | 'high';

/**
 * Asset type per Asset Identity Contract.
 * See: docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md
 */
export interface Asset {
  id: string;
  orgId: string;
  siteId: string;
  assetTypeId: string;
  /**
   * Business identity for the asset. Required per Asset Identity Contract.
   * This value is immutable after creation.
   */
  externalRef: string;
  /**
   * True if externalRef was auto-generated as a fallback identity.
   * Derived identities should be replaced with real utility-internal IDs.
   */
  derivedIdentity: boolean;
  name: string;
  installedOn: string | null;
  ageYears: number | null;
  lifeYears: number | null;
  replacementCostEur: string | null; // Decimal comes as string
  criticality: Criticality | null;
  status: AssetStatus;
  ownerRole: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Included relations
  site?: Site;
  assetType?: AssetType;
  // Computed fields from API
  effectiveLifeYears?: number | null;
  expectedReplacementYear?: number | null;
}

export interface AssetsQuery {
  siteId?: string;
  status?: AssetStatus | 'all';
  q?: string;
  needsDetails?: boolean;
}

// Maintenance Items
export type MaintenanceKind = 'MAINTENANCE' | 'REPLACEMENT';

export interface MaintenanceItem {
  id: string;
  assetId: string;
  orgId: string;
  kind: MaintenanceKind;
  intervalYears: number;
  costEur: string; // Decimal comes as string
  startsAtYear: number | null;
  endsAtYear: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceItemPayload {
  assetId: string;
  kind: MaintenanceKind;
  intervalYears: number;
  costEur: number;
  startsAtYear?: number;
  endsAtYear?: number;
  notes?: string;
}

// Excel Import Types
export type ImportStatus = 'pending' | 'mapped' | 'imported' | 'failed';
export type InferredColumnType = 'string' | 'number' | 'date' | 'boolean' | 'mixed' | 'empty';

export interface ColumnProfile {
  headerRaw: string;
  headerNormalized: string;
  columnIndex: number;
  inferredType: InferredColumnType;
  emptyRate: number;
  exampleValues: string[];
  detectedUnits: string[];
  nonEmptyCount: number;
  totalCount: number;
}

export interface ExcelSheet {
  id: string;
  importId: string;
  sheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows?: Record<string, unknown>[];
  columnsProfile?: ColumnProfile[];
  /** Facit-first: actual data rows after skipping header/descriptor rows */
  dataRowCount?: number;
  /** ASSET_CANDIDATE | REFERENCE | EMPTY | UNKNOWN */
  kind?: SheetKind;
  kindReason?: string;
}

export interface ExcelImport {
  id: string;
  orgId: string;
  filename: string;
  status: ImportStatus;
  uploadedAt: string;
  sheets: ExcelSheet[];
}

export interface UploadResponse {
  message: string;
  import: ExcelImport;
}

// Import Inbox (Inbox → Sort → Commit flow)
export type InboxSignalStatus = 'good' | 'warn' | 'missing';

export interface InboxSignal {
  label: string;
  status: InboxSignalStatus;
}

export interface InboxDetectedColumnSummary {
  field: string;
  sourceColumn: string;
}

/** Sheet classification (Facit-first): reference sheets are ignored by default */
export type SheetKind = 'ASSET_CANDIDATE' | 'REFERENCE' | 'EMPTY' | 'UNKNOWN';

export interface ImportInboxGroup {
  sheetId: string;
  sheetName: string;
  dataRowCount: number;
  recommendedMethod: 'quick' | 'mapping';
  signals: InboxSignal[];
  detectedColumnsSummary?: InboxDetectedColumnSummary[];
  kind?: SheetKind;
  kindReason?: string;
  /** When set, quick import is disabled with this friendly reason (e.g. reference sheet) */
  quickImportDisabledReason?: string;
}

export interface ImportInbox {
  importId: string;
  filename: string;
  uploadedAt: string;
  groups: ImportInboxGroup[];
}

// Planning Scenario Types
export interface PlanningScenario {
  id: string;
  orgId: string;
  name: string;
  planningHorizonYears: number;
  inflationRate: string; // Decimal as string
  discountRate: string; // Decimal as string
  currentTariffEur: string | null;
  revenueBaselineEur: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Import Mapping Types
export type TargetEntity = 'asset' | 'assetType' | 'site' | 'maintenanceItem';
export type FieldCriticality = 'law_critical' | 'model_critical' | 'optional';
export type CanonicalFieldType = 'string' | 'number' | 'date' | 'decimal' | 'enum' | 'boolean';
/**
 * Match key strategy per Asset Identity Contract.
 * - 'externalRef' is the ONLY production strategy
 * - 'fallback_acknowledged' allows generating derived identities when explicitly requested
 */
export type MatchKeyStrategy = 'externalRef' | 'fallback_acknowledged';

export interface CanonicalField {
  entity: TargetEntity;
  field: string;
  label: string;
  type: CanonicalFieldType;
  criticality: FieldCriticality;
  required: boolean;
  enumValues?: string[];
  examples: string[];
  description?: string;
}

export interface MappingColumn {
  id: string;
  mappingId: string;
  sourceColumn: string;
  targetField: string;
  transformation?: Record<string, unknown>;
  required: boolean;
  criticality: FieldCriticality;
}

export interface ImportMapping {
  id: string;
  orgId: string;
  name: string;
  targetEntity: TargetEntity;
  version: number;
  isTemplate: boolean;
  columns: MappingColumn[];
  createdAt: string;
  updatedAt: string;
}

// Import Execution Types
export interface ImportExecutionResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  unchanged: number;
  /** Count of assets created with fallback (derived) identity */
  derivedIdentityCount: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  matchKeyUsed: MatchKeyStrategy;
  sampleErrors: Array<{ row: number; message: string }>;
}

// Template Matching Types
export interface TemplateMatchResult {
  templateId: string;
  templateName: string;
  confidence: number;
  matchedColumns: number;
  totalTemplateColumns: number;
  totalSheetColumns: number;
  matchDetails: Array<{
    sourceColumn: string;
    matchedHeader: string | null;
    confidence: number;
  }>;
}

export interface TemplateMatchResponse {
  matches: TemplateMatchResult[];
  bestMatch: TemplateMatchResult | null;
  autoApplyRecommended: boolean;
}

// Readiness Gate Types
export interface ImportAssumption {
  field: string;
  value: string;
  reason?: string;
}

export interface FieldCoverage {
  field: string;
  label: string;
  type: string;
  criticality: FieldCriticality;
  isMapped: boolean;
  mappedFrom?: string;
  hasAssumption: boolean;
  assumptionValue?: string;
  /** If true, this field can use a global assumption instead of being mapped from Excel */
  assumptionBased?: boolean;
  /** Default assumption value suggested by the system */
  defaultAssumption?: string;
  /** Categorization for UI display */
  requirementCategory: 'required_from_excel' | 'required_as_assumption' | 'optional';
}

export interface ReadinessCheckResult {
  ready: boolean;
  canProceed: boolean;
  fieldCoverage: FieldCoverage[];
  lawCriticalMissing: string[];
  modelCriticalMissing: string[];
  optionalMissing: string[];
  summary: {
    totalFields: number;
    mappedFields: number;
    fieldsWithAssumptions: number;
    lawCriticalCount: number;
    lawCriticalMapped: number;
    modelCriticalCount: number;
    modelCriticalMapped: number;
  };
  warnings: string[];
  errors: string[];
}

// ============================================
// Auto-Extract Types
// ============================================

export interface SheetDefaults {
  /** Default lifeYears if not in Excel */
  lifeYears?: number;
  /** Default replacement cost if not in Excel */
  replacementCostEur?: number;
  /** Default criticality if not in Excel */
  criticality?: Criticality;
  /** AssetType to use for all rows (by code or name) */
  assetType: string;
  /** Site to use for all rows (by name, optional if only one site exists) */
  site?: string;
}

export interface AssumedFieldStat {
  field: string;
  source: 'sheet-default' | 'assetType-default';
  value: string | number;
  rowCount: number;
}

export interface DataRowDetectionResult {
  /** Index of the first real data row (0-based from sampleRows) */
  dataStartIndex: number;
  /** Number of header/descriptor rows skipped */
  skippedRows: number;
  /** Reason for the detection */
  reason: string;
}

export interface AutoExtractAnalysis {
  detectedColumns: Record<string, string | undefined>;
  suggestedAssetType: string | null;
  rowCount: number;
  /** Actual data row count after skipping headers */
  dataRowCount: number;
  canAutoExtract: boolean;
  issues: string[];
  /** Sites detected in the import data (if a site column was found) */
  detectedSites: string[];
  /** Sites that exist in the organization */
  existingSites: Array<{ id: string; name: string }>;
  /** Sites detected in import that don't exist in organization */
  unknownSites: string[];
  /** True if there are no sites in the organization */
  noSitesExist: boolean;
  /** True if user needs to manually select a site (no valid sites detected from file) */
  needsSiteSelection: boolean;
  /** Info about skipped header/descriptor rows */
  dataRowDetection: DataRowDetectionResult;
  /** Whether site override is supported */
  supportsSiteOverride: boolean;
}

export interface AutoExtractResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  unchanged: number;
  derivedIdentityCount: number;
  assumedFields: AssumedFieldStat[];
  detectedColumns: {
    externalRef?: string;
    name?: string;
    installedOn?: string;
    ageYears?: string;
    lifeYears?: string;
    replacementCostEur?: string;
    criticality?: string;
  };
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  sampleErrors: Array<{ row: number; message: string }>;
  infoMessages?: string[];
  missingLifeYearsCount?: number;
  missingReplacementCostCount?: number;
  derivedInstalledOnCount?: number;
  excludedFromProjectionCount?: number;
}

/** Per-sheet plan for Workbook Import Plan (multi-sheet quick import). */
export type LocationModePlan = 'fromFile' | 'oneLocation';

export interface SheetPlan {
  included: boolean;
  locationMode: LocationModePlan;
  siteOverrideId?: string;
  /** Asset type code (required for import). */
  assetTypeCode: string;
  lifeYears: number;
  replacementCostEur?: number;
  criticality: Criticality;
  allowFallbackIdentity: boolean;
  hasPreview: boolean;
  previewResult?: AutoExtractResult;
  /** True when location is resolved (oneLocation + siteOverrideId, or fromFile with 0 unknown). */
  locationResolved: boolean;
}

export type SheetPlanStatus = 'ready' | 'needs-location' | 'needs-asset-type' | 'not-supported';

// ============================================
// Post-Import Sanity Summary Types
// ============================================

export interface AssetCountByType {
  assetTypeId: string;
  assetTypeName: string;
  assetTypeCode: string;
  count: number;
}

export interface AssetCountBySite {
  siteId: string;
  siteName: string;
  count: number;
}

export interface AssetCountByDecade {
  decade: string;
  count: number;
}

export interface CostDistribution {
  min: number | null;
  max: number | null;
  median: number | null;
  average: number | null;
  p90: number | null;
  p95: number | null;
  totalAssets: number;
  assetsWithCost: number;
}

export interface AgeLifetimeData {
  overdueCount: number;
  upcomingCount: number;
  okCount: number;
  unknownCount: number;
  averageAge: number | null;
  averageLifeYears: number | null;
  ageDistribution: Array<{
    bucket: string;
    count: number;
  }>;
}

export interface SanitySummary {
  importId: string;
  importFilename: string;
  importedAt: string;
  totalAssetsImported: number;
  byAssetType: AssetCountByType[];
  bySite: AssetCountBySite[];
  byDecade: AssetCountByDecade[];
  costDistribution: CostDistribution;
  ageLifetime: AgeLifetimeData;
  dataQualityNotes: string[];
}

// ============================================
// Demo Mode Types
// ============================================

export interface DemoStatus {
  enabled: boolean;
  orgId: string | null;
  message: string;
}

export interface DemoResetResult {
  success: boolean;
  deleted: {
    maintenanceItems: number;
    assets: number;
    sites: number;
    importedRecords: number;
    excelSheets: number;
    excelImports: number;
    mappingColumns: number;
    importMappings: number;
    planningScenarios: number;
  };
  recreated: {
    assetTypes: number;
  };
}
