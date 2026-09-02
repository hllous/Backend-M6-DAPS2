-- AlterTable
-- updated_at lleva DEFAULT CURRENT_TIMESTAMP para que la migracion no falle
-- sobre una tabla con filas (Prisma la genera sin default y ahi rompe).
-- El valor real lo sigue manejando @updatedAt desde la aplicacion.
ALTER TABLE "disposal_site" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
