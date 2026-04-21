import { IsArray,IsIn,IsOptional,IsString } from 'class-validator';

export class ImportYearReconcileDto {
  @IsString()
  @IsIn(['keep_manual', 'apply_veeti'])
  action!: 'keep_manual' | 'apply_veeti';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataTypes?: string[];
}
