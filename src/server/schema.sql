-- =========================================================================
-- AI AGENT STUDIO CONTROL PLANE - ENTERPRISE RELATIONAL DATABASE SCHEMA
-- Compatible with PostgreSQL 15+, Cloud SQL for PostgreSQL, and Neon/Supabase
-- Version: 2.0.0-p0-1
-- =========================================================================

-- 1. Tenants (Multi-Tenant Root Partition)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    quota_max_concurrent_runs INT NOT NULL DEFAULT 10,
    quota_monthly_budget_usd DECIMAL(12, 2) NOT NULL DEFAULT 5000.00,
    quota_used_budget_usd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Projects (Tenant-Scoped Organizational Units)
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);

-- 3. Users & Identity
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'REVOKED'
    invited_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- 4. Role Bindings (RBAC & Grants)
CREATE TABLE IF NOT EXISTS role_bindings (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
    role VARCHAR(64) NOT NULL, -- 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'APP_DEVELOPER' | 'CONNECTOR_ADMIN' | 'APPROVER' | 'OPERATOR' | 'AUDITOR'
    grants JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by VARCHAR(255) NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_role_bindings_user ON role_bindings(user_id, is_active);

-- 5. AI Models & Gateway Configurations
CREATE TABLE IF NOT EXISTS model_configs (
    id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(64) NOT NULL, -- 'GEMINI' | 'OPENAI' | 'CLAUDE' | 'LOCAL_LLAMA' | 'FAKE_MODEL'
    model_name VARCHAR(128) NOT NULL,
    context_window INT NOT NULL DEFAULT 128000,
    cost_per_1k_input_tokens DECIMAL(10, 6) NOT NULL DEFAULT 0.00015,
    cost_per_1k_output_tokens DECIMAL(10, 6) NOT NULL DEFAULT 0.00060,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    rate_limit_rpm INT NOT NULL DEFAULT 600,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tools & MCP Server Registry
CREATE TABLE IF NOT EXISTS tool_definitions (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL, -- 'SYSTEM' | 'DATABASE' | 'CLOUD' | 'COMMUNICATION' | 'CODE' | 'INFRASTRUCTURE'
    input_schema JSONB NOT NULL,
    output_schema JSONB NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk VARCHAR(32) NOT NULL DEFAULT 'LOW', -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    idempotency_mode VARCHAR(32) NOT NULL DEFAULT 'IDEMPOTENT',
    timeout_ms INT NOT NULL DEFAULT 5000,
    retry_policy JSONB NOT NULL DEFAULT '{"max_retries": 2, "backoff_ms": 100}'::jsonb,
    network_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_fake BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Agents (Autonomous AI Agent Definitions)
CREATE TABLE IF NOT EXISTS agent_definitions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    description TEXT,
    system_prompt TEXT NOT NULL,
    model_id VARCHAR(64) NOT NULL REFERENCES model_configs(id),
    tool_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    author VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agents_project ON agent_definitions(project_id);

-- 8. Workflows (DAG Graph Definitions)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    description TEXT,
    nodes JSONB NOT NULL, -- Array of DAG Node objects with inputs/outputs
    edges JSONB NOT NULL, -- Array of Directed Edges
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    author VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflow_definitions(project_id);

-- 9. Execution Runs (State-Machine Driven Execution History)
CREATE TABLE IF NOT EXISTS runs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    trace_id VARCHAR(64) NOT NULL UNIQUE,
    entity_type VARCHAR(32) NOT NULL, -- 'AGENT' | 'WORKFLOW'
    entity_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL, -- 'PENDING' | 'RUNNING' | 'PAUSED_FOR_APPROVAL' | 'COMPLETED' | 'FAILED' | 'REJECTED'
    input_query TEXT NOT NULL,
    output_result TEXT,
    error_message TEXT,
    initiated_by VARCHAR(255) NOT NULL,
    total_tokens_consumed INT NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runs_trace ON runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_runs_tenant_status ON runs(tenant_id, status);

-- 10. Step Runs (Fine-Grained Node/Step Execution)
CREATE TABLE IF NOT EXISTS step_runs (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    step_id VARCHAR(64) NOT NULL,
    node_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    input_payload JSONB,
    output_payload JSONB,
    duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_step_runs_run ON step_runs(run_id);

-- 11. Approval Requests (Human-in-the-Loop Zero-Trust Governance)
CREATE TABLE IF NOT EXISTS approval_records (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tool_id VARCHAR(64) NOT NULL REFERENCES tool_definitions(id),
    tool_name VARCHAR(255) NOT NULL,
    risk_level VARCHAR(32) NOT NULL, -- 'HIGH' | 'CRITICAL'
    raw_payload JSONB NOT NULL,
    plan_hash VARCHAR(64) NOT NULL, -- Cryptographic SHA-256 bound plan hash
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'REJECTED'
    requested_by VARCHAR(255) NOT NULL,
    decided_by VARCHAR(255),
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_approvals_run ON approval_records(run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_tenant_status ON approval_records(tenant_id, status);

-- 12. Security Audit Trail (Immutable Write-Ahead-Log)
CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL, -- 'RUN_DISPATCHED' | 'TOOL_INVOKED' | 'APPROVAL_GRANTED' | 'CONFIG_UPDATED' | 'CONNECTOR_STATUS_CHANGE'
    target_resource VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    payload_redacted JSONB NOT NULL, -- Strictly sanitized with zero plain credentials
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_events(tenant_id, timestamp DESC);

-- 13. Plugins & Connectors (Domestic & Custom App Connectors)
CREATE TABLE IF NOT EXISTS plugins (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_zh VARCHAR(255),
    category VARCHAR(64) NOT NULL, -- 'DOMESTIC_APPS' | 'MAPS' | 'WEATHER' | 'SYSTEM_TOOLS'
    provider VARCHAR(64) NOT NULL, -- 'WECHAT' | 'QQ' | 'MEITUAN' | 'RAIL12306' | 'AIRLINE_FLIGHTS' | 'ALIPAY' | 'CUSTOM'
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    description TEXT,
    description_zh TEXT,
    auth_type VARCHAR(32) NOT NULL DEFAULT 'API_KEY',
    endpoint TEXT,
    api_key_ref TEXT, -- Vault reference URI
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_calls BIGINT NOT NULL DEFAULT 0,
    p95_latency_ms INT NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Metal3 BareMetal Fleet (BareMetalHost Inventory)
CREATE TABLE IF NOT EXISTS bare_metal_hosts (
    name VARCHAR(128) PRIMARY KEY,
    rack_location VARCHAR(64) NOT NULL,
    bmc_address TEXT NOT NULL,
    bmc_protocol VARCHAR(32) NOT NULL DEFAULT 'Redfish',
    boot_mac_address VARCHAR(32) NOT NULL UNIQUE,
    power_status VARCHAR(32) NOT NULL DEFAULT 'ON', -- 'ON' | 'OFF' | 'REBOOTING' | 'PXE_BOOTING'
    provisioning_status VARCHAR(64) NOT NULL DEFAULT 'Available', -- 'Available' | 'Provisioning' | 'ActiveInCluster' | 'Degraded' | 'Provisioning Failed'
    assigned_role VARCHAR(64) NOT NULL, -- 'control-plane' | 'worker-gpu' | 'worker-compute'
    target_cluster_id VARCHAR(64),
    hardware JSONB NOT NULL,
    sensors JSONB NOT NULL,
    ip_addresses JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Proactive Fleet Alerts
CREATE TABLE IF NOT EXISTS host_alerts (
    id VARCHAR(64) PRIMARY KEY,
    host_name VARCHAR(128) NOT NULL REFERENCES bare_metal_hosts(name) ON DELETE CASCADE,
    severity VARCHAR(32) NOT NULL, -- 'CRITICAL' | 'WARNING'
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'RESOLVING' | 'RESOLVED'
    rule VARCHAR(64) NOT NULL, -- 'PROVISIONING_FAILED' | 'NODE_DEGRADED'
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    error_code VARCHAR(64) NOT NULL,
    diagnostics JSONB NOT NULL,
    dispatched_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_host_alerts_status ON host_alerts(status);
