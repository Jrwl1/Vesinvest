import { PrismaClient, MaintenanceKind, AssetStatus, Criticality } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = 'devpassword';
  const passwordHash = await bcrypt.hash(password, 10);

  // ============================================================
  // IDEMPOTENT CLEANUP: Delete child entities (foreign keys)
  // Keep org/user/role stable via upsert
  // ============================================================
  await prisma.maintenanceItem.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.assetType.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.userRole.deleteMany({});

  // ============================================================
  // 1. ORGANIZATION (upsert by slug for stable ID across runs)
  // ============================================================
  const org = await prisma.organization.upsert({
    where: { slug: 'dev-org' },
    update: { name: 'Dev Org' },
    create: { slug: 'dev-org', name: 'Dev Org' },
  });

  // ============================================================
  // 2. USER + ROLE (upsert by unique keys)
  // ============================================================
  const user = await prisma.user.upsert({
    where: { email: 'admin@dev.local' },
    update: { password: passwordHash },
    create: { email: 'admin@dev.local', password: passwordHash },
  });

  const role = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  // UserRole (check if exists, create if not)
  const existingUserRole = await prisma.userRole.findFirst({
    where: { user_id: user.id, role_id: role.id, org_id: org.id },
  });
  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        user: { connect: { id: user.id } },
        role: { connect: { id: role.id } },
        org: { connect: { id: org.id } },
      },
    });
  }

  // ============================================================
  // 3. SITE
  // ============================================================
  const site = await prisma.site.create({
    data: {
      orgId: org.id,
      name: 'Main Plant',
      address: '123 Industrial Ave',
    },
  });

  // ============================================================
  // 4. ASSET TYPES
  // ============================================================
  const pumpType = await prisma.assetType.create({
    data: {
      orgId: org.id,
      code: 'PUMP',
      name: 'Pump',
      defaultLifeYears: 10,
    },
  });

  const motorType = await prisma.assetType.create({
    data: {
      orgId: org.id,
      code: 'MOTOR',
      name: 'Motor',
      defaultLifeYears: 5,
    },
  });

  // ============================================================
  // 5. ASSETS
  // ============================================================
  // A) Pump A1: installedOn=2018-01-01, replacementCostEur=15000, lifeYears=null (uses default=10)
  //    => replacementYear = 2018 + 10 = 2028
  const pumpA1 = await prisma.asset.create({
    data: {
      orgId: org.id,
      siteId: site.id,
      assetTypeId: pumpType.id,
      name: 'Pump A1',
      installedOn: new Date('2018-01-01T00:00:00Z'),
      lifeYears: null, // uses assetType.defaultLifeYears = 10
      replacementCostEur: 15000,
      criticality: Criticality.high,
      status: AssetStatus.active,
    },
  });

  // B) Motor M1: installedOn=2020-01-01, replacementCostEur=3000, lifeYears=8 (override)
  //    => replacementYear = 2020 + 8 = 2028
  const motorM1 = await prisma.asset.create({
    data: {
      orgId: org.id,
      siteId: site.id,
      assetTypeId: motorType.id,
      name: 'Motor M1',
      installedOn: new Date('2020-01-01T00:00:00Z'),
      lifeYears: 8, // override (default would be 5)
      replacementCostEur: 3000,
      criticality: Criticality.medium,
      status: AssetStatus.active,
    },
  });

  // C) Pump A2: installedOn=null, replacementCostEur=12000
  //    => NO replacement event (installedOn is null)
  const pumpA2 = await prisma.asset.create({
    data: {
      orgId: org.id,
      siteId: site.id,
      assetTypeId: pumpType.id,
      name: 'Pump A2',
      installedOn: null, // no install date => no replacement year
      lifeYears: null,
      replacementCostEur: 12000,
      criticality: Criticality.low,
      status: AssetStatus.active,
    },
  });

  // ============================================================
  // 6. MAINTENANCE ITEMS
  // ============================================================
  // Pump A1: MAINTENANCE every 1 year, costEur=500, startsAtYear=2026
  await prisma.maintenanceItem.create({
    data: {
      orgId: org.id,
      assetId: pumpA1.id,
      kind: MaintenanceKind.MAINTENANCE,
      intervalYears: 1,
      costEur: 500,
      startsAtYear: 2026,
      endsAtYear: null,
      notes: 'Annual pump maintenance',
    },
  });

  // Motor M1: MAINTENANCE every 2 years, costEur=200, startsAtYear=2026
  await prisma.maintenanceItem.create({
    data: {
      orgId: org.id,
      assetId: motorM1.id,
      kind: MaintenanceKind.MAINTENANCE,
      intervalYears: 2,
      costEur: 200,
      startsAtYear: 2026,
      endsAtYear: null,
      notes: 'Biennial motor maintenance',
    },
  });

  // ============================================================
  // OUTPUT
  // ============================================================
  console.log('\n=== SEED COMPLETE ===\n');
  console.log('Credentials:');
  console.log('  email:', user.email);
  console.log('  password:', password);
  console.log('\nIDs:');
  console.log('  orgId:', org.id);
  console.log('  siteId:', site.id);
  console.log('  pumpTypeId:', pumpType.id);
  console.log('  motorTypeId:', motorType.id);
  console.log('  pumpA1:', pumpA1.id);
  console.log('  motorM1:', motorM1.id);
  console.log('  pumpA2:', pumpA2.id);

  console.log('\n=== EXPECTED PROJECTION (2026-2035) ===');
  console.log('Algorithm rule: replacementYear = installedYear + effectiveLifeYears');
  console.log('  - Pump A1: 2018 + 10 = 2028, CAPEX=15000');
  console.log('  - Motor M1: 2020 + 8 = 2028, CAPEX=3000');
  console.log('  - Pump A2: installedOn=null → no replacement');
  console.log('\nMaintenance (OPEX):');
  console.log('  - Pump A1: 500/year starting 2026 (every 1 year)');
  console.log('  - Motor M1: 200 every 2 years starting 2026');
  console.log('\n Year | OPEX |  CAPEX |  TOTAL');
  console.log('------|------|--------|--------');
  console.log(' 2026 |  700 |      0 |    700   (500 + 200)');
  console.log(' 2027 |  500 |      0 |    500');
  console.log(' 2028 |  700 |  18000 |  18700   (500 + 200) + (15000 + 3000)');
  console.log(' 2029 |  500 |      0 |    500');
  console.log(' 2030 |  700 |      0 |    700   (500 + 200)');
  console.log(' 2031 |  500 |      0 |    500');
  console.log(' 2032 |  700 |      0 |    700   (500 + 200)');
  console.log(' 2033 |  500 |      0 |    500');
  console.log(' 2034 |  700 |      0 |    700   (500 + 200)');
  console.log(' 2035 |  500 |      0 |    500');
  console.log('\nTotals: OPEX=6000, CAPEX=18000, TOTAL=24000');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
