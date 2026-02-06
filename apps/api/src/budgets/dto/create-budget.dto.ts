import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateBudgetDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  vuosi!: number;

  @IsOptional()
  @IsString()
  nimi?: string;
}
