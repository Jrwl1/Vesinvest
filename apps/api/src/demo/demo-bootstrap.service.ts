import { Injectable,Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID } from './demo.constants';

/**
 * Service to bootstrap demo when DEMO_MODE is enabled.
 * - ensureDemoOrg(): only creates the demo org (and optionally user/role are in DemoService). No business data.
 * - seedDemoData(): optional dataset (assumptions, budget, projection); idempotent, only when user clicks "Load demo data".
 */
@Injectable()
export class DemoBootstrapService {
  private readonly logger = new Logger(DemoBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure demo organization exists with deterministic ID only. No budgets or projections.
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
   * Seed optional demo dataset (assumptions, 3-year budget set, projection). Idempotent.
   * The ONLY place that creates demo budgets/projections/assumptions. Called only from POST /demo/seed.
   * Creates a 3-year budget set so the Budget page shows 3 cards (not single-year view).
   */
  async seedDemoData(): Promise<{
    alreadySeeded: boolean;
    seededAt: string;
    batchId?: string;
    created?: { assumptions: number; budget: boolean; projection: boolean };
  }> {
    this.logger.log('Demo seed invoked (source: POST /demo/seed only)');
    const currentYear = new Date().getFullYear();
    const demoBatchId = `demo-set-${currentYear}`;
    const existingSet = await this.prisma.talousarvio.findFirst({
      where: { orgId: DEMO_ORG_ID, importBatchId: demoBatchId },
    });

    if (existingSet) {
      this.logger.log(`Demo data already seeded (batch ${demoBatchId} exists); skipping.`);
      return {
        alreadySeeded: true,
        seededAt: new Date().toISOString(),
        batchId: demoBatchId,
      };
    }

    await this.seedAssumptions();
    const batchId = await this.seedBudget();
    await this.seedProjection();

    this.logger.log('Demo dataset seeded: assumptions=6, budget set (3 years), projection=1');
    return {
      alreadySeeded: false,
      seededAt: new Date().toISOString(),
      batchId,
      created: { assumptions: 6, budget: true, projection: true },
    };
  }

  /**
   * Seed default assumptions for the demo org. Idempotent via upsert.
   */
  async seedAssumptions(): Promise<void> {
    const defaults = [
      { avain: 'inflaatio', nimi: 'Inflaatio', arvo: 0.025, yksikko: '%', kuvaus: 'Yleinen inflaatio-olettamus (2.5%)' },
      { avain: 'energiakerroin', nimi: 'Energiakerroin', arvo: 0.05, yksikko: '%', kuvaus: 'Energiakustannusten vuosittainen muutos (5%)' },
      { avain: 'henkilostokerroin', nimi: 'Henkilostokulujen kasvu', arvo: 0.025, yksikko: '%', kuvaus: 'Henkilostokulujen vuosittainen muutos (2.5%)' },
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
   * Seed a 3-year demo budget set with valisummat so the Budget page shows 3 cards.
   * Idempotent - skips if batch already exists. Returns batchId for frontend to load set.
   */
  async seedBudget(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear] as const;
    const demoBatchId = `demo-set-${currentYear}`;

    const existing = await this.prisma.talousarvio.findFirst({
      where: { orgId: DEMO_ORG_ID, importBatchId: demoBatchId },
    });
    if (existing) {
      this.logger.log(`Demo budget set ${demoBatchId} already exists`);
      return demoBatchId;
    }

    // Totals similar to previous single-year seed (tulot, kulut, poistot, investoinnit) for 3 years
    const baseTulot = 288000 + 348000 + 12000 + 5000; // 653k
    const baseKulut = 120000 + 85000 + 35000 + 45000 + 25000 + 15000; // 335k (excl. poistot)
    const basePoistot = 90000;
    const baseInvestoinnit = 150000 + 50000; // 200k

    for (const vuosi of years) {
      const budget = await this.prisma.talousarvio.create({
        data: {
          orgId: DEMO_ORG_ID,
          vuosi,
          nimi: `Talousarvio ${vuosi}`,
          tila: 'luonnos',
          importBatchId: demoBatchId,
        },
      });

      await this.prisma.talousarvioValisumma.createMany({
        data: [
          { talousarvioId: budget.id, palvelutyyppi: 'muu', categoryKey: 'other_income', tyyppi: 'tulo', summa: baseTulot },
          { talousarvioId: budget.id, palvelutyyppi: 'muu', categoryKey: 'other_costs', tyyppi: 'kulu', summa: baseKulut },
          { talousarvioId: budget.id, palvelutyyppi: 'muu', categoryKey: 'depreciation', tyyppi: 'poisto', summa: basePoistot },
          { talousarvioId: budget.id, palvelutyyppi: 'muu', categoryKey: 'investments', tyyppi: 'investointi', summa: baseInvestoinnit },
        ],
      });
    }

    // Revenue drivers and rivit only on current-year budget for projection and single-year view
    const currentBudget = await this.prisma.talousarvio.findFirst({
      where: { orgId: DEMO_ORG_ID, importBatchId: demoBatchId, vuosi: currentYear },
    });
    if (currentBudget) {
      const lines = [
        { tiliryhma: '4100', nimi: 'Henkilöstökulut', tyyppi: 'kulu' as const, summa: 120000 },
        { tiliryhma: '4200', nimi: 'Energiakustannukset', tyyppi: 'kulu' as const, summa: 85000 },
        { tiliryhma: '4000', nimi: 'Materiaalit ja tarvikkeet', tyyppi: 'kulu' as const, summa: 35000 },
        { tiliryhma: '4300', nimi: 'Ulkopuoliset palvelut', tyyppi: 'kulu' as const, summa: 45000 },
        { tiliryhma: '4500', nimi: 'Hallinto ja vakuutukset', tyyppi: 'kulu' as const, summa: 25000 },
        { tiliryhma: '4600', nimi: 'Poistot', tyyppi: 'kulu' as const, summa: 90000 },
        { tiliryhma: '4900', nimi: 'Muut kulut', tyyppi: 'kulu' as const, summa: 15000 },
        { tiliryhma: '3200', nimi: 'Liittymismaksut', tyyppi: 'tulo' as const, summa: 12000 },
        { tiliryhma: '3900', nimi: 'Muut tulot', tyyppi: 'tulo' as const, summa: 5000 },
        { tiliryhma: '5000', nimi: 'Verkostoinvestoinnit', tyyppi: 'investointi' as const, summa: 150000 },
        { tiliryhma: '5100', nimi: 'Laitosinvestoinnit', tyyppi: 'investointi' as const, summa: 50000 },
      ];
      for (const line of lines) {
        await this.prisma.talousarvioRivi.create({
          data: {
            talousarvioId: currentBudget.id,
            tiliryhma: line.tiliryhma,
            nimi: line.nimi,
            tyyppi: line.tyyppi,
            summa: line.summa,
          },
        });
      }
      await this.prisma.tuloajuri.createMany({
        data: [
          { talousarvioId: currentBudget.id, palvelutyyppi: 'vesi', yksikkohinta: 1.80, myytyMaara: 160000, perusmaksu: 4.0, liittymamaara: 3000, alvProsentti: 24 },
          { talousarvioId: currentBudget.id, palvelutyyppi: 'jatevesi', yksikkohinta: 2.40, myytyMaara: 145000, perusmaksu: 5.0, liittymamaara: 2800, alvProsentti: 24 },
        ],
      });
    }

    this.logger.log(`Demo budget set seeded: 3 years, batchId=${demoBatchId}`);
    return demoBatchId;
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
      this.logger.log('No demo budget found - skipping projection seed');
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

