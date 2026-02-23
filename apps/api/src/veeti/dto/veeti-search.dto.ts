import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class VeetiSearchDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

