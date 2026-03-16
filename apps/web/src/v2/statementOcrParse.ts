export type StatementOcrFieldKey =
  | 'liikevaihto'
  | 'henkilostokulut'
  | 'liiketoiminnanMuutKulut'
  | 'poistot'
  | 'rahoitustuototJaKulut'
  | 'tilikaudenYliJaama';

export type StatementOcrMatch = {
  key: StatementOcrFieldKey;
  label: string;
  value: number;
  sourceLine: string;
  pageNumber: number;
};

export type StatementOcrComparisonRow = {
  key: StatementOcrFieldKey;
  label: string;
  veetiValue: number | null;
  pdfValue: number | null;
  currentValue: number | null;
  changedFromVeeti: boolean;
  changedFromCurrent: boolean;
  sourceLine: string | null;
  pageNumber: number | null;
};

type ParsedStatementLine = {
  original: string;
  normalized: string;
  compact: string;
};

export const STATEMENT_OCR_FIELD_CONFIG: Array<{
  key: StatementOcrFieldKey;
  label: string;
  sourceField: string;
  patterns: string[];
}> = [
  {
    key: 'liikevaihto',
    label: 'Revenue',
    sourceField: 'Liikevaihto',
    patterns: ['omsattning'],
  },
  {
    key: 'henkilostokulut',
    label: 'Personnel costs',
    sourceField: 'Henkilostokulut',
    patterns: [
      'personalkostnader',
      'parsonalkostnader',
      'sonalkostnader',
      'onalkostnader',
    ],
  },
  {
    key: 'liiketoiminnanMuutKulut',
    label: 'Other operating costs',
    sourceField: 'LiiketoiminnanMuutKulut',
    patterns: [
      'ovriga driftskostnader',
      'ovriga rorelsekostnader',
      'ovriga rorstagkostnader',
      'ovriga rorstakostnader',
    ],
  },
  {
    key: 'poistot',
    label: 'Depreciation',
    sourceField: 'Poistot',
    patterns: ['avskrivningar enligt plan', 'avskrivningar och nedskrivningar'],
  },
  {
    key: 'rahoitustuototJaKulut',
    label: 'Net finance',
    sourceField: 'RahoitustuototJaKulut',
    patterns: ['finansiella intakter och kostnader'],
  },
  {
    key: 'tilikaudenYliJaama',
    label: 'Year result',
    sourceField: 'TilikaudenYliJaama',
    patterns: [
      'rakenskapsperiodens vinst',
      'vinst forlust fore bokslutsdispositioner och skatter',
    ],
  },
];

export function parseStatementText(text: string, pageNumber: number) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const parsedLines = lines.map((line) => createParsedStatementLine(line));

  const fields: Partial<Record<StatementOcrFieldKey, number>> = {};
  const matches: StatementOcrMatch[] = [];
  const warnings: string[] = [];

  for (const field of STATEMENT_OCR_FIELD_CONFIG) {
    const match = findFieldMatch(
      field.key,
      field.label,
      field.patterns,
      parsedLines,
      pageNumber,
    );
    if (match) {
      fields[match.key] = match.value;
      matches.push(match);
    }
  }

  if (fields.henkilostokulut == null) {
    const personnel = computePersonnelCosts(parsedLines);
    if (personnel) {
      fields.henkilostokulut = personnel.value;
      matches.push({
        key: 'henkilostokulut',
        label: 'Personnel costs',
        value: personnel.value,
        sourceLine: personnel.sourceLine,
        pageNumber,
      });
    }
  }

  if (fields.liiketoiminnanMuutKulut == null) {
    const operatingCosts = findLineAmount(
      parsedLines,
      [
        'ovriga driftskostnader',
        'ovriga rorelsekostnader',
        'ovriga rorstagkostnader',
        'ovriga rorstakostnader',
      ],
      'Other operating costs',
      'liiketoiminnanMuutKulut',
      pageNumber,
    );
    if (operatingCosts) {
      fields.liiketoiminnanMuutKulut = operatingCosts.value;
      matches.push(operatingCosts);
    }
  }

  if (fields.rahoitustuototJaKulut == null) {
    const finance = computeNetFinance(parsedLines);
    if (finance) {
      fields.rahoitustuototJaKulut = finance.value;
      matches.push({
        key: 'rahoitustuototJaKulut',
        label: 'Net finance',
        value: finance.value,
        sourceLine: finance.sourceLine,
        pageNumber,
      });
    }
  }

  for (const field of STATEMENT_OCR_FIELD_CONFIG) {
    if (fields[field.key] == null) {
      warnings.push(`OCR could not confidently map ${field.label}.`);
    }
  }

  return { fields, matches, warnings };
}

