-- Fix broken approval constraints:
-- 1. Drop UNIQUE(item_id, approver_id) which prevents same approver on different transitions
-- 2. Drop unique_active_transition index which prevents multi-approver flows
-- 3. Add correct UNIQUE(item_id, approver_id, transition_id)
-- 4. Add index for efficient status+transition queries

ALTER TABLE approvals DROP CONSTRAINT IF EXISTS unique_item_approver;

DROP INDEX IF EXISTS unique_active_transition;

ALTER TABLE approvals ADD CONSTRAINT unique_item_approver_transition
  UNIQUE (item_id, approver_id, transition_id);

CREATE INDEX IF NOT EXISTS idx_approvals_item_transition_status
  ON approvals(item_id, transition_id, status);
