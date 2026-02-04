import { toExcelSheetCreateInput } from './imports.repository';
import type { CreateExcelSheetInput } from './imports.repository';
import { Prisma } from '@prisma/client';

describe('ImportsRepository', () => {
  const validSheetInput: CreateExcelSheetInput = {
    sheetName: 'kva_ledningar_vatten',
    headers: ['FEATUREID', 'MATERIALNAME', 'YEARBUILT'],
    rowCount: 5000,
    dataRowCount: 4998,
    headerRowsSkipped: 2,
    kind: 'ASSET_CANDIDATE',
    kindReason: '5000 data rows',
  };

  describe('toExcelSheetCreateInput', () => {
    const VALID_KEYS = new Set([
      'sheetName',
      'headers',
      'rowCount',
      'sampleRows',
      'columnsProfile',
      'dataRowCount',
      'headerRowsSkipped',
      'kind',
      'kindReason',
    ]);

    it('returns only valid Prisma ExcelSheet create keys', () => {
      const result = toExcelSheetCreateInput(validSheetInput);
      const keys = Object.keys(result);
      for (const key of keys) {
        expect(VALID_KEYS.has(key)).toBe(true);
      }
      expect(keys.length).toBeLessThanOrEqual(VALID_KEYS.size);
    });

    it('includes sheet analysis fields when provided', () => {
      const result = toExcelSheetCreateInput(validSheetInput);
      expect(result.dataRowCount).toBe(4998);
      expect(result.headerRowsSkipped).toBe(2);
      expect(result.kind).toBe('ASSET_CANDIDATE');
      expect(result.kindReason).toBe('5000 data rows');
    });

    it('does not include unknown keys from input', () => {
      const inputWithExtra = {
        ...validSheetInput,
        unknownField: 'must not appear',
      } as CreateExcelSheetInput & { unknownField?: string };
      const result = toExcelSheetCreateInput(inputWithExtra);
      expect((result as Record<string, unknown>).unknownField).toBeUndefined();
    });

    it('satisfies Prisma.ExcelSheetCreateWithoutImportInput shape', () => {
      const result = toExcelSheetCreateInput(validSheetInput);
      const _typeCheck: Prisma.ExcelSheetCreateWithoutImportInput = result;
      expect(result.sheetName).toBe(validSheetInput.sheetName);
      expect(result.headers).toEqual(validSheetInput.headers);
      expect(result.rowCount).toBe(validSheetInput.rowCount);
    });

    it('uses JsonNull for missing optional json fields', () => {
      const minimal: CreateExcelSheetInput = {
        sheetName: 'Test',
        headers: ['A'],
        rowCount: 0,
      };
      const result = toExcelSheetCreateInput(minimal);
      expect(result.sampleRows).toBe(Prisma.JsonNull);
      expect(result.columnsProfile).toBe(Prisma.JsonNull);
      expect(result.dataRowCount).toBeUndefined();
      expect(result.headerRowsSkipped).toBeUndefined();
      expect(result.kind).toBeUndefined();
      expect(result.kindReason).toBeUndefined();
    });
  });
});
