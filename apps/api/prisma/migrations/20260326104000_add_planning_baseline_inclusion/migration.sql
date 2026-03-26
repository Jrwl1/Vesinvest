ALTER TABLE "veeti_year_policy"
ADD COLUMN "included_in_planning_baseline" BOOLEAN NOT NULL DEFAULT false;

UPDATE "veeti_year_policy"
SET "included_in_planning_baseline" = false
WHERE "excluded" = true;
