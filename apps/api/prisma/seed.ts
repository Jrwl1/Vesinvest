import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed script for development/demo database.
 * 
 * Per Site Handling Contract:
 * - NO sites are created by seed scripts
 * - NO assets are created by seed scripts
 * - Sites must be created manually or via import flow
 * 
 * This script only creates:
 * - Organization
 * - User
 * - Role + UserRole link
 * - Asset Types (foundational reference data)
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');
  console.log('📋 Per Site Handling Contract: NO sites or assets are seeded.');
  console.log('   Sites must be created manually or during import.\n');

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

  // ============ Asset Types ============
  // Asset types are foundational reference data - OK to seed
  const assetTypesData = [
    { code: 'PUMP', name: 'Pump', defaultLifeYears: 15 },
    { code: 'VALVE', name: 'Valve', defaultLifeYears: 25 },
    { code: 'PIPE', name: 'Pipe', defaultLifeYears: 50 },
    { code: 'METER', name: 'Water Meter', defaultLifeYears: 10 },
    { code: 'MOTOR', name: 'Motor', defaultLifeYears: 12 },
  ];

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
  }

  // ============ Summary ============
  console.log('\n✅ Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Organization: ${organization.id} (${orgName})`);
  console.log(`   User: ${user.id} (${userEmail})`);
  console.log(`   Role: ${role.id} (${roleName})`);
  console.log(`   Asset Types: ${assetTypesData.length}`);
  console.log('\n⚠️  Sites: 0 (per Site Handling Contract - create manually or via import)');
  console.log('⚠️  Assets: 0 (per Site Handling Contract - import after creating sites)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
