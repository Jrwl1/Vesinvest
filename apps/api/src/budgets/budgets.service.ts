import { Injectable, BadRequestException } from '@nestjs/common';
import { BudgetsRepository } from './budgets.repository';
import { BudgetImportService, ParsedBudgetRow, ImportRevenueDriver } from './budget-import.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { CreateRevenueDriverDto } from './dto/create-revenue-driver.dto';
import { UpdateRevenueDriverDto } from './dto/update-revenue-driver.dto';

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

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  create(orgId: string, dto: CreateBudgetDto) {
    return this.repo.create(orgId, dto);
  }

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

  // ── Import ──

  async importPreview(orgId: string, budgetId: string, buffer: Buffer, filename: string) {
    // Verify budget ownership
    const budget = await this.repo.findById(orgId, budgetId);
    if (!budget) throw new BadRequestException('Budget not found');

    return this.importService.parseFile(buffer, filename);
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
