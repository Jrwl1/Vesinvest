import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  nimi?: string;

  @IsOptional()
  @IsIn(['luonnos', 'vahvistettu'])
  tila?: 'luonnos' | 'vahvistettu';
}
