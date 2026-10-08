-- AlterTable
ALTER TABLE "environmental_report" ADD COLUMN     "citizen_response_at" TIMESTAMP(3),
ADD COLUMN     "escalation_changed_at" TIMESTAMP(3),
ADD COLUMN     "priority_changed_at" TIMESTAMP(3),
ADD COLUMN     "ticket_status_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inbox_event" ADD COLUMN     "occurred_at" TIMESTAMP(3);

