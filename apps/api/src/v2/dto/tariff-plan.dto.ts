import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class TariffBaselineInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  connectionFeeAverage?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  connectionFeeRevenue?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  connectionFeeNewConnections?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  connectionFeeBasis?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseFeeRevenue?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  connectionCount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waterPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastewaterPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  soldWaterVolume?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  soldWastewaterVolume?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

class TariffAllocationPolicyDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  connectionFeeSharePct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  baseFeeSharePct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  waterUsageSharePct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  wastewaterUsageSharePct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(20)
  smoothingYears?: number | null;

  @IsOptional()
  @IsBoolean()
  regionalVariationApplies?: boolean | null;

  @IsOptional()
  @IsBoolean()
  stormwaterApplies?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  financialRiskAssessment?: string | null;
}

export class UpsertTariffPlanDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TariffBaselineInputDto)
  baselineInput?: TariffBaselineInputDto | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TariffAllocationPolicyDto)
  allocationPolicy?: TariffAllocationPolicyDto | null;
}
