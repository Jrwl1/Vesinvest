import { IsIn, IsNumber, IsOptional, IsInt, IsString, Min, IsObject } from 'class-validator';

export class UpdateRevenueDriverDto {
  @IsOptional()
  @IsIn(['vesi', 'jatevesi', 'muu'])
  palvelutyyppi?: 'vesi' | 'jatevesi' | 'muu';

  @IsOptional()
  @IsNumber()
  @Min(0)
  yksikkohinta?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  myytyMaara?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perusmaksu?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  liittymamaara?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  alvProsentti?: number;

  @IsOptional()
  @IsString()
  muistiinpanot?: string;

  @IsOptional()
  @IsObject()
  sourceMeta?: Record<string, unknown>;
}
