import { IsIn, IsNumber, IsOptional, IsInt, Min, IsObject } from 'class-validator';

export class CreateRevenueDriverDto {
  @IsIn(['vesi', 'jatevesi', 'muu'])
  palvelutyyppi!: 'vesi' | 'jatevesi' | 'muu';

  @IsNumber()
  @Min(0)
  yksikkohinta!: number;

  @IsNumber()
  @Min(0)
  myytyMaara!: number;

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
  muistiinpanot?: string;

  @IsOptional()
  @IsObject()
  sourceMeta?: Record<string, unknown>;
}
