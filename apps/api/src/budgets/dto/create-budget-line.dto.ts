import { IsString, IsNumber, IsIn, IsOptional, Min } from 'class-validator';

export class CreateBudgetLineDto {
  @IsString()
  tiliryhma!: string;

  @IsString()
  nimi!: string;

  @IsIn(['kulu', 'tulo', 'investointi'])
  tyyppi!: 'kulu' | 'tulo' | 'investointi';

  @IsNumber()
  @Min(0)
  summa!: number;

  @IsOptional()
  @IsString()
  muistiinpanot?: string;
}
