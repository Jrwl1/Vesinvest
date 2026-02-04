/**
 * Sheet classification for Facit-first Quick Import.
 * Determines whether a sheet is an asset candidate, reference/legend, or empty/unknown.
 */

export type SheetKind = 'ASSET_CANDIDATE' | 'REFERENCE' | 'EMPTY' | 'UNKNOWN';

export interface SheetClassification {
  kind: SheetKind;
  kindReason: string;
}

const REFERENCE_NAME_PATTERN = /förklar|legend|explain|notes|info|instruktion|manual|readme/i;
const ASSET_COLUMN_SIGNALS = [
  /uwd_/i,
  /shape_length|shape_length/i,
  /materialname|material_name/i,
  /yearbuilt|year_built|byggt|install/i,
  /featureid|objectid|feature_id|object_id/i,
  /ledning|pipe|asset|linefeature/i,
];

/** Descriptive header labels that suggest a reference/legend sheet rather than data. */
const DESCRIPTIVE_HEADER_HINTS = [
  /linefeatureid|ledningstyp|noggrannhet|mätmått|dimension|förklaring/i,
  /column|kolumn|description|beskrivning|meaning|betydelse/i,
];

const MIN_DATA_ROWS_FOR_ASSET = 50;

/**
 * Classify a sheet as ASSET_CANDIDATE, REFERENCE, EMPTY, or UNKNOWN.
 * Deterministic: name + row count + header signals.
 */
export function classifySheet(
  sheetName: string,
  headers: string[],
  dataRowCount: number,
  headerRowsSkipped: number,
): SheetClassification {
  const nameLower = sheetName.toLowerCase().trim();
  const headerStr = headers.join(' ').toLowerCase();

  // 1. Explicit reference/legend by name
  if (REFERENCE_NAME_PATTERN.test(nameLower)) {
    return {
      kind: 'REFERENCE',
      kindReason: 'Sheet name indicates reference or explanations',
    };
  }

  // 2. Empty or negligible data
  if (dataRowCount === 0) {
    return { kind: 'EMPTY', kindReason: 'No data rows' };
  }

  // 3. Small row count + descriptive headers → reference
  if (dataRowCount < MIN_DATA_ROWS_FOR_ASSET) {
    const looksDescriptive = DESCRIPTIVE_HEADER_HINTS.some((re) => re.test(headerStr));
    if (looksDescriptive) {
      return {
        kind: 'REFERENCE',
        kindReason: 'Few rows and descriptive headers (legend/explanations)',
      };
    }
  }

  // 4. Strong asset signals: many rows or asset-like columns
  const hasAssetColumns = ASSET_COLUMN_SIGNALS.some((re) =>
    headers.some((h) => re.test(String(h))),
  );
  if (dataRowCount >= MIN_DATA_ROWS_FOR_ASSET || hasAssetColumns) {
    return {
      kind: 'ASSET_CANDIDATE',
      kindReason: dataRowCount >= MIN_DATA_ROWS_FOR_ASSET
        ? `${dataRowCount} data rows`
        : 'Asset-like column names',
    };
  }

  // 5. Default: treat as candidate if we have some data
  if (dataRowCount > 0) {
    return {
      kind: 'ASSET_CANDIDATE',
      kindReason: `${dataRowCount} data rows`,
    };
  }

  return { kind: 'UNKNOWN', kindReason: 'Could not classify' };
}
