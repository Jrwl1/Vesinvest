import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateAssetTypeDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  defaultLifeYears?: number;
}