import { describe, expect, it } from 'vitest';
import type { V2ImportYearDataResponse } from '../api';
import {
  buildFinancialComparisonRows,
  buildImportYearSummaryRows,
  buildImportYearResultToZeroSignal,
  buildImportYearSourceLayers,
  buildPriceComparisonRows,
  buildImportYearTrustSignal,
  buildVolumeComparisonRows,
  canReapplyDatasetVeeti,
  canReapplyFinancialVeeti,
  markPersistedReviewedImportYears,
  resolveApprovedYearStep,
  resolveNextReviewQueueYear,
  resolveReviewContinueTarget,
  syncPersistedReviewedImportYears,
} from './yearReview';

function buildYearData(
  tilinpaatos: Partial<V2ImportYearDataResponse['datasets'][number]>,
): V2ImportYearDataResponse {
  return {
    year: 2024,
    veetiId: 1535,
    sourceStatus: 'MIXED',
    completeness: {
      tilinpaatos: true,
      taksa: true,
      volume_vesi: true,
      volume_jatevesi: true,
    },
    hasManualOverrides: true,
    hasVeetiData: true,
    datasets: [
      {
        dataType: 'tilinpaatos',
        rawRows: [],
        effectiveRows: [],
        source: 'manual',
        hasOverride: true,
        reconcileNeeded: false,
        overrideMeta: null,
        ...tilinpaatos,
      },
    ],
  };
}

