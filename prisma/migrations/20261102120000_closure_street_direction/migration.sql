-- CreateEnum
CREATE TYPE "StreetDirection" AS ENUM ('FORWARD', 'REVERSE', 'BOTH');

-- AlterTable
-- Los tramos ya cargados no tienen sentido registrado: se backfillean con BOTH
-- (el corte más conservador, afecta ambos sentidos). El DEFAULT se quita después
-- para que los inserts nuevos tengan que declarar direction.
ALTER TABLE "closure_street" ADD COLUMN     "direction" "StreetDirection" NOT NULL DEFAULT 'BOTH';
ALTER TABLE "closure_street" ALTER COLUMN "direction" DROP DEFAULT;
