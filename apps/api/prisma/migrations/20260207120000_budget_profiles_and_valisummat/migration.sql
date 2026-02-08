-- Phase 0: Enable multiple budget profiles per org/year + subtotal persistence
-- This migration:
-- 1. Makes Talousarvio.nimi required (backfills any NULLs)
-- 2. Replaces @@unique([orgId, vuosi]) with @@unique([orgId, vuosi, nimi])
-- 3. Adds ValisummaTyyppi enum
-- 4. Creates TalousarvioValisumma table

-- Step 1: Backfill any NULL nimi values before making column NOT NULL
UPDATE "talousarvio" SET "nimi" = CONCAT('Talousarvio ', "vuosi") WHERE "nimi" IS NULL;

-- Step 2: Make nimi NOT NULL
ALTER TABLE "talousarvio" ALTER COLUMN "nimi" SET NOT NULL;

-- Step 3: Drop old unique constraint (orgId, vuosi) and add new one (orgId, vuosi, nimi)
DROP INDEX "talousarvio_orgId_vuosi_key";
CREATE UNIQUE INDEX "talousarvio_orgId_vuosi_nimi_key" ON "talousarvio"("orgId", "vuosi", "nimi");

-- Step 4: Create ValisummaTyyppi enum
CREATE TYPE "ValisummaTyyppi" AS ENUM ('tulo', 'kulu', 'poisto', 'rahoitus_tulo', 'rahoitus_kulu', 'investointi', 'tulos');

-- Step 5: Create TalousarvioValisumma table
CREATE TABLE "talousarvio_valisumma" (
    "id" TEXT NOT NULL,
    "talousarvioId" TEXT NOT NULL,
    "palvelutyyppi" "Palvelutyyppi" NOT NULL,
    "category_key" TEXT NOT NULL,
    "tyyppi" "ValisummaTyyppi" NOT NULL,
    "label" TEXT,
    "summa" DECIMAL(65,30) NOT NULL,
    "lahde" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talousarvio_valisumma_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create indexes and constraints for TalousarvioValisumma
CREATE UNIQUE INDEX "talousarvio_valisumma_talousarvioId_palvelutyyppi_category_key_key" ON "talousarvio_valisumma"("talousarvioId", "palvelutyyppi", "category_key");
CREATE INDEX "talousarvio_valisumma_talousarvioId_idx" ON "talousarvio_valisumma"("talousarvioId");

-- Step 7: Add foreign key
ALTER TABLE "talousarvio_valisumma" ADD CONSTRAINT "talousarvio_valisumma_talousarvioId_fkey" FOREIGN KEY ("talousarvioId") REFERENCES "talousarvio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
