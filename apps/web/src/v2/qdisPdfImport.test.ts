import { describe, expect, it } from 'vitest';
import {
  parseQdisText,
  selectPreferredQdisCandidate,
} from './qdisPdfImport';

describe('qdisPdfImport', () => {
  it('parses prices and volumes from direct QDIS text', () => {
    const parsed = parseQdisText(
      [
        'QDIS export 2022',
        'Vatten brukningsavgift 1,20 eur/m3',
        'Avlopp brukningsavgift 2,50 eur/m3',
        'Såld vattenmängd 65 000 m3',
        'Såld avloppsmängd 35 000 m3',
      ].join('\n'),
      2,
    );

    expect(parsed.fields).toEqual({
      waterUnitPrice: 1.2,
      wastewaterUnitPrice: 2.5,
      soldWaterVolume: 65000,
      soldWastewaterVolume: 35000,
    });
    expect(parsed.matches.map((match) => match.key)).toEqual([
      'waterUnitPrice',
      'wastewaterUnitPrice',
      'soldWaterVolume',
      'soldWastewaterVolume',
    ]);
  });

  it('prefers OCR text when direct PDF text maps fewer QDIS values', () => {
    const selected = selectPreferredQdisCandidate({
      directText: 'QDIS export\nVatten brukningsavgift 1,20 eur/m3',
      ocrText: [
        'QDIS export',
        'Vatten brukningsavgift 1,20 eur/m3',
        'Avlopp brukningsavgift 2,50 eur/m3',
        'Såld vattenmängd 65 000 m3',
        'Såld avloppsmängd 35 000 m3',
      ].join('\n'),
      pageNumber: 3,
    });

    expect(selected.usedOcr).toBe(true);
    expect(selected.parsed.fields).toEqual({
      waterUnitPrice: 1.2,
      wastewaterUnitPrice: 2.5,
      soldWaterVolume: 65000,
      soldWastewaterVolume: 35000,
    });
    expect(selected.parsed.warnings).toEqual(
      expect.arrayContaining([
        'OCR fallback was used because direct PDF text did not map enough QDIS values.',
      ]),
    );
  });
});
