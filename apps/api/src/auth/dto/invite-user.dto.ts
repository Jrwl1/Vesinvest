import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'USER', 'VIEWER'])
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

