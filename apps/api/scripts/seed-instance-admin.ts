import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const orgSlug = required('INSTANCE_ORG_SLUG');
    const orgName = process.env.INSTANCE_ORG_NAME?.trim() || orgSlug;
    const adminEmail = required('INSTANCE_ADMIN_EMAIL').toLowerCase();
    const adminPassword = required('INSTANCE_ADMIN_PASSWORD');
    const trialDays = Number(process.env.INSTANCE_TRIAL_DAYS || '30');

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const org = await prisma.organization.upsert({
      where: { slug: orgSlug },
      update: {
        name: orgName,
        trialStartsAt: now,
        trialEndsAt,
        trialStatus: 'active',
        lockReason: null,
      },
      create: {
        slug: orgSlug,
        name: orgName,
        trialStartsAt: now,
        trialEndsAt,
        trialStatus: 'active',
      },
    });

    const role = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN' },
    });

    const hash = await bcrypt.hash(adminPassword, 10);
    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { password: hash },
      create: { email: adminEmail, password: hash },
    });

    await prisma.userRole.upsert({
      where: {
        user_id_role_id_org_id: {
          user_id: user.id,
          role_id: role.id,
          org_id: org.id,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        role_id: role.id,
        org_id: org.id,
      },
    });

    console.log(
      JSON.stringify(
        {
          orgId: org.id,
          orgSlug: org.slug,
          adminUserId: user.id,
          adminEmail: user.email,
          trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

