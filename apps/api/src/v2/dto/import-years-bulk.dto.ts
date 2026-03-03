import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class ImportYearsBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1900, { each: true })
  @Max(2100, { each: true })
  years!: number[];
}
