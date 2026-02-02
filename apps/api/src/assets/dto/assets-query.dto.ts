import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const ASSET_STATUSES = ['active', 'inactive', 'retired'] as const;

export class AssetsQueryDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string;

  @IsOptional()
  @IsIn(ASSET_STATUSES)
  status?: (typeof ASSET_STATUSES)[number];

  @IsOptional()
  @IsString()
  q?: string;
}
