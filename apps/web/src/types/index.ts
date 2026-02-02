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
