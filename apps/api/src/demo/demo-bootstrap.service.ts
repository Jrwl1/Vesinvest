import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID } from './demo.constants';

/**
 * Service to bootstrap demo when DEMO_MODE is enabled.
 * - ensureDemoOrg(): only creates the demo org (and optionally user/role are in DemoService). No budgets/sites/assets.
 * - seedDemoData(): optional dataset (assumptions, budget, projection); idempotent, only when user clicks "Load demo data".
 */
@Injectable()
export class DemoBootstrapService {
  private readonly logger = new Logger(DemoBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure demo organization exists with deterministic ID only. No budgets, sites, assets, or projections.
   * Idempotent. Used by demo-login and TenantGuard so demo org exists before any request.
   */
  async ensureDemoOrg(): Promise<void> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: DEMO_ORG_ID },
    });

    if (existingOrg) {
      this.logger.log(`Demo org already exists: ${DEMO_ORG_ID}`);
      return;
    }

    await this.prisma.organization.create({
      data: {
        id: DEMO_ORG_ID,
        name: 'Demo-vesilaitos',
        slug: 'demo',
      },
    });

    this.logger.log(`Created demo org: ${DEMO_ORG_ID} (Demo-vesilaitos)`);
  }

  /**
   * Seed optional demo dataset (assumptions, budget, revenue drivers, projection). Idempotent.
   * The ONLY place that creates demo budgets/projections/assumptions. Called only from POST /demo/seed.
   * If demo org already has a budget for current year, returns alreadySeeded: true and does nothing.
   */
  async seedDemoData(): Promise<{
    alreadySeeded: boolean;
    seededAt: string;
    created?: { assumptions: number; budget: boolean; projection: boolean };
  }> {
    this.logger.log('Demo seed invoked (source: POST /demo/seed only)');
    const currentYear = new Date().getFullYear();
    const demoBudgetNimi = `Talousarvio ${currentYear}`;
    const existingBudget = await this.prisma.talousarvio.findUnique({
      where: { orgId_vuosi_nimi: { orgId: DEMO_ORG_ID, vuosi: currentYear, nimi: demoBudgetNimi } },
    });

    if (existingBudget) {
      this.logger.log(`Demo data already seeded (budget ${currentYear} exists); skipping.`);
      return {
        alreadySeeded: true,
        seededAt: new Date().toISOString(),
      };
    }

    await this.seedAssumptions();
    await this.seedBudget();
    await this.seedProjection();

    this.logger.log('Demo dataset seeded: assumptions=5, budget=1, projection=1');
    return {
      alreadySeeded: false,
      seededAt: new Date().toISOString(),
      created: { assumptions: 5, budget: true, projection: true },
    };
  }

  /**
   * Seed default assumptions for the demo org. Idempotent via upsert.
   */
  async seedAssumptions(): Promise<void> {
    const defaults = [
      { avain: 'inflaatio', nimi: 'Inflaatio', arvo: 0.025, yksikko: '%', kuvaus: 'Yleinen inflaatio-olettamus (2.5%)' },
      { avain: 'energiakerroin', nimi: 'Energiakerroin', arvo: 0.05, yksikko: '%', kuvaus: 'Energiakustannusten vuosittainen muutos (5%)' },
      { avain: 'vesimaaran_muutos', nimi: 'Vesimäärän muutos', arvo: -0.01, yksikko: '%', kuvaus: 'Myydyn vesimäärän vuosittainen muutos (-1%)' },
      { avain: 'hintakorotus', nimi: 'Hintakorotus', arvo: 0.03, yksikko: '%', kuvaus: 'Yksikköhinnan vuosittainen korotus (3%)' },
      { avain: 'investointikerroin', nimi: 'Investointikerroin', arvo: 0.02, yksikko: '%', kuvaus: 'Investointikustannusten vuosittainen muutos (2%)' },
    ];

    for (const a of defaults) {
      await this.prisma.olettamus.upsert({
        where: { orgId_avain: { orgId: DEMO_ORG_ID, avain: a.avain } },
        update: {},
        create: {
          orgId: DEMO_ORG_ID,
          avain: a.avain,
          nimi: a.nimi,
          arvo: a.arvo,
          yksikko: a.yksikko,
          kuvaus: a.kuvaus,
        },
      });
    }

    this.logger.log(`Demo assumptions seeded: ${defaults.length} keys`);
  }

  /**
   * Seed a demo budget for the current year with realistic Finnish VA data.
   * Idempotent — skips if budget for current year already exists.
   */
  async seedBudget(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const demoBudgetNimi = `Talousarvio ${currentYear}`;

    // Check if budget already exists
    const existing = await this.prisma.talousarvio.findUnique({
      where: { orgId_vuosi_nimi: { orgId: DEMO_ORG_ID, vuosi: currentYear, nimi: demoBudgetNimi } },
    });

    if (existing) {
      this.logger.log(`Demo budget for ${currentYear} already exists`);
      return;
    }

    // Create budget
    const budget = await this.prisma.talousarvio.create({
      data: {
        orgId: DEMO_ORG_ID,
        vuosi: currentYear,
        nimi: demoBudgetNimi,
        tila: 'luonnos',
      },
    });

    // Budget lines — realistic for a ~3000-connection Finnish water utility
    const lines = [
      // Expenses (kulut)
      { tiliryhma: '4100', nimi: 'Henkilöstökulut', tyyppi: 'kulu' as const, summa: 120000 },
      { tiliryhma: '4200', nimi: 'Energiakustannukset', tyyppi: 'kulu' as const, summa: 85000 },
      { tiliryhma: '4000', nimi: 'Materiaalit ja tarvikkeet', tyyppi: 'kulu' as const, summa: 35000 },
      { tiliryhma: '4300', nimi: 'Ulkopuoliset palvelut', tyyppi: 'kulu' as const, summa: 45000 },
      { tiliryhma: '4500', nimi: 'Hallinto ja vakuutukset', tyyppi: 'kulu' as const, summa: 25000 },
      { tiliryhma: '4600', nimi: 'Poistot', tyyppi: 'kulu' as const, summa: 90000 },
      { tiliryhma: '4900', nimi: 'Muut kulut', tyyppi: 'kulu' as const, summa: 15000 },
      // Revenue (tulot) — manually entered, non-computed
      { tiliryhma: '3200', nimi: 'Liittymismaksut', tyyppi: 'tulo' as const, summa: 12000 },
      { tiliryhma: '3900', nimi: 'Muut tulot', tyyppi: 'tulo' as const, summa: 5000 },
      // Investments (investoinnit)
      { tiliryhma: '5000', nimi: 'Verkostoinvestoinnit', tyyppi: 'investointi' as const, summa: 150000 },
      { tiliryhma: '5100', nimi: 'Laitosinvestoinnit', tyyppi: 'investointi' as const, summa: 50000 },
    ];

    for (const line of lines) {
      await this.prisma.talousarvioRivi.create({
        data: {
          talousarvioId: budget.id,
          tiliryhma: line.tiliryhma,
          nimi: line.nimi,
          tyyppi: line.tyyppi,
          summa: line.summa,
        },
      });
    }

    // Revenue drivers (tuloajurit) — the compliance-critical inputs
    // Water: €1.80/m³ × 160,000 m³ = €288,000
    await this.prisma.tuloajuri.create({
      data: {
        talousarvioId: budget.id,
        palvelutyyppi: 'vesi',
        yksikkohinta: 1.80,
        myytyMaara: 160000,
        perusmaksu: 4.0,
        liittymamaara: 3000,
        alvProsentti: 24,
      },
    });

    // Wastewater: €2.40/m³ × 145,000 m³ = €348,000
    await this.prisma.tuloajuri.create({
      data: {
        talousarvioId: budget.id,
        palvelutyyppi: 'jatevesi',
        yksikkohinta: 2.40,
        myytyMaara: 145000,
        perusmaksu: 5.0,
        liittymamaara: 2800,
        alvProsentti: 24,
      },
    });

    this.logger.log(
      `Demo budget seeded: ${lines.length} lines, 2 revenue drivers for year ${currentYear}`,
    );
  }

  /**
   * Seed a default projection scenario for the demo org. Idempotent.
   */
  async seedProjection(): Promise<void> {
    const currentYear = new Date().getFullYear();
    const demoBudgetNimi = `Talousarvio ${currentYear}`;

    // Find the demo budget
    const budget = await this.prisma.talousarvio.findUnique({
      where: { orgId_vuosi_nimi: { orgId: DEMO_ORG_ID, vuosi: currentYear, nimi: demoBudgetNimi } },
    });

    if (!budget) {
      this.logger.log('No demo budget found — skipping projection seed');
      return;
    }

    // Check if a default projection already exists
    const existingProjection = await this.prisma.ennuste.findFirst({
      where: { orgId: DEMO_ORG_ID, onOletus: true },
    });

    if (existingProjection) {
      this.logger.log('Default projection already exists');
      return;
    }

    await this.prisma.ennuste.create({
      data: {
        orgId: DEMO_ORG_ID,
        talousarvioId: budget.id,
        nimi: `Perusskenaario ${currentYear}`,
        aikajaksoVuosia: 5,
        onOletus: true,
      },
    });

    this.logger.log('Demo default projection scenario seeded');
  }
}
