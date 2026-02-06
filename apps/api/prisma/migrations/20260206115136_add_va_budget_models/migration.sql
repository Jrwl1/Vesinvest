-- CreateEnum
CREATE TYPE "TalousarvioTila" AS ENUM ('luonnos', 'vahvistettu');

-- CreateEnum
CREATE TYPE "RiviTyyppi" AS ENUM ('kulu', 'tulo', 'investointi');

-- CreateEnum
CREATE TYPE "Palvelutyyppi" AS ENUM ('vesi', 'jatevesi', 'muu');

-- CreateTable
CREATE TABLE "talousarvio" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vuosi" INTEGER NOT NULL,
    "nimi" TEXT,
    "tila" "TalousarvioTila" NOT NULL DEFAULT 'luonnos',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talousarvio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talousarvio_rivi" (
    "id" TEXT NOT NULL,
    "talousarvioId" TEXT NOT NULL,
    "tiliryhma" TEXT NOT NULL,
    "nimi" TEXT NOT NULL,
    "tyyppi" "RiviTyyppi" NOT NULL,
    "summa" DECIMAL(65,30) NOT NULL,
    "muistiinpanot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talousarvio_rivi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuloajuri" (
    "id" TEXT NOT NULL,
    "talousarvioId" TEXT NOT NULL,
    "palvelutyyppi" "Palvelutyyppi" NOT NULL,
    "yksikkohinta" DECIMAL(65,30) NOT NULL,
    "myyty_maara" DECIMAL(65,30) NOT NULL,
    "perusmaksu" DECIMAL(65,30),
    "liittyma_maara" INTEGER,
    "alv_prosentti" DECIMAL(65,30),
    "muistiinpanot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuloajuri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "olettamus" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "avain" TEXT NOT NULL,
    "nimi" TEXT NOT NULL,
    "arvo" DECIMAL(65,30) NOT NULL,
    "yksikko" TEXT,
    "kuvaus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olettamus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ennuste" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "talousarvioId" TEXT NOT NULL,
    "nimi" TEXT NOT NULL,
    "aikajakso_vuosia" INTEGER NOT NULL,
    "olettamus_ylikirjoitukset" JSONB,
    "on_oletus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ennuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ennuste_vuosi" (
    "id" TEXT NOT NULL,
    "ennusteId" TEXT NOT NULL,
    "vuosi" INTEGER NOT NULL,
    "tulot_yhteensa" DECIMAL(65,30) NOT NULL,
    "kulut_yhteensa" DECIMAL(65,30) NOT NULL,
    "investoinnit_yhteensa" DECIMAL(65,30) NOT NULL,
    "tulos" DECIMAL(65,30) NOT NULL,
    "kumulatiivinen_tulos" DECIMAL(65,30) NOT NULL,
    "vesihinta" DECIMAL(65,30),
    "myyty_vesimaara" DECIMAL(65,30),
    "erittelyt" JSONB,

    CONSTRAINT "ennuste_vuosi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "talousarvio_orgId_vuosi_key" ON "talousarvio"("orgId", "vuosi");

-- CreateIndex
CREATE INDEX "talousarvio_rivi_talousarvioId_idx" ON "talousarvio_rivi"("talousarvioId");

-- CreateIndex
CREATE INDEX "tuloajuri_talousarvioId_idx" ON "tuloajuri"("talousarvioId");

-- CreateIndex
CREATE UNIQUE INDEX "olettamus_orgId_avain_key" ON "olettamus"("orgId", "avain");

-- CreateIndex
CREATE INDEX "ennuste_orgId_idx" ON "ennuste"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ennuste_orgId_nimi_key" ON "ennuste"("orgId", "nimi");

-- CreateIndex
CREATE UNIQUE INDEX "ennuste_vuosi_ennusteId_vuosi_key" ON "ennuste_vuosi"("ennusteId", "vuosi");

-- AddForeignKey
ALTER TABLE "talousarvio" ADD CONSTRAINT "talousarvio_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talousarvio_rivi" ADD CONSTRAINT "talousarvio_rivi_talousarvioId_fkey" FOREIGN KEY ("talousarvioId") REFERENCES "talousarvio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuloajuri" ADD CONSTRAINT "tuloajuri_talousarvioId_fkey" FOREIGN KEY ("talousarvioId") REFERENCES "talousarvio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olettamus" ADD CONSTRAINT "olettamus_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ennuste" ADD CONSTRAINT "ennuste_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ennuste" ADD CONSTRAINT "ennuste_talousarvioId_fkey" FOREIGN KEY ("talousarvioId") REFERENCES "talousarvio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ennuste_vuosi" ADD CONSTRAINT "ennuste_vuosi_ennusteId_fkey" FOREIGN KEY ("ennusteId") REFERENCES "ennuste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
