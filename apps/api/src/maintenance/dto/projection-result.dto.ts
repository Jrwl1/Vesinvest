/**
 * DTO for projection line items (detailed breakdown per year)
 */
export class ProjectionItemDto {
  assetId!: string;
  assetName!: string;
  maintenanceItemId!: string | null;
  kind!: 'MAINTENANCE' | 'REPLACEMENT';
  cost!: number;
  /** Cost adjusted for inflation (if applyInflation=true) */
  inflatedCost?: number;
  source!: string;
}

/**
 * DTO for a single year's projection row
 */
export class ProjectionRowDto {
  year!: number;
  /** Nominal OPEX (today's prices) */
  opex!: number;
  /** Nominal CAPEX (today's prices) */
  capex!: number;
  /** Nominal total (today's prices) */
  total!: number;
  /** OPEX adjusted for inflation (if applyInflation=true) */
  inflatedOpex?: number;
  /** CAPEX adjusted for inflation (if applyInflation=true) */
  inflatedCapex?: number;
  /** Total adjusted for inflation (if applyInflation=true) */
  inflatedTotal?: number;
  /** Present value of total (if applyDiscount=true) */
  presentValue?: number;
  items?: ProjectionItemDto[];
}

/**
 * DTO for scenario info in projection result
 */
export class ProjectionScenarioDto {
  id!: string;
  name!: string;
  inflationRate!: number;
  discountRate!: number;
  planningHorizonYears!: number;
}

/**
 * DTO for the full projection result
 */
export class ProjectionResultDto {
  fromYear!: number;
  toYear!: number;
  siteId!: string | null;
  scenario?: ProjectionScenarioDto | null;
  /** Sum of all nominal totals */
  totalNominal!: number;
  /** Sum of all inflated totals (if applyInflation=true) */
  totalInflated?: number;
  /** Net present value of all costs (if applyDiscount=true) */
  npv?: number;
  rows!: ProjectionRowDto[];
}
