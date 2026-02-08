/**
 * Inspect KVA workbook for revenue-driver tables (price, volume, connections).
 * Run from apps/api: node scripts/inspect-kva-revenue.js
 * Requires: fixtures/Simulering av kommande lönsamhet KVA.xlsx (or VA_FIXTURES_DIR)
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
  process.exit(1);
}

const ExcelJS = require('exceljs');

function getRowCells(sheet, rowIndex) {
  const row = sheet.getRow(rowIndex);
  const cells = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    let v = cell?.value;
    if (v != null && typeof v === 'object' && v.result !== undefined) v = v.result;
    cells[colNumber - 1] = v == null ? '' : String(v).trim();
  });
  return cells;
}

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SHEETS_TO_INSPECT = ['KVA totalt', 'Blad1', 'Vatten KVA', 'Avlopp KVA', 'Anslutningar', 'Boksluten '];
const MAX_ROWS = 250;
const MAX_CELLS = 8;

// Price: pris and (€/m³ or eur/m³ or m3) or moms
function isPriceCandidate(cells) {
  const rowText = cells.map(normalize).join(' ');
  const hasPris = rowText.includes('pris');
  const hasM3 = /€\/m³|eur\/m³|m3|m³/.test(rowText);
  const hasMoms = rowText.includes('moms');
  return (hasPris && hasM3) || hasMoms;
}

// Vatten / Avlopp
function isVattenAvlopp(cells) {
  const rowText = cells.map(normalize).join(' ');
  return /vatten|avlopp|vesi|jätevesi|jatevesi/.test(rowText);
}

// Volume labels
const VOLUME_RE = /m³|m3|mängd|volym|såld|förbruk|uppmätt|försäljning|myyty|volume/i;
function isVolumeCandidate(cells) {
  return cells.some((c) => VOLUME_RE.test(normalize(c)));
}

// Connection labels
const CONNECTION_RE = /anslut|liittym|connection|kpl|antal/i;
function isConnectionCandidate(cells) {
  return cells.some((c) => CONNECTION_RE.test(normalize(c)));
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(KVA_PATH);

  console.log('=== SHEET NAMES (exact) ===');
  wb.worksheets.forEach((ws, i) => {
    const name = ws.name ?? '';
    console.log(`${i + 1}. ${JSON.stringify(name)} (rows: ${ws.rowCount ?? '?'})`);
  });

  for (const sheet of wb.worksheets) {
    const sheetName = (sheet.name ?? '').trim() || sheet.name || 'Sheet';
    if (!SHEETS_TO_INSPECT.includes(sheet.name) && !SHEETS_TO_INSPECT.includes(sheetName)) continue;

    const rowCount = Math.min(sheet.rowCount ?? 0, MAX_ROWS);
    const candidates = { price: [], vattenAvlopp: [], volume: [], connection: [] };

    for (let r = 1; r <= rowCount; r++) {
      const cells = getRowCells(sheet, r);
      const first8 = cells.slice(0, MAX_CELLS).map((c) => (c ?? '').substring(0, 24));
      const rowKey = `R${r}`;
      if (isPriceCandidate(cells)) candidates.price.push({ row: r, cells: first8 });
      if (isVattenAvlopp(cells)) candidates.vattenAvlopp.push({ row: r, cells: first8 });
      if (isVolumeCandidate(cells)) candidates.volume.push({ row: r, cells: first8 });
      if (isConnectionCandidate(cells)) candidates.connection.push({ row: r, cells: first8 });
    }

    console.log('\n=== SHEET:', JSON.stringify(sheet.name), '===');
    if (candidates.price.length) {
      console.log('  Price-like rows (pris+m3/moms):');
      candidates.price.forEach(({ row, cells }) => {
        console.log(`    ${row}: ${cells.join(' | ')}`);
      });
    }
    if (candidates.vattenAvlopp.length) {
      console.log('  Vatten/Avlopp rows:');
      candidates.vattenAvlopp.forEach(({ row, cells }) => {
        console.log(`    ${row}: ${cells.join(' | ')}`);
      });
    }
    if (candidates.volume.length) {
      console.log('  Volume-like rows:');
      candidates.volume.forEach(({ row, cells }) => {
        console.log(`    ${row}: ${cells.join(' | ')}`);
      });
    }
    if (candidates.connection.length) {
      console.log('  Connection-like rows:');
      candidates.connection.forEach(({ row, cells }) => {
        console.log(`    ${row}: ${cells.join(' | ')}`);
      });
    }
    if (
      !candidates.price.length &&
      !candidates.vattenAvlopp.length &&
      !candidates.volume.length &&
      !candidates.connection.length
    ) {
      console.log('  (no candidates)');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
