-- Remove legacy asset management, import mapping, and planning scenario tables.
-- VEETI pivot keeps only budget/projection + auth/legal/demo core tables.

ALTER TABLE "Organization"
  DROP COLUMN IF EXISTS "renewalStrategy",
  DROP COLUMN IF EXISTS "annualRenewalCapacityEur";

DROP TABLE IF EXISTS "MappingColumn";
DROP TABLE IF EXISTS "ImportMapping";
DROP TABLE IF EXISTS "ImportedRecord";
DROP TABLE IF EXISTS "ExcelSheet";
DROP TABLE IF EXISTS "ExcelImport";
DROP TABLE IF EXISTS "PlanningScenario";
DROP TABLE IF EXISTS "MaintenanceItem";
DROP TABLE IF EXISTS "Asset";
DROP TABLE IF EXISTS "AssetType";
DROP TABLE IF EXISTS "Site";

DROP TYPE IF EXISTS "ImportAction";
DROP TYPE IF EXISTS "FieldCriticality";
DROP TYPE IF EXISTS "TargetEntity";
DROP TYPE IF EXISTS "ImportStatus";
DROP TYPE IF EXISTS "MaintenanceKind";
DROP TYPE IF EXISTS "Criticality";
DROP TYPE IF EXISTS "AssetStatus";
DROP TYPE IF EXISTS "RenewalStrategy";