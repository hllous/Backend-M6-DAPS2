-- AlterTable
-- Aditivo: `attachment` no tiene filas en producción al momento de esta
-- migración (verificado antes de escribirla), por eso las columnas NOT NULL
-- sin default son seguras — no hay filas existentes que puedan violarlas.
ALTER TABLE "attachment"
  ADD COLUMN     "content_type" TEXT NOT NULL,
  ADD COLUMN     "size" INTEGER NOT NULL,
  ADD COLUMN     "idempotency_key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "attachment_owner_type_owner_id_idempotency_key_key" ON "attachment"("owner_type", "owner_id", "idempotency_key");
