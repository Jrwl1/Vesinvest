import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { detectKvaTemplate, previewKvaWorkbook } from './kva-template.adapter';

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

    it('parses header and data rows when structure is present', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Simulering');
      const sheet = wb.getWorksheet('Simulering')!;
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
      wb.addWorksheet('KVA');
      const sheet = wb.getWorksheet('KVA')!;
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
      wb.addWorksheet('Data');
      const sheet = wb.getWorksheet('Data')!;
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

    it('parses multiple sections in one sheet', async () => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('KVA');
      const sheet = wb.getWorksheet('KVA')!;
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
  });
});
