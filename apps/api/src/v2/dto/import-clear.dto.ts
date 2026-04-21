import { IsOptional,IsString } from 'class-validator';

export class ImportClearDto {
  @IsOptional()
  @IsString()
  confirmToken?: string;
}
