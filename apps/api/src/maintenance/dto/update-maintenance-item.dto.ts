import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MaintenanceKind } from '@prisma/client';

export class UpdateMaintenanceItemDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsEnum(MaintenanceKind)
  kind?: MaintenanceKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalYears?: number;

  @IsOptional()
  @IsNumber()
  costEur?: number;

  @IsOptional()
  @IsInt()
  startsAtYear?: number;

  @IsOptional()
  @IsInt()
  endsAtYear?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}