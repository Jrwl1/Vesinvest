-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('linear', 'residual', 'none');

-- CreateTable
CREATE TABLE "depreciation_rule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "asset_class_key" TEXT NOT NULL,
    "asset_class_name" TEXT,
    "method" "DepreciationMethod" NOT NULL,
    "linear_years" INTEGER,
    "residual_percent" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depreciation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_rule_orgId_asset_class_key_key" ON "depreciation_rule"("orgId", "asset_class_key");

-- CreateIndex
CREATE INDEX "depreciation_rule_orgId_method_idx" ON "depreciation_rule"("orgId", "method");

-- AddForeignKey
ALTER TABLE "depreciation_rule" ADD CONSTRAINT "depreciation_rule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
