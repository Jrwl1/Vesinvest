-- CreateEnum
CREATE TYPE "RiviKind" AS ENUM ('group', 'line');

-- AlterTable
ALTER TABLE "talousarvio"
ADD COLUMN "input_completeness" JSONB;

-- AlterTable
ALTER TABLE "talousarvio_rivi"
ADD COLUMN "parent_id" TEXT,
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "row_kind" "RiviKind" NOT NULL DEFAULT 'line',
ADD COLUMN "service_type" "Palvelutyyppi",
ADD COLUMN "imported" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tuloajuri"
ADD COLUMN "source_meta" JSONB;

-- CreateIndex
CREATE INDEX "talousarvio_rivi_talousarvio_id_parent_id_idx"
ON "talousarvio_rivi"("talousarvioId", "parent_id");

-- CreateIndex
CREATE INDEX "talousarvio_rivi_talousarvio_id_sort_order_idx"
ON "talousarvio_rivi"("talousarvioId", "sort_order");

-- AddForeignKey
ALTER TABLE "talousarvio_rivi"
ADD CONSTRAINT "talousarvio_rivi_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "talousarvio_rivi"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
