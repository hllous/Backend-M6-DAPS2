-- CreateEnum
CREATE TYPE "TicketStateSource" AS ENUM ('DEDUCED', 'RECEIVED');

-- CreateTable
CREATE TABLE "ticket_m2_state" (
    "ticket_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" "TicketStateSource" NOT NULL,
    "received_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_m2_state_pkey" PRIMARY KEY ("ticket_id")
);
