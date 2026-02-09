/**
 * Introspect Postgres unique constraints/indexes on talousarvio (dev-only).
 * Run from repo root:  node apps/api/scripts/inspect-talousarvio-constraints.js
 * Run from apps/api:   node scripts/inspect-talousarvio-constraints.js  (do not use apps/api/... here)
 * Requires: DATABASE_URL (from .env or env), Prisma generated client (pnpm prisma generate).
 */
const path = require('path');
const fs = require('fs');

// Load .env from apps/api/.env so script works without dotenv dependency
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Unique constraints/indexes for table: talousarvio ===\n');

  try {
    // pg_indexes: index name, definition (includes column list for unique indexes)
    // Table name is hardcoded to avoid $queryRawUnsafe (talousarvio = Prisma @@map)
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'talousarvio'
      ORDER BY indexname
    `;
    console.log('pg_indexes:');
    console.log(JSON.stringify(indexes, null, 2));

    // pg_constraint: constraint name and definition (contype 'u' = unique)
    const constraints = await prisma.$queryRaw`
      SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'talousarvio' AND n.nspname = 'public'
      ORDER BY c.conname
    `;
    console.log('\npg_constraint (public.talousarvio):');
    console.log(JSON.stringify(constraints, null, 2));

    // Sanitized DATABASE_URL for confirmation
    const url = process.env.DATABASE_URL;
    let sanitized = '(no DATABASE_URL)';
    if (url) {
      try {
        const u = new URL(url);
        sanitized = `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname || '/'}`;
      } catch (e) {
        sanitized = '(invalid URL)';
      }
    }
    console.log('\nDATABASE_URL (sanitized):', sanitized);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
