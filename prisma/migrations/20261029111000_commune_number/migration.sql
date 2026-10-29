-- AlterTable: la columna nace nullable para poder rellenar las filas existentes
ALTER TABLE "commune" ADD COLUMN     "number" INTEGER;

-- Backfill: `comuna-N` -> N
UPDATE "commune" SET "number" = substring("code" from '^comuna-([0-9]+)$')::INTEGER;

-- Un code que no sea `comuna-N` no tiene número deducible: falla acá, con el motivo, en vez de dejar NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "commune" WHERE "number" IS NULL) THEN
    RAISE EXCEPTION 'commune.number: hay comunas cuyo code no es comuna-N (%). Corregirlas antes de migrar',
      (SELECT string_agg("code", ', ') FROM "commune" WHERE "number" IS NULL);
  END IF;
END $$;

ALTER TABLE "commune" ALTER COLUMN "number" SET NOT NULL;
