import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class AssetsQueryDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  assetTypeId?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  q?: string;
}