/**
 * Column Profiler - Analyzes Excel columns to infer types, detect patterns, and compute statistics
 */

export type InferredColumnType = 'string' | 'number' | 'date' | 'boolean' | 'mixed' | 'empty';

export interface ColumnProfile {
  /** Original header as it appears in Excel */
  headerRaw: string;
  /** Normalized header (lowercase, trimmed, spaces normalized) */
  headerNormalized: string;
  /** Column index (0-based) */
  columnIndex: number;
  /** Inferred data type based on sample values */
  inferredType: InferredColumnType;
  /** Percentage of empty/null values (0-100) */
  emptyRate: number;
  /** First N non-empty example values */
  exampleValues: string[];
  /** Detected unit hints (e.g., "m", "km", "€", "years") */
  detectedUnits: string[];
  /** Total non-empty values in sample */
  nonEmptyCount: number;
  /** Total values in sample */
  totalCount: number;
}

const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: string }> = [
  { pattern: /\(m\)|\bm\b|meter/i, unit: 'm' },
  { pattern: /\(km\)|\bkm\b|kilometer/i, unit: 'km' },
  { pattern: /\(mm\)|\bmm\b|millimeter/i, unit: 'mm' },
  { pattern: /€|eur|euro/i, unit: '€' },
  { pattern: /\$|usd|dollar/i, unit: '$' },
  { pattern: /year|år|vuosi|years/i, unit: 'years' },
  { pattern: /%|percent|prosentti/i, unit: '%' },
  { pattern: /\(l\)|\bl\b|liter|litre/i, unit: 'l' },
  { pattern: /m³|m3|kuutio/i, unit: 'm³' },
];

/**
 * Normalize a header string for consistent matching
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ')
    .replace(/[()[\]]/g, '')
    .trim();
}

/**
 * Detect units from a header string
 */
function detectUnitsFromHeader(header: string): string[] {
  const units: string[] = [];
  for (const { pattern, unit } of UNIT_PATTERNS) {
    if (pattern.test(header)) {
      units.push(unit);
    }
  }
  return units;
}

/**
 * Infer the type of a single value
 */
function inferValueType(value: unknown): InferredColumnType {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (value instanceof Date) {
    return 'date';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Check for boolean strings
    if (/^(true|false|yes|no|kyllä|ei|ja|nej)$/i.test(trimmed)) {
      return 'boolean';
    }

    // Check for date patterns
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(trimmed)) {
      return 'date';
    }

    // Check for year-only (common in asset data)
    if (/^\d{4}$/.test(trimmed)) {
      const year = parseInt(trimmed, 10);
      if (year >= 1900 && year <= 2100) {
        return 'date';
      }
    }

    // Check for numeric values (including with thousand separators)
    const numericClean = trimmed.replace(/[€$£,\s]/g, '').replace(',', '.');
    if (/^-?\d+\.?\d*$/.test(numericClean)) {
      return 'number';
    }

    return 'string';
  }

  return 'mixed';
}

/**
 * Determine the overall column type from individual value types
 */
function determineColumnType(typeCounts: Record<InferredColumnType, number>): InferredColumnType {
  const { empty, ...nonEmptyTypes } = typeCounts;

  const nonEmptyEntries = Object.entries(nonEmptyTypes).filter(([, count]) => count > 0);

  if (nonEmptyEntries.length === 0) {
    return 'empty';
  }

  if (nonEmptyEntries.length === 1) {
    return nonEmptyEntries[0][0] as InferredColumnType;
  }

  // If mostly one type with a few others, use the dominant type
  const total = nonEmptyEntries.reduce((sum, [, count]) => sum + count, 0);
  const dominant = nonEmptyEntries.reduce((max, entry) => (entry[1] > max[1] ? entry : max));

  if (dominant[1] / total >= 0.8) {
    return dominant[0] as InferredColumnType;
  }

  return 'mixed';
}

/**
 * Profile a single column from sample data
 */
export function profileColumn(
  header: string,
  columnIndex: number,
  values: unknown[],
): ColumnProfile {
  const typeCounts: Record<InferredColumnType, number> = {
    string: 0,
    number: 0,
    date: 0,
    boolean: 0,
    mixed: 0,
    empty: 0,
  };

  const exampleValues: string[] = [];
  let nonEmptyCount = 0;

  for (const value of values) {
    const valueType = inferValueType(value);
    typeCounts[valueType]++;

    if (valueType !== 'empty') {
      nonEmptyCount++;
      if (exampleValues.length < 5) {
        const strValue = String(value).slice(0, 100);
        if (!exampleValues.includes(strValue)) {
          exampleValues.push(strValue);
        }
      }
    }
  }

  const totalCount = values.length;
  const emptyRate = totalCount > 0 ? Math.round((typeCounts.empty / totalCount) * 100) : 100;

  return {
    headerRaw: header,
    headerNormalized: normalizeHeader(header),
    columnIndex,
    inferredType: determineColumnType(typeCounts),
    emptyRate,
    exampleValues,
    detectedUnits: detectUnitsFromHeader(header),
    nonEmptyCount,
    totalCount,
  };
}

/**
 * Profile all columns from sample data
 */
export function profileColumns(
  headers: string[],
  sampleRows: Record<string, unknown>[],
): ColumnProfile[] {
  const profiles: ColumnProfile[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const values = sampleRows.map((row) => {
      // Case-insensitive column lookup
      for (const [key, value] of Object.entries(row)) {
        if (key.toLowerCase() === header.toLowerCase()) {
          return value;
        }
      }
      return undefined;
    });

    profiles.push(profileColumn(header, i, values));
  }

  return profiles;
}
