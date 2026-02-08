/**
 * Full KVA workbook inspection for EXCEL_IMPORT_VA_FULL_PLAN.
 * Prints: exact sheet names, year columns, key label rows, candidate tables,
 * and cell value types (formula/result/richText/string/number).
 *
 * Run: node apps/api/scripts/inspect-kva-full.js (from repo root)
 *      or from apps/api: node scripts/inspect-kva-full.js
 * Requires: fixture at fixtures/Simulering av kommande lönsamhet KVA.xlsx or VA_FIXTURES_DIR
 */
const path = require('path');
const fs = require('fs');

const FIXTURES_DIR = process.env.VA_FIXTURES_DIR
  ? path.isAbsolute(process.env.VA_FIXTURES_DIR)
    ? process.env.VA_FIXTURES_DIR
    : path.join(__dirname, '..', '..', '..', process.env.VA_FIXTURES_DIR)
  : path.join(__dirname, '..', '..', '..', 'fixtures');

const KVA_PATH = path.join(FIXTURES_DIR, 'Simulering av kommande lönsamhet KVA.xlsx');

if (!fs.existsSync(KVA_PATH)) {
  console.error('File not found:', KVA_PATH);
  console.error('Set VA_FIXTURES_DIR or place Simulering av kommande lönsamhet KVA.xlsx in fixtures/');
  process.exit(1);
}

const ExcelJS = require('exceljs');

function cellType(v) {
  if (v == null) return 'empty';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v !== 'object') return 'other';
  if (v.formula != null) return 'formula';
  if (v.result !== undefined) return 'result';
  if (Array.isArray(v.richText)) return 'richText';
  if (typeof v.text === 'string') return 'text';
  return 'object';
}

function getCellText(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v.richText)) return v.richText.map((p) => p.text || '').join('');
  if (typeof v.text === 'string') return v.text;
  if (v.result !== undefined) return getCellText(v.result);
  return String(v);
}

function getRowCellsWithMeta(sheet, rowIndex, maxCols = 14) {
  const row = sheet.getRow(rowIndex);
  const cells = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > maxCols) return;
    const v = cell?.value;
    cells[colNumber - 1] = {
      text: getCellText(v).trim().substring(0, 36),
      type: cellType(v),
    };
  });
  return cells;
}

function getRowCellsText(sheet, rowIndex, maxCols = 14) {
  return getRowCellsWithMeta(sheet, rowIndex, maxCols).map((c) => c.text);
}

const YEAR_RE = /^20\d{2}$/;
function findYearColumns(sheet, maxRows = 30) {
  const years = [];
  const limit = Math.min(sheet.rowCount ?? 0, maxRows);
  for (let r = 1; r <= limit; r++) {
    const cells = getRowCellsWithMeta(sheet, r, 20);
    for (let i = 0; i < cells.length; i++) {
      const t = cells[i].text.replace(/\s/g, '');
      if (YEAR_RE.test(t)) years.push({ row: r, col: i + 1, year: parseInt(t, 10) });
    }
    if (years.length > 5) break;
  }
  return years;
}

const LABELS = {
  budget: /budget|budjetti|talousarvio/i,
  konto: /konto|tili|account/i,
  pris: /pris/i,
  m3: /m³|m3|€\/m³|eur\/m³/i,
  moms: /moms/i,
  vatten: /vatten|vesi/i,
  avlopp: /avlopp|jätevesi|jatevesi/i,
  volume: /förbrukning|volym|m³\/a|m3\/a|uppmätt|mängd/i,
  revenue: /försäljningsintäkter|omsättning|intäkter/i,
  connection: /anslutning|liittym|connection|antal/i,
  inflation: /inflaatio|inflation|index|ökning/i,
  depreciation: /avskrivning|depreciation/i,
  baseFee: /perusmaksu|basavgift|anslutningsavgift/i,
};

