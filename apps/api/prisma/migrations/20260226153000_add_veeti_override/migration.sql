-- CreateTable
CREATE TABLE "veeti_override" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "veetiId" INTEGER NOT NULL,
    "vuosi" INTEGER NOT NULL,
    "data_type" TEXT NOT NULL,
    "override_data" JSONB NOT NULL,
    "edited_by" TEXT,
    "reason" TEXT,
    "edited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veeti_override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "veeti_override_orgId_veetiId_vuosi_data_type_key" ON "veeti_override"("orgId", "veetiId", "vuosi", "data_type");

-- CreateIndex
CREATE INDEX "veeti_override_orgId_veetiId_vuosi_idx" ON "veeti_override"("orgId", "veetiId", "vuosi");

-- AddForeignKey
ALTER TABLE "veeti_override" ADD CONSTRAINT "veeti_override_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
