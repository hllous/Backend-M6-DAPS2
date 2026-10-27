-- AlterTable
ALTER TABLE "zone" ADD COLUMN     "commune_id" UUID;

-- CreateTable
CREATE TABLE "commune" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commune_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commune_code_key" ON "commune"("code");

-- CreateIndex
CREATE INDEX "zone_commune_id_idx" ON "zone"("commune_id");

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
