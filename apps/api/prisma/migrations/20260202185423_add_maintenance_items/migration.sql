-- CreateEnum
CREATE TYPE "MaintenanceKind" AS ENUM ('MAINTENANCE', 'REPLACEMENT');

-- CreateTable
CREATE TABLE "MaintenanceItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "MaintenanceKind" NOT NULL,
    "intervalYears" INTEGER NOT NULL,
    "costEur" DECIMAL(65,30) NOT NULL,
    "startsAtYear" INTEGER,
    "endsAtYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceItem_orgId_assetId_idx" ON "MaintenanceItem"("orgId", "assetId");

-- CreateIndex
CREATE INDEX "MaintenanceItem_orgId_kind_idx" ON "MaintenanceItem"("orgId", "kind");

-- AddForeignKey
ALTER TABLE "MaintenanceItem" ADD CONSTRAINT "MaintenanceItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceItem" ADD CONSTRAINT "MaintenanceItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
