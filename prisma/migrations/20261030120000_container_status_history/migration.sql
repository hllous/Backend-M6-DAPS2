-- CreateTable
CREATE TABLE "container_status_history" (
    "id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "from_status" "ContainerStatus",
    "to_status" "ContainerStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "container_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "container_status_history_container_id_changed_at_idx" ON "container_status_history"("container_id", "changed_at");

-- CreateIndex
CREATE INDEX "container_status_history_to_status_changed_at_idx" ON "container_status_history"("to_status", "changed_at");

-- AddForeignKey
ALTER TABLE "container_status_history" ADD CONSTRAINT "container_status_history_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fila base: una por contenedor existente, con su estado actual (origen nulo) y el
-- instante de la migración. Permite reconstruir los daños pendientes desde el
-- despliegue sin inventar desbordes ni daños pasados: con origen nulo la fila
-- nunca cuenta como incidente. Los desbordes y daños anteriores a esta migración
-- no se reconstruyen (quedan "sin dato").
INSERT INTO "container_status_history" ("id", "container_id", "from_status", "to_status", "changed_at")
SELECT gen_random_uuid(), "id", NULL, "status", CURRENT_TIMESTAMP
FROM "container";
