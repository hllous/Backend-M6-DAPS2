-- CreateEnum
CREATE TYPE "M6Role" AS ENUM ('M6_ADMIN', 'M6_OFICINA_OPERACIONES', 'M6_OFICINA_AMBIENTAL', 'M6_CAMPO_CUADRILLA', 'M6_CAMPO_INSPECTOR', 'M6_AUDITOR');

-- CreateEnum
CREATE TYPE "RoleAssignmentAction" AS ENUM ('GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "user_role_assignment" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "M6Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment_audit" (
    "id" UUID NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "action" "RoleAssignmentAction" NOT NULL,
    "role" "M6Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignment_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignment_user_id_role_key" ON "user_role_assignment"("user_id", "role");

-- CreateIndex
CREATE INDEX "role_assignment_audit_target_user_id_created_at_idx" ON "role_assignment_audit"("target_user_id", "created_at");

-- Auditoría append-only: ni el código ni una consulta manual pueden reescribirla.
-- TRUNCATE lo cubre la migración siguiente.
CREATE FUNCTION "role_assignment_audit_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'role_assignment_audit es append-only (% no permitido)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "role_assignment_audit_no_update_delete"
BEFORE UPDATE OR DELETE ON "role_assignment_audit"
FOR EACH ROW EXECUTE FUNCTION "role_assignment_audit_append_only"();