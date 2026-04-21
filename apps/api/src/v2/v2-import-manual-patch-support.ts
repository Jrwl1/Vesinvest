import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { parseKvaWorkbookPreview } from '../budgets/va-import/kva-workbook-preview';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiEffectiveDataService, type OverrideProvenance } from '../veeti/veeti-effective-data.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { IMPORT_YEAR_SUMMARY_FIELDS } from './v2-import-overview.constants';
import { createV2ImportManualFinancialSupport } from './v2-import-manual-financial-support';
import type { ImportYearReconcileDto } from './dto/import-year-reconcile.dto';
import type { ManualYearCompletionDto, ManualYearDocumentImportSourceLineDto, ManualYearWorkbookCandidateDto } from './dto/manual-year-completion.dto';
import type { OverrideProvenanceCore, StatementPreviewRequest, StatementPreviewResponse, WorkbookPreviewRequest, WorkbookPreviewResponse } from './v2-import-overview.types';
import type { VeetiDataType } from '../veeti/veeti.service';
type ImportManualPatchContext = {
  prisma: PrismaService;
  veetiEffectiveDataService: VeetiEffectiveDataService;
  veetiSyncService: VeetiSyncService;
  manualPatchSupport: ReturnType<typeof createV2ImportManualFinancialSupport>;
  assertStatementPreviewUpload(input: StatementPreviewRequest): void;
  assertWorkbookPreviewUpload(input: WorkbookPreviewRequest): void;
  augmentCompletenessWithTariffRevenue(
    completeness: Record<string, boolean>,
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
  ): {
    completeness: Record<string, boolean>;
    tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null;
  };
  buildImportYearResultToZeroSignal(summaryRows: unknown): unknown;
  buildImportYearSubrowAvailability(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): unknown;
  buildImportYearSummaryRows(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): Array<{
    sourceField: string;
    effectiveValue: number | null;
    effectiveSource: 'direct' | 'missing';
    key: string;
    changed: boolean;
  }>;
  buildImportYearTrustSignal(yearDataset: unknown, summaryRows: unknown): unknown;
  buildStatementPreviewFields(
    veetiRow: Record<string, unknown> | null,
    effectiveRow: Record<string, unknown> | null,
  ): StatementPreviewResponse['fields'];
  emptyCompleteness(): Record<string, boolean>;
  evaluateBaselineReadiness(
    completeness: Record<string, boolean>,
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
    summaryRows: ReturnType<ImportManualPatchContext['buildImportYearSummaryRows']>,
    tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null,
  ): {
    baselineReady: boolean;
    baselineMissingRequirements: Array<'financialBaseline' | 'prices' | 'volumes'>;
    baselineWarnings: Array<'tariffRevenueMismatch'>;
  };
  getImportStatus(orgId: string): Promise<{
    years: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      baselineReady?: boolean;
      baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
      baselineWarnings?: Array<'tariffRevenueMismatch'>;
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    }>;
    excludedYears?: number[];
    workspaceYears?: number[];
    [key: string]: unknown;
  }>;
  hydrateYearRowsWithTariffRevenueReadiness<T extends { vuosi: number; completeness: Record<string, boolean> }>(
    orgId: string,
    yearRows: T[],
  ): Promise<
    Array<
      T & {
        tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null;
        baselineReady: boolean;
        baselineMissingRequirements: Array<'financialBaseline' | 'prices' | 'volumes'>;
        baselineWarnings: Array<'tariffRevenueMismatch'>;
      }
    >
  >;
  normalizeText(value: string | null | undefined): string | null;
  normalizeYears(years: number[]): number[];
  resolveMissingSyncRequirements(
    completeness: Record<string, boolean>,
  ): Array<'financials' | 'prices' | 'volumes' | 'tariffRevenue'>;
  round2(value: number): number;
  summaryValuesDiffer(left: number | null, right: number | null): boolean;
  toNumber(value: unknown): number;
};
export function createV2ImportManualPatchSupport(ctx: ImportManualPatchContext) {
  const financialSupport = createV2ImportManualFinancialSupport(ctx);
  return {
    ...financialSupport,
  async getImportYearData(orgId: string, year: number) {
    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }
    const yearDataset = await ctx.veetiEffectiveDataService.getYearDataset(
      orgId,
      targetYear,
    );
    const summaryRows = ctx.buildImportYearSummaryRows(yearDataset);
    const { completeness, tariffRevenueReason } =
      ctx.augmentCompletenessWithTariffRevenue(
        yearDataset.completeness ?? ctx.emptyCompleteness(),
        yearDataset,
      );
    const baselineReadiness = ctx.evaluateBaselineReadiness(
      completeness,
      yearDataset,
      summaryRows,
      tariffRevenueReason,
    );
    return {
      ...yearDataset,
      completeness,
      tariffRevenueReason,
      ...baselineReadiness,
      summaryRows,
      trustSignal: ctx.buildImportYearTrustSignal(yearDataset, summaryRows),
      resultToZero: ctx.buildImportYearResultToZeroSignal(summaryRows),
      subrowAvailability: ctx.buildImportYearSubrowAvailability(yearDataset),
    };
  },
  async previewWorkbookImport(
    orgId: string,
    input: WorkbookPreviewRequest,
  ): Promise<WorkbookPreviewResponse> {
    const link = await ctx.veetiSyncService.getStatus(orgId);
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }
    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new BadRequestException('Workbook file is required.');
    }
    ctx.assertWorkbookPreviewUpload(input);
    let parsedWorkbook: Awaited<ReturnType<typeof parseKvaWorkbookPreview>>;
    try {
      parsedWorkbook = await parseKvaWorkbookPreview(input.fileBuffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Workbook preview failed.',
      );
    }
    const availableYears = await ctx.veetiEffectiveDataService.getAvailableYears(
      orgId,
    );
    const importedYears = ctx.normalizeYears(
      link.workspaceYears?.length
        ? link.workspaceYears
        : availableYears.map((row) => row.vuosi),
    );
    const workbookYearSet = new Set(parsedWorkbook.workbookYears);
    const matchedYears = importedYears.filter((year) => workbookYearSet.has(year));
    const years = await Promise.all(
      matchedYears.map(async (year) => {
        const yearDataset = await ctx.veetiEffectiveDataService.getYearDataset(
          orgId,
          year,
        );
        const summaryRows = ctx.buildImportYearSummaryRows(yearDataset);
        const workbookRows = parsedWorkbook.valuesByYear.get(year) ?? {};
        return {
          year,
          sourceStatus: yearDataset.sourceStatus,
          rows: IMPORT_YEAR_SUMMARY_FIELDS.map(({ key, sourceField }) => {
            const currentRow =
              summaryRows.find((row) => row.sourceField === sourceField) ?? null;
            const currentValue = currentRow?.effectiveValue ?? null;
            const workbookValue = workbookRows[sourceField] ?? null;
            return {
              key,
              sourceField,
              currentValue,
              workbookValue,
              differs: ctx.summaryValuesDiffer(currentValue, workbookValue),
              currentSource: currentRow?.effectiveSource ?? 'missing',
              suggestedAction:
                currentRow?.effectiveSource === 'missing' && workbookValue != null
                  ? ('apply_workbook' as const)
                  : ('keep_veeti' as const),
            };
          }),
        };
      }),
    );
    return {
      document: {
        fileName:
          ctx.normalizeText(input.fileName)?.trim() || 'workbook.xlsx',
        contentType: input.contentType ?? null,
        sizeBytes: input.sizeBytes,
        receivedAt: new Date().toISOString(),
      },
      sheetName: parsedWorkbook.sheetName,
      workbookYears: parsedWorkbook.workbookYears,
      importedYears,
      matchedYears,
      unmatchedImportedYears: importedYears.filter(
        (year) => !workbookYearSet.has(year),
      ),
      unmatchedWorkbookYears: parsedWorkbook.workbookYears.filter(
        (year) => !importedYears.includes(year),
      ),
      years,
      canApply: years.length > 0,
    };
  },
  async previewStatementImport(
    orgId: string,
    year: number,
    input: StatementPreviewRequest,
  ): Promise<StatementPreviewResponse> {
    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }
    if (input.statementType && input.statementType !== 'result_statement') {
      throw new BadRequestException(
        'Only result_statement previews are supported.',
      );
    }
    if (!input.fileBuffer || input.sizeBytes <= 0 || !input.fileName) {
      throw new BadRequestException('Statement PDF file is required.');
    }
    ctx.assertStatementPreviewUpload(input);
    const yearData = await ctx.veetiEffectiveDataService.getYearDataset(
      orgId,
      targetYear,
    );
    const tilinpaatosDataset =
      yearData.datasets.find((row) => row.dataType === 'tilinpaatos') ?? null;
    const veetiRow = (tilinpaatosDataset?.rawRows?.[0] ??
      null) as Record<string, unknown> | null;
    const effectiveRow = (tilinpaatosDataset?.effectiveRows?.[0] ??
      null) as Record<string, unknown> | null;
    const receivedAt = new Date().toISOString();
    return {
      year: targetYear,
      statementType: 'result_statement',
      document: {
        fileName: ctx.normalizeText(input.fileName) ?? input.fileName,
        contentType: input.contentType,
        sizeBytes: Math.round(input.sizeBytes),
        receivedAt,
        parserStatus: 'pending_parser',
      },
      fields: ctx.buildStatementPreviewFields(veetiRow, effectiveRow),
      sourceRows: [],
      warnings: [
        'Statement PDF upload contract is ready, but row extraction is not implemented yet.',
        'Extracted rows and proposed override values will be populated after the parser step is completed.',
      ],
      canApply: false,
    };
  },
  async reconcileImportYear(
    orgId: string,
    _userId: string,
    roles: string[],
    year: number,
    body: ImportYearReconcileDto,
  ) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only admins can reconcile VEETI year data.',
      );
    }
    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }
    const yearData = await ctx.veetiEffectiveDataService.getYearDataset(
      orgId,
      targetYear,
    );
    const defaultDataTypes = yearData.datasets
      .filter((row: { reconcileNeeded?: boolean }) => row.reconcileNeeded)
      .map((row: { dataType: string }) => row.dataType);
    const requestedDataTypes = Array.isArray(body?.dataTypes)
      ? body.dataTypes
      : defaultDataTypes;
    const allowedDataTypes = new Set<VeetiDataType>([
      'tilinpaatos',
      'taksa',
      'volume_vesi',
      'volume_jatevesi',
      'investointi',
      'energia',
      'verkko',
    ]);
    const dataTypes = requestedDataTypes
      .map((item: unknown) => String(item))
      .filter((item: string): item is VeetiDataType =>
        allowedDataTypes.has(item as VeetiDataType),
      );
    if (body.action === 'apply_veeti' && dataTypes.length > 0) {
      await ctx.veetiEffectiveDataService.removeOverrides(
        orgId,
        yearData.veetiId,
        targetYear,
        dataTypes,
      );
    }
    return {
      year: targetYear,
      action: body.action,
      reconciledDataTypes: dataTypes,
      status: await ctx.getImportStatus(orgId),
      yearData: await ctx.veetiEffectiveDataService.getYearDataset(
        orgId,
        targetYear,
      ),
    };
  },
  async clearImportAndScenarios(
    orgId: string,
    roles: string[],
    confirmToken?: string,
  ) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can clear imported data.');
    }
    const expectedToken = orgId.slice(0, 8).toUpperCase();
    const providedToken = (confirmToken ?? '').trim().toUpperCase();
    if (!providedToken || providedToken !== expectedToken) {
      throw new BadRequestException({
        message: 'Confirmation token did not match. Database was not cleared.',
        code: 'CLEAR_CONFIRMATION_INVALID',
      });
    }
    // Current destructive scope: all forecast scenarios, VEETI-derived budgets,
    // imported snapshots, override rows, year policies, Vesinvest plan state,
    // and VEETI link state.
    const veetiBudgetRows = await ctx.prisma.talousarvio.findMany({
      where: {
        orgId,
        OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
      },
      select: { id: true },
    });
    const veetiBudgetIds = veetiBudgetRows.map((row) => row.id);
    const [
      deletedScenarios,
      deletedBudgets,
      deletedSnapshots,
      deletedOverrides,
      deletedYearPolicies,
      deletedPlanSeries,
      deletedLink,
    ] = await ctx.prisma.$transaction([
      ctx.prisma.ennuste.deleteMany({
        where: { orgId },
      }),
      ctx.prisma.talousarvio.deleteMany({
        where: {
          orgId,
          id: { in: veetiBudgetIds },
        },
      }),
      ctx.prisma.veetiSnapshot.deleteMany({
        where: { orgId },
      }),
      ctx.prisma.veetiOverride.deleteMany({
        where: { orgId },
      }),
      ctx.prisma.veetiYearPolicy.deleteMany({
        where: { orgId },
      }),
      ctx.prisma.vesinvestPlanSeries.deleteMany({
        where: { orgId },
      }),
      ctx.prisma.veetiOrganisaatio.deleteMany({
        where: { orgId },
      }),
    ]);
    return {
      deletedScenarios: deletedScenarios.count,
      deletedVeetiBudgets: deletedBudgets.count,
      deletedVeetiSnapshots: deletedSnapshots.count,
      deletedVeetiOverrides: deletedOverrides.count,
      deletedVeetiYearPolicies: deletedYearPolicies.count,
      deletedVesinvestPlanSeries: deletedPlanSeries.count,
      deletedVeetiLinks: deletedLink.count,
      status: await ctx.getImportStatus(orgId),
    };
  },
  async completeImportYearManually(
    orgId: string,
    userId: string,
    roles: string[],
    body: ManualYearCompletionDto,
  ) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can patch VEETI import years.');
    }
    const year = Math.round(Number(body.year));
    if (!Number.isFinite(year)) {
      throw new BadRequestException('Invalid year.');
    }
    const link = await ctx.veetiSyncService.getStatus(orgId);
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }
    const hasPatchSection =
      body.financials != null ||
      body.prices != null ||
      body.volumes != null ||
      body.investments != null ||
      body.energy != null ||
      body.network != null;
    if (!hasPatchSection) {
      throw new BadRequestException('Provide at least one patch section.');
    }
    const yearRows = await ctx.hydrateYearRowsWithTariffRevenueReadiness(
      orgId,
      await ctx.veetiSyncService.getAvailableYears(orgId),
    );
    const existing = yearRows.find(
      (row: { vuosi: number; completeness?: Record<string, boolean> }) =>
        row.vuosi === year,
    );
    const missingBefore = ctx.resolveMissingSyncRequirements(
      existing?.completeness ?? ctx.emptyCompleteness(),
    );
    const existingYearDataset =
      typeof ctx.veetiEffectiveDataService.getYearDataset === 'function'
        ? await ctx.veetiEffectiveDataService.getYearDataset(orgId, year)
        : null;
    const now = new Date();
    const workbookCandidateRows = body.workbookImport?.candidateRows
      ?.map((row: ManualYearWorkbookCandidateDto) => {
        const sourceField = String(row.sourceField ?? '').trim();
        const action =
          row.action === 'keep_veeti' || row.action === 'apply_workbook'
            ? row.action
            : null;
        if (!sourceField || action == null) {
          return null;
        }
        return {
          sourceField,
          workbookValue:
            row.workbookValue == null
              ? null
              : ctx.round2(ctx.toNumber(row.workbookValue)),
          action,
        };
      })
      .filter(
        (
          row: {
            sourceField: string;
            workbookValue: number | null;
            action: 'keep_veeti' | 'apply_workbook';
          } | null,
        ): row is {
          sourceField: string;
          workbookValue: number | null;
          action: 'keep_veeti' | 'apply_workbook';
        } => row !== null,
      ) ?? [];
    const workbookConfirmedSourceFields = [
      ...new Set(
        [
          ...(body.workbookImport?.confirmedSourceFields ?? []),
          ...workbookCandidateRows
            .filter(
              (row: { action: 'keep_veeti' | 'apply_workbook' }) =>
                row.action === 'apply_workbook',
            )
            .map((row: { sourceField: string }) => row.sourceField),
        ]
          .map((field: unknown) => String(field ?? '').trim())
          .filter((field: string) => field.length > 0),
      ),
    ];
    const workbookMatchedFields = [
      ...new Set(
        [
          ...(body.workbookImport?.matchedFields ?? []),
          ...workbookCandidateRows.map((row: { sourceField: string }) => row.sourceField),
        ]
          .map((field: unknown) => String(field ?? '').trim())
          .filter((field: string) => field.length > 0),
      ),
    ];
    const createBaseProvenance = (
      kind:
        | 'manual_edit'
        | 'statement_import'
        | 'qdis_import'
        | 'document_import'
        | 'kva_import'
        | 'excel_import',
    ): OverrideProvenanceCore =>
      kind === 'statement_import' && body.statementImport
        ? {
            kind: 'statement_import',
            fileName:
              ctx.normalizeText(body.statementImport.fileName) ??
              body.statementImport.fileName,
            pageNumber: body.statementImport.pageNumber ?? null,
            confidence: body.statementImport.confidence ?? null,
            scannedPageCount: body.statementImport.scannedPageCount ?? null,
            matchedFields: body.statementImport.matchedFields ?? [],
            warnings: body.statementImport.warnings ?? [],
          }
        : kind === 'qdis_import' && body.qdisImport
        ? {
            kind: 'qdis_import',
            fileName:
              ctx.normalizeText(body.qdisImport.fileName) ??
              body.qdisImport.fileName,
            pageNumber: body.qdisImport.pageNumber ?? null,
            confidence: body.qdisImport.confidence ?? null,
            scannedPageCount: body.qdisImport.scannedPageCount ?? null,
            matchedFields: body.qdisImport.matchedFields ?? [],
            warnings: body.qdisImport.warnings ?? [],
          }
        : kind === 'document_import' && body.documentImport
        ? {
            kind: 'document_import',
            fileName:
              ctx.normalizeText(body.documentImport.fileName) ??
              body.documentImport.fileName,
            pageNumber: body.documentImport.pageNumber ?? null,
            pageNumbers: body.documentImport.pageNumbers ?? [],
            confidence: body.documentImport.confidence ?? null,
            scannedPageCount: body.documentImport.scannedPageCount ?? null,
            matchedFields: body.documentImport.matchedFields ?? [],
            warnings: body.documentImport.warnings ?? [],
            documentProfile: body.documentImport.documentProfile ?? null,
            datasetKinds: body.documentImport.datasetKinds ?? [],
            sourceLines: (
              body.documentImport.sourceLines ?? []
            ).map((row: ManualYearDocumentImportSourceLineDto) => ({
              text: ctx.normalizeText(row.text) ?? row.text ?? '',
              pageNumber: row.pageNumber ?? null,
            })),
          }
        : (kind === 'kva_import' || kind === 'excel_import') &&
          body.workbookImport
        ? {
            kind,
            fileName:
              ctx.normalizeText(body.workbookImport.fileName) ??
              body.workbookImport.fileName,
            pageNumber: null,
            confidence: null,
            scannedPageCount: null,
            matchedFields: workbookMatchedFields,
            warnings: body.workbookImport.warnings ?? [],
            sheetName: body.workbookImport.sheetName ?? null,
            matchedYears: body.workbookImport.matchedYears ?? [],
            confirmedSourceFields: workbookConfirmedSourceFields,
            candidateRows: workbookCandidateRows,
          }
        : {
            kind: 'manual_edit',
            fileName: null,
            pageNumber: null,
            confidence: null,
            scannedPageCount: null,
            matchedFields: [],
            warnings: [],
          };
    const buildSourceMeta = (provenance: OverrideProvenanceCore | OverrideProvenance) => ({
      source: 'manual_year_patch',
      imported: false,
      manualOverride: true,
      patchedAt: now.toISOString(),
      reason: body.reason ?? null,
      provenance,
    });
    const manualEditProvenance = createBaseProvenance('manual_edit');
    const documentImportProvenance = body.documentImport
      ? createBaseProvenance('document_import')
      : null;
    const statementFinancialProvenance = body.statementImport
      ? createBaseProvenance('statement_import')
      : documentImportProvenance &&
          (body.documentImport?.datasetKinds?.includes('financials') ??
            Boolean(body.financials))
        ? documentImportProvenance
        : manualEditProvenance;
    const currentFinancialProvenance =
      existingYearDataset?.datasets.find(
        (row: { dataType: string }) => row.dataType === 'tilinpaatos',
      )
        ?.overrideMeta?.provenance ?? null;
    const workbookFinancialProvenance = body.workbookImport
      ? createBaseProvenance(body.workbookImport.kind ?? 'excel_import')
      : null;
    const financialSourceMeta = buildSourceMeta(
      ctx.manualPatchSupport.mergeFinancialOverrideProvenance(
        currentFinancialProvenance,
        workbookFinancialProvenance ?? statementFinancialProvenance,
      ) ?? (workbookFinancialProvenance ?? statementFinancialProvenance),
    );
    const manualEditSourceMeta = buildSourceMeta(manualEditProvenance);
    const qdisPriceVolumeSourceMeta = body.qdisImport
      ? buildSourceMeta(createBaseProvenance('qdis_import'))
      : documentImportProvenance &&
          (body.documentImport?.datasetKinds?.some(
            (kind: string) => kind === 'prices' || kind === 'volumes',
          ) ??
            Boolean(body.prices || body.volumes))
        ? buildSourceMeta(documentImportProvenance)
        : manualEditSourceMeta;
    const patchOps: Array<Promise<unknown>> = [];
    const patchedDataTypes = new Set<string>();
    const upsertSnapshot = (
      dataType:
        | 'tilinpaatos'
        | 'taksa'
        | 'volume_vesi'
        | 'volume_jatevesi'
        | 'investointi'
        | 'energia'
        | 'verkko',
      rows: Array<Record<string, unknown>>,
    ) => {
      if (rows.length === 0) return;
      patchedDataTypes.add(dataType);
      patchOps.push(
        ctx.veetiEffectiveDataService.upsertOverride({
          orgId,
          veetiId: link.veetiId,
          vuosi: year,
          dataType,
          rows,
          editedBy: userId || null,
          reason: body.reason ?? null,
        }),
      );
    };
    if (body.financials) {
      const financialRow = ctx.manualPatchSupport.buildFinancialOverrideRow(
        year,
        body.financials,
        existingYearDataset,
        financialSourceMeta,
      );
      upsertSnapshot('tilinpaatos', financialRow ? [financialRow] : []);
    }
    if (body.prices) {
      const p = body.prices;
      upsertSnapshot('taksa', [
        {
          Vuosi: year,
          Tyyppi_Id: 1,
          Kayttomaksu: ctx.round2(ctx.toNumber(p.waterUnitPrice)),
          __sourceMeta: qdisPriceVolumeSourceMeta,
        },
        {
          Vuosi: year,
          Tyyppi_Id: 2,
          Kayttomaksu: ctx.round2(ctx.toNumber(p.wastewaterUnitPrice)),
          __sourceMeta: qdisPriceVolumeSourceMeta,
        },
      ]);
    }
    if (body.volumes) {
      const v = body.volumes;
      upsertSnapshot('volume_vesi', [
        {
          Vuosi: year,
          Maara: ctx.round2(ctx.toNumber(v.soldWaterVolume)),
          __sourceMeta: qdisPriceVolumeSourceMeta,
        },
      ]);
      upsertSnapshot('volume_jatevesi', [
        {
          Vuosi: year,
          Maara: ctx.round2(ctx.toNumber(v.soldWastewaterVolume)),
          __sourceMeta: qdisPriceVolumeSourceMeta,
        },
      ]);
    }
    if (body.investments) {
      upsertSnapshot('investointi', [
        {
          Vuosi: year,
          InvestoinninMaara: ctx.round2(
            ctx.toNumber(body.investments.investoinninMaara),
          ),
          KorvausInvestoinninMaara: ctx.round2(
            ctx.toNumber(body.investments.korvausInvestoinninMaara),
          ),
          __sourceMeta: manualEditSourceMeta,
        },
      ]);
    }
    if (body.energy) {
      upsertSnapshot('energia', [
        {
          Vuosi: year,
          ProsessinKayttamaSahko: ctx.round2(
            ctx.toNumber(body.energy.prosessinKayttamaSahko),
          ),
          __sourceMeta: manualEditSourceMeta,
        },
      ]);
    }
    if (body.network) {
      upsertSnapshot('verkko', [
        {
          Vuosi: year,
          VerkostonPituus: ctx.round2(
            ctx.toNumber(body.network.verkostonPituus),
          ),
          __sourceMeta: manualEditSourceMeta,
        },
      ]);
    }
    if (patchOps.length === 0) {
      throw new BadRequestException('No patch values to save.');
    }
    await Promise.all(patchOps);
    const status = await ctx.getImportStatus(orgId);
    const afterRow = status.years.find(
      (row: { vuosi: number; completeness?: Record<string, boolean> }) =>
        row.vuosi === year,
    );
    const missingAfter = ctx.resolveMissingSyncRequirements(
      afterRow?.completeness ?? ctx.emptyCompleteness(),
    );
    return {
      year,
      patchedDataTypes: [...patchedDataTypes].sort(),
      missingBefore,
      missingAfter,
      syncReady: afterRow?.baselineReady ?? missingAfter.length === 0,
      tariffRevenueReason: afterRow?.tariffRevenueReason ?? null,
      baselineReady: afterRow?.baselineReady ?? missingAfter.length === 0,
      baselineMissingRequirements: afterRow?.baselineMissingRequirements ?? [],
      baselineWarnings: afterRow?.baselineWarnings ?? [],
      status,
    };
  },
  };
}
