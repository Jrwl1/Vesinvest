import type { V2DocumentImportSourceLine } from '../api';
import type { DocumentImportFieldMatch } from './documentPdfImportModel';
import type { QdisFieldKey } from './qdisPdfImport';

export function extractFinancialAmount(line: string): number | null {
  const values = extractAllAmounts(line).filter((value) => {
    const absolute = Math.abs(value);
    if (Number.isInteger(absolute) && absolute >= 1900 && absolute <= 2100) {
      return false;
    }
    return true;
  });
  return values[0] ?? null;
}

export function extractPriceAmount(line: string): number | null {
  return extractNumberWithPattern(
    line,
    /(-?\d[\d\s.,]*)\s*(?:\u20ac|eur)?\s*(?:\/|per)?\s*(?:m3|m\u00b3)/i,
  );
}

export function extractVolumeAmount(line: string): number | null {
  return extractNumberWithPattern(line, /(-?\d[\d\s.,]*)\s*(?:m3|m\u00b3)/i);
}

export function extractNumberWithPattern(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  return parseAmountToken(match[1]);
}

export function extractAllAmounts(line: string): number[] {
  const tokens =
    line.match(/[+-]?\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{2})|[+-]?\d+(?:[.,]\d{2})/g) ?? [];
  const values: number[] = [];
  for (const token of tokens) {
    const parsed = parseAmountToken(token);
    if (parsed != null) {
      values.push(parsed);
    }
  }
  return values;
}

export function parseAmountToken(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.includes('31.12') || raw.includes('1.1')) return null;

  let normalized = raw.replace(/[^\d,.\-\s]/g, '').replace(/\s+/g, '');
  if (!normalized) return null;

  if (normalized.includes(',') && normalized.includes('.')) {
    const decimalSeparator = normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
    if (decimalSeparator === ',') {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  if ((normalized.match(/\./g) ?? []).length > 1) {
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const parts = unsigned.split('.');
    const decimalPart = parts[parts.length - 1] ?? '0';
    normalized = `${negative ? '-' : ''}${parts.slice(0, -1).join('')}.${decimalPart}`;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeFinancialImportValue(key: string, value: number): number {
  if (
    key === 'aineetJaPalvelut' ||
    key === 'henkilostokulut' ||
    key === 'liiketoiminnanMuutKulut' ||
    key === 'poistot'
  ) {
    return round2(Math.abs(value));
  }
  return round2(value);
}

export function isQdisPriceField(key: QdisFieldKey): boolean {
  return key === 'waterUnitPrice' || key === 'wastewaterUnitPrice';
}

export function uniqueSourceLines(
  sourceLines: V2DocumentImportSourceLine[],
): V2DocumentImportSourceLine[] {
  const seen = new Set<string>();
  return sourceLines.filter((line) => {
    const key = `${line.pageNumber ?? '-'}:${line.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function mergeMatches(
  left: DocumentImportFieldMatch[],
  right: DocumentImportFieldMatch[],
): DocumentImportFieldMatch[] {
  const merged = new Map<string, DocumentImportFieldMatch>();
  for (const match of [...left, ...right]) {
    merged.set(match.key, match);
  }
  return [...merged.values()];
}

export function mergeCandidateMatches(
  left: DocumentImportFieldMatch[],
  right: DocumentImportFieldMatch[],
): DocumentImportFieldMatch[] {
  const seen = new Set<string>();
  const merged: DocumentImportFieldMatch[] = [];
  for (const match of [...left, ...right]) {
    const key = [match.key, match.value, match.pageNumber ?? '-', match.sourceLine].join('|');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(match);
  }
  return merged;
}

export function selectPreferredMatches(
  matches: DocumentImportFieldMatch[],
): DocumentImportFieldMatch[] {
  const selected = new Map<string, DocumentImportFieldMatch>();
  for (const match of matches) {
    if (!selected.has(match.key)) {
      selected.set(match.key, match);
    }
  }
  return [...selected.values()];
}
