import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanningScenarioDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  planningHorizonYears?: number;

  @IsOptional()
  @IsNumber()
  inflationRate?: number;

  @IsOptional()
  @IsNumber()
  discountRate?: number;

  @IsOptional()
  @IsNumber()
  currentTariffEur?: number;

  @IsOptional()
  @IsNumber()
  revenueBaselineEur?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
