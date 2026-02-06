import { IsString, IsInt, IsOptional, Min, Max, IsObject } from 'class-validator';

export class CreateProjectionDto {
  @IsString()
  talousarvioId!: string;

  @IsString()
  nimi!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  aikajaksoVuosia!: number;

  @IsOptional()
  @IsObject()
  olettamusYlikirjoitukset?: Record<string, number>;
}
