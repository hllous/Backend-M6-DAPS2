-- AlterTable
ALTER TABLE "outbox_event" ADD COLUMN     "causation_id" UUID,
ADD COLUMN     "correlation_id" UUID NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "inbox_event" ADD COLUMN     "correlation_id" UUID,
ADD COLUMN     "source_module" TEXT;
