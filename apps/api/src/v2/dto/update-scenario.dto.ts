import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class YearlyInvestmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsIn(['replacement', 'new'])
  investmentType?: 'replacement' | 'new';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  confidence?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class NearTermExpenseAssumptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(1000)
  personnelPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(1000)
  energyPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(1000)
  opexOtherPct?: number;
}

class ThereafterExpenseAssumptionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  personnelPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  energyPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  opexOtherPct?: number;
}

export class UpdateScenarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  horizonYears?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => YearlyInvestmentDto)
  yearlyInvestments?: YearlyInvestmentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => NearTermExpenseAssumptionDto)
  nearTermExpenseAssumptions?: NearTermExpenseAssumptionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ThereafterExpenseAssumptionDto)
  thereafterExpenseAssumptions?: ThereafterExpenseAssumptionDto;
}
