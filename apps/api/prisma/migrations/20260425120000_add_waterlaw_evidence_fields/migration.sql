ALTER TABLE "vesinvest_plan"
ADD COLUMN "asset_evidence_state" JSONB,
ADD COLUMN "municipal_plan_context" JSONB,
ADD COLUMN "maintenance_evidence_state" JSONB,
ADD COLUMN "condition_study_state" JSONB,
ADD COLUMN "financial_risk_state" JSONB,
ADD COLUMN "publication_state" JSONB,
ADD COLUMN "communication_state" JSONB;

ALTER TABLE "vesinvest_tariff_plan"
ADD COLUMN "revenue_evidence" JSONB,
ADD COLUMN "cost_evidence" JSONB,
ADD COLUMN "regional_differentiation_state" JSONB,
ADD COLUMN "stormwater_state" JSONB,
ADD COLUMN "special_use_state" JSONB,
ADD COLUMN "connection_fee_liability_state" JSONB,
ADD COLUMN "owner_distribution_state" JSONB;
