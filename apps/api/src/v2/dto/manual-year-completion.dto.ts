import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualYearFinancialsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liikevaihto!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  henkilostokulut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liiketoiminnanMuutKulut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  poistot?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  arvonalentumiset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rahoitustuototJaKulut?: number;

  @Type(() => Number)
  @IsNumber()
  tilikaudenYliJaama!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  omistajatuloutus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  omistajanTukiKayttokustannuksiin?: number;
}

export class ManualYearPricesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waterUnitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastewaterUnitPrice!: number;
}

export class ManualYearVolumesDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  soldWaterVolume!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  soldWastewaterVolume!: number;
}

export class ManualYearInvestmentsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  investoinninMaara!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  korvausInvestoinninMaara!: number;
}

export class ManualYearEnergyDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prosessinKayttamaSahko!: number;
}

export class ManualYearNetworkDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  verkostonPituus!: number;
}

export class ManualYearCompletionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  year!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearFinancialsDto)
  financials?: ManualYearFinancialsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearPricesDto)
  prices?: ManualYearPricesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearVolumesDto)
  volumes?: ManualYearVolumesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearInvestmentsDto)
  investments?: ManualYearInvestmentsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearEnergyDto)
  energy?: ManualYearEnergyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualYearNetworkDto)
  network?: ManualYearNetworkDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
