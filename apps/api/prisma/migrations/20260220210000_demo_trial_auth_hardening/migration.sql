-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('active', 'expired', 'locked');

-- CreateEnum
CREATE TYPE "LegalDocType" AS ENUM ('terms', 'dpa');

-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "trial_starts_at" TIMESTAMP(3),
ADD COLUMN "trial_ends_at" TIMESTAMP(3),
ADD COLUMN "trial_status" "TrialStatus" DEFAULT 'active',
ADD COLUMN "lock_reason" TEXT;

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document" (
    "id" TEXT NOT NULL,
    "doc_type" "LegalDocType" NOT NULL,
    "version" TEXT NOT NULL,
    "content_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptance" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terms_version" TEXT NOT NULL,
    "dpa_version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invitation_orgId_email_idx" ON "invitation"("orgId", "email");

-- CreateIndex
CREATE INDEX "invitation_token_hash_idx" ON "invitation"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_doc_type_version_key" ON "legal_document"("doc_type", "version");

-- CreateIndex
CREATE INDEX "legal_document_doc_type_is_active_idx" ON "legal_document"("doc_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptance_orgId_user_id_terms_version_dpa_version_key" ON "legal_acceptance"("orgId", "user_id", "terms_version", "dpa_version");

-- CreateIndex
CREATE INDEX "legal_acceptance_orgId_terms_version_dpa_version_idx" ON "legal_acceptance"("orgId", "terms_version", "dpa_version");

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptance" ADD CONSTRAINT "legal_acceptance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptance" ADD CONSTRAINT "legal_acceptance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
