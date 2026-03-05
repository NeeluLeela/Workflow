ALTER TABLE approvals
ADD COLUMN transition_id UUID;

ALTER TABLE approvals
ADD CONSTRAINT fk_approval_transition
FOREIGN KEY (transition_id)
REFERENCES workflow_transitions(id)
ON DELETE CASCADE;

CREATE INDEX idx_approval_transition
ON approvals(transition_id);