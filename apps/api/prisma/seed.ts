import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed script for development/demo database.
 *
 * Creates:
 * - Organization
 * - User + Role + UserRole link
 * - Default assumptions (olettamukset)
 * - Sample Vesipolku budget with lines and revenue drivers
 */

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...\n');

  // ============ Organization ============
  const orgSlug = 'vesipolku-demo';
  const orgName = 'Vesipolku Demo';

  let organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (organization) {
    console.log(
      `Organization "${orgName}" already exists (id: ${organization.id})`,
    );
  } else {
    organization = await prisma.organization.create({
      data: { slug: orgSlug, name: orgName },
    });
    console.log(`Organization "${orgName}" created (id: ${organization.id})`);
  }

  const orgId = organization.id;

  // ============ Role ============
  const roleName = 'ADMIN';

  let role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (role) {
    console.log(`Role "${roleName}" already exists (id: ${role.id})`);
  } else {
    role = await prisma.role.create({
      data: { name: roleName },
    });
    console.log(`Role "${roleName}" created (id: ${role.id})`);
  }

  // ============ User ============
  const userEmail = 'admin@vesipolku.dev';
  const userPassword = 'admin123';

  let user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (user) {
    console.log(`User "${userEmail}" already exists (id: ${user.id})`);
  } else {
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    user = await prisma.user.create({
      data: { email: userEmail, password: hashedPassword },
    });
    console.log(`User "${userEmail}" created (id: ${user.id})`);
  }

  // ============ UserRole ============
  const existingUserRole = await prisma.userRole.findUnique({
    where: {
      user_id_role_id_org_id: {
        user_id: user.id,
        role_id: role.id,
        org_id: orgId,
      },
    },
  });

  if (existingUserRole) {
    console.log(`UserRole link already exists (id: ${existingUserRole.id})`);
  } else {
    const userRole = await prisma.userRole.create({
      data: { user_id: user.id, role_id: role.id, org_id: orgId },
    });
    console.log(`UserRole link created (id: ${userRole.id})`);
  }

  // ============ Default Assumptions (Olettamukset) ============
  const assumptions = [
    {
      avain: 'inflaatio',
      nimi: 'Inflaatio',
      arvo: 0.025,
      yksikko: '%',
      kuvaus: 'Yleinen inflaatio-olettamus (2.5%)',
    },
    {
      avain: 'energiakerroin',
      nimi: 'Energiakerroin',
      arvo: 0.05,
      yksikko: '%',
      kuvaus: 'Energiakustannusten vuosittainen muutos (5%)',
    },
    {
      avain: 'vesimaaran_muutos',
      nimi: 'Vesimäärän muutos',
      arvo: -0.01,
      yksikko: '%',
      kuvaus: 'Myydyn vesimäärän vuosittainen muutos (-1%)',
    },
    {
      avain: 'hintakorotus',
      nimi: 'Hintakorotus',
      arvo: 0.03,
      yksikko: '%',
      kuvaus: 'Yksikköhinnan vuosittainen korotus (3%)',
    },
    {
      avain: 'investointikerroin',
      nimi: 'Investointikerroin',
      arvo: 0.02,
      yksikko: '%',
      kuvaus: 'Investointikustannusten vuosittainen muutos (2%)',
    },
  ];

  for (const a of assumptions) {
    await prisma.olettamus.upsert({
      where: { orgId_avain: { orgId, avain: a.avain } },
      update: {},
      create: {
        orgId,
        avain: a.avain,
        nimi: a.nimi,
        arvo: a.arvo,
        yksikko: a.yksikko,
        kuvaus: a.kuvaus,
      },
    });
  }
  console.log(`Assumptions seeded: ${assumptions.length} keys`);

  // ============ Sample Budget (Talousarvio) ============
  const currentYear = new Date().getFullYear();
  const budgetNimi = `Talousarvio ${currentYear}`;

  let budget = await prisma.talousarvio.findUnique({
    where: {
      orgId_vuosi_nimi: { orgId, vuosi: currentYear, nimi: budgetNimi },
    },
  });

  if (budget) {
    console.log(`Budget for ${currentYear} already exists (id: ${budget.id})`);
  } else {
    budget = await prisma.talousarvio.create({
      data: {
        orgId,
        vuosi: currentYear,
        nimi: budgetNimi,
        tila: 'luonnos',
      },
    });
    console.log(`Budget for ${currentYear} created (id: ${budget.id})`);

    // Budget lines — realistic for a ~3000-connection Finnish water utility
    const lines = [
      {
        tiliryhma: '4100',
        nimi: 'Henkilöstökulut',
        tyyppi: 'kulu' as const,
        summa: 120000,
      },
      {
        tiliryhma: '4200',
        nimi: 'Energiakustannukset',
        tyyppi: 'kulu' as const,
        summa: 85000,
      },
      {
        tiliryhma: '4000',
        nimi: 'Materiaalit ja tarvikkeet',
        tyyppi: 'kulu' as const,
        summa: 35000,
      },
      {
        tiliryhma: '4300',
        nimi: 'Ulkopuoliset palvelut',
        tyyppi: 'kulu' as const,
        summa: 45000,
      },
      {
        tiliryhma: '4500',
        nimi: 'Hallinto ja vakuutukset',
        tyyppi: 'kulu' as const,
        summa: 25000,
      },
      {
        tiliryhma: '4600',
        nimi: 'Poistot',
        tyyppi: 'kulu' as const,
        summa: 90000,
      },
      {
        tiliryhma: '4900',
        nimi: 'Muut kulut',
        tyyppi: 'kulu' as const,
        summa: 15000,
      },
      {
        tiliryhma: '3200',
        nimi: 'Liittymismaksut',
        tyyppi: 'tulo' as const,
        summa: 12000,
      },
      {
        tiliryhma: '3900',
        nimi: 'Muut tulot',
        tyyppi: 'tulo' as const,
        summa: 5000,
      },
      {
        tiliryhma: '5000',
        nimi: 'Verkostoinvestoinnit',
        tyyppi: 'investointi' as const,
        summa: 150000,
      },
      {
        tiliryhma: '5100',
        nimi: 'Laitosinvestoinnit',
        tyyppi: 'investointi' as const,
        summa: 50000,
      },
    ];

    for (const line of lines) {
      await prisma.talousarvioRivi.create({
        data: {
          talousarvioId: budget.id,
          tiliryhma: line.tiliryhma,
          nimi: line.nimi,
          tyyppi: line.tyyppi,
          summa: line.summa,
        },
      });
    }
    console.log(`Budget lines created: ${lines.length}`);

    // Revenue drivers
    await prisma.tuloajuri.create({
      data: {
        talousarvioId: budget.id,
        palvelutyyppi: 'vesi',
        yksikkohinta: 1.8,
        myytyMaara: 160000,
        perusmaksu: 4.0,
        liittymamaara: 3000,
        alvProsentti: 24,
      },
    });

    await prisma.tuloajuri.create({
      data: {
        talousarvioId: budget.id,
        palvelutyyppi: 'jatevesi',
        yksikkohinta: 2.4,
        myytyMaara: 145000,
        perusmaksu: 5.0,
        liittymamaara: 2800,
        alvProsentti: 24,
      },
    });
    console.log('Revenue drivers created: 2 (water + wastewater)');
  }

  // ============ Summary ============
  console.log('\nSeed completed successfully!');
  console.log('\nSummary:');
  console.log(`   Organization: ${organization.id} (${orgName})`);
  console.log(`   User: ${user.id} (${userEmail})`);
  console.log(`   Role: ${role.id} (${roleName})`);
  console.log(`   Assumptions: ${assumptions.length}`);
  console.log(`   Budget: ${currentYear}`);
  console.log(`   Budget lines: 11`);
  console.log(`   Revenue drivers: 2 (water + wastewater)`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