describe('yearReview helpers', () => {
  it('syncs persisted reviewed years to the currently imported workspace years', () => {
    window.localStorage.clear();

    expect(
      markPersistedReviewedImportYears('org-1', [2024, 2022], [2024, 2023]),
    ).toEqual([2024]);
    expect(syncPersistedReviewedImportYears('org-1', [2023])).toEqual([]);
  });

  it('returns no financial comparison rows when statement data is absent', () => {
    const yearData = buildYearData({
      rawRows: [],
      effectiveRows: [],
      reconcileNeeded: false,
    });

    expect(buildFinancialComparisonRows(yearData)).toEqual([]);
  });

  it('builds comparison rows for wrong-but-complete years and marks changed fields', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 1000,
          Henkilostokulut: 100,
          TilikaudenYliJaama: 25,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 1400,
          Henkilostokulut: 100,
          TilikaudenYliJaama: 50,
        },
      ],
      reconcileNeeded: true,
    });

    const rows = buildFinancialComparisonRows(yearData);
    const revenue = rows.find((row) => row.key === 'liikevaihto');
    const personnel = rows.find((row) => row.key === 'henkilostokulut');
    const result = rows.find((row) => row.key === 'tilikaudenYliJaama');

    expect(revenue).toMatchObject({
      veetiValue: 1000,
      effectiveValue: 1400,
      changed: true,
    });
    expect(personnel).toMatchObject({
      veetiValue: 100,
      effectiveValue: 100,
      changed: false,
    });
    expect(result).toMatchObject({
      veetiValue: 25,
      effectiveValue: 50,
      changed: true,
    });
  });

  it('resolves statement and QDIS provenance by dataset group', () => {
    const yearData: V2ImportYearDataResponse = {
      ...buildYearData({
        rawRows: [{ Liikevaihto: 1000 }],
        effectiveRows: [{ Liikevaihto: 1200 }],
        reconcileNeeded: true,
        overrideMeta: {
          editedAt: '2026-03-08T10:00:00.000Z',
          editedBy: 'tester',
          reason: 'Statement-backed correction',
          provenance: {
            kind: 'statement_import',
            fileName: 'bokslut-2024.pdf',
            pageNumber: 3,
            confidence: 98,
            scannedPageCount: 5,
            matchedFields: ['liikevaihto'],
            warnings: [],
          },
        },
      }),
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 1000 }],
          effectiveRows: [{ Liikevaihto: 1200 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'Statement-backed correction',
            provenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              scannedPageCount: 5,
              matchedFields: ['liikevaihto'],
              warnings: [],
            },
          },
        },
        {
          dataType: 'taksa',
          rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 1.1 }],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 1.2 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'QDIS import',
            provenance: {
              kind: 'qdis_import',
              fileName: 'qdis-2022.pdf',
              pageNumber: 2,
              confidence: 94,
              scannedPageCount: 2,
              matchedFields: ['waterUnitPrice'],
              warnings: [],
            },
          },
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 10000 }, { Maara: 5000 }],
          effectiveRows: [{ Maara: 12000 }, { Maara: 5000 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'QDIS import',
            provenance: {
              kind: 'qdis_import',
              fileName: 'qdis-2022.pdf',
              pageNumber: 2,
              confidence: 94,
              scannedPageCount: 2,
              matchedFields: ['soldWaterVolume'],
              warnings: [],
            },
          },
        },
      ],
    };

    expect(buildImportYearSourceLayers(yearData)).toEqual([
      expect.objectContaining({
        key: 'financials',
        provenanceKind: 'statement_import',
      }),
      expect.objectContaining({
        key: 'prices',
        provenanceKind: 'qdis_import',
      }),
      expect.objectContaining({
        key: 'volumes',
        provenanceKind: 'qdis_import',
      }),
    ]);
  });

  it('keeps the six-row year-card summary in direct canon order', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 1000,
          AineetJaPalvelut: 200,
          Henkilostokulut: 300,
          Poistot: 40,
          LiiketoiminnanMuutKulut: 50,
          TilikaudenYliJaama: 410,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 1100,
          AineetJaPalvelut: 210,
          Henkilostokulut: 320,
          Poistot: 45,
          LiiketoiminnanMuutKulut: 55,
          TilikaudenYliJaama: 470,
        },
      ],
    });

    expect(buildImportYearSummaryRows(yearData).map((row) => row.key)).toEqual([
      'revenue',
      'materialsCosts',
      'personnelCosts',
      'depreciation',
      'otherOperatingCosts',
      'result',
    ]);
  });

  it('surfaces workbook provenance on the financial layer and trust signal', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 1000,
          AineetJaPalvelut: null,
          TilikaudenYliJaama: 25,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 1000,
          AineetJaPalvelut: 210,
          TilikaudenYliJaama: 25,
        },
      ],
      overrideMeta: {
        editedAt: '2026-03-08T10:00:00.000Z',
        editedBy: 'tester',
        reason: 'Workbook repair',
        provenance: {
          kind: 'kva_import',
          fileName: 'kronoby-kva.xlsx',
          pageNumber: null,
          confidence: null,
          scannedPageCount: null,
          matchedFields: ['AineetJaPalvelut'],
          warnings: [],
          sheetName: 'KVA totalt',
          confirmedSourceFields: ['AineetJaPalvelut'],
          candidateRows: [
            {
              sourceField: 'AineetJaPalvelut',
              workbookValue: 210,
              action: 'apply_workbook',
            },
          ],
        },
      },
    });

    expect(buildImportYearSourceLayers(yearData)[0]).toMatchObject({
      key: 'financials',
      provenanceKind: 'kva_import',
      fileName: 'kronoby-kva.xlsx',
    });
    expect(buildImportYearTrustSignal(yearData)).toMatchObject({
      level: 'material',
      reasons: expect.arrayContaining(['workbook_import', 'mixed_source']),
      workbookImport: expect.objectContaining({
        kind: 'kva_import',
        fileName: 'kronoby-kva.xlsx',
        confirmedSourceFields: ['AineetJaPalvelut'],
      }),
    });
  });

  it('keeps both statement and workbook reasons when field ownership is mixed inside one financial year', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 700000,
          AineetJaPalvelut: null,
          TilikaudenYliJaama: 25000,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 786930.85,
          AineetJaPalvelut: 182000.12,
          TilikaudenYliJaama: 3691.35,
        },
      ],
      overrideMeta: {
        editedAt: '2026-03-08T10:00:00.000Z',
        editedBy: 'tester',
        reason: 'Statement + Excel repair',
        provenance: {
          kind: 'kva_import',
          fileName: 'kronoby-kva.xlsx',
          pageNumber: null,
          confidence: null,
          scannedPageCount: null,
          matchedFields: ['AineetJaPalvelut'],
          warnings: [],
          sheetName: 'KVA totalt',
          confirmedSourceFields: ['AineetJaPalvelut'],
          candidateRows: [
            {
              sourceField: 'AineetJaPalvelut',
              workbookValue: 182000.12,
              action: 'apply_workbook',
            },
          ],
          fieldSources: [
            {
              sourceField: 'Liikevaihto',
              provenance: {
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: ['liikevaihto', 'tilikaudenYliJaama'],
                warnings: [],
              },
            },
            {
              sourceField: 'AineetJaPalvelut',
              provenance: {
                kind: 'kva_import',
                fileName: 'kronoby-kva.xlsx',
                pageNumber: null,
                confidence: null,
                scannedPageCount: null,
                matchedFields: ['AineetJaPalvelut'],
                warnings: [],
                sheetName: 'KVA totalt',
                confirmedSourceFields: ['AineetJaPalvelut'],
                candidateRows: [
                  {
                    sourceField: 'AineetJaPalvelut',
                    workbookValue: 182000.12,
                    action: 'apply_workbook',
                  },
                ],
              },
            },
          ],
        },
      },
    });

    expect(buildImportYearTrustSignal(yearData)).toMatchObject({
      reasons: expect.arrayContaining([
        'statement_import',
        'workbook_import',
        'mixed_source',
      ]),
      statementImport: expect.objectContaining({
        kind: 'statement_import',
      }),
      workbookImport: expect.objectContaining({
        kind: 'kva_import',
      }),
    });
  });

  it('derives discrepancy reasons for manual and statement-backed year corrections', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 1000,
          TilikaudenYliJaama: 25,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 1400,
          TilikaudenYliJaama: 50,
        },
      ],
      overrideMeta: {
        editedAt: '2026-03-08T10:00:00.000Z',
        editedBy: 'tester',
        reason: 'Statement-backed correction',
        provenance: {
          kind: 'statement_import',
          fileName: 'bokslut-2024.pdf',
          pageNumber: 3,
          confidence: 98,
          scannedPageCount: 5,
          matchedFields: ['liikevaihto', 'tilikaudenYliJaama'],
          warnings: [],
        },
      },
    });

    expect(buildImportYearTrustSignal(yearData)).toMatchObject({
      level: 'material',
      reasons: expect.arrayContaining(['statement_import', 'mixed_source', 'result_changed']),
      changedSummaryKeys: ['revenue', 'result'],
      statementImport: expect.objectContaining({
        fileName: 'bokslut-2024.pdf',
      }),
    });
  });

  it('derives a numeric result-to-zero signal from the effective summary rows', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 95000,
          TilikaudenYliJaama: 25000,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 100000,
          TilikaudenYliJaama: 3000,
        },
      ],
    });

    expect(buildImportYearResultToZeroSignal(yearData)).toMatchObject({
      rawValue: 25000,
      effectiveValue: 3000,
      delta: -22000,
      absoluteGap: 3000,
      marginPct: 3,
      direction: 'above_zero',
    });
  });

  it('uses the explicit TilikaudenYliJaama field for the visible result summary even when the other rows imply a different derived result', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 1000,
          AineetJaPalvelut: 200,
          Henkilostokulut: 300,
          Poistot: 40,
          LiiketoiminnanMuutKulut: 50,
          TilikaudenYliJaama: 25,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 1200,
          AineetJaPalvelut: 210,
          Henkilostokulut: 320,
          Poistot: 45,
          LiiketoiminnanMuutKulut: 55,
          TilikaudenYliJaama: 410,
        },
      ],
    });

    const summaryRows = buildImportYearSummaryRows(yearData);
    const resultRow = summaryRows.find((row) => row.key === 'result');

    expect(resultRow).toMatchObject({
      sourceField: 'TilikaudenYliJaama',
      rawValue: 25,
      effectiveValue: 410,
      changed: true,
    });
    expect(buildImportYearResultToZeroSignal(yearData)).toMatchObject({
      rawValue: 25,
      effectiveValue: 410,
      delta: 385,
      absoluteGap: 410,
      marginPct: 34.17,
      direction: 'above_zero',
    });
  });

  it('builds price and volume comparison rows from raw vs effective datasets', () => {
    const yearData: V2ImportYearDataResponse = {
      ...buildYearData({
        rawRows: [{ Liikevaihto: 1000 }],
        effectiveRows: [{ Liikevaihto: 1000 }],
        reconcileNeeded: false,
      }),
      datasets: [
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 10000 }, { Maara: 5000 }],
          effectiveRows: [{ Maara: 12000 }, { Maara: 5000 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 8000 }],
          effectiveRows: [{ Maara: 8000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    };

    expect(buildPriceComparisonRows(yearData)).toEqual([
      {
        key: 'waterUnitPrice',
        veetiValue: 2.5,
        effectiveValue: 2.75,
        changed: true,
      },
      {
        key: 'wastewaterUnitPrice',
        veetiValue: 3.2,
        effectiveValue: 3.2,
        changed: false,
      },
    ]);
    expect(buildVolumeComparisonRows(yearData)).toEqual([
      {
        key: 'soldWaterVolume',
        veetiValue: 15000,
        effectiveValue: 17000,
        changed: true,
      },
      {
        key: 'soldWastewaterVolume',
        veetiValue: 8000,
        effectiveValue: 8000,
        changed: false,
      },
    ]);
  });

  it('only allows VEETI re-apply when the year has a financial reconcile path and the user is admin', () => {
    const yearData = buildYearData({
      rawRows: [{ Liikevaihto: 1000 }],
      effectiveRows: [{ Liikevaihto: 1200 }],
      reconcileNeeded: true,
    });

    expect(canReapplyFinancialVeeti(yearData, true)).toBe(true);
    expect(canReapplyFinancialVeeti(yearData, false)).toBe(false);
    expect(
      canReapplyFinancialVeeti(
        buildYearData({
          rawRows: [{ Liikevaihto: 1000 }],
          effectiveRows: [{ Liikevaihto: 1000 }],
          reconcileNeeded: false,
        }),
        true,
      ),
    ).toBe(false);
    expect(
      canReapplyDatasetVeeti(
        {
          ...yearData,
          datasets: [
            {
              dataType: 'taksa',
              rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
              effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.7 }],
              source: 'manual',
              hasOverride: true,
              reconcileNeeded: true,
              overrideMeta: null,
            },
          ],
        },
        ['taksa'],
        true,
      ),
    ).toBe(true);
  });

  it('sends review continue to the first problem year when attention is still needed', () => {
    expect(
      resolveReviewContinueTarget([
        { year: 2024, setupStatus: 'ready_for_review' },
        { year: 2023, setupStatus: 'needs_attention' },
      ]),
    ).toEqual({
      nextStep: 4,
      selectedProblemYear: 2023,
      yearsToMarkReviewed: [],
    });
  });

  it('sends review continue to the first technically ready year when explicit approval is still needed', () => {
    expect(
      resolveReviewContinueTarget([
        { year: 2024, setupStatus: 'ready_for_review' },
        { year: 2023, setupStatus: 'excluded_from_plan' },
      ]),
    ).toEqual({
      nextStep: 4,
      selectedProblemYear: 2024,
      yearsToMarkReviewed: [],
    });
  });

  it('keeps the wizard on the review queue when unresolved years remain after approval', () => {
    expect(
      resolveApprovedYearStep(
        [
          { year: 2024, setupStatus: 'ready_for_review' },
          { year: 2023, setupStatus: 'needs_attention' },
        ],
        2024,
      ),
    ).toBe(3);
  });

  it('moves to baseline creation when the approved year closes the review queue', () => {
    expect(
      resolveApprovedYearStep(
        [
          { year: 2024, setupStatus: 'ready_for_review' },
          { year: 2023, setupStatus: 'reviewed' },
          { year: 2022, setupStatus: 'excluded_from_plan' },
        ],
        2024,
      ),
    ).toBe(5);
  });

  it('picks the next blocked year before remaining ready years in the review queue', () => {
    expect(
      resolveNextReviewQueueYear([
        { year: 2024, setupStatus: 'reviewed' },
        { year: 2023, setupStatus: 'needs_attention' },
        { year: 2022, setupStatus: 'ready_for_review' },
      ]),
    ).toBe(2023);
  });

  it('returns the next ready year when no blocked years remain', () => {
    expect(
      resolveNextReviewQueueYear([
        { year: 2024, setupStatus: 'reviewed' },
        { year: 2023, setupStatus: 'ready_for_review' },
      ]),
    ).toBe(2023);
    expect(
      resolveNextReviewQueueYear([
        { year: 2024, setupStatus: 'reviewed' },
        { year: 2023, setupStatus: 'excluded_from_plan' },
      ]),
    ).toBeNull();
  });

  it('ignores current-year estimates when resolving the mandatory review queue', () => {
    expect(
      resolveReviewContinueTarget([
        { year: 2026, planningRole: 'current_year_estimate', setupStatus: 'needs_attention' },
        { year: 2024, setupStatus: 'reviewed' },
      ]),
    ).toEqual({
      nextStep: 5,
      selectedProblemYear: null,
      yearsToMarkReviewed: [],
    });

    expect(
      resolveApprovedYearStep(
        [
          { year: 2026, planningRole: 'current_year_estimate', setupStatus: 'needs_attention' },
          { year: 2024, setupStatus: 'ready_for_review' },
        ],
        2024,
      ),
    ).toBe(5);

    expect(
      resolveNextReviewQueueYear([
        { year: 2024, setupStatus: 'reviewed' },
        { year: 2026, planningRole: 'current_year_estimate', setupStatus: 'needs_attention' },
      ]),
    ).toBeNull();
  });
});
