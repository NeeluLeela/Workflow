CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    current_state_id UUID NOT NULL,
    created_by UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_item_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_item_workflow
        FOREIGN KEY (workflow_id)
        REFERENCES workflows(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_item_state
        FOREIGN KEY (current_state_id)
        REFERENCES workflow_states(id),

    CONSTRAINT fk_item_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
);

CREATE INDEX idx_items_tenant ON items(tenant_id);
CREATE INDEX idx_items_workflow ON items(workflow_id);


CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL,
    approver_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    delegated_from UUID,
    decided_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_approval_item
        FOREIGN KEY (item_id)
        REFERENCES items(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_approval_user
        FOREIGN KEY (approver_id)
        REFERENCES users(id),

    CONSTRAINT unique_item_approver UNIQUE(item_id, approver_id)
);

CREATE INDEX idx_approvals_item ON approvals(item_id);


CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    performed_by UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_id);