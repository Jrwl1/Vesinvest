/**
 * Data Row Detector
 * 
 * Detects where actual data starts in Excel sheets that may contain:
 * - Multiple header rows
 * - Descriptor/label rows (e.g., "Ägare", "Ledningstyp", "Area")
 * - Empty rows before data
 * 
 * Also provides site value sanitization to filter out header-like values.
 */

/**
 * Denylist of values that should never be treated as site names.
 * Includes common Swedish/English column labels that might appear in data.
 */
const SITE_VALUE_DENYLIST = new Set([
  // Swedish labels
  'area',
  'subarea',
  'ägare',
  'agare',
  'owner',
  'ledningstyp',
  'mätmått',
  'matmatt',
  'dimension',
  'material',
  'status',
  'typ',
  'type',
  'namn',
  'name',
  'id',
  'objektid',
  'objectid',
  'featureid',
  // English labels
  'organisation',
  'organization',
  'org',
  'site',
  'location',
  'region',
  'zone',
  'district',
  'sector',
  'category',
  'class',
  'group',
  'description',
  // Common descriptors
  'unknown',
  'n/a',
  'na',
  'null',
  'none',
  'undefined',
  '-',
  '--',
  '---',
]);

/**
 * Common header labels that indicate a row is a header/descriptor row
 */
const HEADER_INDICATORS = new Set([
  'area',
  'subarea',
  'ägare',
  'agare',
  'ledningstyp',
  'mätmått',
  'dimension',
  'material',
  'status',
  'typ',
  'type',
  'namn',
  'name',
  'id',
  'objectid',
  'objektid',
  'featureid',
  'owner',
  'organisation',
  'organization',
  'description',
  'category',
  'class',
]);

export interface DataRowDetectionResult {
  /** Index of the first real data row (0-based from sampleRows) */
  dataStartIndex: number;
  /** Number of header/descriptor rows skipped */
  skippedRows: number;
  /** Reason for the detection */
  reason: string;
}

export interface SiteValueValidationResult {
  /** Cleaned site values (filtered, deduplicated) */
  validSites: string[];
  /** Values that were filtered out */
  filteredOut: string[];
  /** Whether any filtering occurred */
  hadFiltering: boolean;
}

/**
 * Detect where actual data rows start in a sheet.
 * 
 * @param rows - The sample rows from the sheet
 * @param headers - The detected column headers
 * @param externalRefColumn - The column name used for external ref (if detected)
 * @returns Detection result with data start index
 */
export function detectDataStartRow(
  rows: Record<string, unknown>[],
  headers: string[],
  externalRefColumn?: string,
): DataRowDetectionResult {
  if (rows.length === 0) {
    return { dataStartIndex: 0, skippedRows: 0, reason: 'No rows to analyze' };
  }

  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));
  const maxRowsToScan = Math.min(rows.length, 25);

  for (let i = 0; i < maxRowsToScan; i++) {
    const row = rows[i];
    const rowAnalysis = analyzeRow(row, headerSet, externalRefColumn);

    if (rowAnalysis.isDataRow) {
      return {
        dataStartIndex: i,
        skippedRows: i,
        reason: i === 0 
          ? 'First row appears to be data' 
          : `Skipped ${i} header/descriptor row(s)`,
      };
    }
  }

  // If we couldn't find a clear data row in first 25, assume row 0 is data
  // This is a fallback - better to process potentially bad data than fail
  return {
    dataStartIndex: 0,
    skippedRows: 0,
    reason: 'Could not detect clear data start, using first row',
  };
}

interface RowAnalysis {
  isDataRow: boolean;
  headerMatchCount: number;
  numericCount: number;
  stringCount: number;
  emptyCount: number;
  reason: string;
}

/**
 * Analyze a single row to determine if it's a data row or header/descriptor row.
 */
