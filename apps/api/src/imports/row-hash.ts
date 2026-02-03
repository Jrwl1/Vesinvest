/**
 * Row Hash - Stable hash computation for import idempotency
 *
 * The hash is computed from the mapped column values, normalized for consistency.
 * This allows detecting if a row has changed between import runs.
 */

import { createHash } from 'crypto';

/**
 * Normalize a value for consistent hashing
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    // Normalize whitespace and case for strings
    return value.trim().toLowerCase();
  }

  if (typeof value === 'number') {
    // Round to avoid floating point inconsistencies
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(6);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // For objects/arrays, stringify consistently
  return JSON.stringify(value);
}

/**
 * Extract mapped values from a row based on column mapping
 */
export function extractMappedValues(
  row: Record<string, unknown>,
  columnMap: Map<string, { targetField: string }>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [sourceCol, mapping] of columnMap) {
    // Case-insensitive lookup
    const lowerSource = sourceCol.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === lowerSource) {
        result[mapping.targetField] = value;
        break;
      }
    }
  }

  return result;
}

/**
 * Compute a stable hash for a row based on its mapped values
 *
 * The hash uses only the values that are mapped to canonical fields,
 * sorted by target field name for consistency.
 */
export function computeRowHash(
  row: Record<string, unknown>,
  columnMap: Map<string, { targetField: string }>,
): string {
  // Extract and normalize mapped values
  const mappedValues = extractMappedValues(row, columnMap);

  // Sort by target field name for consistent ordering
  const sortedFields = Object.keys(mappedValues).sort();

  // Build hash input string
  const parts: string[] = [];
  for (const field of sortedFields) {
    const normalizedValue = normalizeValue(mappedValues[field]);
    parts.push(`${field}:${normalizedValue}`);
  }

  const hashInput = parts.join('|');

  // Compute SHA-256 hash and return first 16 hex characters
  return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

/**
 * Compute hash for a row using raw data (without column mapping)
 * Used for detecting duplicate rows within the same sheet
 */
export function computeRawRowHash(row: Record<string, unknown>): string {
  const sortedKeys = Object.keys(row).sort();
  const parts: string[] = [];

  for (const key of sortedKeys) {
    const normalizedValue = normalizeValue(row[key]);
    parts.push(`${key}:${normalizedValue}`);
  }

  const hashInput = parts.join('|');
  return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
}

/**
 * Compare two row hashes
 */
export function hashesMatch(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
