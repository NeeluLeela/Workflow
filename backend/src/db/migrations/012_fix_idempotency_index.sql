-- Fix: the old index on (item_id, idempotency_key) prevents creating
-- multiple approval records (one per approver) for the same transition.
-- Include approver_id so each approver can have a row with the same key.
DROP INDEX IF EXISTS idx_approvals_idempotency;

CREATE UNIQUE INDEX idx_approvals_idempotency
  ON approvals(item_id, approver_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
