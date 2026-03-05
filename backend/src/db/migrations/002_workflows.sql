CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_workflow_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);

CREATE TABLE workflow_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL,
    name TEXT NOT NULL,
    is_initial BOOLEAN DEFAULT false,
    is_final BOOLEAN DEFAULT false,

    CONSTRAINT fk_state_workflow
        FOREIGN KEY (workflow_id)
        REFERENCES workflows(id)
        ON DELETE CASCADE
);
CREATE INDEX idx_states_workflow ON workflow_states(workflow_id);

CREATE TYPE approval_strategy AS ENUM ('NONE', 'SINGLE', 'ALL', 'QUORUM');

CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL,
    from_state_id UUID NOT NULL,
    to_state_id UUID NOT NULL,
    requires_approval BOOLEAN DEFAULT false,
    approval_strategy approval_strategy DEFAULT 'NONE',
    required_approvals INTEGER DEFAULT 1,

    CONSTRAINT fk_transition_workflow
        FOREIGN KEY (workflow_id)
        REFERENCES workflows(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transition_from
        FOREIGN KEY (from_state_id)
        REFERENCES workflow_states(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transition_to
        FOREIGN KEY (to_state_id)
        REFERENCES workflow_states(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_transitions_workflow ON workflow_transitions(workflow_id);