export function normalizeStatementOcrFieldValue(
  key: StatementOcrFieldKey,
  value: number | null,
): number | null {
  if (value == null) return null;
  switch (key) {
    case 'henkilostokulut':
    case 'liiketoiminnanMuutKulut':
    case 'poistot':
      return round2(Math.abs(value));
    default:
      return round2(value);
  }
}

export function buildStatementOcrComparisonRows(input: {
  fields: Partial<Record<StatementOcrFieldKey, number>>;
  matches: StatementOcrMatch[];
  veetiFinancials?: Record<string, unknown> | null;
  currentFinancials?: Record<string, unknown> | null;
}): StatementOcrComparisonRow[] {
  const matchMap = new Map(
    input.matches.map((match) => [match.key, match] as const),
  );

  return STATEMENT_OCR_FIELD_CONFIG.map((field) => {
    const match = matchMap.get(field.key) ?? null;
    const pdfValue = normalizeStatementOcrFieldValue(
      field.key,
      input.fields[field.key] ?? match?.value ?? null,
    );
    const veetiValue = normalizeStatementOcrFieldValue(
      field.key,
      parseComparisonNumber(input.veetiFinancials?.[field.sourceField]),
    );
    const currentValue = normalizeStatementOcrFieldValue(
      field.key,
      parseComparisonNumber(input.currentFinancials?.[field.sourceField]),
    );

    return {
      key: field.key,
      label: field.label,
      veetiValue,
      pdfValue,
      currentValue,
      changedFromVeeti: comparisonValuesDiffer(pdfValue, veetiValue),
      changedFromCurrent: comparisonValuesDiffer(pdfValue, currentValue),
      sourceLine: match?.sourceLine ?? null,
      pageNumber: match?.pageNumber ?? null,
    };
  }).filter(
    (row) =>
      row.pdfValue != null || row.veetiValue != null || row.currentValue != null,
  );
}

function findFieldMatch(
  key: StatementOcrFieldKey,
  label: string,
  patterns: string[],
  lines: ParsedStatementLine[],
  pageNumber: number,
): StatementOcrMatch | null {
  for (const line of lines) {
    if (!lineMatchesPatterns(line, patterns)) {
      continue;
    }
    const value = extractCurrentYearAmount(line.original);
    if (value == null) continue;
    return {
      key,
      label,
      value,
      sourceLine: line.original,
      pageNumber,
    };
  }
  return null;
}

function computeNetFinance(
  lines: ParsedStatementLine[],
): { value: number; sourceLine: string } | null {
  let interestIncome: number | null = null;
  let interestExpense: number | null = null;

  for (const line of lines) {
    if (
      interestIncome == null &&
      (lineMatchesPatterns(line, [
        'ovriga ranteintakter',
        'ovriga rantelnlakter',
        'ovriga ranteinkomster',
      ]) ||
        line.normalized.includes('fran ovriga'))
    ) {
      interestIncome = extractCurrentYearAmount(line.original);
    }
    if (
      interestExpense == null &&
      (lineMatchesPatterns(line, ['rantekostnader', 'rantekastnader']) ||
        line.normalized.includes('till ovriga'))
    ) {
      interestExpense = extractCurrentYearAmount(line.original);
    }
  }

  if (interestIncome == null && interestExpense == null) {
    return null;
  }

  return {
    value: round2((interestIncome ?? 0) + (interestExpense ?? 0)),
    sourceLine: `Interest income ${interestIncome ?? 0}, interest expense ${interestExpense ?? 0}`,
  };
}

