CREATE TYPE "VesinvestPlanStatus" AS ENUM ('draft', 'active', 'archived');
CREATE TYPE "VesinvestBaselineStatus" AS ENUM ('draft', 'incomplete', 'verified');
CREATE TYPE "VesinvestFeeRecommendationStatus" AS ENUM ('blocked', 'provisional', 'verified');
CREATE TYPE "VesinvestIdentitySource" AS ENUM ('manual', 'veeti', 'mixed');
CREATE TYPE "VesinvestInvestmentType" AS ENUM ('sanering', 'nyanlaggning', 'reparation');

CREATE TABLE "vesinvest_plan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "utility_name" TEXT NOT NULL,
    "business_id" TEXT,
    "identity_source" "VesinvestIdentitySource" NOT NULL DEFAULT 'manual',
    "veeti_id" INTEGER,
    "horizon_years" INTEGER NOT NULL DEFAULT 20,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "status" "VesinvestPlanStatus" NOT NULL DEFAULT 'draft',
    "baseline_status" "VesinvestBaselineStatus" NOT NULL DEFAULT 'draft',
    "fee_recommendation_status" "VesinvestFeeRecommendationStatus" NOT NULL DEFAULT 'blocked',
    "fee_recommendation" JSONB,
    "baseline_source_state" JSONB,
    "selected_scenario_id" TEXT,
    "source_plan_id" TEXT,
    "last_reviewed_at" TIMESTAMP(3),
    "review_due_at" TIMESTAMP(3),
    "baseline_changed_since_accepted_revision" BOOLEAN NOT NULL DEFAULT false,
    "investment_plan_changed_since_fee_recommendation" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vesinvest_project" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "project_code" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "investment_type" "VesinvestInvestmentType" NOT NULL,
    "group_key" TEXT NOT NULL,
    "depreciation_class_key" TEXT,
    "account_key" TEXT,
    "report_group_key" TEXT,
    "subtype" TEXT,
    "notes" TEXT,
    "water_amount" DECIMAL(65,30),
    "wastewater_amount" DECIMAL(65,30),
    "total_amount" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vesinvest_project_allocation" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "water_amount" DECIMAL(65,30),
    "wastewater_amount" DECIMAL(65,30),
    "total_amount" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_project_allocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vesinvest_plan_orgId_updated_at_idx" ON "vesinvest_plan"("orgId", "updated_at");
CREATE INDEX "vesinvest_plan_orgId_status_idx" ON "vesinvest_plan"("orgId", "status");
CREATE INDEX "vesinvest_plan_orgId_review_due_at_idx" ON "vesinvest_plan"("orgId", "review_due_at");
CREATE UNIQUE INDEX "vesinvest_project_plan_id_project_code_key" ON "vesinvest_project"("plan_id", "project_code");
CREATE INDEX "vesinvest_project_plan_id_investment_type_idx" ON "vesinvest_project"("plan_id", "investment_type");
CREATE UNIQUE INDEX "vesinvest_project_allocation_project_id_year_key" ON "vesinvest_project_allocation"("project_id", "year");
CREATE INDEX "vesinvest_project_allocation_year_idx" ON "vesinvest_project_allocation"("year");

ALTER TABLE "vesinvest_plan" ADD CONSTRAINT "vesinvest_plan_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vesinvest_plan" ADD CONSTRAINT "vesinvest_plan_selected_scenario_id_fkey"
FOREIGN KEY ("selected_scenario_id") REFERENCES "ennuste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vesinvest_plan" ADD CONSTRAINT "vesinvest_plan_source_plan_id_fkey"
FOREIGN KEY ("source_plan_id") REFERENCES "vesinvest_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vesinvest_project" ADD CONSTRAINT "vesinvest_project_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "vesinvest_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vesinvest_project_allocation" ADD CONSTRAINT "vesinvest_project_allocation_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "vesinvest_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
