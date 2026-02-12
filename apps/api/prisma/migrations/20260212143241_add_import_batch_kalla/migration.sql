-- AlterTable
ALTER TABLE "talousarvio" ADD COLUMN     "import_batch_id" TEXT,
ADD COLUMN     "import_source_file_name" TEXT,
ADD COLUMN     "imported_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "talousarvio_orgId_import_batch_id_idx" ON "talousarvio"("orgId", "import_batch_id");
