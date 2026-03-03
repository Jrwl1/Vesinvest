-- CreateTable
CREATE TABLE "veeti_year_policy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "veetiId" INTEGER NOT NULL,
    "vuosi" INTEGER NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "edited_by" TEXT,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veeti_year_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "veeti_year_policy_orgId_veetiId_vuosi_key" ON "veeti_year_policy"("orgId", "veetiId", "vuosi");

-- CreateIndex
CREATE INDEX "veeti_year_policy_orgId_veetiId_excluded_idx" ON "veeti_year_policy"("orgId", "veetiId", "excluded");

-- CreateIndex
CREATE INDEX "veeti_year_policy_orgId_vuosi_idx" ON "veeti_year_policy"("orgId", "vuosi");

-- AddForeignKey
ALTER TABLE "veeti_year_policy" ADD CONSTRAINT "veeti_year_policy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
