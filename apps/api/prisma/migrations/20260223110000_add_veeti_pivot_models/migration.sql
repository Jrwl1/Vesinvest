-- CreateTable
CREATE TABLE "veeti_organisaatio" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "veetiId" INTEGER NOT NULL,
    "nimi" TEXT,
    "ytunnus" TEXT,
    "kunta" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_fetched_at" TIMESTAMP(3),
    "fetch_status" TEXT,

    CONSTRAINT "veeti_organisaatio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veeti_snapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "veetiId" INTEGER NOT NULL,
    "vuosi" INTEGER NOT NULL,
    "data_type" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "veeti_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veeti_benchmark" (
    "id" TEXT NOT NULL,
    "vuosi" INTEGER NOT NULL,
    "metric_key" TEXT NOT NULL,
    "kokoluokka" TEXT NOT NULL,
    "org_count" INTEGER NOT NULL,
    "avg_value" DECIMAL(65,30) NOT NULL,
    "median_value" DECIMAL(65,30),
    "p25_value" DECIMAL(65,30),
    "p75_value" DECIMAL(65,30),
    "min_value" DECIMAL(65,30),
    "max_value" DECIMAL(65,30),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "veeti_benchmark_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "talousarvio"
  ADD COLUMN "lahde" TEXT,
  ADD COLUMN "veeti_vuosi" INTEGER,
  ADD COLUMN "veeti_imported_at" TIMESTAMP(3),
  ADD COLUMN "user_edited" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "veeti_organisaatio_orgId_key" ON "veeti_organisaatio"("orgId");

-- CreateIndex
CREATE INDEX "veeti_snapshot_orgId_vuosi_idx" ON "veeti_snapshot"("orgId", "vuosi");

-- CreateIndex
CREATE UNIQUE INDEX "veeti_snapshot_orgId_veetiId_vuosi_data_type_key" ON "veeti_snapshot"("orgId", "veetiId", "vuosi", "data_type");

-- CreateIndex
CREATE INDEX "veeti_benchmark_vuosi_metric_key_idx" ON "veeti_benchmark"("vuosi", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "veeti_benchmark_vuosi_metric_key_kokoluokka_key" ON "veeti_benchmark"("vuosi", "metric_key", "kokoluokka");

-- AddForeignKey
ALTER TABLE "veeti_organisaatio" ADD CONSTRAINT "veeti_organisaatio_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "veeti_snapshot" ADD CONSTRAINT "veeti_snapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

