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

export interface Asset {
  id: string;
  orgId: string;
  siteId: string;
  assetTypeId: string;
  externalRef: string | null;
  name: string;
  installedOn: string | null;
  lifeYears: number | null;
  replacementCostEur: string | null; // Decimal comes as string
  criticality: Criticality;
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
export type MatchKeyStrategy = 'externalRef' | 'name_siteId' | 'auto';

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
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  matchKeyUsed: MatchKeyStrategy;
  sampleErrors: Array<{ row: number; message: string }>;
}
