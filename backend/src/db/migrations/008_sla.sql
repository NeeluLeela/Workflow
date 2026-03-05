-- SLA rules: configurable per workflow state (how long an item may stay in a state)
CREATE TABLE sla_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    state_id UUID NOT NULL,
    deadline_hours INTEGER NOT NULL CHECK (deadline_hours > 0),
    escalation_role TEXT NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    CONSTRAINT fk_sla_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT fk_sla_workflow
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,

    CONSTRAINT fk_sla_state
        FOREIGN KEY (state_id) REFERENCES workflow_states(id) ON DELETE CASCADE,

    CONSTRAINT unique_sla_per_state UNIQUE (tenant_id, workflow_id, state_id)
);

CREATE INDEX idx_sla_rules_workflow ON sla_rules(workflow_id);
CREATE INDEX idx_sla_rules_tenant ON sla_rules(tenant_id);

-- SLA breaches: recorded when an item exceeds the deadline for a state
CREATE TABLE sla_breaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    item_id UUID NOT NULL,
    sla_rule_id UUID NOT NULL,
    state_id UUID NOT NULL,
    breached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    escalated BOOLEAN DEFAULT false,
    escalated_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_breach_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

    CONSTRAINT fk_breach_item
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,

    CONSTRAINT fk_breach_rule
        FOREIGN KEY (sla_rule_id) REFERENCES sla_rules(id) ON DELETE CASCADE,

    -- One breach record per item per state (prevents duplicates on re-check)
    CONSTRAINT unique_breach_per_item_state UNIQUE (item_id, state_id)
);

CREATE INDEX idx_sla_breaches_tenant ON sla_breaches(tenant_id);
CREATE INDEX idx_sla_breaches_item ON sla_breaches(item_id);
CREATE INDEX idx_sla_breaches_escalated ON sla_breaches(escalated);
