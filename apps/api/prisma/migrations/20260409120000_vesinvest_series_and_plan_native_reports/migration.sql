CREATE TYPE "VesinvestServiceSplit" AS ENUM ('water', 'wastewater', 'mixed');

CREATE TABLE "vesinvest_plan_series" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_plan_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vesinvest_group_definition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "default_account_key" TEXT NOT NULL,
    "default_depreciation_class_key" TEXT,
    "report_group_key" TEXT NOT NULL,
    "service_split" "VesinvestServiceSplit" NOT NULL DEFAULT 'mixed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_group_definition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "vesinvest_plan"
    ADD COLUMN "series_id" TEXT,
    ADD COLUMN "baseline_fingerprint" TEXT,
    ADD COLUMN "scenario_fingerprint" TEXT;

ALTER TABLE "ennuste_report"
    ADD COLUMN "vesinvest_plan_id" TEXT;

CREATE UNIQUE INDEX "vesinvest_group_definition_key_key" ON "vesinvest_group_definition"("key");
CREATE INDEX "vesinvest_plan_series_orgId_updated_at_idx" ON "vesinvest_plan_series"("orgId", "updated_at");

WITH RECURSIVE plan_series_root AS (
    SELECT
        vp."id",
        vp."source_plan_id",
        vp."id" AS root_id
    FROM "vesinvest_plan" vp
    WHERE vp."source_plan_id" IS NULL

    UNION ALL

    SELECT
        child."id",
        child."source_plan_id",
        parent.root_id
    FROM "vesinvest_plan" child
    JOIN plan_series_root parent
      ON child."source_plan_id" = parent."id"
),
resolved_roots AS (
    SELECT
        vp."id",
        COALESCE(psr.root_id, vp."id") AS root_id,
        vp."orgId"
    FROM "vesinvest_plan" vp
    LEFT JOIN plan_series_root psr
      ON psr."id" = vp."id"
),
distinct_series AS (
    SELECT DISTINCT
        'series-' || root_id AS series_id,
        "orgId"
    FROM resolved_roots
)
INSERT INTO "vesinvest_plan_series" ("id", "orgId", "created_at", "updated_at")
SELECT
    ds.series_id,
    ds."orgId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM distinct_series ds;

WITH RECURSIVE plan_series_root AS (
    SELECT
        vp."id",
        vp."source_plan_id",
        vp."id" AS root_id
    FROM "vesinvest_plan" vp
    WHERE vp."source_plan_id" IS NULL

    UNION ALL

    SELECT
        child."id",
        child."source_plan_id",
        parent.root_id
    FROM "vesinvest_plan" child
    JOIN plan_series_root parent
      ON child."source_plan_id" = parent."id"
),
resolved_roots AS (
    SELECT
        vp."id",
        COALESCE(psr.root_id, vp."id") AS root_id
    FROM "vesinvest_plan" vp
    LEFT JOIN plan_series_root psr
      ON psr."id" = vp."id"
)
UPDATE "vesinvest_plan" vp
SET "series_id" = 'series-' || rr.root_id
FROM resolved_roots rr
WHERE vp."id" = rr."id";

WITH ranked_active AS (
    SELECT
        vp."id",
        ROW_NUMBER() OVER (
            PARTITION BY vp."series_id"
            ORDER BY vp."version_number" DESC, vp."updated_at" DESC, vp."created_at" DESC
        ) AS rank_in_series
    FROM "vesinvest_plan" vp
    WHERE vp."status" = 'active'
)
UPDATE "vesinvest_plan" vp
SET "status" = 'archived'
FROM ranked_active ra
WHERE vp."id" = ra."id"
  AND ra.rank_in_series > 1;

UPDATE "ennuste_report" er
SET "vesinvest_plan_id" = (
    SELECT vp."id"
    FROM "vesinvest_plan" vp
    WHERE vp."orgId" = er."orgId"
      AND vp."selected_scenario_id" = er."ennuste_id"
    ORDER BY
      CASE vp."status"
        WHEN 'active' THEN 0
        WHEN 'draft' THEN 1
        ELSE 2
      END,
      vp."updated_at" DESC,
      vp."created_at" DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM "vesinvest_plan" vp
    WHERE vp."orgId" = er."orgId"
      AND vp."selected_scenario_id" = er."ennuste_id"
);

INSERT INTO "vesinvest_group_definition" (
    "id",
    "key",
    "label",
    "default_account_key",
    "default_depreciation_class_key",
    "report_group_key",
    "service_split",
    "created_at",
    "updated_at"
) VALUES
    ('vesinvest-group-sanering-water-network', 'sanering_water_network', 'Sanering / vattennätverk', 'sanering_water_network', 'water_network_post_1999', 'network_rehabilitation', 'water', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-sanering-wastewater-network', 'sanering_wastewater_network', 'Sanering / avloppsnätverk', 'sanering_wastewater_network', 'wastewater_network_post_1999', 'network_rehabilitation', 'wastewater', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-new-water-network', 'new_water_network', 'Nyanläggning / vattennätverk', 'new_water_network', 'water_network_post_1999', 'new_network', 'water', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-new-wastewater-network', 'new_wastewater_network', 'Nyanläggning / avloppsnätverk', 'new_wastewater_network', 'wastewater_network_post_1999', 'new_network', 'wastewater', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-waterworks-equipment', 'waterworks_equipment', 'Vattenverksapparatur', 'waterworks_equipment', 'plant_machinery', 'plant_equipment', 'water', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-wastewater-equipment', 'wastewater_equipment', 'Avloppsapparatur', 'wastewater_equipment', 'plant_machinery', 'plant_equipment', 'wastewater', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-water-production', 'water_production', 'Vattenproduktion', 'water_production', 'plant_buildings', 'production', 'water', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('vesinvest-group-wastewater-treatment', 'wastewater_treatment', 'Avloppsrening', 'wastewater_treatment', 'plant_buildings', 'treatment', 'wastewater', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "vesinvest_plan"
    ALTER COLUMN "series_id" SET NOT NULL;

CREATE INDEX "vesinvest_plan_series_id_status_idx" ON "vesinvest_plan"("series_id", "status");
CREATE UNIQUE INDEX "vesinvest_plan_series_id_version_number_key" ON "vesinvest_plan"("series_id", "version_number");
CREATE INDEX "ennuste_report_vesinvest_plan_id_idx" ON "ennuste_report"("vesinvest_plan_id");

ALTER TABLE "vesinvest_plan_series" ADD CONSTRAINT "vesinvest_plan_series_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vesinvest_plan" ADD CONSTRAINT "vesinvest_plan_series_id_fkey"
FOREIGN KEY ("series_id") REFERENCES "vesinvest_plan_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ennuste_report" ADD CONSTRAINT "ennuste_report_vesinvest_plan_id_fkey"
FOREIGN KEY ("vesinvest_plan_id") REFERENCES "vesinvest_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
