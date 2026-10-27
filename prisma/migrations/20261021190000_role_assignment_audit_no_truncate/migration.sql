-- La auditoría de roles también rechaza TRUNCATE (misma función que UPDATE/DELETE).
-- La limpieza de los e2e (test/helpers.ts) lo salta con
-- session_replication_role = replica, que pide superusuario.
CREATE TRIGGER "role_assignment_audit_no_truncate"
BEFORE TRUNCATE ON "role_assignment_audit"
FOR EACH STATEMENT EXECUTE FUNCTION "role_assignment_audit_append_only"();
