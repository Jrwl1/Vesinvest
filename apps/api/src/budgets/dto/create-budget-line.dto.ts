import { IsString, IsNumber, IsIn, IsOptional, Min, IsInt } from 'class-validator';

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

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['group', 'line'])
  rowKind?: 'group' | 'line';

  @IsOptional()
  @IsIn(['vesi', 'jatevesi', 'muu'])
  serviceType?: 'vesi' | 'jatevesi' | 'muu';
}
