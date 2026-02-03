-- Add slug column to Organization (required for demo-login upsert)
-- Step 1: Add column as nullable
ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;

-- Step 2: Populate existing rows with a unique slug derived from id
UPDATE "Organization" SET "slug" = "id" WHERE "slug" IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE "Organization" ALTER COLUMN "slug" SET NOT NULL;

-- Step 4: Add unique index (required for Prisma upsert)
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Add unique index on Role.name (missing from initial migration, needed for demo upsert)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Role_name_key') THEN
    CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
  END IF;
END $$;
