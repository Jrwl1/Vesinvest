import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { BudgetsRepository } from './budgets.repository';
import { BudgetImportService, ParsedBudgetRow, ImportRevenueDriver } from './budget-import.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { CreateRevenueDriverDto } from './dto/create-revenue-driver.dto';
import { UpdateRevenueDriverDto } from './dto/update-revenue-driver.dto';

/** Category keys allowed for KVA confirm (must match preview extraction). Reject non-previewed categories. */
const KVA_ALLOWED_CATEGORY_KEYS = new Set([
  'sales_revenue', 'connection_fees', 'other_income', 'materials_services', 'personnel_costs',
  'other_costs', 'purchased_services', 'rents', 'depreciation', 'financial_income', 'financial_costs',
  'investments', 'operating_result', 'net_result',
]);

type KvaDriverPayload = {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta?: number;
  myytyMaara?: number;
  perusmaksu?: number;
  liittymamaara?: number;
  alvProsentti?: number;
  sourceMeta?: Record<string, unknown>;
};

type KvaConfirmInput = Parameters<BudgetsRepository['confirmKvaImport']>[1] & {
  extractedYears?: number[];
  editedDriversByYear?: Record<number, KvaDriverPayload[]>;
  importQuality?: { requiredMissing?: string[] };
};

/**
 * V1: Budget totals (revenue, expenses, investments) are VAT-free.
 * Amounts are stored and summed without any VAT multiplier; display and projection use them as-is.
 */
@Injectable()
export class BudgetsService {
  constructor(
    private readonly repo: BudgetsRepository,
    private readonly importService: BudgetImportService,
  ) {}

  // ── Talousarvio ──

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  listBudgetSets(orgId: string) {
    return this.repo.findBudgetSets(orgId);
  }

  getBudgetsByBatchId(orgId: string, batchId: string) {
    return this.repo.findBudgetsByBatchId(orgId, batchId);
  }

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  create(orgId: string, dto: CreateBudgetDto) {
    return this.repo.create(orgId, dto);
  }

  /** Update budget (nimi, tila, perusmaksuYhteensa). Passes through full DTO to repo. */
  update(orgId: string, id: string, dto: UpdateBudgetDto) {
    return this.repo.update(orgId, id, dto);
  }

  delete(orgId: string, id: string) {
    return this.repo.delete(orgId, id);
  }

  // ── TalousarvioRivi ──

  createLine(orgId: string, budgetId: string, dto: CreateBudgetLineDto) {
    return this.repo.createLine(orgId, budgetId, dto);
  }

  updateLine(orgId: string, budgetId: string, lineId: string, dto: UpdateBudgetLineDto) {
    return this.repo.updateLine(orgId, budgetId, lineId, dto);
  }

  moveLine(
    orgId: string,
    budgetId: string,
    lineId: string,
    dto: { parentId?: string | null; sortOrder: number },
  ) {
    return this.repo.moveLine(orgId, budgetId, lineId, dto);
  }

  deleteLine(orgId: string, budgetId: string, lineId: string) {
    return this.repo.deleteLine(orgId, budgetId, lineId);
  }

  // ── Tuloajuri ──

  createDriver(orgId: string, budgetId: string, dto: CreateRevenueDriverDto) {
    return this.repo.createDriver(orgId, budgetId, dto);
  }

  updateDriver(orgId: string, budgetId: string, driverId: string, dto: UpdateRevenueDriverDto) {
    return this.repo.updateDriver(orgId, budgetId, driverId, dto);
  }

  deleteDriver(orgId: string, budgetId: string, driverId: string) {
    return this.repo.deleteDriver(orgId, budgetId, driverId);
  }

  // ── TalousarvioValisumma ──

  findValisummat(orgId: string, budgetId: string) {
    return this.repo.findValisummat(orgId, budgetId);
  }

  upsertValisumma(orgId: string, budgetId: string, data: Parameters<BudgetsRepository['upsertValisumma']>[2]) {
    return this.repo.upsertValisumma(orgId, budgetId, data);
  }

  upsertManyValisummat(orgId: string, budgetId: string, items: Parameters<BudgetsRepository['upsertManyValisummat']>[2]) {
    return this.repo.upsertManyValisummat(orgId, budgetId, items);
  }

