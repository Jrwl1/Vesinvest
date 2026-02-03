-- Asset Identity Contract Migration
-- See: docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md
--
-- This migration enforces:
-- 1. externalRef is required (not null)
-- 2. externalRef is unique within organization
-- 3. derivedIdentity flag tracks fallback-generated identities

-- Step 1: Add derivedIdentity column with default false
ALTER TABLE "Asset" ADD COLUMN "derivedIdentity" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Generate fallback externalRef for existing assets with NULL externalRef
-- Formula: DERIVED_ + hash(assetTypeId + siteId + normalizedName)
-- This marks them as derived identities that can be replaced later
UPDATE "Asset"
SET 
  "externalRef" = 'DERIVED_' || substring(md5("assetTypeId" || '|' || "siteId" || '|' || lower(trim("name"))) from 1 for 16),
  "derivedIdentity" = true
WHERE "externalRef" IS NULL;

-- Step 3: Make externalRef NOT NULL
ALTER TABLE "Asset" ALTER COLUMN "externalRef" SET NOT NULL;

-- Step 4: Add unique constraint on (orgId, externalRef)
-- externalRef is unique per organization, not globally
CREATE UNIQUE INDEX "Asset_orgId_externalRef_key" ON "Asset"("orgId", "externalRef");
