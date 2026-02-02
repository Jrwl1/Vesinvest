import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const MAINTENANCE_KINDS = ['MAINTENANCE', 'REPLACEMENT'] as const;

export class CreateMaintenanceItemDto {
  @IsUUID()
  assetId!: string;

  @IsIn(MAINTENANCE_KINDS)
  kind!: (typeof MAINTENANCE_KINDS)[number];

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
