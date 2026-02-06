import { IsString, IsNumber, IsIn, IsOptional, Min } from 'class-validator';

export class UpdateBudgetLineDto {
  @IsOptional()
  @IsString()
  tiliryhma?: string;

  @IsOptional()
  @IsString()
  nimi?: string;

  @IsOptional()
  @IsIn(['kulu', 'tulo', 'investointi'])
  tyyppi?: 'kulu' | 'tulo' | 'investointi';

  @IsOptional()
  @IsNumber()
  @Min(0)
  summa?: number;

  @IsOptional()
  @IsString()
  muistiinpanot?: string;
}
