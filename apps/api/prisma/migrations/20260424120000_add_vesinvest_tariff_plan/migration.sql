CREATE TYPE "VesinvestTariffPlanStatus" AS ENUM ('draft', 'accepted', 'stale');

CREATE TABLE "vesinvest_tariff_plan" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "vesinvest_plan_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "status" "VesinvestTariffPlanStatus" NOT NULL DEFAULT 'draft',
    "baseline_input" JSONB NOT NULL,
    "allocation_policy" JSONB NOT NULL,
    "recommendation" JSONB NOT NULL,
    "readiness_checklist" JSONB NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_tariff_plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vesinvest_tariff_plan_org_id_updated_at_idx" ON "vesinvest_tariff_plan"("org_id", "updated_at");
CREATE INDEX "vesinvest_tariff_plan_vesinvest_plan_id_status_idx" ON "vesinvest_tariff_plan"("vesinvest_plan_id", "status");
CREATE INDEX "vesinvest_tariff_plan_scenario_id_status_idx" ON "vesinvest_tariff_plan"("scenario_id", "status");
CREATE UNIQUE INDEX "vesinvest_tariff_plan_one_accepted_idx" ON "vesinvest_tariff_plan"("org_id", "vesinvest_plan_id", "scenario_id") WHERE "status" = 'accepted';

ALTER TABLE "vesinvest_tariff_plan" ADD CONSTRAINT "vesinvest_tariff_plan_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vesinvest_tariff_plan" ADD CONSTRAINT "vesinvest_tariff_plan_vesinvest_plan_id_fkey" FOREIGN KEY ("vesinvest_plan_id") REFERENCES "vesinvest_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vesinvest_tariff_plan" ADD CONSTRAINT "vesinvest_tariff_plan_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "ennuste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
