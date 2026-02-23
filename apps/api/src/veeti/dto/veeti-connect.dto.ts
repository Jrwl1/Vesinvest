import { IsInt, Min } from 'class-validator';

export class VeetiConnectDto {
  @IsInt()
  @Min(1)
  veetiId!: number;
}

