import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScenarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID('4')
  talousarvioId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  horizonYears?: number;

  @IsOptional()
  @IsUUID('4')
  copyFromScenarioId?: string;

  @IsOptional()
  @IsIn(['base', 'committed', 'hypothesis', 'stress'])
  scenarioType?: 'base' | 'committed' | 'hypothesis' | 'stress';

  @IsOptional()
  @IsBoolean()
  compute?: boolean;
}
