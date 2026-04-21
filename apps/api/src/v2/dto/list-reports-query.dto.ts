import { IsOptional,IsUUID } from 'class-validator';

export class ListReportsQueryDto {
  @IsOptional()
  @IsUUID('4')
  ennusteId?: string;
}
