import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const METHODS = ['linear', 'residual', 'none'] as const;

export class CreateDepreciationRuleDto {
  @IsString()
  @MaxLength(64)
  assetClassKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assetClassName?: string;

  @IsString()
  @IsIn(METHODS)
  method!: 'linear' | 'residual' | 'none';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  linearYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  residualPercent?: number;
}

export class UpdateDepreciationRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assetClassKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assetClassName?: string;

  @IsOptional()
  @IsString()
  @IsIn(METHODS)
  method?: 'linear' | 'residual' | 'none';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  linearYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  residualPercent?: number;
}
