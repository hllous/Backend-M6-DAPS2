-- Solicitud de informacion al vecino (#169): aditiva, todo nullable.
ALTER TABLE "environmental_report"
  ADD COLUMN "information_requested_at" TIMESTAMP(3),
  ADD COLUMN "information_request_message" TEXT,
  ADD COLUMN "information_request_required_by" TIMESTAMP(3);
