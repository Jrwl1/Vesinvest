CREATE TABLE "vesinvest_group_override" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "default_account_key" TEXT NOT NULL,
    "default_depreciation_class_key" TEXT,
    "report_group_key" TEXT NOT NULL,
    "service_split" "VesinvestServiceSplit" NOT NULL DEFAULT 'mixed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vesinvest_group_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vesinvest_group_override_orgId_key_key"
ON "vesinvest_group_override"("orgId", "key");

CREATE INDEX "vesinvest_group_override_orgId_updated_at_idx"
ON "vesinvest_group_override"("orgId", "updated_at");

ALTER TABLE "vesinvest_group_override" ADD CONSTRAINT "vesinvest_group_override_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
