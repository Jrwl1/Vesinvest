import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAssetTypeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  defaultLifeYears?: number;
}