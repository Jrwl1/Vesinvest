import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetStatus, Criticality } from '@prisma/client';

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
  @IsEnum(Criticality)
  criticality?: Criticality;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}