import { describe, expect, it } from 'vitest';

import {
  applyDocumentImportMatchSelection,
  buildDocumentImportPreviewFromQdis,
  buildDocumentImportPreviewFromStatement,
  buildDocumentImportPreviewFromUnknownLayout,
  clearDocumentImportMatchSelections,
  mergeDocumentImportPreviews,
  parseGenericDocumentText,
  requiresDocumentImportConfidenceReview,
} from './documentPdfImport';

describe('documentPdfImport', () => {
  it('converts statement OCR output into a generic document preview', () => {
    const preview = buildDocumentImportPreviewFromStatement({
      fileName: 'statement.pdf',
      pageNumber: 4,
      scannedPageCount: 6,
      confidence: 98,
      fields: {
        liikevaihto: 125000,
        poistot: 24000,
      },
      matches: [
        {
          key: 'liikevaihto',
          label: 'Revenue',
          value: 125000,
          sourceLine: 'Omsattning 125 000',
          pageNumber: 4,
        },
        {
          key: 'poistot',
          label: 'Depreciation',
          value: 24000,
          sourceLine: 'Avskrivningar 24 000',
          pageNumber: 4,
        },
      ],
      warnings: [],
      rawText: 'Statement text',
    });

    expect(preview.documentProfile).toBe('statement_pdf');
    expect(preview.datasetKinds).toEqual(['financials']);
    expect(preview.matchedFields).toEqual(['liikevaihto', 'poistot']);
    expect(preview.financials.liikevaihto).toBe(125000);
    expect(preview.sourceLines).toEqual([
      { text: 'Omsattning 125 000', pageNumber: 4 },
      { text: 'Avskrivningar 24 000', pageNumber: 4 },
    ]);
  });

  it('merges statement and QDIS previews into a generic mixed-document preview', () => {
    const statement = buildDocumentImportPreviewFromStatement({
      fileName: 'source.pdf',
      pageNumber: 3,
      scannedPageCount: 6,
      confidence: 95,
      fields: {
        liikevaihto: 125000,
      },
      matches: [
        {
          key: 'liikevaihto',
          label: 'Revenue',
          value: 125000,
          sourceLine: 'Omsattning 125 000',
          pageNumber: 3,
        },
      ],
      warnings: ['Check scanned totals'],
      rawText: 'Statement text',
    });
    const qdis = buildDocumentImportPreviewFromQdis({
      fileName: 'source.pdf',
      pageNumber: 1,
      scannedPageCount: 2,
      confidence: 91,
      fields: {
        waterUnitPrice: 1.45,
        wastewaterUnitPrice: 2.15,
        soldWaterVolume: 10000,
      },
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          value: 1.45,
          sourceLine: 'Water 1.45 EUR/m3',
          pageNumber: 1,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          value: 10000,
          sourceLine: 'Water 10 000 m3',
          pageNumber: 1,
        },
      ],
      warnings: [],
      rawText: 'QDIS text',
    });

    const merged = mergeDocumentImportPreviews([statement, qdis]);

    expect(merged).not.toBeNull();
    expect(merged?.documentProfile).toBe('generic_pdf');
    expect(merged?.datasetKinds).toEqual(['financials', 'prices', 'volumes']);
    expect(merged?.financials.liikevaihto).toBe(125000);
    expect(merged?.prices.waterUnitPrice).toBe(1.45);
    expect(merged?.volumes.soldWaterVolume).toBe(10000);
    expect(merged?.warnings).toContain('Check scanned totals');
    expect(merged?.pageNumber).toBeNull();
    expect(requiresDocumentImportConfidenceReview(merged!)).toBe(true);
  });

  it('extracts reviewable candidates from an unknown-layout source PDF text block', () => {
    const parsed = parseGenericDocumentText(
      [
        'Liikevaihto 786 930,85',
        'Vatten brukningsavgift 1,45 eur/m3',
        'Avloppsmangd 35 000 m3',
      ].join('\n'),
      2,
    );

    expect(parsed.matches).toEqual([
      expect.objectContaining({
        key: 'liikevaihto',
        datasetKind: 'financials',
        value: 786930.85,
        pageNumber: 2,
      }),
      expect.objectContaining({
        key: 'waterUnitPrice',
        datasetKind: 'prices',
        value: 1.45,
        pageNumber: 2,
      }),
      expect.objectContaining({
        key: 'soldWastewaterVolume',
        datasetKind: 'volumes',
        value: 35000,
        pageNumber: 2,
      }),
    ]);
  });

  it('keeps unknown-layout-only imports in the unknown_pdf profile until a known parser joins them', () => {
    const unknownOnly = buildDocumentImportPreviewFromUnknownLayout({
      fileName: 'scan.pdf',
      pageNumber: 5,
      scannedPageCount: 5,
      confidence: 82,
      matches: [
        {
          key: 'liikevaihto',
          label: 'Revenue',
          value: 250000,
          datasetKind: 'financials',
          sourceLine: 'Liikevaihto 250 000',
          pageNumber: 5,
        },
      ],
      warnings: [],
      rawText: 'Liikevaihto 250 000',
    });

    expect(unknownOnly.documentProfile).toBe('unknown_pdf');
    expect(unknownOnly.datasetKinds).toEqual(['financials']);

    const merged = mergeDocumentImportPreviews([
      unknownOnly,
      buildDocumentImportPreviewFromQdis({
        fileName: 'scan.pdf',
        pageNumber: 1,
        scannedPageCount: 5,
        confidence: 96,
        fields: {
          waterUnitPrice: 1.3,
          wastewaterUnitPrice: 2.6,
          soldWaterVolume: 1000,
          soldWastewaterVolume: 2000,
        },
        matches: [
          {
            key: 'waterUnitPrice',
            label: 'Water unit price',
            value: 1.3,
            sourceLine: 'Water 1.30 EUR/m3',
            pageNumber: 1,
          },
        ],
        warnings: [],
        rawText: 'Water 1.30 EUR/m3',
      }),
    ]);

    expect(merged?.documentProfile).toBe('generic_pdf');
    expect(merged?.matchedFields).toContain('liikevaihto');
    expect(merged?.matchedFields).toContain('waterUnitPrice');
  });

  it('keeps all unknown-layout candidates available for review while selecting one value per field', () => {
    const preview = buildDocumentImportPreviewFromUnknownLayout({
      fileName: 'scan.pdf',
      pageNumber: 2,
      scannedPageCount: 3,
      confidence: 77,
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          value: 1.2,
          datasetKind: 'prices',
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          value: 1.45,
          datasetKind: 'prices',
          sourceLine: 'Vatten brukningsavgift 1,45 eur/m3',
          pageNumber: 3,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          value: 65000,
          datasetKind: 'volumes',
          sourceLine: 'Sald vattenmangd 65 000 m3',
          pageNumber: 2,
        },
      ],
      warnings: ['Generic PDF detection needs manual review before saving.'],
      rawText: 'mock source text',
    });

    expect(preview.documentProfile).toBe('unknown_pdf');
    expect(preview.matches).toEqual([
      expect.objectContaining({
        key: 'waterUnitPrice',
        value: 1.2,
      }),
      expect.objectContaining({
        key: 'soldWaterVolume',
        value: 65000,
      }),
    ]);
    expect(preview.candidateMatches).toEqual([
      expect.objectContaining({
        key: 'waterUnitPrice',
        value: 1.2,
      }),
      expect.objectContaining({
        key: 'waterUnitPrice',
        value: 1.45,
      }),
      expect.objectContaining({
        key: 'soldWaterVolume',
        value: 65000,
      }),
    ]);
    expect(preview.sourceLines).toEqual([
      { text: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
      { text: 'Sald vattenmangd 65 000 m3', pageNumber: 2 },
    ]);
  });

  it('lets review select another candidate or keep the current value for a previewed field', () => {
    const preview = buildDocumentImportPreviewFromUnknownLayout({
      fileName: 'scan.pdf',
      pageNumber: 2,
      scannedPageCount: 3,
      confidence: 77,
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          value: 1.2,
          datasetKind: 'prices',
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          value: 1.45,
          datasetKind: 'prices',
          sourceLine: 'Vatten brukningsavgift 1,45 eur/m3',
          pageNumber: 3,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          value: 65000,
          datasetKind: 'volumes',
          sourceLine: 'Sald vattenmangd 65 000 m3',
          pageNumber: 2,
        },
      ],
      warnings: [],
      rawText: 'mock source text',
    });

    const alternative = preview.candidateMatches?.find(
      (match) => match.key === 'waterUnitPrice' && match.value === 1.45,
    );
    expect(alternative).toBeTruthy();

    const selectedAlternative = applyDocumentImportMatchSelection({
      preview,
      key: 'waterUnitPrice',
      selectedMatch: alternative ?? null,
    });
    expect(selectedAlternative.prices.waterUnitPrice).toBe(1.45);
    expect(selectedAlternative.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'waterUnitPrice',
          value: 1.45,
        }),
      ]),
    );
    expect(selectedAlternative.pageNumber).toBeNull();

    const keepCurrent = applyDocumentImportMatchSelection({
      preview: selectedAlternative,
      key: 'waterUnitPrice',
      selectedMatch: null,
    });
    expect(keepCurrent.prices.waterUnitPrice).toBeUndefined();
    expect(keepCurrent.matches).toEqual([
      expect.objectContaining({
        key: 'soldWaterVolume',
        value: 65000,
      }),
    ]);
    expect(keepCurrent.candidateMatches).toEqual(preview.candidateMatches);
    expect(keepCurrent.pageNumber).toBe(2);
  });

  it('clears selected matches and source lines when a staged review starts', () => {
    const preview = buildDocumentImportPreviewFromUnknownLayout({
      fileName: 'scan.pdf',
      pageNumber: 2,
      scannedPageCount: 3,
      confidence: 77,
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          value: 1.2,
          datasetKind: 'prices',
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          value: 65000,
          datasetKind: 'volumes',
          sourceLine: 'Sald vattenmangd 65 000 m3',
          pageNumber: 2,
        },
      ],
      warnings: [],
      rawText: 'mock source text',
    });

    const cleared = clearDocumentImportMatchSelections(preview);

    expect(cleared.matches).toEqual([]);
    expect(cleared.sourceLines).toEqual([]);
    expect(cleared.candidateMatches).toEqual(preview.candidateMatches);
  });
});
