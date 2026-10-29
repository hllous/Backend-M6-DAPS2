-- CreateTable
CREATE TABLE "outbox_retry_audit" (
    "id" UUID NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_attempts" INTEGER NOT NULL,
    "previous_error" TEXT,

    CONSTRAINT "outbox_retry_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_retry_audit_outbox_event_id_at_idx" ON "outbox_retry_audit"("outbox_event_id", "at");

-- AddForeignKey
ALTER TABLE "outbox_retry_audit" ADD CONSTRAINT "outbox_retry_audit_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
