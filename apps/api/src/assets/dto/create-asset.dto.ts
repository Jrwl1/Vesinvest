import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

const CRITICALITIES = ['low', 'medium', 'high'] as const;
const ASSET_STATUSES = ['active', 'inactive', 'retired'] as const;

/**
 * DTO for creating an asset.
 * Per Asset Identity Contract (docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md):
 * - externalRef is REQUIRED and becomes the immutable business identity
 * - derivedIdentity indicates if externalRef was auto-generated (fallback)
 */
export class CreateAssetDto {
  @IsUUID()
  siteId!: string;

  @IsUUID()
  assetTypeId!: string;

  /**
   * Business identity for the asset. REQUIRED per Asset Identity Contract.
   * This value is IMMUTABLE after creation.
   */
  @IsString()
  externalRef!: string;

  /**
   * True if externalRef was auto-generated as a fallback identity.
   * Derived identities can be replaced later with real utility-internal IDs.
   */
  @IsOptional()
  @IsBoolean()
  derivedIdentity?: boolean;

  @IsString()
  name!: string;

  @IsOptional()
  @IsDateString()
  installedOn?: string;

  @IsOptional()
  @IsInt()
  lifeYears?: number;

  @IsOptional()
  @IsNumber()
  replacementCostEur?: number;

  @IsIn(CRITICALITIES)
  criticality!: (typeof CRITICALITIES)[number];

  @IsIn(ASSET_STATUSES)
  status!: (typeof ASSET_STATUSES)[number];

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
