-- CreateTable
CREATE TABLE "ennuste_report" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ennuste_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot_json" JSONB NOT NULL,
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "baseline_year" INTEGER NOT NULL,
    "required_price_today" DECIMAL(65,30) NOT NULL,
    "required_annual_increase_pct" DECIMAL(65,30) NOT NULL,
    "total_investments" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "ennuste_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ennuste_report_orgId_created_at_idx" ON "ennuste_report"("orgId", "created_at");

-- CreateIndex
CREATE INDEX "ennuste_report_ennuste_id_idx" ON "ennuste_report"("ennuste_id");

-- AddForeignKey
ALTER TABLE "ennuste_report" ADD CONSTRAINT "ennuste_report_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ennuste_report" ADD CONSTRAINT "ennuste_report_ennuste_id_fkey" FOREIGN KEY ("ennuste_id") REFERENCES "ennuste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ennuste_report" ADD CONSTRAINT "ennuste_report_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
