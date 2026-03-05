-- Audit log immutability: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- Self-loop prevention at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_self_loops'
  ) THEN
    ALTER TABLE workflow_transitions
      ADD CONSTRAINT no_self_loops CHECK (from_state_id != to_state_id);
  END IF;
END $$;

-- Unique active workflow name per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_tenant_name_active
  ON workflows(tenant_id, name) WHERE is_active = true;

-- Idempotency key on approvals for transition deduplication
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_idempotency
  ON approvals(item_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Comment column for approval decisions
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS comment TEXT;
