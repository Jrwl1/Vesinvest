import { Type } from 'class-transformer';
import { IsObject,IsOptional,IsString,MaxLength } from 'class-validator';

export class OpsEventDto {
  @Type(() => String)
  @IsString()
  @MaxLength(80)
  event!: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;
}
