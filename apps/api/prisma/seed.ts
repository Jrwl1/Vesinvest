import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');

  // ============ Organization ============
  const orgSlug = 'plan20-demo';
  const orgName = 'Plan20 Demo';

  let organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (organization) {
    console.log(`✓ Organization "${orgName}" already exists (id: ${organization.id})`);
  } else {
    organization = await prisma.organization.create({
      data: { slug: orgSlug, name: orgName },
    });
    console.log(`✓ Organization "${orgName}" created (id: ${organization.id})`);
  }

  const orgId = organization.id;

  // ============ Role ============
  const roleName = 'ADMIN';

  let role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (role) {
    console.log(`✓ Role "${roleName}" already exists (id: ${role.id})`);
  } else {
    role = await prisma.role.create({
      data: { name: roleName },
    });
    console.log(`✓ Role "${roleName}" created (id: ${role.id})`);
  }

  // ============ User ============
  const userEmail = 'admin@plan20.dev';
  const userPassword = 'admin123';

  let user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (user) {
    console.log(`✓ User "${userEmail}" already exists (id: ${user.id})`);
  } else {
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    user = await prisma.user.create({
      data: { email: userEmail, password: hashedPassword },
    });
    console.log(`✓ User "${userEmail}" created (id: ${user.id})`);
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
    console.log(`✓ UserRole link already exists (id: ${existingUserRole.id})`);
  } else {
    const userRole = await prisma.userRole.create({
      data: { user_id: user.id, role_id: role.id, org_id: orgId },
    });
    console.log(`✓ UserRole link created (id: ${userRole.id})`);
  }

  // ============ Sites ============
  const sitesData = [
    { name: 'Main Plant', address: '123 Industrial Ave' },
    { name: 'Water Tower East', address: 'East Hill Rd' },
  ];

  const sites: Record<string, { id: string; name: string }> = {};

  for (const siteData of sitesData) {
    let site = await prisma.site.findFirst({
      where: { orgId, name: siteData.name },
    });

    if (site) {
      console.log(`✓ Site "${siteData.name}" already exists (id: ${site.id})`);
    } else {
      site = await prisma.site.create({
        data: { orgId, name: siteData.name, address: siteData.address },
      });
      console.log(`✓ Site "${siteData.name}" created (id: ${site.id})`);
    }

    sites[siteData.name] = { id: site.id, name: site.name };
  }

  // ============ Asset Types ============
  const assetTypesData = [
    { code: 'PUMP', name: 'Pump', defaultLifeYears: 10 },
    { code: 'MOTOR', name: 'Motor', defaultLifeYears: 5 },
  ];

  const assetTypes: Record<string, { id: string; name: string }> = {};

  for (const typeData of assetTypesData) {
    let assetType = await prisma.assetType.findUnique({
      where: { orgId_code: { orgId, code: typeData.code } },
    });

    if (assetType) {
      console.log(`✓ AssetType "${typeData.name}" already exists (id: ${assetType.id})`);
    } else {
      assetType = await prisma.assetType.create({
        data: {
          orgId,
          code: typeData.code,
          name: typeData.name,
          defaultLifeYears: typeData.defaultLifeYears,
        },
      });
      console.log(`✓ AssetType "${typeData.name}" created (id: ${assetType.id})`);
    }

    assetTypes[typeData.name] = { id: assetType.id, name: assetType.name };
  }

  // ============ Assets ============
  const assetsData = [
    {
      name: 'Pump A1',
      typeName: 'Pump',
      siteName: 'Main Plant',
      installedOn: new Date('2018-01-01'),
      lifeYears: 10,
      replacementCostEur: new Prisma.Decimal(15000),
      criticality: 'high' as const,
      status: 'active' as const,
    },
    {
      name: 'Motor M1',
      typeName: 'Motor',
      siteName: 'Main Plant',
      installedOn: new Date('2020-01-01'),
      lifeYears: 8,
      replacementCostEur: new Prisma.Decimal(3000),
      criticality: 'medium' as const,
      status: 'active' as const,
    },
    {
      name: 'Pump A2',
      typeName: 'Pump',
      siteName: 'Water Tower East',
      installedOn: new Date('2019-01-01'),
      lifeYears: 12,
      replacementCostEur: new Prisma.Decimal(12000),
      criticality: 'medium' as const,
      status: 'active' as const,
    },
  ];

  const assets: Record<string, { id: string; name: string }> = {};

  for (const assetData of assetsData) {
    const siteId = sites[assetData.siteName].id;
    const assetTypeId = assetTypes[assetData.typeName].id;

    let asset = await prisma.asset.findFirst({
      where: { orgId, name: assetData.name, siteId },
    });

    if (asset) {
      console.log(`✓ Asset "${assetData.name}" already exists (id: ${asset.id})`);
    } else {
      asset = await prisma.asset.create({
        data: {
          orgId,
          siteId,
          assetTypeId,
          name: assetData.name,
          installedOn: assetData.installedOn,
          lifeYears: assetData.lifeYears,
          replacementCostEur: assetData.replacementCostEur,
          criticality: assetData.criticality,
          status: assetData.status,
        },
      });
      console.log(`✓ Asset "${assetData.name}" created (id: ${asset.id})`);
    }

    assets[assetData.name] = { id: asset.id, name: asset.name };
  }

  // ============ Maintenance Items ============
  const maintenanceItemsData = [
    {
      assetName: 'Pump A1',
      kind: 'MAINTENANCE' as const,
      intervalYears: 1,
      costEur: new Prisma.Decimal(500),
      startsAtYear: 2019,
      notes: 'Annual inspection and service',
    },
    {
      assetName: 'Motor M1',
      kind: 'REPLACEMENT' as const,
      intervalYears: 1,
      costEur: new Prisma.Decimal(3000),
      startsAtYear: 2028,
      notes: 'Scheduled motor replacement',
    },
  ];

  for (const itemData of maintenanceItemsData) {
    const assetId = assets[itemData.assetName].id;

    const existingItem = await prisma.maintenanceItem.findFirst({
      where: {
        orgId,
        assetId,
        kind: itemData.kind,
        startsAtYear: itemData.startsAtYear,
      },
    });

    if (existingItem) {
      console.log(
        `✓ MaintenanceItem for "${itemData.assetName}" (${itemData.kind}) already exists (id: ${existingItem.id})`
      );
    } else {
      const item = await prisma.maintenanceItem.create({
        data: {
          orgId,
          assetId,
          kind: itemData.kind,
          intervalYears: itemData.intervalYears,
          costEur: itemData.costEur,
          startsAtYear: itemData.startsAtYear,
          notes: itemData.notes,
        },
      });
      console.log(
        `✓ MaintenanceItem for "${itemData.assetName}" (${itemData.kind}) created (id: ${item.id})`
      );
    }
  }

  // ============ Summary ============
  console.log('\n✅ Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Organization: ${organization.id} (${orgName})`);
  console.log(`   User: ${user.id} (${userEmail})`);
  console.log(`   Role: ${role.id} (${roleName})`);
  console.log(`   Sites: ${Object.keys(sites).length}`);
  console.log(`   Asset Types: ${Object.keys(assetTypes).length}`);
  console.log(`   Assets: ${Object.keys(assets).length}`);
  console.log(`   Maintenance Items: ${maintenanceItemsData.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
