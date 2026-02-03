import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

const CRITICALITIES = ['low', 'medium', 'high'] as const;
const ASSET_STATUSES = ['active', 'inactive', 'retired'] as const;

/**
 * DTO for updating an asset.
 * Per Asset Identity Contract (docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md):
 * - externalRef is IMMUTABLE and cannot be changed after creation
 * - derivedIdentity cannot be changed via update
 */
export class UpdateAssetDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string;

  // NOTE: externalRef is intentionally NOT included here
  // Per Asset Identity Contract, externalRef is IMMUTABLE after creation
  // See: docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  installedOn?: string;

  @IsOptional()
  @IsInt()
  lifeYears?: number;

  @IsOptional()
  @IsNumber()
  replacementCostEur?: number;

  @IsOptional()
  @IsIn(CRITICALITIES)
  criticality?: (typeof CRITICALITIES)[number];

  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: (typeof ASSET_STATUSES)[number];

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