function computePersonnelCosts(
  lines: ParsedStatementLine[],
): { value: number; sourceLine: string } | null {
  const startIndex = lines.findIndex((line) =>
    lineMatchesPatterns(line, [
      'personalkostnader',
      'parsonalkostnader',
      'sonalkostnader',
      'onalkostnader',
    ]),
  );
  if (startIndex === -1) {
    return null;
  }

  let endIndex = lines.findIndex(
    (line, index) =>
      index > startIndex &&
      lineMatchesPatterns(line, [
        'avskrivningar',
        'ovriga driftskostnader',
        'ovriga rorelsekostnader',
        'rorelsevinst',
      ]),
  );
  if (endIndex === -1) {
    endIndex = Math.min(lines.length, startIndex + 8);
  }

  let sectionTotal: { value: number; sourceLine: string } | null = null;
  let mostNegativeAmount: { value: number; sourceLine: string } | null = null;

  for (const line of lines.slice(startIndex + 1, endIndex)) {
    const amounts = extractAllAmounts(line.original);
    if (amounts.length === 0) {
      continue;
    }

    if (sectionTotal == null && amounts.length >= 4) {
      const subtotal = amounts[1];
      if (subtotal != null && subtotal < 0) {
        sectionTotal = { value: subtotal, sourceLine: line.original };
      }
    }

    const minimum = amounts.reduce<number | null>(
      (current, value) =>
        current == null || value < current ? value : current,
      null,
    );
    if (
      minimum != null &&
      minimum < 0 &&
      (mostNegativeAmount == null || minimum < mostNegativeAmount.value)
    ) {
      mostNegativeAmount = { value: minimum, sourceLine: line.original };
    }
  }

  return sectionTotal ?? mostNegativeAmount;
}

function findLineAmount(
  lines: ParsedStatementLine[],
  patterns: string[],
  label: string,
  key: StatementOcrFieldKey,
  pageNumber: number,
): StatementOcrMatch | null {
  for (const line of lines) {
    if (!lineMatchesPatterns(line, patterns)) {
      continue;
    }
    const value = extractCurrentYearAmount(line.original);
    if (value == null) {
      continue;
    }
    return {
      key,
      label,
      value,
      sourceLine: line.original,
      pageNumber,
    };
  }
  return null;
}

function extractCurrentYearAmount(line: string): number | null {
  for (const value of extractAllAmounts(line)) {
    return value;
  }
  return null;
}

function extractAllAmounts(line: string): number[] {
  const tokens =
    line.match(/[+-]?\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{2})|[+-]?\d+(?:[.,]\d{2})/g) ??
    [];
  const values: number[] = [];
  for (const token of tokens) {
    const parsed = parseAmountToken(token);
    if (parsed != null) {
      values.push(parsed);
    }
  }
  return values;
}

function parseAmountToken(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.includes('31.12') || raw.includes('1.1')) return null;

  let normalized = raw.replace(/[^\d,.\-\s]/g, '').replace(/\s+/g, '');
  if (!normalized) return null;

  if (normalized.includes(',') && normalized.includes('.')) {
    const decimalSeparator =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
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
    normalized = `${negative ? '-' : ''}${parts
      .slice(0, -1)
      .join('')}.${decimalPart}`;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createParsedStatementLine(line: string): ParsedStatementLine {
  const normalized = normalizeText(line);
  return {
    original: line,
    normalized,
    compact: normalized.replace(/\s+/g, ''),
  };
}

function lineMatchesPatterns(
  line: ParsedStatementLine,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    return (
      line.normalized.includes(normalizedPattern) ||
      line.compact.includes(normalizedPattern.replace(/\s+/g, ''))
    );
  });
}

function parseComparisonNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return round2(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? round2(parsed) : null;
  }
  return null;
}

function comparisonValuesDiffer(left: number | null, right: number | null): boolean {
  if (left == null && right == null) return false;
  if (left == null || right == null) return true;
  return Math.abs(left - right) > 0.005;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
