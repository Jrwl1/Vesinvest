import { IsOptional, IsString, IsIn, IsNumber, Min, IsObject } from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  nimi?: string;

  @IsOptional()
  @IsIn(['luonnos', 'vahvistettu'])
  tila?: 'luonnos' | 'vahvistettu';

  /** Annual base-fee total (EUR). ADR-013: manual total with yearly adjustment. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  perusmaksuYhteensa?: number;

  @IsOptional()
  @IsObject()
  inputCompleteness?: Record<string, unknown>;
}
