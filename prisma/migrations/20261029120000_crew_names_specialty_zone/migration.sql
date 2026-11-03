-- CreateEnum
CREATE TYPE "CrewSpecialty" AS ENUM ('COLLECTION', 'SWEEPING', 'CLEANING', 'RECYCLING', 'TREES', 'GREEN_SPACES', 'INSPECTION');

-- AlterTable
ALTER TABLE "crew" ADD COLUMN     "home_zone_id" UUID,
ADD COLUMN     "leader_name" TEXT,
ADD COLUMN     "organization_name" TEXT,
ADD COLUMN     "specialty" "CrewSpecialty";

-- AlterTable
ALTER TABLE "crew_member" ADD COLUMN     "display_name" TEXT;

-- CreateTable
CREATE TABLE "crew_zone_assignment" (
    "id" UUID NOT NULL,
    "crew_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_zone_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crew_zone_assignment_crew_id_valid_from_idx" ON "crew_zone_assignment"("crew_id", "valid_from");

-- CreateIndex
CREATE INDEX "crew_zone_assignment_zone_id_idx" ON "crew_zone_assignment"("zone_id");

-- CreateIndex
CREATE INDEX "crew_home_zone_id_idx" ON "crew"("home_zone_id");

-- AddForeignKey
ALTER TABLE "crew" ADD CONSTRAINT "crew_home_zone_id_fkey" FOREIGN KEY ("home_zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_zone_assignment" ADD CONSTRAINT "crew_zone_assignment_crew_id_fkey" FOREIGN KEY ("crew_id") REFERENCES "crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_zone_assignment" ADD CONSTRAINT "crew_zone_assignment_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
