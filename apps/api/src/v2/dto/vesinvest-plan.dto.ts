import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class VesinvestProjectAllocationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waterAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastewaterAmount?: number | null;
}

class VesinvestProjectDto {
  @IsString()
  @MaxLength(80)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsIn(['sanering', 'nyanlaggning', 'reparation'])
  investmentType!: 'sanering' | 'nyanlaggning' | 'reparation';

  @IsString()
  @MaxLength(120)
  groupKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  depreciationClassKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reportGroupKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subtype?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waterAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastewaterAmount?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VesinvestProjectAllocationDto)
  allocations?: VesinvestProjectAllocationDto[];
}

export class CreateVesinvestPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utilityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  businessId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  veetiId?: number | null;

  @IsOptional()
  @IsIn(['manual', 'veeti', 'mixed'])
  identitySource?: 'manual' | 'veeti' | 'mixed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(50)
  horizonYears?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => VesinvestProjectDto)
  projects?: VesinvestProjectDto[];

  @IsOptional()
  @IsObject()
  baselineSourceState?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  assetEvidenceState?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  municipalPlanContext?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  maintenanceEvidenceState?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  conditionStudyState?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  financialRiskState?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  publicationState?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  communicationState?: Record<string, unknown> | null;
}

export class UpdateVesinvestPlanDto extends CreateVesinvestPlanDto {
  @IsOptional()
  @IsIn(['draft', 'active', 'archived'])
  status?: 'draft' | 'active' | 'archived';

  @IsOptional()
  @IsIn(['draft', 'incomplete', 'verified'])
  baselineStatus?: 'draft' | 'incomplete' | 'verified';

  @IsOptional()
  @IsIn(['blocked', 'provisional', 'verified'])
  feeRecommendationStatus?: 'blocked' | 'provisional' | 'verified';

  @IsOptional()
  @IsString()
  lastReviewedAt?: string | null;

  @IsOptional()
  @IsString()
  reviewDueAt?: string | null;
}

export class SyncVesinvestPlanDto {
  @IsOptional()
  @IsBoolean()
  compute?: boolean;

  @IsOptional()
  @IsObject()
  baselineSourceState?: Record<string, unknown> | null;
}
