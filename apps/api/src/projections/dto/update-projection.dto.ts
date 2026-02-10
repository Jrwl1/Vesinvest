import { IsString, IsInt, IsOptional, Min, Max, IsObject, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

const VAT_KEYS = ['alv', 'alvProsentti', 'vat', 'verokanta', 'moms'];
const isVatKey = (k: string) => VAT_KEYS.some((v) => k.toLowerCase().includes(v.toLowerCase()));

function stripVatFromOverrides(obj: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!obj || typeof obj !== 'object') return obj;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number' && !isVatKey(key)) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

export class UpdateProjectionDto {
  @IsOptional()
  @IsString()
  nimi?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  aikajaksoVuosia?: number;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => stripVatFromOverrides(value))
  olettamusYlikirjoitukset?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  onOletus?: boolean;
}