  deleteValisummat(orgId: string, budgetId: string) {
    return this.repo.deleteValisummat(orgId, budgetId);
  }

  updateValisummaSumma(orgId: string, budgetId: string, valisummaId: string, summa: number) {
    return this.repo.updateValisummaSumma(orgId, budgetId, valisummaId, summa);
  }

  setValisummat(
    orgId: string,
    budgetId: string,
    items: Parameters<BudgetsRepository['upsertManyValisummat']>[2],
  ) {
    return this.repo.upsertManyValisummat(orgId, budgetId, items);
  }

  // ── Import ──

  async importPreview(orgId: string, budgetId: string, buffer: Buffer, filename: string) {
    // Verify budget ownership
    const budget = await this.repo.findById(orgId, budgetId);
    if (!budget) throw new BadRequestException('Budget not found');

    return this.importService.parseFile(buffer, filename);
  }

  /**
   * KVA preview without requiring a pre-existing budget.
   * Budget is created on confirm, not on preview.
   */
  async previewKva(orgId: string, buffer: Buffer, filename: string) {
    this.repo['requireOrgId'](orgId); // tenant guard
    return this.importService.parseFile(buffer, filename);
  }

  /**
   * KVA confirm: create a named budget profile with subtotals + drivers + optional account lines.
   * Totals-only contract: subtotalLines (Tulot, Kulut, Poistot, Investoinnit) per extracted year; create/update per org and budget name.
   * All-or-nothing transaction. Returns the created budget ID.
   * When extractedYears is provided, vuosi must be one of those years (from preview).
   * Guard behavior: year, subtotalLines, category keys; covered by budgets.service.spec.ts and web typecheck.
   */
  async confirmKvaImport(
    orgId: string,
    body: KvaConfirmInput,
  ) {
    const repoPayload = this.validateAndBuildKvaConfirmPayload(body);
    try {
      return await this.repo.confirmKvaImport(orgId, repoPayload);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'A budget with this name already exists for this year. Choose a different name or year.',
        );
      }
      throw err;
    }
  }

  async confirmKvaImportBatch(
    orgId: string,
    body: {
      years: KvaConfirmInput[];
      extractedYears?: number[];
      importBatchId?: string;
      importSourceFileName?: string;
      reimportMode?: 'replace_imported_scope' | 'replace_all';
    },
  ) {
    const yearsPayload = Array.isArray(body.years) ? body.years : [];
    if (yearsPayload.length === 0) {
      throw new BadRequestException('At least one year payload is required for batch import.');
    }

    const selectedYears = yearsPayload
      .map((yearPayload) => Number(yearPayload.vuosi))
      .filter((year) => Number.isInteger(year))
      .sort((a, b) => a - b);

    if (selectedYears.length !== yearsPayload.length) {
      throw new BadRequestException('Each batch payload entry must include a valid vuosi.');
    }

    if (selectedYears.length !== 3) {
      throw new BadRequestException('Batch import requires exactly 3 selected years.');
    }

    if (!(selectedYears[1] === selectedYears[0] + 1 && selectedYears[2] === selectedYears[1] + 1)) {
      throw new BadRequestException('Selected years must be 3 consecutive years.');
    }

    const sharedExtractedYears = body.extractedYears?.length ? body.extractedYears : selectedYears;
    const repoPayloads = yearsPayload.map((yearPayload) => (
      this.validateAndBuildKvaConfirmPayload({
        ...yearPayload,
        extractedYears: sharedExtractedYears,
        importBatchId: yearPayload.importBatchId ?? body.importBatchId,
        importSourceFileName: yearPayload.importSourceFileName ?? body.importSourceFileName,
        reimportMode: yearPayload.reimportMode ?? body.reimportMode,
      })
    ));

    try {
      return await this.repo.confirmKvaImportBatch(orgId, repoPayloads);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          'A budget with this name already exists for one of the selected years. Choose a different name or years.',
        );
      }
      throw err;
    }
  }

  private validateAndBuildKvaConfirmPayload(body: KvaConfirmInput): Parameters<BudgetsRepository['confirmKvaImport']>[1] {
    if (!body.nimi || !body.nimi.trim()) {
      throw new BadRequestException('Budget name (nimi) is required');
    }
    if (!body.vuosi || body.vuosi < 2000 || body.vuosi > 2100) {
      throw new BadRequestException('Year (vuosi) must be between 2000 and 2100');
    }
    if (
      Array.isArray(body.extractedYears)
      && body.extractedYears.length > 0
      && !body.extractedYears.includes(body.vuosi)
    ) {
      throw new BadRequestException(
        'Selected year must be one of the years extracted from the KVA file (extractedYears)',
      );
    }
    if (!body.subtotalLines || body.subtotalLines.length === 0) {
      throw new BadRequestException(
        'Extracted totals (subtotalLines) are required; re-run the KVA preview and confirm again.',
      );
    }
    const yearDriversFromMap = body.editedDriversByYear?.[body.vuosi];
    const drivers =
      Array.isArray(yearDriversFromMap) && yearDriversFromMap.length > 0
        ? yearDriversFromMap
        : (body.revenueDrivers ?? []);
    const driverOverrides = body.driverOverrides ?? [];
    const driverByType = new Map<'vesi' | 'jatevesi' | 'muu', {
      palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
      yksikkohinta: number;
      myytyMaara: number;
      perusmaksu?: number;
      liittymamaara?: number;
      alvProsentti?: number;
      sourceMeta?: Record<string, unknown>;
    }>();
    for (const d of drivers) {
      driverByType.set(d.palvelutyyppi, {
        ...d,
        yksikkohinta: Number(d.yksikkohinta ?? 0),
        myytyMaara: Number(d.myytyMaara ?? 0),
      });
    }
    for (const o of driverOverrides) {
      const base = driverByType.get(o.palvelutyyppi);
      if (!base) continue;
      driverByType.set(o.palvelutyyppi, {
        ...base,
        ...o,
        yksikkohinta: o.yksikkohinta ?? base.yksikkohinta,
        myytyMaara: o.myytyMaara ?? base.myytyMaara,
      });
    }
    const effectiveDrivers = Array.from(driverByType.values());
    const requiredChecks: Array<{ key: string; ok: boolean }> = [
      {
        key: 'vesi.yksikkohinta',
        ok: (effectiveDrivers.find((d) => d.palvelutyyppi === 'vesi')?.yksikkohinta ?? 0) > 0,
      },
      {
        key: 'vesi.myytyMaara',
        ok: (effectiveDrivers.find((d) => d.palvelutyyppi === 'vesi')?.myytyMaara ?? 0) > 0,
      },
      {
        key: 'jatevesi.yksikkohinta',
        ok: (effectiveDrivers.find((d) => d.palvelutyyppi === 'jatevesi')?.yksikkohinta ?? 0) > 0,
      },
      {
        key: 'jatevesi.myytyMaara',
        ok: (effectiveDrivers.find((d) => d.palvelutyyppi === 'jatevesi')?.myytyMaara ?? 0) > 0,
      },
    ];
    const requiredMissing = requiredChecks.filter((c) => !c.ok).map((c) => c.key);
    if (requiredMissing.length > 0) {
      throw new BadRequestException({
        code: 'KVA_REQUIRED_DRIVER_FIELDS_MISSING',
        message: `Missing required baseline fields for year ${body.vuosi}: ${requiredMissing.join(', ')}`,
        requiredMissing,
      });
    }
    const tyyppiToBucket = (tyyppi: string) =>
      tyyppi === 'tulo' || tyyppi === 'rahoitus_tulo' ? 'tulot' : tyyppi === 'kulu' || tyyppi === 'rahoitus_kulu' ? 'kulut' : tyyppi === 'poisto' ? 'poistot' : tyyppi === 'investointi' ? 'investoinnit' : null;
    const buckets = new Set<string>();
    for (const line of body.subtotalLines) {
      const b = tyyppiToBucket(line.tyyppi);
      if (b) buckets.add(b);
    }
    if (!buckets.has('tulot') || !buckets.has('kulut') || !buckets.has('poistot')) {
      const missing = [
        !buckets.has('tulot') && 'Tulot',
        !buckets.has('kulut') && 'Kulut',
        !buckets.has('poistot') && 'Poistot',
      ].filter(Boolean);
      throw new BadRequestException(
        `Required buckets missing for year ${body.vuosi}: ${missing.join(', ')}. Add at least one line per bucket.`,
      );
    }
    const extractedYearsSet =
      Array.isArray(body.extractedYears) && body.extractedYears.length > 0
        ? new Set(body.extractedYears)
        : null;

    for (const line of body.subtotalLines) {
      if (!KVA_ALLOWED_CATEGORY_KEYS.has(line.categoryKey)) {
        throw new BadRequestException(
          `Category "${line.categoryKey}" is not a valid KVA preview category; only categories from the preview may be used.`,
        );
      }
      const lineExt = line as typeof line & { year?: number; level?: number; order?: number };
      if (extractedYearsSet != null && lineExt.year != null && !extractedYearsSet.has(lineExt.year)) {
        throw new BadRequestException(
          `Subtotal line year ${lineExt.year} must be one of the extracted years (extractedYears).`,
        );
      }
      if (
        typeof line.summa !== 'number'
        || !line.palvelutyyppi
        || !line.tyyppi
      ) {
        throw new BadRequestException(
          'Each subtotal line must have palvelutyyppi, tyyppi, and summa (number).',
        );
      }
      if (lineExt.level != null && (typeof lineExt.level !== 'number' || lineExt.level < 0)) {
        throw new BadRequestException('Subtotal line level must be a non-negative number.');
      }
      if (lineExt.order != null && (typeof lineExt.order !== 'number' || lineExt.order < 0)) {
        throw new BadRequestException('Subtotal line order must be a non-negative number.');
      }
    }
    const { extractedYears: _drop, editedDriversByYear: _dropEditedByYear, ...rest } = body;
    return {
      ...rest,
      revenueDrivers: effectiveDrivers,
      driverOverrides: rest.driverOverrides ?? [],
      accountLines: rest.accountLines,
    };
  }

  async importConfirm(
    orgId: string,
    budgetId: string,
    rows: Array<{ tiliryhma: string; nimi: string; tyyppi: string; summa: number; muistiinpanot?: string }>,
    revenueDrivers?: ImportRevenueDriver[],
  ) {
    if (!rows || rows.length === 0) {
      throw new BadRequestException('No rows to import');
    }

    // Verify budget ownership
    const budget = await this.repo.findById(orgId, budgetId);
    if (!budget) throw new BadRequestException('Budget not found');

    // Create lines
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const tyyppi = row.tyyppi as 'kulu' | 'tulo' | 'investointi';
      if (!['kulu', 'tulo', 'investointi'].includes(tyyppi)) {
        skipped++;
        continue;
      }
      try {
        await this.repo.createLine(orgId, budgetId, {
          tiliryhma: row.tiliryhma,
          nimi: row.nimi,
          tyyppi,
          summa: row.summa,
          muistiinpanot: row.muistiinpanot,
        });
        created++;
      } catch {
        skipped++;
      }
    }

    // Upsert revenue drivers only when at least one field is meaningful (avoid overwriting real data with zeros)
    if (revenueDrivers && revenueDrivers.length > 0) {
      const validTypes = ['vesi', 'jatevesi', 'muu'] as const;
      for (const d of revenueDrivers) {
        if (!d.palvelutyyppi || !validTypes.includes(d.palvelutyyppi)) continue;
        const meaningful =
          (d.yksikkohinta ?? 0) > 0 ||
          (d.myytyMaara ?? 0) > 0 ||
          (d.liittymamaara ?? 0) > 0 ||
          (d.perusmaksu ?? 0) > 0;
        if (!meaningful) continue;
        try {
          await this.repo.upsertDriverByPalvelutyyppi(orgId, budgetId, {
            palvelutyyppi: d.palvelutyyppi,
            yksikkohinta: d.yksikkohinta ?? 0,
            myytyMaara: d.myytyMaara ?? 0,
            perusmaksu: d.perusmaksu,
            liittymamaara: d.liittymamaara,
            alvProsentti: d.alvProsentti,
            sourceMeta: d.sourceMeta ?? { imported: false, manualOverride: true, source: 'manual' },
          });
        } catch {
          // Skip failed driver upsert; lines were already created
        }
      }
    }

    return {
      success: true,
      created,
      skipped,
      total: rows.length,
    };
  }
}
