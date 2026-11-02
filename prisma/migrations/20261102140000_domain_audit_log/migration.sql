-- CreateTable
CREATE TABLE "domain_audit_log" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "actor_roles" "M6Role"[],
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_audit_log_entity_type_entity_id_occurred_at_idx" ON "domain_audit_log"("entity_type", "entity_id", "occurred_at");

-- Auditoría append-only (#460), igual que role_assignment_audit: ni el código ni
-- una consulta manual pueden reescribirla. No se purga. La limpieza de los e2e
-- (test/helpers.ts) salta el trigger con session_replication_role = replica.
CREATE FUNCTION "domain_audit_log_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'domain_audit_log es append-only (% no permitido)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "domain_audit_log_no_update_delete"
BEFORE UPDATE OR DELETE ON "domain_audit_log"
FOR EACH ROW EXECUTE FUNCTION "domain_audit_log_append_only"();

CREATE TRIGGER "domain_audit_log_no_truncate"
BEFORE TRUNCATE ON "domain_audit_log"
FOR EACH STATEMENT EXECUTE FUNCTION "domain_audit_log_append_only"();
