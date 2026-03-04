import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ClassAllocationItemDto {
  @IsString()
  @MaxLength(64)
  classKey!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  sharePct!: number;
}

class ScenarioYearClassAllocationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year!: number;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ClassAllocationItemDto)
  allocations!: ClassAllocationItemDto[];
}

export class UpdateScenarioClassAllocationsDto {
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ScenarioYearClassAllocationDto)
  years!: ScenarioYearClassAllocationDto[];
}
