import { IsString, IsNumber, IsIn, IsOptional, Min, IsInt } from 'class-validator';

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

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['group', 'line'])
  rowKind?: 'group' | 'line';

  @IsOptional()
  @IsIn(['vesi', 'jatevesi', 'muu'])
  serviceType?: 'vesi' | 'jatevesi' | 'muu' | null;
}
