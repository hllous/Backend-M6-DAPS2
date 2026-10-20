-- AlterEnum
-- ADD VALUE no puede usarse en la misma transaccion que lo referencia: esta
-- migracion solo agrega el valor y las columnas, no lo usa.
ALTER TYPE "StreetClosureRequestStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "street_closure_request" ADD COLUMN "approved_from" TIMESTAMP(3),
ADD COLUMN "approved_to" TIMESTAMP(3);
