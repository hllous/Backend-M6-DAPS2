-- AlterTable
ALTER TABLE "service" ADD COLUMN     "assignment_override_at" TIMESTAMP(3),
ADD COLUMN     "assignment_override_by" TEXT,
ADD COLUMN     "assignment_override_note" TEXT;

-- CreateTable
CREATE TABLE "service_delay_notice" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "delay_type" "DelayType" NOT NULL,
    "delay_minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "new_estimated_end" TIMESTAMP(3),
    "service_status" "ServiceStatus" NOT NULL,
    "reported_by" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_by_id" UUID,

    CONSTRAINT "service_delay_notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_delay_notice_superseded_by_id_key" ON "service_delay_notice"("superseded_by_id");

-- CreateIndex
CREATE INDEX "service_delay_notice_service_id_detected_at_idx" ON "service_delay_notice"("service_id", "detected_at");

-- CreateIndex
CREATE INDEX "service_crew_id_scheduled_date_idx" ON "service"("crew_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "service_vehicle_id_scheduled_date_idx" ON "service"("vehicle_id", "scheduled_date");

-- AddForeignKey
ALTER TABLE "service_delay_notice" ADD CONSTRAINT "service_delay_notice_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_delay_notice" ADD CONSTRAINT "service_delay_notice_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "service_delay_notice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
