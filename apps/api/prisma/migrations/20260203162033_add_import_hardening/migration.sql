-- CreateEnum
CREATE TYPE "RenewalStrategy" AS ENUM ('linear', 'clustered', 'risk_based');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'mapped', 'imported', 'failed');

-- CreateEnum
CREATE TYPE "TargetEntity" AS ENUM ('asset', 'assetType', 'site', 'maintenanceItem');

-- CreateEnum
CREATE TYPE "FieldCriticality" AS ENUM ('law_critical', 'model_critical', 'optional');

-- CreateEnum
CREATE TYPE "ImportAction" AS ENUM ('created', 'updated', 'skipped');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "sourceImportId" TEXT,
ADD COLUMN     "sourceRowNumber" INTEGER,
ADD COLUMN     "sourceSheetName" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "annualRenewalCapacityEur" DECIMAL(65,30),
ADD COLUMN     "renewalStrategy" "RenewalStrategy";

-- CreateTable
CREATE TABLE "PlanningScenario" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planningHorizonYears" INTEGER NOT NULL DEFAULT 20,
    "inflationRate" DECIMAL(65,30) NOT NULL DEFAULT 0.02,
    "discountRate" DECIMAL(65,30) NOT NULL DEFAULT 0.03,
    "currentTariffEur" DECIMAL(65,30),
    "revenueBaselineEur" DECIMAL(65,30),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelImport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcelImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcelSheet" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "headers" TEXT[],
    "rowCount" INTEGER NOT NULL,
    "sampleRows" JSONB,
    "columnsProfile" JSONB,

    CONSTRAINT "ExcelSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedRecord" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "entityType" "TargetEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "action" "ImportAction" NOT NULL DEFAULT 'created',
    "matchKey" TEXT,
    "matchValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetEntity" "TargetEntity" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingColumn" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "sourceColumn" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transformation" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "criticality" "FieldCriticality" NOT NULL DEFAULT 'optional',

    CONSTRAINT "MappingColumn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningScenario_orgId_idx" ON "PlanningScenario"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningScenario_orgId_name_key" ON "PlanningScenario"("orgId", "name");

-- CreateIndex
CREATE INDEX "ExcelImport_orgId_idx" ON "ExcelImport"("orgId");

-- CreateIndex
CREATE INDEX "ExcelImport_orgId_status_idx" ON "ExcelImport"("orgId", "status");

-- CreateIndex
CREATE INDEX "ExcelSheet_importId_idx" ON "ExcelSheet"("importId");

-- CreateIndex
CREATE INDEX "ImportedRecord_importId_idx" ON "ImportedRecord"("importId");

-- CreateIndex
CREATE INDEX "ImportedRecord_entityId_idx" ON "ImportedRecord"("entityId");

-- CreateIndex
CREATE INDEX "ImportedRecord_rowHash_idx" ON "ImportedRecord"("rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRecord_importId_sheetName_rowNumber_key" ON "ImportedRecord"("importId", "sheetName", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRecord_importId_rowHash_entityType_key" ON "ImportedRecord"("importId", "rowHash", "entityType");

-- CreateIndex
CREATE INDEX "ImportMapping_orgId_idx" ON "ImportMapping"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMapping_orgId_name_version_key" ON "ImportMapping"("orgId", "name", "version");

-- CreateIndex
CREATE INDEX "MappingColumn_mappingId_idx" ON "MappingColumn"("mappingId");

-- CreateIndex
CREATE INDEX "Asset_sourceImportId_idx" ON "Asset"("sourceImportId");

-- AddForeignKey
ALTER TABLE "PlanningScenario" ADD CONSTRAINT "PlanningScenario_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImport" ADD CONSTRAINT "ExcelImport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelSheet" ADD CONSTRAINT "ExcelSheet_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRecord" ADD CONSTRAINT "ImportedRecord_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMapping" ADD CONSTRAINT "ImportMapping_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingColumn" ADD CONSTRAINT "MappingColumn_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "ImportMapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;
