-- Drop ageYears column: value is now computed at API boundary from installedOn
-- (currentYear - year(installedOn)). No DB column needed.
ALTER TABLE "Asset" DROP COLUMN IF EXISTS "ageYears";
