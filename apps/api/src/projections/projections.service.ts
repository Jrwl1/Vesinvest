import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsRepository } from './projections.repository';
import { ProjectionEngine, BudgetLineInput, RevenueDriverInput, AssumptionMap } from './projection-engine.service';
import { CreateProjectionDto } from './dto/create-projection.dto';
import { UpdateProjectionDto } from './dto/update-projection.dto';

@Injectable()
export class ProjectionsService {
  constructor(
    private readonly repo: ProjectionsRepository,
    private readonly engine: ProjectionEngine,
    private readonly prisma: PrismaService,
  ) {}

  // ── CRUD ──

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  async findById(orgId: string, id: string) {
    const projection = await this.repo.findById(orgId, id);
    if (!projection) throw new NotFoundException('Projection not found');
    return projection;
  }

  async create(orgId: string, dto: CreateProjectionDto) {
    // Verify budget belongs to org
    await this.repo.requireBudgetOwnership(orgId, dto.talousarvioId);
    return this.repo.create(orgId, dto);
  }

  update(orgId: string, id: string, dto: UpdateProjectionDto) {
    return this.repo.update(orgId, id, dto);
  }

  delete(orgId: string, id: string) {
    return this.repo.delete(orgId, id);
  }

  // ── Computation ──

  /**
   * Compute (or recompute) the year-by-year projection.
   * Loads the linked budget's lines + drivers, merges org assumptions
   * with scenario-level overrides, runs the engine, and persists results.
   */
  async compute(orgId: string, id: string) {
    const projection = await this.findById(orgId, id);

    const budget = projection.talousarvio;
    if (!budget || !budget.rivit || !budget.tuloajurit) {
      throw new BadRequestException('Projection budget has no data to compute from');
    }

    // Load org-level assumptions
    const orgAssumptions = await this.prisma.olettamus.findMany({
      where: { orgId },
      orderBy: { avain: 'asc' },
    });

    // Build assumption map: start with org defaults, then apply overrides
    const assumptionMap: AssumptionMap = {
      inflaatio: 0.025,
      energiakerroin: 0.05,
      vesimaaran_muutos: -0.01,
      hintakorotus: 0.03,
      investointikerroin: 0.02,
    };

    for (const a of orgAssumptions) {
      assumptionMap[a.avain] = Number(a.arvo);
    }

    // Apply scenario-level overrides
    const overrides = (projection.olettamusYlikirjoitukset as Record<string, number>) ?? {};
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'number') {
        assumptionMap[key] = value;
      }
    }

    // Prepare inputs
    const lines: BudgetLineInput[] = budget.rivit.map((r) => ({
      tiliryhma: r.tiliryhma,
      nimi: r.nimi,
      tyyppi: r.tyyppi as 'kulu' | 'tulo' | 'investointi',
      summa: Number(r.summa),
    }));

    const drivers: RevenueDriverInput[] = budget.tuloajurit.map((d) => ({
      palvelutyyppi: d.palvelutyyppi as 'vesi' | 'jatevesi' | 'muu',
      yksikkohinta: Number(d.yksikkohinta),
      myytyMaara: Number(d.myytyMaara),
      perusmaksu: Number(d.perusmaksu ?? 0),
      liittymamaara: d.liittymamaara ?? 0,
    }));

    // Run engine
    const computedYears = this.engine.compute(
      budget.vuosi,
      projection.aikajaksoVuosia,
      lines,
      drivers,
      assumptionMap,
    );

    // Persist computed years
    const years = await this.repo.replaceYears(projection.id, computedYears);

    // Return full projection with fresh years
    return this.findById(orgId, id);
  }

  // ── CSV Export ──

  async exportCsv(orgId: string, id: string): Promise<string> {
    const projection = await this.findById(orgId, id);

    if (!projection.vuodet || projection.vuodet.length === 0) {
      throw new BadRequestException('Projection has no computed data. Run compute first.');
    }

    const headers = [
      'Vuosi',
      'Tulot yhteensä',
      'Kulut yhteensä',
      'Investoinnit yhteensä',
      'Tulos',
      'Kumulatiivinen tulos',
      'Vesihinta (€/m³)',
      'Myyty vesimäärä (m³)',
    ];

    const rows = projection.vuodet.map((y) => [
      y.vuosi,
      Number(y.tulotYhteensa).toFixed(2),
      Number(y.kulutYhteensa).toFixed(2),
      Number(y.investoinnitYhteensa).toFixed(2),
      Number(y.tulos).toFixed(2),
      Number(y.kumulatiivinenTulos).toFixed(2),
      y.vesihinta ? Number(y.vesihinta).toFixed(2) : '',
      y.myytyVesimaara ? Number(y.myytyVesimaara).toFixed(0) : '',
    ].join(';'));

    // Use semicolon separator (common in Finnish locales)
    return [headers.join(';'), ...rows].join('\n');
  }
}
