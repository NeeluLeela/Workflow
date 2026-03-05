
CREATE UNIQUE INDEX unique_initial_state
ON workflow_states(workflow_id)
WHERE is_initial = true;



CREATE UNIQUE INDEX unique_active_transition
ON approvals(item_id, transition_id);


CREATE INDEX idx_items_state
ON items(current_state_id);

CREATE INDEX idx_items_created_by
ON items(created_by);

CREATE INDEX idx_approvals_status
ON approvals(status);