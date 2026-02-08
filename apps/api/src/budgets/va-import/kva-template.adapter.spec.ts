import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { detectKvaTemplate, previewKvaWorkbook, previewKvaRevenueDrivers } from './kva-template.adapter';

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
    it('extracts unit prices and VAT from KVA totalt Pris €/m³ table', () => {
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
      kvaTotalt.getRow(2).getCell(1).value = 'Vatten';
      kvaTotalt.getRow(2).getCell(2).value = 1.2;
      kvaTotalt.getRow(2).getCell(3).value = 1.25;
      kvaTotalt.getRow(3).getCell(1).value = 'Avlopp';
      kvaTotalt.getRow(3).getCell(2).value = 2.5;
      kvaTotalt.getRow(3).getCell(3).value = 2.6;

      const warnings: string[] = [];
      const drivers = previewKvaRevenueDrivers(wb, warnings);
      expect(drivers.length).toBe(2);
      const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
      const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
      expect(vesi).toBeDefined();
      expect(vesi!.yksikkohinta).toBe(1.2);
      expect(vesi!.alvProsentti).toBe(24);
      expect(jatevesi).toBeDefined();
      expect(jatevesi!.yksikkohinta).toBe(2.5);
      expect(jatevesi!.alvProsentti).toBe(24);
      expect(warnings.some((w) => w.includes('Pris') && w.includes('not found'))).toBe(false);
    });

    it('returns vesi and jatevesi with empty prices when KVA totalt is missing', () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Blad1');
      const warnings: string[] = [];
      const drivers = previewKvaRevenueDrivers(wb, warnings);
      expect(drivers.length).toBe(2);
      expect(drivers.every((d) => d.yksikkohinta == null)).toBe(true);
      expect(warnings.some((w) => w.includes('KVA totalt') && w.includes('not found'))).toBe(true);
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

    it('extracts revenue drivers from fixture: length >= 1, no sheet-spam warnings', async () => {
      const buffer = fs.readFileSync(KVA_FIXTURE) as Buffer;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const preview = await previewKvaWorkbook(workbook);
      expect(preview.revenueDrivers).toBeDefined();
      expect(preview.revenueDrivers!.length).toBeGreaterThanOrEqual(1);
      const withPrice = preview.revenueDrivers!.filter((d) => (d.yksikkohinta ?? 0) > 0);
      if (withPrice.length > 0) {
        expect(withPrice.some((d) => (d.yksikkohinta ?? 0) > 0)).toBe(true);
      }
      const withVat = preview.revenueDrivers!.filter((d) => d.alvProsentti != null);
      if (withVat.length > 0) {
        expect(withVat.some((d) => d.alvProsentti === 24 || (d.alvProsentti ?? 0) > 0)).toBe(true);
      }
      expect(preview.warnings.some((w) => /sheet.*skipped|no section header/.test(w) && !w.includes('Blad1'))).toBe(false);
    });
  });
});
