import { IsString, IsInt, IsOptional, Min, Max, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';
import { DriverPaths, normalizeDriverPaths } from '../driver-paths';

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

export class CreateProjectionDto {
  @IsString()
  talousarvioId!: string;

  @IsString()
  nimi!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  aikajaksoVuosia!: number;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => stripVatFromOverrides(value))
  olettamusYlikirjoitukset?: Record<string, number>;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => normalizeDriverPaths(value))
  ajuriPolut?: DriverPaths;
}
