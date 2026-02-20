import { IsBoolean } from 'class-validator';

export class LegalAcceptDto {
  @IsBoolean()
  acceptTerms!: boolean;

  @IsBoolean()
  acceptDpa!: boolean;
}

