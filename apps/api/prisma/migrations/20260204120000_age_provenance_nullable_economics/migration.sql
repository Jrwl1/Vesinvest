-- Add ageYears (nullable)
ALTER TABLE "Asset" ADD COLUMN "ageYears" INTEGER;

-- Make criticality nullable (no 0 sentinel; missing = null)
ALTER TABLE "Asset" ALTER COLUMN "criticality" DROP NOT NULL;
