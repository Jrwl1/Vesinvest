import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsUUID('4', {
    message:
      'Invalid report request: ennusteId must be a valid scenario id (UUID). Use field "ennusteId".',
  })
  @IsNotEmpty({
    message:
      'Invalid report request: ennusteId is required. Use field "ennusteId".',
  })
  ennusteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}
