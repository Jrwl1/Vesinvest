import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsUUID('4')
  @IsNotEmpty({
    message:
      'Invalid report request: vesinvestPlanId is required. Use field "vesinvestPlanId".',
  })
  vesinvestPlanId!: string;

  @IsOptional()
  @IsUUID('4', {
    message:
      'Invalid report request: ennusteId must be a valid scenario id (UUID). Use field "ennusteId".',
  })
  ennusteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsIn(['regulator_package', 'board_package', 'internal_appendix'])
  variant?: 'regulator_package' | 'board_package' | 'internal_appendix';

  @IsOptional()
  @IsIn(['en', 'fi', 'sv'])
  locale?: 'en' | 'fi' | 'sv';
}
