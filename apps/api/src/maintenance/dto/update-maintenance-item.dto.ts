import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const MAINTENANCE_KINDS = ['MAINTENANCE', 'REPLACEMENT'] as const;

export class UpdateMaintenanceItemDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsIn(MAINTENANCE_KINDS)
  kind?: (typeof MAINTENANCE_KINDS)[number];

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