function rowMatches(rowText, labelKeys) {
  const lower = rowText.toLowerCase();
  const out = [];
  for (const key of labelKeys) {
    if (LABELS[key] && LABELS[key].test(lower)) out.push(key);
  }
  return out;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(KVA_PATH);

  console.log('=== EXACT SHEET NAMES ===');
  wb.worksheets.forEach((ws, i) => {
    const raw = ws.name ?? '';
    const trimmed = raw.trim();
    console.log(`${i + 1}. raw=${JSON.stringify(raw)} trimmed=${JSON.stringify(trimmed)} rows=${ws.rowCount ?? '?'}`);
  });

  console.log('\n=== YEAR COLUMNS (first 30 rows per sheet) ===');
  for (const sheet of wb.worksheets) {
    const years = findYearColumns(sheet, 30);
    if (years.length) {
      const byRow = {};
      years.forEach(({ row, col, year }) => {
        if (!byRow[row]) byRow[row] = [];
        byRow[row].push({ col, year });
      });
      console.log(`\nSheet: ${JSON.stringify(sheet.name)}`);
      Object.keys(byRow)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((row) => {
          console.log(`  Row ${row}: ${byRow[row].map((y) => `col${y.col}=${y.year}`).join(', ')}`);
        });
    }
  }

  console.log('\n=== KEY LABEL ROWS (per sheet, first 120 rows) ===');
  const labelKeys = Object.keys(LABELS);
  for (const sheet of wb.worksheets) {
    const limit = Math.min(sheet.rowCount ?? 0, 120);
    const matches = [];
    for (let r = 1; r <= limit; r++) {
      const cells = getRowCellsText(sheet, r, 12);
      const rowText = cells.join(' ');
      const matched = rowMatches(rowText, labelKeys);
      if (matched.length) {
        const first8 = cells.slice(0, 8);
        matches.push({ row: r, labels: matched, cells: first8 });
      }
    }
    if (matches.length) {
      console.log(`\nSheet: ${JSON.stringify(sheet.name)}`);
      matches.forEach(({ row, labels, cells }) => {
        console.log(`  R${row} [${labels.join(',')}]: ${cells.join(' | ')}`);
      });
    }
  }

  console.log('\n=== CANDIDATE TABLES (cell types: formula/result/richText/string/number) ===');
  const tables = [
    { sheet: 'Blad1', hint: 'Budget block', rowStart: 74, rowEnd: 92, cols: 6 },
    { sheet: 'KVA totalt', hint: 'Price table', rowStart: 52, rowEnd: 62, cols: 8 },
    { sheet: 'Vatten KVA', hint: 'Volume/revenue', rowStart: 1, rowEnd: 15, cols: 8 },
    { sheet: 'Avlopp KVA', hint: 'Volume/revenue', rowStart: 1, rowEnd: 15, cols: 8 },
    { sheet: 'Anslutningar', hint: 'Connections', rowStart: 1, rowEnd: 15, cols: 12 },
    { sheet: 'Avskrivningar', hint: 'Depreciation', rowStart: 1, rowEnd: 25, cols: 8 },
    { sheet: 'Boksluten', hint: 'Actuals (out of scope)', rowStart: 1, rowEnd: 20, cols: 8 },
  ];
  for (const t of tables) {
    const sheet = wb.worksheets.find((s) => (s.name || '').trim() === t.sheet || (s.name || '').trim() === t.sheet.trim());
    if (!sheet) continue;
    console.log(`\n--- ${t.sheet}: ${t.hint} (rows ${t.rowStart}-${t.rowEnd}) ---`);
    for (let r = t.rowStart; r <= t.rowEnd; r++) {
      const cells = getRowCellsWithMeta(sheet, r, t.cols);
      const line = cells.map((c, i) => `${c.text}[${c.type}]`).join(' | ');
      if (line.trim()) console.log(`  R${r}: ${line}`);
    }
  }

  console.log('\n=== BUDGET BLOCK CANDIDATES (Blad1 rows with numeric account pattern) ===');
  const blad1 = wb.worksheets.find((s) => (s.name || '').trim() === 'Blad1');
  if (blad1) {
    for (let r = 74; r <= 95; r++) {
      const cells = getRowCellsWithMeta(blad1, r, 6);
      const first = cells[0];
      const isAccount = first && /^\d{3,6}$/.test(String(first.text).trim());
      if (cells.some((c) => c.text) || isAccount) {
        const line = cells.map((c) => `${c.text}[${c.type}]`).join(' | ');
        console.log(`  R${r}: ${line}`);
      }
    }
  }

  console.log('\n=== DONE ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
