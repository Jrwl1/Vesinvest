import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

const CRITICALITIES = ['low', 'medium', 'high'] as const;
const ASSET_STATUSES = ['active', 'inactive', 'retired'] as const;

export class CreateAssetDto {
  @IsUUID()
  siteId!: string;

  @IsUUID()
  assetTypeId!: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

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
