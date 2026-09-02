-- DropIndex
DROP INDEX "outbox_event_status_idx";

-- AlterTable
-- Drift heredado, no es parte de esta migracion: al crear
-- 20260902144045_disposal_site_soft_delete se le puso a mano un
-- DEFAULT CURRENT_TIMESTAMP a updated_at para que la migracion no fallara sobre
-- una tabla con filas. schema.prisma nunca declaro ese default, asi que Prisma
-- lo detecta como divergencia en cada migracion nueva. Se elimina aca para
-- dejar la base alineada con el schema: el valor lo sigue poniendo @updatedAt
-- desde la aplicacion en cada escritura.
ALTER TABLE "disposal_site" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "outbox_event" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT;

-- CreateIndex
CREATE INDEX "outbox_event_status_occurred_at_idx" ON "outbox_event"("status", "occurred_at");