function analyzeRow(
  row: Record<string, unknown>,
  headerSet: Set<string>,
  externalRefColumn?: string,
): RowAnalysis {
  const values = Object.entries(row);
  let headerMatchCount = 0;
  let numericCount = 0;
  let stringCount = 0;
  let emptyCount = 0;
  let externalRefLooksLikeId = false;

  for (const [key, value] of values) {
    if (value === null || value === undefined || value === '') {
      emptyCount++;
      continue;
    }

    const strValue = String(value).toLowerCase().trim();

    // Check if this value looks like a header label
    if (headerSet.has(strValue) || HEADER_INDICATORS.has(strValue)) {
      headerMatchCount++;
    }

    // Check value type
    if (typeof value === 'number') {
      numericCount++;
    } else if (typeof value === 'string') {
      stringCount++;
      // Check if string is a number-like ID
      if (/^\d+$/.test(value.trim()) || /^[A-Z0-9-_]+$/i.test(value.trim())) {
        numericCount++; // Count ID-like strings as "numeric"
      }
    }

    // Special check for externalRef column
    if (externalRefColumn && key.toLowerCase() === externalRefColumn.toLowerCase()) {
      externalRefLooksLikeId = looksLikeId(value);
    }
  }

  const totalNonEmpty = values.length - emptyCount;

  // A row is likely a header/descriptor if:
  // 1. Many cells match header labels (more than 30%)
  // 2. Very few numeric/ID values (less than 20%)
  // 3. ExternalRef column contains non-ID text

  const headerMatchRatio = totalNonEmpty > 0 ? headerMatchCount / totalNonEmpty : 0;
  const numericRatio = totalNonEmpty > 0 ? numericCount / totalNonEmpty : 0;

  const isDescriptorRow = 
    headerMatchRatio > 0.3 || 
    (headerMatchCount >= 2 && numericRatio < 0.2) ||
    (externalRefColumn && !externalRefLooksLikeId && headerMatchCount > 0);

  return {
    isDataRow: !isDescriptorRow,
    headerMatchCount,
    numericCount,
    stringCount,
    emptyCount,
    reason: isDescriptorRow 
      ? `Header-like row (${headerMatchCount} label matches, ${Math.round(numericRatio * 100)}% numeric)`
      : `Data row (${numericCount} numeric values, ${headerMatchCount} label matches)`,
  };
}

/**
 * Check if a value looks like an ID (numeric, alphanumeric code, etc.)
 */
function looksLikeId(value: unknown): boolean {
  if (typeof value === 'number') {
    return true;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Numeric ID
    if (/^\d+$/.test(trimmed)) return true;
    // UUID-like
    if (/^[0-9a-f-]{8,}$/i.test(trimmed)) return true;
    // Alphanumeric code (e.g., "PUMP-001", "VA-12345")
    if (/^[A-Z0-9][-A-Z0-9_]*$/i.test(trimmed) && trimmed.length >= 3) return true;
    // Not an ID if it's a known label
    if (HEADER_INDICATORS.has(trimmed.toLowerCase())) return false;
  }
  return false;
}

/**
 * Filter and validate site values extracted from Excel.
 * Removes header labels, short values, and denylisted terms.
 * 
 * @param rawSiteValues - Raw site values extracted from Excel
 * @param columnHeaders - The column headers (to filter out header-like values)
 * @returns Validated site values
 */
export function sanitizeSiteValues(
  rawSiteValues: string[],
  columnHeaders: string[],
): SiteValueValidationResult {
  const headerSet = new Set(columnHeaders.map(h => h.toLowerCase().trim()));
  const validSites: string[] = [];
  const filteredOut: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawSiteValues) {
    if (!rawValue) continue;

    const trimmed = rawValue.trim();
    const lower = trimmed.toLowerCase();

    // Skip empty
    if (!trimmed) {
      continue;
    }

    // Skip duplicates (case-insensitive)
    if (seen.has(lower)) {
      continue;
    }

    // Check if should be filtered
    const filterReason = getSiteFilterReason(trimmed, lower, headerSet);
    if (filterReason) {
      filteredOut.push(`${trimmed} (${filterReason})`);
      continue;
    }

    // Valid site value
    seen.add(lower);
    validSites.push(trimmed);
  }

  return {
    validSites,
    filteredOut,
    hadFiltering: filteredOut.length > 0,
  };
}

/**
 * Get the reason a site value should be filtered, or null if valid.
 */
function getSiteFilterReason(
  value: string,
  lowerValue: string,
  headerSet: Set<string>,
): string | null {
  // Check denylist
  if (SITE_VALUE_DENYLIST.has(lowerValue)) {
    return 'common label';
  }

  // Check if it matches a column header
  if (headerSet.has(lowerValue)) {
    return 'matches column header';
  }

  // Check if too short (1-2 chars) and not numeric
  if (value.length <= 2 && !/^\d+$/.test(value)) {
    return 'too short';
  }

  // Check for common Swedish label patterns
  if (/^(ägare|agare|lednings|mät|mat|dimension|material|status|typ|area|sub)/i.test(lowerValue)) {
    return 'Swedish label pattern';
  }

  return null;
}

/**
 * Check if a single site value is valid (not a header label).
 */
export function isValidSiteValue(
  value: string,
  columnHeaders: string[],
): boolean {
  const headerSet = new Set(columnHeaders.map(h => h.toLowerCase().trim()));
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return getSiteFilterReason(trimmed, lower, headerSet) === null;
}

/**
 * Get data rows only (skip header/descriptor rows).
 */
export function getDataRows(
  allRows: Record<string, unknown>[],
  headers: string[],
  externalRefColumn?: string,
): {
  rows: Record<string, unknown>[];
  detection: DataRowDetectionResult;
} {
  const detection = detectDataStartRow(allRows, headers, externalRefColumn);
  const rows = allRows.slice(detection.dataStartIndex);
  return { rows, detection };
}
