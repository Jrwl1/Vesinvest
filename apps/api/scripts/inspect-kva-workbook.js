/**
 * One-off script to inspect KVA workbook structure. Run from apps/api:
 *   node scripts/inspect-kva-workbook.js
 * Requires: fixtures/Simulering av kommande lönsamhet KVA.xlsx (or VA_FIXTURES_DIR)
 */
const path = require('path');
const fs = require('fs');

// From apps/api: repo root is ../..
const FIXTURES_DIR = process.env.VA_FIXTURES_DIR
  ? path.isAbsolute(process.env.VA_FIXTURES_DIR)
    ? process.env.VA_FIXTURES_DIR
    : path.join(process.cwd(), '..', '..', process.env.VA_FIXTURES_DIR)
  : path.join(process.cwd(), '..', '..', 'fixtures');

const KVA_PATH = path.join(FIXTURES_DIR, 'Simulering av kommande lönsamhet KVA.xlsx');

if (!fs.existsSync(KVA_PATH)) {
  console.error('File not found:', KVA_PATH);
  process.exit(1);
}

const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(KVA_PATH);

  console.log('=== SHEET NAMES ===');
  wb.worksheets.forEach((ws, i) => {
    console.log(`${i + 1}. "${ws.name}" (rows: ${ws.rowCount ?? '?'})`);
  });

  for (const sheet of wb.worksheets) {
    const rowCount = Math.min(sheet.rowCount ?? 0, 250);
    console.log('\n=== SHEET:', sheet.name, '=== (first', rowCount, 'rows, first 12 cols)');
    for (let r = 1; r <= rowCount; r++) {
      const row = sheet.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 12) {
          let v = cell?.value;
          if (v != null && typeof v === 'object' && v.result !== undefined) v = v.result;
          cells[colNumber - 1] = v == null ? '' : String(v).substring(0, 30);
        }
      });
      const line = cells.map((c, i) => (c ?? '').padEnd(18)).join(' | ');
      if (line.trim() || r <= 60) console.log(`R${r.toString().padStart(3)}: ${line}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
