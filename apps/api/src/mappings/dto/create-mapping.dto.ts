import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TargetEntity, FieldCriticality } from '@prisma/client';

export class CreateMappingColumnDto {
  @IsString()
  sourceColumn!: string;

  @IsString()
  targetField!: string;

  @IsOptional()
  transformation?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsEnum(FieldCriticality)
  criticality?: FieldCriticality;
}

export class CreateMappingDto {
  @IsString()
  name!: string;

  @IsEnum(TargetEntity)
  targetEntity!: TargetEntity;

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMappingColumnDto)
  columns!: CreateMappingColumnDto[];
}
