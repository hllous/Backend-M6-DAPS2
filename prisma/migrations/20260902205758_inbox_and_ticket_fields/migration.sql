-- AlterTable
ALTER TABLE "environmental_report" ADD COLUMN     "citizen_response" TEXT,
ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "inbox_event" ADD COLUMN     "error" TEXT;

-- CreateIndex
CREATE INDEX "inbox_event_processed_at_idx" ON "inbox_event"("processed_at");
