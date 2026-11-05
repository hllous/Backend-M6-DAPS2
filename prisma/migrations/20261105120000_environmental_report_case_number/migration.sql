-- Numero de expediente legible (EXP-2026-000123), interno de M6.
ALTER TABLE "environmental_report" ADD COLUMN "case_number" TEXT;

CREATE SEQUENCE "environmental_report_case_seq";
ALTER SEQUENCE "environmental_report_case_seq" OWNED BY "environmental_report"."case_number";

-- Backfill por orden de alta.
UPDATE "environmental_report" r
SET "case_number" = 'EXP-' || to_char(o."created_at", 'YYYY') || '-' || lpad(o.rn::text, 6, '0')
FROM (
  SELECT "id", "created_at", row_number() OVER (ORDER BY "created_at", "id") AS rn
  FROM "environmental_report"
) o
WHERE r."id" = o."id";

SELECT setval(
  'environmental_report_case_seq',
  GREATEST((SELECT count(*) FROM "environmental_report"), 1),
  (SELECT count(*) > 0 FROM "environmental_report")
);

-- El default cubre todos los caminos de alta (API, consumidor de M2, seed).
ALTER TABLE "environmental_report"
  ALTER COLUMN "case_number" SET DEFAULT ('EXP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('environmental_report_case_seq')::text, 6, '0')),
  ALTER COLUMN "case_number" SET NOT NULL;

CREATE UNIQUE INDEX "environmental_report_case_number_key" ON "environmental_report"("case_number");
