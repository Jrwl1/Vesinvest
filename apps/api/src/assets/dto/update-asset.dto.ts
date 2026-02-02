import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

const CRITICALITIES = ['low', 'medium', 'high'] as const;
const ASSET_STATUSES = ['active', 'inactive', 'retired'] as const;

export class UpdateAssetDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

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
