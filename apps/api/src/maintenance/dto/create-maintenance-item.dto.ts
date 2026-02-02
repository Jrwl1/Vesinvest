import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MaintenanceKind } from '@prisma/client';

export class CreateMaintenanceItemDto {
  @IsUUID()
  assetId!: string;

  @IsEnum(MaintenanceKind)
  kind!: MaintenanceKind;

  @IsInt()
  @Min(1)
  intervalYears!: number;

  @IsNumber()
  costEur!: number;

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