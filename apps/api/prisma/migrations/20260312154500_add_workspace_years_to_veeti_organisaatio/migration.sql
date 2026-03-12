ALTER TABLE "veeti_organisaatio"
ADD COLUMN "workspace_years" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
