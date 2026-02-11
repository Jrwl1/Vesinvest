import { IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateBudgetDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  vuosi!: number;

  @IsOptional()
  @IsString()
  nimi?: string;

  /** Annual base-fee total (EUR). ADR-013: manual total with yearly adjustment. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  perusmaksuYhteensa?: number;
}
