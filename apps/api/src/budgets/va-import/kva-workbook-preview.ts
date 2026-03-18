import * as XLSX from 'xlsx';

export type KvaWorkbookSourceField =
  | 'Liikevaihto'
  | 'AineetJaPalvelut'
  | 'Henkilostokulut'
  | 'Poistot'
  | 'LiiketoiminnanMuutKulut'
  | 'TilikaudenYliJaama';

type ParsedWorkbookRow = Partial<Record<KvaWorkbookSourceField, number | null>>;

export type ParsedKvaWorkbookPreview = {
  sheetName: string;
  workbookYears: number[];
  valuesByYear: Map<number, ParsedWorkbookRow>;
};

const KVA_TOTALT_SHEET = 'KVA totalt';

const KVA_ROW_MAPPINGS: Array<{
  sourceField: KvaWorkbookSourceField;
  workbookLabel: string;
}> = [
  { sourceField: 'Liikevaihto', workbookLabel: 'Omsättning' },
  {
    sourceField: 'AineetJaPalvelut',
    workbookLabel: 'Material och tjänster',
  },
  { sourceField: 'Henkilostokulut', workbookLabel: 'Personalkostnader' },
  {
    sourceField: 'Poistot',
    workbookLabel: 'Avskrivningar och nedskrivningar',
  },
  {
    sourceField: 'LiiketoiminnanMuutKulut',
    workbookLabel: 'Övriga rörelsekostnader',
  },
  {
    sourceField: 'TilikaudenYliJaama',
    workbookLabel: 'Vinst (- förlust) före bokslutsdepositioner och skatter',
  },
];

const NORMALIZED_ROW_LABELS = new Map(
  KVA_ROW_MAPPINGS.map((row) => [normalizeText(row.workbookLabel), row.sourceField]),
);

export function parseKvaWorkbookPreview(
  fileBuffer: Buffer,
): ParsedKvaWorkbookPreview {
  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellDates: false,
    dense: true,
  });
  const sheet = workbook.Sheets[KVA_TOTALT_SHEET];
  if (!sheet) {
    throw new Error(`Workbook sheet "${KVA_TOTALT_SHEET}" was not found.`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  const yearColumns = resolveYearColumns(rows);
  if (yearColumns.length === 0) {
    throw new Error(`Workbook sheet "${KVA_TOTALT_SHEET}" does not contain year columns.`);
  }

  const valuesByYear = new Map<number, ParsedWorkbookRow>();
  for (const yearColumn of yearColumns) {
    valuesByYear.set(yearColumn.year, {});
  }

  const rowValuesByField = new Map<
    KvaWorkbookSourceField,
    Map<number, number | null>
  >();
  const firstYearColumn = yearColumns[0].columnIndex;
  for (const row of rows) {
    const mappedField = resolveWorkbookField(row, firstYearColumn);
    if (!mappedField || rowValuesByField.has(mappedField)) {
      continue;
    }

    const rowValues = new Map<number, number | null>();
    for (const yearColumn of yearColumns) {
      rowValues.set(yearColumn.year, toNullableNumber(row[yearColumn.columnIndex]));
    }
    rowValuesByField.set(mappedField, rowValues);
  }

  const missingFields = KVA_ROW_MAPPINGS.filter(
    (row) => !rowValuesByField.has(row.sourceField),
  ).map((row) => row.sourceField);
  if (missingFields.length > 0) {
    throw new Error(
      `Workbook sheet "${KVA_TOTALT_SHEET}" is missing rows for ${missingFields.join(', ')}.`,
    );
  }

  for (const { sourceField } of KVA_ROW_MAPPINGS) {
    const rowValues = rowValuesByField.get(sourceField)!;
    for (const yearColumn of yearColumns) {
      const yearValues = valuesByYear.get(yearColumn.year);
      if (!yearValues) continue;
      yearValues[sourceField] = rowValues.get(yearColumn.year) ?? null;
    }
  }

  return {
    sheetName: KVA_TOTALT_SHEET,
    workbookYears: yearColumns.map((entry) => entry.year),
    valuesByYear,
  };
}

function resolveYearColumns(
  rows: unknown[][],
): Array<{ columnIndex: number; year: number }> {
  let best: Array<{ columnIndex: number; year: number }> = [];

  for (const row of rows.slice(0, 10)) {
    const current = row
      .map((value, columnIndex) => {
        const year = toYear(value);
        return year == null ? null : { columnIndex, year };
      })
      .filter(
        (value): value is { columnIndex: number; year: number } => value != null,
      );
    if (current.length > best.length) {
      best = current;
    }
  }

  return best;
}

function resolveWorkbookField(
  row: unknown[],
  firstYearColumn: number,
): KvaWorkbookSourceField | null {
  for (const cell of row.slice(0, firstYearColumn)) {
    const normalized = normalizeText(cell);
    if (!normalized) continue;
    const sourceField = NORMALIZED_ROW_LABELS.get(normalized);
    if (sourceField) {
      return sourceField;
    }
  }
  return null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function toYear(value: unknown): number | null {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value.trim())
      : Number.NaN;
  const rounded = Math.round(numberValue);
  return rounded >= 1900 && rounded <= 2100 ? rounded : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? round2(value) : null;
  }

  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export { KVA_TOTALT_SHEET };
