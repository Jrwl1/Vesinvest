CREATE TABLE "v2_import_clear_challenge" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "confirm_token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "v2_import_clear_challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "v2_import_clear_challenge_org_id_user_id_expires_at_idx"
  ON "v2_import_clear_challenge"("org_id", "user_id", "expires_at");

CREATE INDEX "v2_import_clear_challenge_expires_at_idx"
  ON "v2_import_clear_challenge"("expires_at");

ALTER TABLE "v2_import_clear_challenge"
  ADD CONSTRAINT "v2_import_clear_challenge_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
