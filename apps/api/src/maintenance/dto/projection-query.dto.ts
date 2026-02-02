import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID } from 'class-validator';

export class ProjectionQueryDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toYear?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDetails?: boolean;
}