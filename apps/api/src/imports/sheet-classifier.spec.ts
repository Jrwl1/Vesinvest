import { classifySheet } from './sheet-classifier';

describe('sheet-classifier', () => {
  describe('classifySheet', () => {
    it('classifies "Förklaringar" as REFERENCE', () => {
      const r = classifySheet('Förklaringar', ['Column A', 'Column B'], 10, 0);
      expect(r.kind).toBe('REFERENCE');
      expect(r.kindReason).toMatch(/reference|explanations/i);
    });

    it('classifies "Legend" as REFERENCE', () => {
      const r = classifySheet('Legend', [], 5, 0);
      expect(r.kind).toBe('REFERENCE');
    });

    it('classifies facit-like sheet names as ASSET_CANDIDATE when many rows', () => {
      const r = classifySheet('kva_ledningar_vatten', ['FEATUREID', 'MATERIALNAME', 'YEARBUILT'], 5000, 1);
      expect(r.kind).toBe('ASSET_CANDIDATE');
      expect(r.kindReason).toMatch(/5000|data rows/);
    });

    it('classifies tva_ledningar_avlopp as ASSET_CANDIDATE', () => {
      const r = classifySheet('tva_ledningar_avlopp', ['UWD_FEATUREID', 'SHAPE_Length'], 100, 0);
      expect(r.kind).toBe('ASSET_CANDIDATE');
    });

    it('classifies small row count + descriptive headers as REFERENCE', () => {
      const headers = ['Linefeatureid / Ledningstyp', 'Noggrannhet', 'Förklaring'];
      const r = classifySheet('Metadata', headers, 20, 0);
      expect(r.kind).toBe('REFERENCE');
      expect(r.kindReason).toMatch(/Few rows|descriptive/i);
    });

    it('classifies empty sheet as EMPTY', () => {
      const r = classifySheet('Empty', ['A', 'B'], 0, 0);
      expect(r.kind).toBe('EMPTY');
    });
  });
});
