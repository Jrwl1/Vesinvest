import { IsString, IsInt, IsOptional, Min, Max, IsObject, IsBoolean } from 'class-validator';

export class UpdateProjectionDto {
  @IsOptional()
  @IsString()
  nimi?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  aikajaksoVuosia?: number;

  @IsOptional()
  @IsObject()
  olettamusYlikirjoitukset?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  onOletus?: boolean;
}
