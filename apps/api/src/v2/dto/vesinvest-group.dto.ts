import { IsIn,IsOptional,IsString,MaxLength } from 'class-validator';

export class UpdateVesinvestGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  defaultAccountKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  defaultDepreciationClassKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  reportGroupKey?: string;

  @IsOptional()
  @IsIn(['water', 'wastewater', 'mixed'])
  serviceSplit?: 'water' | 'wastewater' | 'mixed';
}
