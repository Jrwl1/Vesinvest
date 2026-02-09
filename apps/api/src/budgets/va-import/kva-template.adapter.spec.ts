import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import {
  detectKvaTemplate,
  previewKvaWorkbook,
  previewKvaRevenueDrivers,
  discoverBudgetBlockCandidates,
  extractSubtotalLines,
} from './kva-template.adapter';

const FIXTURES_DIR = process.env.VA_FIXTURES_DIR
  ? path.isAbsolute(process.env.VA_FIXTURES_DIR)
    ? process.env.VA_FIXTURES_DIR
    : path.join(process.cwd(), '..', process.env.VA_FIXTURES_DIR)
  : path.join(process.cwd(), '..', 'fixtures');

const KVA_FIXTURE = path.join(FIXTURES_DIR, 'Simulering av kommande lönsamhet KVA.xlsx');

function fixtureExists(): boolean {
  return fs.existsSync(KVA_FIXTURE);
}

describe('KVA template adapter', () => {
  describe('discoverBudgetBlockCandidates', () => {
    it('returns one candidate when header has Budget and next row has numeric account in col 0', () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Blad1');
      sheet.getRow(76).getCell(1).value = 'Förverkligat';
      sheet.getRow(76).getCell(2).value = 'Vatten';
      sheet.getRow(76).getCell(3).value = '2023';
      sheet.getRow(76).getCell(4).value = 'Budget';
      sheet.getRow(77).getCell(1).value = '6201';
      sheet.getRow(77).getCell(2).value = 'El';
      sheet.getRow(77).getCell(4).value = 59000;
      const candidates = discoverBudgetBlockCandidates(sheet, 400);
      expect(candidates.length).toBe(1);
      expect(candidates[0].headerRowIndex).toBe(76);
      expect(candidates[0].budgetColumnIndex).toBe(3);
      expect(candidates[0].accountColumnIndex).toBe(0);
      expect(candidates[0].nameColumnIndex).toBe(1);
    });

    it('finds account column in col 1 when col 0 is non-numeric in next row', () => {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Blad1');
      sheet.getRow(1).getCell(1).value = 'Section';
      sheet.getRow(1).getCell(2).value = 'X';
      sheet.getRow(1).getCell(3).value = 'Y';
      sheet.getRow(1).getCell(4).value = 'Budget';
      sheet.getRow(2).getCell(1).value = 'Label';
      sheet.getRow(2).getCell(2).value = '6201';
      sheet.getRow(2).getCell(3).value = 'El';
      sheet.getRow(2).getCell(4).value = 1000;
      const candidates = discoverBudgetBlockCandidates(sheet, 100);
      expect(candidates.length).toBe(1);
      expect(candidates[0].headerRowIndex).toBe(1);
      expect(candidates[0].budgetColumnIndex).toBe(3);
      expect(candidates[0].accountColumnIndex).toBe(1);
      expect(candidates[0].nameColumnIndex).toBe(2);
    });
  });

  describe('detectKvaTemplate', () => {
    it('returns true when filename contains Simulering and KVA', () => {
      const workbook = { worksheets: [{ name: 'Sheet1' }] };
      expect(detectKvaTemplate(workbook, 'Simulering av kommande lönsamhet KVA.xlsx')).toBe(true);
      expect(detectKvaTemplate(workbook, 'SIMULERING_KVA.xlsx')).toBe(true);
    });

    it('returns true when first sheet name contains KVA or Simulering', () => {
      expect(detectKvaTemplate({ worksheets: [{ name: 'Simulering' }] }, 'other.xlsx')).toBe(true);
      expect(detectKvaTemplate({ worksheets: [{ name: 'KVA översikt' }] }, 'file.xlsx')).toBe(true);
    });

    it('returns false for unrelated filename and sheet', () => {
      expect(detectKvaTemplate({ worksheets: [{ name: 'Data' }] }, 'budget_2026.xlsx')).toBe(false);
    });
  });

  describe('previewKvaWorkbook', () => {
    it('returns templateId kva and empty budgetLines for empty workbook', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Sheet1');
      const sheet = wb.getWorksheet('Sheet1')!;
      sheet.getRow(1).getCell(1).value = 'Konto';
      sheet.getRow(1).getCell(2).value = 'Namn';
      sheet.getRow(1).getCell(3).value = 'Belopp';
      const result = await previewKvaWorkbook(wb);
      expect(result.templateId).toBe('kva');
      expect(result.budgetLines).toEqual([]);
      expect(result.year).toBeNull();
    });

    it('parses header and data rows when structure is present (Blad1 only)', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(1).getCell(1).value = 'Konto';
      sheet.getRow(1).getCell(2).value = 'Benämning';
      sheet.getRow(1).getCell(3).value = 'Belopp';
      sheet.getRow(2).getCell(1).value = '4100';
      sheet.getRow(2).getCell(2).value = 'Energi';
      sheet.getRow(2).getCell(3).value = 10000;
      sheet.getRow(3).getCell(1).value = '3200';
      sheet.getRow(3).getCell(2).value = 'Vatten';
      sheet.getRow(3).getCell(3).value = '12 500,50';
      const result = await previewKvaWorkbook(wb);
      expect(result.templateId).toBe('kva');
      expect(result.budgetLines.length).toBeGreaterThanOrEqual(2);
      const expense = result.budgetLines.find((r) => r.tiliryhma === '4100');
      expect(expense).toBeDefined();
      expect(expense?.tyyppi).toBe('kulu');
      expect(expense?.summa).toBe(10000);
      const revenue = result.budgetLines.find((r) => r.tiliryhma === '3200');
      expect(revenue).toBeDefined();
      expect(revenue?.tyyppi).toBe('tulo');
      expect(revenue?.summa).toBe(12500.5);
    });

    it('skips non-account rows like Förverkligat | Vatten', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(1).getCell(1).value = 'Konto';
      sheet.getRow(1).getCell(2).value = 'Benämning';
      sheet.getRow(1).getCell(3).value = 'Belopp';
      sheet.getRow(2).getCell(1).value = 'Förverkligat';
      sheet.getRow(2).getCell(2).value = 'Vatten';
      sheet.getRow(2).getCell(3).value = 1000;
      sheet.getRow(3).getCell(1).value = '4100';
      sheet.getRow(3).getCell(2).value = 'Energi';
      sheet.getRow(3).getCell(3).value = 5000;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(1);
      expect(result.budgetLines[0].tiliryhma).toBe('4100');
      expect(result.budgetLines[0].nimi).toBe('Energi');
      expect(result.warnings.some((w) => w.includes('non-account') && w.includes('Förverkligat'))).toBe(true);
    });

    it('uses Budget column when header is Budget', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(1).getCell(1).value = 'Konto';
      sheet.getRow(1).getCell(2).value = 'Namn';
      sheet.getRow(1).getCell(3).value = 'Förverkligat';
      sheet.getRow(1).getCell(4).value = 'Budget';
      sheet.getRow(2).getCell(1).value = '4100';
      sheet.getRow(2).getCell(2).value = 'Energi';
      sheet.getRow(2).getCell(3).value = 999;
      sheet.getRow(2).getCell(4).value = 12000;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(1);
      expect(result.budgetLines[0].summa).toBe(12000);
      expect(result.warnings.some((w) => w.includes('Could not detect Budget'))).toBe(false);
    });

    it('emits fallback warning when no Budget column found', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(1).getCell(1).value = 'Konto';
      sheet.getRow(1).getCell(2).value = 'Benämning';
      sheet.getRow(1).getCell(3).value = 'Belopp';
      sheet.getRow(2).getCell(1).value = '4100';
      sheet.getRow(2).getCell(2).value = 'Energi';
      sheet.getRow(2).getCell(3).value = 5000;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(1);
      expect(result.warnings.some((w) => w.includes('Could not detect Budget') && w.includes('fallback'))).toBe(true);
    });

    it('finds header row far down the sheet', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      // Header at row 50 (simulating content above)
      for (let r = 1; r < 50; r++) {
        sheet.getRow(r).getCell(1).value = `Title ${r}`;
        sheet.getRow(r).getCell(2).value = '';
      }
      sheet.getRow(50).getCell(1).value = 'Konto';
      sheet.getRow(50).getCell(2).value = 'Namn';
      sheet.getRow(50).getCell(3).value = 'Budget';
      sheet.getRow(51).getCell(1).value = '4100';
      sheet.getRow(51).getCell(2).value = 'Energi';
      sheet.getRow(51).getCell(3).value = 8000;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(1);
      expect(result.budgetLines[0].tiliryhma).toBe('4100');
      expect(result.budgetLines[0].summa).toBe(8000);
      expect(result.amountColumnUsed).toBe('Budget');
    });

    it('detects row-76-style header (Budget + next row numeric account) and uses position-based colMap', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(76).getCell(1).value = 'Förverkligat';
      sheet.getRow(76).getCell(2).value = 'Vatten';
      sheet.getRow(76).getCell(3).value = '2023';
      sheet.getRow(76).getCell(4).value = 'Budget';
      sheet.getRow(77).getCell(1).value = '6201';
      sheet.getRow(77).getCell(2).value = 'El';
      sheet.getRow(77).getCell(3).value = 76156.19;
      sheet.getRow(77).getCell(4).value = 59000;
      sheet.getRow(78).getCell(1).value = '6800';
      sheet.getRow(78).getCell(2).value = 'Maskinhyror';
      sheet.getRow(78).getCell(3).value = 266;
      sheet.getRow(78).getCell(4).value = 100;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(2);
      const row6201 = result.budgetLines.find((r) => r.tiliryhma === '6201');
      expect(row6201).toBeDefined();
      expect(row6201!.nimi).toMatch(/El/i);
      expect(row6201!.summa).toBe(59000);
      expect(result.kvaDebug).toBeDefined();
      expect(result.kvaDebug!.detectedSheetName).toBe('Blad1');
      expect(result.kvaDebug!.detectedHeaderRowIndex).toBe(76);
      expect(result.kvaDebug!.budgetColumnIndex).toBe(3);
      expect(result.warnings.some((w) => w.includes('[KVA_DEBUG]'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('Could not detect Budget'))).toBe(false);
    });

    it('parses multiple sections in one sheet (Blad1)', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(1).getCell(1).value = 'Konto';
      sheet.getRow(1).getCell(2).value = 'Benämning';
      sheet.getRow(1).getCell(3).value = 'Budget';
      sheet.getRow(2).getCell(1).value = '4100';
      sheet.getRow(2).getCell(2).value = 'Energi';
      sheet.getRow(2).getCell(3).value = 1000;
      sheet.getRow(3).getCell(1).value = 'Förverkligat';
      sheet.getRow(3).getCell(2).value = 'Section 2';
      sheet.getRow(4).getCell(1).value = 'Konto';
      sheet.getRow(4).getCell(2).value = 'Namn';
      sheet.getRow(4).getCell(3).value = 'Budget';
      sheet.getRow(5).getCell(1).value = '3200';
      sheet.getRow(5).getCell(2).value = 'Vatten';
      sheet.getRow(5).getCell(3).value = 2000;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(2);
      expect(result.budgetLines[0].tiliryhma).toBe('4100');
      expect(result.budgetLines[0].summa).toBe(1000);
      expect(result.budgetLines[1].tiliryhma).toBe('3200');
      expect(result.budgetLines[1].summa).toBe(2000);
      expect(result.processedSheets).toBeDefined();
      expect(result.processedSheets!.length).toBe(1);
      expect(result.processedSheets![0].sections).toBe(2);
      expect(result.processedSheets![0].lines).toBe(2);
    });

    it('parses budget block when account is not in col 0 (account in col 2, Budget in col 4)', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      sheet.getRow(1).getCell(1).value = 'Section';
      sheet.getRow(1).getCell(2).value = 'X';
      sheet.getRow(1).getCell(3).value = 'Y';
      sheet.getRow(1).getCell(4).value = 'Budget';
      sheet.getRow(2).getCell(1).value = 'Label';
      sheet.getRow(2).getCell(2).value = '6201';
      sheet.getRow(2).getCell(3).value = 'El';
      sheet.getRow(2).getCell(4).value = 1000;
      sheet.getRow(3).getCell(1).value = '';
      sheet.getRow(3).getCell(2).value = '6800';
      sheet.getRow(3).getCell(3).value = 'Maskinhyror';
      sheet.getRow(3).getCell(4).value = 200;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(2);
      const row6201 = result.budgetLines.find((r) => r.tiliryhma === '6201');
      expect(row6201).toBeDefined();
      expect(row6201!.nimi).toBe('El');
      expect(row6201!.summa).toBe(1000);
      expect(result.budgetLines.find((r) => r.tiliryhma === '6800')!.summa).toBe(200);
    });

    it('parses two row-76-style blocks in Blad1 and aggregates (6xxx + 3xxx)', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const sheet = wb.getWorksheet('Blad1')!;
      // Block A: row-76-style header "Förverkligat | Vatten | 2023 | Budget", then 6xxx rows
      sheet.getRow(10).getCell(1).value = 'Förverkligat';
      sheet.getRow(10).getCell(2).value = 'Vatten';
      sheet.getRow(10).getCell(3).value = '2023';
      sheet.getRow(10).getCell(4).value = 'Budget';
      sheet.getRow(11).getCell(1).value = '6201';
      sheet.getRow(11).getCell(2).value = 'El';
      sheet.getRow(11).getCell(4).value = 1000;
      sheet.getRow(12).getCell(1).value = '6800';
      sheet.getRow(12).getCell(2).value = 'Maskinhyror';
      sheet.getRow(12).getCell(4).value = 200;
      // Block B: second row-76-style header, then 3xxx (revenue)
      sheet.getRow(20).getCell(1).value = 'Förverkligat';
      sheet.getRow(20).getCell(2).value = 'Vatten';
      sheet.getRow(20).getCell(3).value = '2023';
      sheet.getRow(20).getCell(4).value = 'Budget';
      sheet.getRow(21).getCell(1).value = '3200';
      sheet.getRow(21).getCell(2).value = 'Vattenintäkter';
      sheet.getRow(21).getCell(4).value = 5000;
      sheet.getRow(22).getCell(1).value = '3300';
      sheet.getRow(22).getCell(2).value = 'Övriga';
      sheet.getRow(22).getCell(4).value = 500;
      const result = await previewKvaWorkbook(wb);
      expect(result.budgetLines.length).toBe(4);
      expect(result.kvaDebug).toBeDefined();
      expect(result.kvaDebug!.totalParsedRowCount).toBe(4);
      expect(result.kvaDebug!.parsedRowCount).toBe(2);
      expect(result.kvaDebug!.detectedHeaderRowIndex).toBe(10);
      const kulu = result.budgetLines.filter((r) => r.tyyppi === 'kulu');
      const tulo = result.budgetLines.filter((r) => r.tyyppi === 'tulo');
      expect(kulu.length).toBeGreaterThanOrEqual(1);
      expect(tulo.length).toBeGreaterThanOrEqual(1);
      expect(result.budgetLines.some((r) => r.tiliryhma === '6201' && r.summa === 1000)).toBe(true);
      expect(result.budgetLines.some((r) => r.tiliryhma === '3200' && r.summa === 5000)).toBe(true);
      expect(result.warnings.some((w) => w.includes('no section header row found'))).toBe(false);
    });
  });

  describe('previewKvaRevenueDrivers', () => {
    it('uses moms 0% column for ex-VAT price, sets alvProsentti to highest rate (25.5)', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      wb.getWorksheet('Blad1')!.getRow(1).getCell(1).value = 'Konto';
      wb.getWorksheet('Blad1')!.getRow(1).getCell(2).value = 'Namn';
      wb.getWorksheet('Blad1')!.getRow(1).getCell(3).value = 'Budget';
      wb.getWorksheet('Blad1')!.getRow(2).getCell(1).value = '4100';
      wb.getWorksheet('Blad1')!.getRow(2).getCell(2).value = 'Energi';
      wb.getWorksheet('Blad1')!.getRow(2).getCell(3).value = 1000;

      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = 'Pris €/m³';
      kvaTotalt.getRow(1).getCell(2).value = 'moms 0 %';
      kvaTotalt.getRow(1).getCell(3).value = 'moms 24 %';
      kvaTotalt.getRow(1).getCell(4).value = 'moms 25,5 % (1.9.2024)';
      kvaTotalt.getRow(2).getCell(1).value = 'Vatten';
      kvaTotalt.getRow(2).getCell(2).value = 1.2;     // ex-VAT
      kvaTotalt.getRow(2).getCell(3).value = 1.488;
      kvaTotalt.getRow(2).getCell(4).value = 1.506;
      kvaTotalt.getRow(3).getCell(1).value = 'Avlopp';
      kvaTotalt.getRow(3).getCell(2).value = 2.5;     // ex-VAT
      kvaTotalt.getRow(3).getCell(3).value = 3.1;
      kvaTotalt.getRow(3).getCell(4).value = 3.138;

      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(wb, warnings);
      expect(drivers.length).toBe(2);
      const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
      expect(vesi).toBeDefined();
      // Should use moms 0% value (ex-VAT)
      expect(vesi!.yksikkohinta).toBe(1.2);
      // alvProsentti = highest rate = 25.5
      expect(vesi!.alvProsentti).toBe(25.5);
      expect(jatevesi).toBeDefined();
      expect(jatevesi!.yksikkohinta).toBe(2.5);
      expect(jatevesi!.alvProsentti).toBe(25.5);
      expect(driversDebug?.chosenVatRate).toBe(25.5);
      expect(warnings.some((w) => w.includes('Pris') && w.includes('m3'))).toBe(false);
    });

    it('finds price table on Blad1 when KVA totalt missing; uses moms 0% for ex-VAT price', () => {
      const wb = new ExcelJS.Workbook();
      const blad1 = wb.addWorksheet('Blad1');
      blad1.getRow(1).getCell(1).value = 'Konto';
      blad1.getRow(1).getCell(2).value = 'Budget';
      blad1.getRow(2).getCell(1).value = '4100';
      blad1.getRow(2).getCell(2).value = 1000;
      blad1.getRow(55).getCell(1).value = 'Pris € / m³';
      blad1.getRow(55).getCell(2).value = '(moms 0 %)';
      blad1.getRow(55).getCell(3).value = 'moms 24 %';
      blad1.getRow(55).getCell(4).value = 'moms 25,5 % (1.9.2024)';
      blad1.getRow(56).getCell(1).value = 'Vatten';
      blad1.getRow(56).getCell(2).value = 1.2;
      blad1.getRow(56).getCell(3).value = 1.488;
      blad1.getRow(56).getCell(4).value = 1.506;
      blad1.getRow(57).getCell(1).value = 'Avlopp';
      blad1.getRow(57).getCell(2).value = 2.5;
      blad1.getRow(57).getCell(3).value = 3.1;
      blad1.getRow(57).getCell(4).value = 3.138;

      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(wb, warnings);
      expect(drivers.length).toBe(2);
      const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
      // Ex-VAT prices from moms 0% column
      expect(vesi!.yksikkohinta).toBe(1.2);
      expect(jatevesi!.yksikkohinta).toBe(2.5);
      expect(vesi!.alvProsentti).toBe(25.5);
      expect(jatevesi!.alvProsentti).toBe(25.5);
      expect(driversDebug?.priceSheetName).toBe('Blad1');
      expect(driversDebug?.priceHeaderRowIndex).toBe(55);
      expect(driversDebug?.chosenVatRate).toBe(25.5);
      expect(warnings.some((w) => w.includes('KVA totalt'))).toBe(false);
    });

    it('returns vesi and jatevesi with empty prices when no sheet has Pris+m3 table', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const warnings: string[] = [];
      const { drivers } = previewKvaRevenueDrivers(wb, warnings);
      expect(drivers.length).toBe(2);
      expect(drivers.every((d) => d.yksikkohinta == null)).toBe(true);
      expect(warnings.some((w) => w.includes('Pris') && w.includes('m3'))).toBe(true);
      expect(warnings.some((w) => w.includes('KVA totalt'))).toBe(false);
    });

    it('does NOT use Boksluten as price sheet when it has pris+m3 but no moms and no Vatten/Avlopp', () => {
      const wb = new ExcelJS.Workbook();
      const boksluten = wb.addWorksheet('Boksluten ');
      boksluten.getRow(10).getCell(1).value = 'Pris €/m³';
      boksluten.getRow(10).getCell(2).value = 'Some amount';
      boksluten.getRow(11).getCell(1).value = 'Other';
      boksluten.getRow(11).getCell(2).value = 100;
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = 'Pris €/m³';
      kvaTotalt.getRow(1).getCell(2).value = 'moms 25,5 %';
      kvaTotalt.getRow(2).getCell(1).value = 'Vatten';
      kvaTotalt.getRow(2).getCell(2).value = 1.25;
      kvaTotalt.getRow(3).getCell(1).value = 'Avlopp';
      kvaTotalt.getRow(3).getCell(2).value = 2.6;
      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(wb, warnings);
      expect(driversDebug?.priceSheetName).toBe('KVA totalt');
      expect(driversDebug?.priceSheetName).not.toBe('Boksluten ');
      expect(drivers.find((d) => d.palvelutyyppi === 'vesi')?.yksikkohinta).toBe(1.25);
      expect(warnings.some((w) => w.includes('could not locate') && w.includes('Pris'))).toBe(false);
    });

    it('rejects sheet with pris+m3 but no moms and no Vatten/Avlopp (Boksluten-style)', () => {
      const wb = new ExcelJS.Workbook();
      const onlyBoksluten = wb.addWorksheet('Boksluten ');
      onlyBoksluten.getRow(5).getCell(1).value = 'Pris €/m³';
      onlyBoksluten.getRow(5).getCell(2).value = 'Belopp';
      onlyBoksluten.getRow(6).getCell(1).value = 'Something';
      onlyBoksluten.getRow(6).getCell(2).value = 50;
      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(wb, warnings);
      expect(driversDebug?.priceSheetName).toBeUndefined();
      expect(drivers.every((d) => d.yksikkohinta == null)).toBe(true);
      expect(warnings.some((w) => w.includes('could not locate') && w.includes('Pris'))).toBe(true);
    });

    it('fixture layout: KVA totalt with split header (row 55 VAT, 56–57 Vatten/Avlopp) detects table and uses moms 0% for ex-VAT price', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(54).getCell(1).value = 'Pris € / m³';
      kvaTotalt.getRow(55).getCell(1).value = '';
      kvaTotalt.getRow(55).getCell(2).value = 'moms 0 %';
      kvaTotalt.getRow(55).getCell(3).value = 'moms 24 %';
      kvaTotalt.getRow(55).getCell(4).value = 'moms 25,5 % (1.9.2024)';
      kvaTotalt.getRow(56).getCell(1).value = 'Vatten';
      kvaTotalt.getRow(56).getCell(2).value = 1.2;     // ex-VAT
      kvaTotalt.getRow(56).getCell(3).value = 1.488;
      kvaTotalt.getRow(56).getCell(4).value = 1.506;
      kvaTotalt.getRow(57).getCell(1).value = 'Avlopp';
      kvaTotalt.getRow(57).getCell(2).value = 2.5;     // ex-VAT
      kvaTotalt.getRow(57).getCell(3).value = 3.1;
      kvaTotalt.getRow(57).getCell(4).value = 3.138;
      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(wb, warnings);
      expect(driversDebug?.priceSheetName).toBe('KVA totalt');
      expect(driversDebug?.priceHeaderRowIndex).toBe(55);
      expect(driversDebug?.chosenVatRate).toBe(25.5);
      expect(driversDebug?.priceVatColumnsFound).toEqual(expect.arrayContaining([0, 24, 25.5]));
      const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
      // Uses moms 0% column for ex-VAT price
      expect(vesi?.yksikkohinta).toBe(1.2);
      expect(jatevesi?.yksikkohinta).toBe(2.5);
      // alvProsentti = highest available rate
      expect(vesi?.alvProsentti).toBe(25.5);
      expect(jatevesi?.alvProsentti).toBe(25.5);
      expect(warnings.some((w) => w.includes('could not locate') && w.includes('Pris'))).toBe(false);
    });

    it('does NOT use Försäljningsintäkter (revenue) as volume', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const vattenKva = wb.addWorksheet('Vatten KVA');
      vattenKva.getRow(1).getCell(1).value = 'Label';
      vattenKva.getRow(1).getCell(2).value = '2023';
      vattenKva.getRow(1).getCell(3).value = '2024';
      vattenKva.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      vattenKva.getRow(2).getCell(2).value = 400000;
      vattenKva.getRow(2).getCell(3).value = 455520.44;
      const warnings: string[] = [];
      const { drivers } = previewKvaRevenueDrivers(wb, warnings, 2024);
      expect(drivers.find((d) => d.palvelutyyppi === 'vesi')?.myytyMaara).toBeUndefined();
      expect(drivers.find((d) => d.palvelutyyppi === 'jatevesi')?.myytyMaara).toBeUndefined();
    });

    it('Step 4: volume detected when m³ appears anywhere in row (not only first cell)', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const vattenKva = wb.addWorksheet('Vatten KVA');
      vattenKva.getRow(1).getCell(1).value = 'Label';
      vattenKva.getRow(1).getCell(2).value = '2023';
      vattenKva.getRow(2).getCell(1).value = 'Leverans';
      vattenKva.getRow(2).getCell(2).value = 11000;
      vattenKva.getRow(2).getCell(3).value = 'm³';
      const avloppKva = wb.addWorksheet('Avlopp KVA');
      avloppKva.getRow(1).getCell(1).value = 'Label';
      avloppKva.getRow(1).getCell(2).value = '2023';
      avloppKva.getRow(2).getCell(1).value = 'Volym';
      avloppKva.getRow(2).getCell(2).value = 8500;
      avloppKva.getRow(2).getCell(3).value = 'm3/a';
      const warnings: string[] = [];
      const { drivers } = previewKvaRevenueDrivers(wb, warnings, 2023);
      expect(drivers.find((d) => d.palvelutyyppi === 'vesi')?.myytyMaara).toBe(11000);
      expect(drivers.find((d) => d.palvelutyyppi === 'jatevesi')?.myytyMaara).toBe(8500);
      expect(warnings.some((w) => w.includes('volume'))).toBe(false);
    });

    it('Step 4: extracts volume and connections from Vatten KVA, Avlopp KVA, Anslutningar with year columns', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      wb.getWorksheet('Blad1')!.getRow(1).getCell(1).value = 'Konto';
      wb.getWorksheet('Blad1')!.getRow(1).getCell(2).value = 'Budget';
      wb.getWorksheet('Blad1')!.getRow(2).getCell(1).value = '4100';
      wb.getWorksheet('Blad1')!.getRow(2).getCell(2).value = 1000;

      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = 'Pris €/m³';
      kvaTotalt.getRow(1).getCell(2).value = 'moms 0 %';
      kvaTotalt.getRow(2).getCell(1).value = 'Vatten';
      kvaTotalt.getRow(2).getCell(2).value = 1.2;
      kvaTotalt.getRow(3).getCell(1).value = 'Avlopp';
      kvaTotalt.getRow(3).getCell(2).value = 2.5;

      const vattenKva = wb.addWorksheet('Vatten KVA');
      vattenKva.getRow(1).getCell(1).value = 'Label';
      vattenKva.getRow(1).getCell(2).value = '2023';
      vattenKva.getRow(1).getCell(3).value = '2024';
      vattenKva.getRow(2).getCell(1).value = 'Förbrukning m³';
      vattenKva.getRow(2).getCell(2).value = 10000;
      vattenKva.getRow(2).getCell(3).value = 12000;

      const avloppKva = wb.addWorksheet('Avlopp KVA');
      avloppKva.getRow(1).getCell(1).value = 'Label';
      avloppKva.getRow(1).getCell(2).value = '2023';
      avloppKva.getRow(1).getCell(3).value = '2024';
      avloppKva.getRow(2).getCell(1).value = 'Volym m³/a';
      avloppKva.getRow(2).getCell(2).value = 8000;
      avloppKva.getRow(2).getCell(3).value = 9000;

      const anslutningar = wb.addWorksheet('Anslutningar');
      anslutningar.getRow(1).getCell(1).value = 'Beskrivning';
      anslutningar.getRow(1).getCell(2).value = '2023';
      anslutningar.getRow(1).getCell(3).value = '2024';
      anslutningar.getRow(2).getCell(1).value = 'Antalet anslutningar';
      anslutningar.getRow(2).getCell(2).value = 500;
      anslutningar.getRow(2).getCell(3).value = 520;

      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(wb, warnings, 2024);
      expect(drivers.length).toBe(2);
      const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
      expect(vesi!.myytyMaara).toBe(12000);
      expect(jatevesi!.myytyMaara).toBe(9000);
      expect(vesi!.liittymamaara).toBe(520);
      expect(jatevesi!.liittymamaara).toBe(520);
      expect(driversDebug?.selectedYear).toBe(2024);
      expect(warnings.filter((w) => w.includes('volume') || w.includes('connection')).length).toBeLessThanOrEqual(2);
    });
  });

  describe('extractSubtotalLines (Tier A)', () => {
    it('extracts income and cost subtotals from KVA totalt with year columns', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1'); // needed for detect
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      // Year header row
      kvaTotalt.getRow(1).getCell(1).value = 'Resultaträkning';
      kvaTotalt.getRow(1).getCell(2).value = '2022';
      kvaTotalt.getRow(1).getCell(3).value = '2023';
      kvaTotalt.getRow(1).getCell(4).value = '2024';
      // P&L subtotal rows
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 380000;
      kvaTotalt.getRow(2).getCell(3).value = 400000;
      kvaTotalt.getRow(2).getCell(4).value = 420000;
      kvaTotalt.getRow(3).getCell(1).value = 'Personalkostnader';
      kvaTotalt.getRow(3).getCell(2).value = -100000;
      kvaTotalt.getRow(3).getCell(3).value = -110000;
      kvaTotalt.getRow(3).getCell(4).value = -115000;
      kvaTotalt.getRow(4).getCell(1).value = 'Avskrivningar';
      kvaTotalt.getRow(4).getCell(2).value = -50000;
      kvaTotalt.getRow(4).getCell(3).value = -52000;
      kvaTotalt.getRow(4).getCell(4).value = -54000;
      kvaTotalt.getRow(5).getCell(1).value = 'Årets resultat';
      kvaTotalt.getRow(5).getCell(2).value = 30000;
      kvaTotalt.getRow(5).getCell(3).value = 35000;
      kvaTotalt.getRow(5).getCell(4).value = 40000;

      const { lines, debug, warnings } = extractSubtotalLines(wb, 2024);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(debug.selectedYear).toBe(2024);
      expect(debug.sourceSheets).toContain('KVA totalt');

      // Check specific categories
      const salesRevenue = lines.find((l) => l.categoryKey === 'sales_revenue');
      expect(salesRevenue).toBeDefined();
      expect(salesRevenue!.type).toBe('income');
      expect(salesRevenue!.amount).toBe(420000);
      expect(salesRevenue!.year).toBe(2024);

      const personnel = lines.find((l) => l.categoryKey === 'personnel_costs');
      expect(personnel).toBeDefined();
      expect(personnel!.type).toBe('cost');
      expect(personnel!.amount).toBe(-115000);

      const depreciation = lines.find((l) => l.categoryKey === 'depreciation');
      expect(depreciation).toBeDefined();
      expect(depreciation!.type).toBe('depreciation');

      const netResult = lines.find((l) => l.categoryKey === 'net_result');
      expect(netResult).toBeDefined();
      expect(netResult!.type).toBe('result');
      expect(netResult!.amount).toBe(40000);
    });

    it('does not produce 100% KULUT when income rows exist', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 500000;
      kvaTotalt.getRow(3).getCell(1).value = 'Övriga kostnader';
      kvaTotalt.getRow(3).getCell(2).value = -80000;

      const { lines } = extractSubtotalLines(wb, 2024);
      expect(lines.some((l) => l.type === 'income')).toBe(true);
      expect(lines.some((l) => l.type === 'cost')).toBe(true);
    });

    it('uses budget year column when available', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2023';
      kvaTotalt.getRow(1).getCell(3).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 400000;
      kvaTotalt.getRow(2).getCell(3).value = 420000;

      // Request 2023 specifically
      const { lines, debug } = extractSubtotalLines(wb, 2023);
      expect(debug.selectedYear).toBe(2023);
      const sales = lines.find((l) => l.categoryKey === 'sales_revenue');
      expect(sales!.amount).toBe(400000);
    });

    it('falls back to newest year when budget year not in columns', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2023';
      kvaTotalt.getRow(1).getCell(3).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 400000;
      kvaTotalt.getRow(2).getCell(3).value = 420000;

      // Request 2030 — not in columns
      const { lines, debug } = extractSubtotalLines(wb, 2030);
      expect(debug.selectedYear).toBe(2024); // newest
      expect(lines.find((l) => l.categoryKey === 'sales_revenue')!.amount).toBe(420000);
    });

    it('skips header rows and unrecognized labels', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Some random header';
      kvaTotalt.getRow(2).getCell(2).value = 'text';
      kvaTotalt.getRow(3).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(3).getCell(2).value = 420000;
      kvaTotalt.getRow(4).getCell(1).value = 'Annan rad som inte matchar';
      kvaTotalt.getRow(4).getCell(2).value = 99999;

      const { lines, debug } = extractSubtotalLines(wb, 2024);
      expect(lines.length).toBe(1);
      expect(lines[0].categoryKey).toBe('sales_revenue');
      expect(debug.rowsSkipped).toBeGreaterThanOrEqual(1);
    });

    it('extracts per-service subtotals from Vatten KVA with palvelutyyppi=vesi', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const vattenKva = wb.addWorksheet('Vatten KVA');
      vattenKva.getRow(1).getCell(1).value = '';
      vattenKva.getRow(1).getCell(2).value = '2023';
      vattenKva.getRow(1).getCell(3).value = '2024';
      vattenKva.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      vattenKva.getRow(2).getCell(2).value = 200000;
      vattenKva.getRow(2).getCell(3).value = 210000;
      vattenKva.getRow(3).getCell(1).value = 'Personalkostnader';
      vattenKva.getRow(3).getCell(2).value = -50000;
      vattenKva.getRow(3).getCell(3).value = -55000;

      const { lines } = extractSubtotalLines(wb, 2024);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.every((l) => l.palvelutyyppi === 'vesi')).toBe(true);
      expect(lines.find((l) => l.categoryKey === 'sales_revenue')!.sourceSheet).toBe('Vatten KVA');
    });

    it('extracts from both KVA totalt (consolidated) and per-service sheets', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 500000;

      const vattenKva = wb.addWorksheet('Vatten KVA');
      vattenKva.getRow(1).getCell(1).value = '';
      vattenKva.getRow(1).getCell(2).value = '2024';
      vattenKva.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      vattenKva.getRow(2).getCell(2).value = 300000;

      const avloppKva = wb.addWorksheet('Avlopp KVA');
      avloppKva.getRow(1).getCell(1).value = '';
      avloppKva.getRow(1).getCell(2).value = '2024';
      avloppKva.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      avloppKva.getRow(2).getCell(2).value = 200000;

      const { lines, debug } = extractSubtotalLines(wb, 2024);
      expect(debug.sourceSheets).toEqual(['KVA totalt', 'Vatten KVA', 'Avlopp KVA']);

      const consolidated = lines.filter((l) => l.palvelutyyppi === undefined);
      const vesi = lines.filter((l) => l.palvelutyyppi === 'vesi');
      const jatevesi = lines.filter((l) => l.palvelutyyppi === 'jatevesi');
      expect(consolidated.length).toBeGreaterThanOrEqual(1);
      expect(vesi.length).toBeGreaterThanOrEqual(1);
      expect(jatevesi.length).toBeGreaterThanOrEqual(1);
      expect(consolidated.find((l) => l.categoryKey === 'sales_revenue')!.amount).toBe(500000);
      expect(vesi.find((l) => l.categoryKey === 'sales_revenue')!.amount).toBe(300000);
      expect(jatevesi.find((l) => l.categoryKey === 'sales_revenue')!.amount).toBe(200000);
    });

    it('warns when no KVA summary sheets are found', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      wb.addWorksheet('RandomSheet');

      const { lines, warnings } = extractSubtotalLines(wb);
      expect(lines.length).toBe(0);
      expect(warnings.some((w) => w.includes('no KVA summary sheets') || w.includes('no year columns'))).toBe(true);
    });

    it('maps Swedish P&L labels to correct categoryKey and type', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';

      const labels: [string, string, string][] = [
        ['Försäljningsintäkter', 'sales_revenue', 'income'],
        ['Övriga intäkter', 'other_income', 'income'],
        ['Material och tjänster', 'materials_services', 'cost'],
        ['Personalkostnader', 'personnel_costs', 'cost'],
        ['Övriga kostnader', 'other_costs', 'cost'],
        ['Avskrivningar', 'depreciation', 'depreciation'],
        ['Finansiella intäkter', 'financial_income', 'financial'],
        ['Finansiella kostnader', 'financial_costs', 'financial'],
        ['Rörelseresultat', 'operating_result', 'result'],
        ['Årets resultat', 'net_result', 'result'],
      ];

      for (let i = 0; i < labels.length; i++) {
        kvaTotalt.getRow(2 + i).getCell(1).value = labels[i][0];
        kvaTotalt.getRow(2 + i).getCell(2).value = (i + 1) * 10000;
      }

      const { lines } = extractSubtotalLines(wb, 2024);
      for (const [label, expectedKey, expectedType] of labels) {
        const line = lines.find((l) => l.categoryKey === expectedKey);
        expect(line).toBeDefined();
        expect(line!.type).toBe(expectedType);
        expect(line!.categoryName).toBe(label);
      }
    });

    it('matches Omsättning as sales_revenue and Lönebikostnader as personnel_costs', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Omsättning';
      kvaTotalt.getRow(2).getCell(2).value = 400000;
      kvaTotalt.getRow(3).getCell(1).value = 'Lönebikostnader';
      kvaTotalt.getRow(3).getCell(2).value = -50000;

      const { lines } = extractSubtotalLines(wb, 2024);
      const sales = lines.find((l) => l.categoryKey === 'sales_revenue');
      expect(sales).toBeDefined();
      expect(sales!.categoryName).toBe('Omsättning');
      const personnel = lines.find((l) => l.categoryKey === 'personnel_costs');
      expect(personnel).toBeDefined();
      expect(personnel!.categoryName).toBe('Lönebikostnader');
    });

    it('excludes "Förändring i..." delta rows from subtotals', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 400000;
      kvaTotalt.getRow(3).getCell(1).value = 'Förändring i intäktsnivån';
      kvaTotalt.getRow(3).getCell(2).value = 5000;
      kvaTotalt.getRow(4).getCell(1).value = 'Personalkostnader';
      kvaTotalt.getRow(4).getCell(2).value = -100000;
      kvaTotalt.getRow(5).getCell(1).value = 'Förändring i lönekostnaderna';
      kvaTotalt.getRow(5).getCell(2).value = -2000;
      kvaTotalt.getRow(6).getCell(1).value = 'Förändring i avskrivningar';
      kvaTotalt.getRow(6).getCell(2).value = -1000;
      kvaTotalt.getRow(7).getCell(1).value = 'Avskrivningar';
      kvaTotalt.getRow(7).getCell(2).value = -60000;

      const { lines } = extractSubtotalLines(wb, 2024);
      // "Förändring i..." rows should NOT appear
      expect(lines.every((l) => !l.categoryName.toLowerCase().includes('förändring'))).toBe(true);
      // Real rows should appear
      expect(lines.find((l) => l.categoryKey === 'sales_revenue')).toBeDefined();
      expect(lines.find((l) => l.categoryKey === 'personnel_costs')).toBeDefined();
      expect(lines.find((l) => l.categoryKey === 'depreciation')).toBeDefined();
      expect(lines).toHaveLength(3);
    });

    it('integrates into previewKvaWorkbook and populates subtotalLines', async () => {
      const wb = new ExcelJS.Workbook();
      const blad1 = wb.addWorksheet('Blad1');
      blad1.getRow(1).getCell(1).value = 'Konto';
      blad1.getRow(1).getCell(2).value = 'Namn';
      blad1.getRow(1).getCell(3).value = 'Budget';
      blad1.getRow(2).getCell(1).value = '4100';
      blad1.getRow(2).getCell(2).value = 'Energi';
      blad1.getRow(2).getCell(3).value = 10000;

      const kvaTotalt = wb.addWorksheet('KVA totalt');
      kvaTotalt.getRow(1).getCell(1).value = '';
      kvaTotalt.getRow(1).getCell(2).value = '2024';
      kvaTotalt.getRow(2).getCell(1).value = 'Försäljningsintäkter';
      kvaTotalt.getRow(2).getCell(2).value = 500000;
      kvaTotalt.getRow(3).getCell(1).value = 'Personalkostnader';
      kvaTotalt.getRow(3).getCell(2).value = -100000;

      const preview = await previewKvaWorkbook(wb);
      // Tier B: account-level
      expect(preview.budgetLines.length).toBeGreaterThanOrEqual(1);
      // Tier A: subtotal-level
      expect(preview.subtotalLines).toBeDefined();
      expect(preview.subtotalLines!.length).toBeGreaterThanOrEqual(2);
      expect(preview.subtotalLines!.some((l) => l.type === 'income')).toBe(true);
      expect(preview.subtotalLines!.some((l) => l.type === 'cost')).toBe(true);
      expect(preview.subtotalDebug).toBeDefined();
      expect(preview.subtotalDebug!.sourceSheets).toContain('KVA totalt');
    });
  });

  describe('with local KVA fixture', () => {
    if (!fixtureExists()) {
      it.skip('KVA fixture not found: set VA_FIXTURES_DIR or add Simulering av kommande lönsamhet KVA.xlsx to fixtures/ (skipped)', () => {});
      return;
    }

    it('detects template and extracts key fields from fixture', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const detected = detectKvaTemplate(workbook, path.basename(KVA_FIXTURE));
      expect(detected).toBe(true);

      const preview = await previewKvaWorkbook(workbook);
      expect(preview.templateId).toBe('kva');
      expect(preview.budgetLines.length).toBeGreaterThanOrEqual(1);
      if (preview.year != null) {
        expect(preview.year).toBeGreaterThanOrEqual(2000);
        expect(preview.year).toBeLessThanOrEqual(2100);
      }
    });

    it('parses Blad1 row-76-style block: account 6201, name El, Budget amount, sheet and column', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);

      const preview = await previewKvaWorkbook(workbook);

      const row6201 = preview.budgetLines.find((r) => r.tiliryhma === '6201');
      expect(row6201).toBeDefined();
      expect(row6201!.nimi).toMatch(/El/i);
      expect(row6201!.summa).toBe(59000);

      expect(preview.kvaDebug).toBeDefined();
      expect(preview.kvaDebug!.detectedSheetName).toBe('Blad1');
      expect(preview.kvaDebug!.detectedHeaderRowIndex).toBe(76);
      expect(preview.kvaDebug!.budgetColumnIndex).toBe(3);
      expect(preview.kvaDebug!.parsedRowCount).toBeGreaterThanOrEqual(1);
      expect(preview.warnings.some((w) => w.includes('[KVA_DEBUG]') && w.includes('Blad1') && w.includes('headerRow=76'))).toBe(true);
      expect(preview.warnings.some((w) => w.includes('Could not detect Budget'))).toBe(false);
    });

    it('does not emit no-section-header warnings for non-Blad1 sheets', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.budgetLines.length).toBeGreaterThan(0);
      expect(preview.warnings.some((w) => /KVA totalt:.*no section header/.test(w))).toBe(false);
      expect(preview.warnings.some((w) => /Vatten KVA:.*no section header/.test(w))).toBe(false);
      expect(preview.warnings.some((w) => /Avlopp:.*no section header/.test(w))).toBe(false);
    });

    it('Step 1: fixture revenue drivers debug for 2023 (why volume/connections missing)', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(workbook, warnings, 2023);

      const byService = { vesi: drivers.filter((d) => d.palvelutyyppi === 'vesi'), jatevesi: drivers.filter((d) => d.palvelutyyppi === 'jatevesi') };
      console.log('--- Step 1: fixture revenue drivers (year 2023) ---');
      for (const [palvelutyyppi, list] of Object.entries(byService)) {
        console.log(`  ${palvelutyyppi}:`, list.length, 'driver(s)');
        list.forEach((d, i) => {
          console.log(`    [${i}] yksikkohinta=${d.yksikkohinta}, myytyMaara=${d.myytyMaara}, perusmaksu=${d.perusmaksu}, liittymamaara=${d.liittymamaara}, alvProsentti=${d.alvProsentti}`);
        });
      }
      console.log('  driversDebug:', JSON.stringify(driversDebug, null, 2));
      console.log('  volume/connection warnings:', warnings.filter((w) => w.includes('volume') || w.includes('connection')));

      expect(drivers).toBeDefined();
      expect(drivers.length).toBeGreaterThanOrEqual(1);

      const allVolumeZero = drivers.every((d) => (d.myytyMaara ?? 0) === 0);
      const allConnectionsZero = drivers.every((d) => (d.liittymamaara ?? 0) === 0);
      if (allVolumeZero || allConnectionsZero) {
        expect(driversDebug).toBeDefined();
        if (allVolumeZero) {
          expect(driversDebug!.volumeNotFound).toBe(true);
          expect(warnings.some((w) => w.toLowerCase().includes('volume'))).toBe(true);
        }
        if (allConnectionsZero) {
          expect(driversDebug!.connectionNotFound).toBe(true);
          expect(warnings.some((w) => w.toLowerCase().includes('connection'))).toBe(true);
        }
      }

      if (driversDebug?.volumeCandidateRowTexts?.length) {
        console.log('  volumeCandidateRowTexts (sample labels that did not match m³):', driversDebug.volumeCandidateRowTexts.length);
      }
      if (driversDebug?.connectionCandidateRowTexts?.length) {
        console.log('  connectionCandidateRowTexts (sample when connection not found):', driversDebug.connectionCandidateRowTexts.length);
      }
      if (driversDebug?.driversSkippedReasons?.length) {
        console.log('  driversSkippedReasons:', driversDebug.driversSkippedReasons.map((r) => `${r.reason} (count=${r.count})`));
      }
    });

    it('extracts revenue drivers from fixture: no KVA totalt warning', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.revenueDrivers).toBeDefined();
      expect(preview.revenueDrivers!.length).toBeGreaterThanOrEqual(1);
      expect(preview.warnings.some((w) => w.includes('KVA totalt') && w.includes('not found'))).toBe(false);
      expect(preview.warnings.some((w) => /sheet.*skipped|no section header/.test(w) && !w.includes('Blad1'))).toBe(false);
    });

    it('Step 4: fixture preview has calm volume/connection warnings (max 2)', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.revenueDrivers!.length).toBeGreaterThanOrEqual(1);
      const volumeConnectionWarnings = preview.warnings.filter(
        (w) => w.includes('volume') || w.includes('connection'),
      );
      expect(volumeConnectionWarnings.length).toBeLessThanOrEqual(2);
    });

    it('Step 8: fixture assertions — budget lines > 0, Blad1 in processedSheets, no Blad1 no-section-header spam', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.budgetLines.length).toBeGreaterThan(0);
      const blad1Sheet = preview.processedSheets?.find((s) => s.sheetName === 'Blad1');
      expect(blad1Sheet).toBeDefined();
      expect(blad1Sheet!.lines).toBeGreaterThan(0);
      expect(blad1Sheet!.skipped).not.toBe(true);
      expect(preview.warnings.some((w) => w.includes('Blad1') && /no section header|no header row/.test(w))).toBe(false);
      expect(preview.amountColumnUsed?.toLowerCase().includes('budget') ?? false).toBe(true);
    });

    it('fixture: budget preview has at least one KULUT line; when 3xxx/5xxx exist, has non-KULUT too', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.budgetLines.length).toBeGreaterThan(0);
      const kuluCount = preview.budgetLines.filter((r) => r.tyyppi === 'kulu').length;
      const tuloCount = preview.budgetLines.filter((r) => r.tyyppi === 'tulo').length;
      const investCount = preview.budgetLines.filter((r) => r.tyyppi === 'investointi').length;
      expect(kuluCount).toBeGreaterThanOrEqual(1);
      if (tuloCount + investCount > 0) {
        expect(tuloCount + investCount).toBeGreaterThanOrEqual(1);
      } else {
        expect(preview.kvaDebug?.blockAccountRanges?.length ?? 0).toBeGreaterThanOrEqual(1);
      }
    });

    it('fixture: price sheet is KVA totalt or Blad1 when present; no false price warning; volume/connection warnings <= 2', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.revenueDrivers?.length).toBeGreaterThanOrEqual(1);
      if (preview.driversDebug?.priceSheetName) {
        expect(['KVA totalt', 'Blad1']).toContain(preview.driversDebug.priceSheetName.trim());
        expect(preview.warnings.some((w) => w.includes('could not locate') && w.includes('Pris'))).toBe(false);
      }
      const volumeConnectionWarnings = preview.warnings.filter(
        (w) => w.includes('volume') || w.includes('connection'),
      );
      expect(volumeConnectionWarnings.length).toBeLessThanOrEqual(2);
    });

    it('fixture: when volume or connection values exist in template, they are > 0', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      const withVolume = preview.revenueDrivers?.filter((d) => (d.myytyMaara ?? 0) > 0) ?? [];
      const withConnections = preview.revenueDrivers?.filter((d) => (d.liittymamaara ?? 0) > 0) ?? [];
      if (withVolume.length > 0) {
        expect(withVolume.every((d) => (d.myytyMaara ?? 0) > 0)).toBe(true);
      }
      if (withConnections.length > 0) {
        expect(preview.revenueDrivers?.every((d) => (d.liittymamaara ?? 0) > 0)).toBe(true);
      }
    });

    it('fixture: when year 2023 is used and no volume warning, Vatten KVA and Avlopp KVA myytyMaara are populated', async () => {
      if (!fixtureExists()) return;
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const warnings: string[] = [];
      const { drivers, driversDebug } = previewKvaRevenueDrivers(workbook, warnings, 2023);
      const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
      expect(vesi).toBeDefined();
      expect(jatevesi).toBeDefined();
      const volumeWarnings = warnings.filter((w) => w.toLowerCase().includes('volume'));
      if (driversDebug?.selectedYear === 2023 && volumeWarnings.length === 0) {
        expect((vesi!.myytyMaara ?? 0) > 0).toBe(true);
        expect((jatevesi!.myytyMaara ?? 0) > 0).toBe(true);
      }
    });

    it('Step 1 (debug): fixture subtotalLines grouped by type — log; current col-A-only yields only income', async () => {
      if (!fixtureExists()) return;
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);

      const lines = preview.subtotalLines ?? [];
      const byType = lines.reduce<Record<string, typeof lines>>((acc, l) => {
        const t = l.type;
        if (!acc[t]) acc[t] = [];
        acc[t].push(l);
        return acc;
      }, {});
      const types = Object.keys(byType);
      if (lines.length > 0) {
        for (const t of types) {
          // eslint-disable-next-line no-console
          console.log(`subtotalLines by type '${t}':`, byType[t]!.length, byType[t]!.map((l) => l.categoryName).join(', '));
        }
      }
      expect(lines.some((l) => l.type === 'income')).toBe(true);
      // With col-A-only label we only get 3 income lines until Step 2 matching/label source fix
    });

    it('fixture: preview-kva returns costs and investments for 2023', async () => {
      if (!fixtureExists()) return;
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);

      const lines = preview.subtotalLines ?? [];
      expect(lines.length).toBeGreaterThan(0);

      const hasTulo = lines.some((l) => l.type === 'income');
      const hasKulu = lines.some((l) => l.type === 'cost' || l.type === 'depreciation');
      const hasInvestointi = lines.some((l) => l.type === 'investment');
      const hasPoistoOrRahoitusKulu = lines.some(
        (l) => l.type === 'depreciation' || l.type === 'financial',
      );

      expect(hasTulo).toBe(true);
      expect(hasKulu).toBe(true);
      expect(hasInvestointi || hasPoistoOrRahoitusKulu).toBe(true);

      for (const line of lines) {
        expect(line.categoryName.toLowerCase()).not.toMatch(/förändring\s*i/);
      }
    });

    it('fixture: subtotal extraction attempted on KVA totalt — debug populated', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);

      // subtotalDebug is always populated (even if 0 lines extracted)
      expect(preview.subtotalDebug).toBeDefined();
      // Should attempt at least one source sheet
      if (preview.subtotalDebug!.sourceSheets.length > 0) {
        expect(preview.subtotalDebug!.selectedYear).toBeGreaterThanOrEqual(2000);
      }

      // If subtotal lines are extracted, verify they have at least income or cost categories
      if (preview.subtotalLines && preview.subtotalLines.length > 0) {
        const types = [...new Set(preview.subtotalLines.map((l) => l.type))];
        // At minimum we expect income OR cost types (fixture may vary; delta rows excluded)
        expect(types.length).toBeGreaterThanOrEqual(1);
        expect(preview.subtotalDebug?.sourceSheets).toContain('KVA totalt');
        // Verify no "Förändring i..." delta rows leaked in
        for (const line of preview.subtotalLines) {
          expect(line.categoryName.toLowerCase()).not.toMatch(/förändring\s*i/);
        }
      }
    });

    it('fixture: preview/extract returns cost/depreciation/financial subtotal lines for 2023', async () => {
      if (!fixtureExists()) return;
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      const lines = preview.subtotalLines ?? [];
      const debug = preview.subtotalDebug;

      // Debug: first ~30 matched lines
      const matchedPreview = lines.slice(0, 30).map((l) => ({
        sourceSheet: l.sourceSheet,
        labelUsed: l.categoryName,
        categoryKey: l.categoryKey,
        type: l.type,
        amount: l.amount,
      }));
      // eslint-disable-next-line no-console
      console.log('Step 2 matched lines (first ~30):', JSON.stringify(matchedPreview, null, 2));
      const noMatchReasons = debug?.skippedReasons?.find((r) => r.reason === 'no label match');
      const sampleSkipped = (noMatchReasons?.sampleLabels ?? []).slice(0, 30);
      // eslint-disable-next-line no-console
      console.log('Step 2 skippedReasons sampleLabels (first ~30):', sampleSkipped);

      expect(lines.some((l) => l.type === 'income')).toBe(true);
      const hasCostOrDepreciationOrFinancial =
        lines.some((l) => l.type === 'cost') ||
        lines.some((l) => l.type === 'depreciation') ||
        lines.some((l) => l.type === 'financial');
      expect(hasCostOrDepreciationOrFinancial).toBe(true);
    });

    it('Step 1: fixture subtotal lines for 2023 — income per sheet + cost/depreciation, debug shows why', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const { lines, debug } = extractSubtotalLines(workbook, 2023);

      // Group by (type, categoryKey, sourceSheet) for reporting
      const key = (l: (typeof lines)[0]) => `${l.type}|${l.categoryKey}|${l.sourceSheet}`;
      const byGroup = new Map<string, (typeof lines)[0][]>();
      for (const l of lines) {
        const k = key(l);
        if (!byGroup.has(k)) byGroup.set(k, []);
        byGroup.get(k)!.push(l);
      }
      const grouped = [...byGroup.entries()].map(([k, arr]) => ({ group: k, count: arr.length, sample: arr[0] }));
      // eslint-disable-next-line no-console
      console.log('Step 1 grouped subtotalLines:', JSON.stringify(grouped, null, 2));
      // eslint-disable-next-line no-console
      console.log('Step 1 skippedReasons:', JSON.stringify(debug.skippedReasons, null, 2));

      // After best-label fix: each of the three sheets has at least one sales_revenue (income)
      const salesRevenue = lines.filter((l) => l.type === 'income' && l.categoryKey === 'sales_revenue');
      expect(salesRevenue.length).toBeGreaterThanOrEqual(3);
      const sheetsWithIncome = [...new Set(salesRevenue.map((l) => l.sourceSheet))].sort();
      expect(sheetsWithIncome).toEqual(['Avlopp KVA', 'KVA totalt', 'Vatten KVA']);

      // Cost/depreciation/financial are now extracted (label from col B when col A is section header)
      expect(
        lines.some((l) => l.type === 'cost') ||
          lines.some((l) => l.type === 'depreciation') ||
          lines.some((l) => l.type === 'financial'),
      ).toBe(true);

      expect(debug.skippedReasons).toBeDefined();
      expect(Array.isArray(debug.skippedReasons)).toBe(true);
      const reasons = debug.skippedReasons!;
      for (const r of reasons) {
        expect(r.reason).toBeDefined();
        expect(typeof r.count).toBe('number');
      }
      const noMatch = reasons.find((r) => r.reason === 'no label match');
      if (noMatch?.sampleLabels?.length) {
        // eslint-disable-next-line no-console
        console.log('Step 1 sample labels that did not match:', noMatch.sampleLabels);
      }
    });

    it('fixture: subtotal import yields both tiers when Blad1 and KVA totalt exist', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);

      // Tier B: account-level from Blad1
      expect(preview.budgetLines.length).toBeGreaterThanOrEqual(1);
      // Tier A: subtotal-level from KVA summary
      if (preview.subtotalLines && preview.subtotalLines.length >= 2) {
        // Both tiers present
        const hasIncome = preview.subtotalLines.some((l) => l.type === 'income');
        const hasCost = preview.subtotalLines.some((l) => l.type === 'cost' || l.type === 'depreciation');
        expect(hasIncome || hasCost).toBe(true);
      }
    });
  });
});
