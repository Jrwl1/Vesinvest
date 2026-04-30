import { IsOptional, IsString } from 'class-validator';

export class ImportClearDto {
  @IsOptional()
  @IsString()
  challengeId?: string;

  @IsOptional()
  @IsString()
  confirmToken?: string;
}
