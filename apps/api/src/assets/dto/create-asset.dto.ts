import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetStatus, Criticality } from '@prisma/client';

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

  @IsEnum(Criticality)
  criticality!: Criticality;

  @IsEnum(AssetStatus)
  status!: AssetStatus;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}