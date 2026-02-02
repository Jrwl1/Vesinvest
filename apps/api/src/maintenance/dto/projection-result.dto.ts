/**
 * DTO for projection line items (detailed breakdown per year)
 */
export class ProjectionItemDto {
  assetId!: string;
  assetName!: string;
  maintenanceItemId!: string | null;
  kind!: 'MAINTENANCE' | 'REPLACEMENT';
  cost!: number;
  source!: string;
}

/**
 * DTO for a single year's projection row
 */
export class ProjectionRowDto {
  year!: number;
  opex!: number;
  capex!: number;
  total!: number;
  items?: ProjectionItemDto[];
}

/**
 * DTO for the full projection result
 */
export class ProjectionResultDto {
  fromYear!: number;
  toYear!: number;
  siteId!: string | null;
  rows!: ProjectionRowDto[];
}
