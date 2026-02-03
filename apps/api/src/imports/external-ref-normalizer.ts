/**
 * External Reference Normalizer
 * 
 * Canonical utility for normalizing externalRef values from diverse data sources.
 * This is THE authoritative transformation for asset business identities.
 * 
 * GIS exports, Excel sheets, and legacy systems often store identifiers in
 * unexpected formats (numeric IDs, padded strings, mixed types). This utility
 * ensures all externalRef values are:
 * 
 * 1. Converted to strings (numbers → "123")
 * 2. Trimmed of whitespace
 * 3. Validated for non-emptiness
 * 
 * Per Asset Identity Contract:
 * - externalRef is the immutable business identity
 * - All import paths MUST go through this function
 * - Schema remains String type (no changes)
 */

export interface NormalizationResult {
  /** The normalized externalRef string, or null if invalid */
  value: string | null;
  /** Whether normalization was applied (e.g., number → string) */
  wasNormalized: boolean;
  /** Human-readable reason if value is null */
  invalidReason?: string;
  /** Original value type for diagnostics */
  originalType: 'number' | 'string' | 'null' | 'undefined' | 'other';
}

/**
 * Normalize an externalRef value from any source to a valid string.
 * 
 * This is the ONLY function that should process raw externalRef values.
 * 
 * @param value - Raw value from Excel/GIS/API (can be number, string, null, undefined)
 * @returns Normalized string or null if invalid
 * 
 * @example
 * normalizeExternalRef(12345)      // "12345"
 * normalizeExternalRef("  ABC ")   // "ABC"
 * normalizeExternalRef("")         // null
 * normalizeExternalRef(null)       // null
 * normalizeExternalRef(0)          // "0" (valid!)
 */
export function normalizeExternalRef(value: unknown): string | null {
  const result = normalizeExternalRefWithDetails(value);
  return result.value;
}

/**
 * Normalize with full diagnostic information.
 * Use this when you need to track or report normalization details.
 */
export function normalizeExternalRefWithDetails(value: unknown): NormalizationResult {
  // Handle null/undefined
  if (value === null) {
    return {
      value: null,
      wasNormalized: false,
      invalidReason: 'Value is null',
      originalType: 'null',
    };
  }
  
  if (value === undefined) {
    return {
      value: null,
      wasNormalized: false,
      invalidReason: 'Value is undefined',
      originalType: 'undefined',
    };
  }
  
  // Handle numbers - common in GIS exports (FEATUREID columns)
  if (typeof value === 'number') {
    // NaN and Infinity are invalid
    if (!Number.isFinite(value)) {
      return {
        value: null,
        wasNormalized: false,
        invalidReason: 'Number is not finite',
        originalType: 'number',
      };
    }
    // Convert to string - including 0 which is valid
    const stringValue = String(value);
    return {
      value: stringValue,
      wasNormalized: true,
      originalType: 'number',
    };
  }
  
  // Handle strings
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return {
        value: null,
        wasNormalized: false,
        invalidReason: 'String is empty after trimming',
        originalType: 'string',
      };
    }
    return {
      value: trimmed,
      wasNormalized: trimmed !== value, // Only if we actually trimmed something
      originalType: 'string',
    };
  }
  
  // Other types (objects, arrays, booleans, etc.) - try toString
  // This is defensive but shouldn't happen with well-formed data
  try {
    const stringified = String(value);
    const trimmed = stringified.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object Object]') {
      return {
        value: null,
        wasNormalized: false,
        invalidReason: `Unsupported type: ${typeof value}`,
        originalType: 'other',
      };
    }
    return {
      value: trimmed,
      wasNormalized: true,
      originalType: 'other',
    };
  } catch {
    return {
      value: null,
      wasNormalized: false,
      invalidReason: `Cannot convert ${typeof value} to string`,
      originalType: 'other',
    };
  }
}

/**
 * Check if a raw value can be normalized to a valid externalRef.
 * Useful for validation without actually performing the conversion.
 */
export function isValidExternalRef(value: unknown): boolean {
  return normalizeExternalRef(value) !== null;
}

/**
 * Batch normalize multiple values, returning both valid and invalid indices.
 * Useful for analyzing a column of data before import.
 */
export function analyzeExternalRefColumn(
  values: unknown[]
): {
  validCount: number;
  invalidCount: number;
  numericCount: number;
  stringCount: number;
  emptyCount: number;
  invalidIndices: number[];
} {
  let validCount = 0;
  let invalidCount = 0;
  let numericCount = 0;
  let stringCount = 0;
  let emptyCount = 0;
  const invalidIndices: number[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const result = normalizeExternalRefWithDetails(values[i]);
    
    if (result.value !== null) {
      validCount++;
      if (result.originalType === 'number') {
        numericCount++;
      } else if (result.originalType === 'string') {
        stringCount++;
      }
    } else {
      invalidCount++;
      invalidIndices.push(i);
      if (result.originalType === 'null' || result.originalType === 'undefined' || 
          result.invalidReason?.includes('empty')) {
        emptyCount++;
      }
    }
  }
  
  return {
    validCount,
    invalidCount,
    numericCount,
    stringCount,
    emptyCount,
    invalidIndices,
  };
}
