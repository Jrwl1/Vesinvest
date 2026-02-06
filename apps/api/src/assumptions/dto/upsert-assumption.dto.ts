import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertAssumptionDto {
  @IsNumber()
  arvo!: number;

  @IsOptional()
  @IsString()
  nimi?: string;

  @IsOptional()
  @IsString()
  yksikko?: string;

  @IsOptional()
  @IsString()
  kuvaus?: string;
}
