ALTER TABLE "ennuste"
ADD COLUMN "baseline_depreciation" JSONB,
ADD COLUMN "scenario_depreciation_rules" JSONB;

UPDATE "ennuste" AS e
SET "scenario_depreciation_rules" = rules.rules_json
FROM (
  SELECT
    en.id AS ennuste_id,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'assetClassKey', dr."asset_class_key",
          'assetClassName', dr."asset_class_name",
          'method', dr."method",
          'linearYears', dr."linear_years",
          'residualPercent', dr."residual_percent"
        )
        ORDER BY dr."asset_class_key"
      ),
      '[]'::jsonb
    ) AS rules_json
  FROM "ennuste" en
  LEFT JOIN "depreciation_rule" dr
    ON dr."orgId" = en."orgId"
  GROUP BY en.id
) AS rules
WHERE e.id = rules.ennuste_id
  AND e."scenario_depreciation_rules" IS NULL;
