/**
 * Core Architecture & Domain Contracts for AI Agent Studio
 * Aligned with docs/architecture-baseline.md & docs/vibe-coding.md
 */

export type ActorType = 'USER' | 'AGENT' | 'WORKFLOW' | 'SYSTEM' | 'EXTERNAL_WEBHOOK';

export interface Principal {
  actor_id: string;
  actor_name: string;
  actor_type: ActorType;
  tenant_id: string;
  tenant_name: string;
  project_ids: string[];
  active_project_id: string;
  role: 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'APP_DEVELOPER' | 'CONNECTOR_ADMIN' | 'APPROVER' | 'OPERATOR' | 'AUDITOR';
  grants: string[];
  auth_context: {
    authenticated_at: string;
    auth_method: 'LOCAL_DEV_IDENTITY' | 'OIDC_MOCK' | 'MUTUAL_TLS';
    ip_address: string;
    session_id: string;
  };
}

export interface TenantInfo {
  id: string;
  name: string;
  plan: 'ENTERPRISE_PREMIUM' | 'PROFESSIONAL' | 'DEVELOPER';
  quota: {
    max_concurrent_runs: number;
    monthly_budget_usd: number;
    used_budget_usd: number;
  };
}

export type UserRole =
  | 'PLATFORM_ADMIN'
  | 'ORG_ADMIN'
  | 'APP_DEVELOPER'
  | 'CONNECTOR_ADMIN'
  | 'APPROVER'
  | 'OPERATOR'
  | 'AUDITOR';

export interface RoleBinding {
  id: string;
  user_id: string;
  tenant_id: string;
  project_id?: string;
  role: UserRole;
  grants: string[];
  assigned_at: string;
  assigned_by: string;
  revoked_at?: string;
  revoked_by?: string;
  is_active: boolean;
}

export interface UserMember {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  project_ids: string[];
  role: UserRole;
  grants: string[];
  status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED';
  created_at: string;
}

export interface ProjectInfo {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IdempotencyMode = 'IDEMPOTENT' | 'AT_LEAST_ONCE' | 'NON_IDEMPOTENT';

export interface ToolDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'SYSTEM' | 'DATABASE' | 'CLOUD' | 'COMMUNICATION' | 'CODE' | 'INFRASTRUCTURE';
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  permissions: string[];
  risk: RiskLevel;
  idempotency_mode: IdempotencyMode;
  timeout_ms: number;
  retry_policy: {
    max_retries: number;
    backoff_ms: number;
  };
  network_targets: string[];
  is_active: boolean;
  is_fake: boolean;
}

export interface ToolCall {
  tool_id: string;
  version: string;
  args: Record<string, any>;
  actor: Principal;
  tenant_id: string;
  project_id: string;
  run_id: string;
  step_id: string;
  trace_id: string;
  credential_ref?: string;
  idempotency_key?: string;
  deadline?: string;
  approval_ref?: string;
}

export type PolicyDecisionType = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export interface PolicyDecision {
  decision: PolicyDecisionType;
  reason: string;
  policy_version: string;
  risk_level: RiskLevel;
  required_plan_hash?: string;
  missing_grants?: string[];
  effective_grants?: string[];
}

export interface ToolResult {
  status: 'SUCCESS' | 'ERROR' | 'REJECTED';
  validated_output?: any;
  sanitized_error?: string;
  elapsed_ms: number;
  trace_id: string;
  idempotency_cached?: boolean;
}

export interface RunSnapshot {
  definition_id: string;
  definition_version: string;
  definition_name: string;
  model_id: string;
  model_version: string;
  tool_versions: Record<string, string>;
  skill_versions: Record<string, string>;
  knowledge_version?: string;
  policy_version: string;
  created_at: string;
  snapshot_hash: string;
}

export type RunState =
  | 'PENDING'
  | 'PLANNING'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PARTIALLY_SUCCEEDED'
  | 'COMPENSATING';

export interface StepRun {
  step_id: string;
  step_name: string;
  node_id?: string;
  node_type: string;
  state: RunState;
  input: any;
  output?: any;
  error?: string;
  tool_call?: ToolCall;
  tool_result?: ToolResult;
  policy_decision?: PolicyDecision;
  approval_id?: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
}

export interface Run {
  id: string;
  target_type: 'AGENT' | 'WORKFLOW';
  target_id: string;
  target_version: string;
  target_name: string;
  tenant_id: string;
  project_id: string;
  state: RunState;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  initiator: Principal;
  snapshot: RunSnapshot;
  steps: StepRun[];
  input_data: any;
  final_output?: any;
  error_message?: string;
  trace_id: string;
  idempotency_key?: string;
  worker_id?: string;
  lease_expires_at?: string;
  total_tokens: number;
  total_cost_usd: number;
}

export interface ApprovalRecord {
  id: string;
  run_id: string;
  step_id: string;
  target_name: string;
  tool_id: string;
  tenant_id: string;
  project_id: string;
  risk_level: RiskLevel;
  plan_hash: string;
  args_summary: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requested_at: string;
  requested_by: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  expires_at: string;
}

export interface AuditEvent {
  id: string;
  trace_id: string;
  tenant_id: string;
  project_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  event_type:
    | 'RUN_CREATED'
    | 'STATE_TRANSITION'
    | 'POLICY_EVALUATION'
    | 'TOOL_CALL_EXECUTED'
    | 'APPROVAL_REQUESTED'
    | 'APPROVAL_DECIDED'
    | 'AGENT_PUBLISHED'
    | 'WORKFLOW_PUBLISHED'
    | 'CONFIG_UPDATED'
    | 'EMERGENCY_TOOL_DISABLE';
  target_resource: string;
  summary: string;
  payload_redacted: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  timestamp: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  project_id: string;
  current_draft: {
    system_prompt: string;
    model_id: string;
    temperature: number;
    max_steps: number;
    timeout_seconds: number;
    budget_limit_usd: number;
    tool_whitelist: string[];
    output_schema: Record<string, any>;
    memory_mode: 'STATELESS' | 'BUFFER_WINDOW' | 'SUMMARY';
  };
  published_versions: {
    version: string;
    published_at: string;
    published_by: string;
    snapshot: RunSnapshot;
    system_prompt: string;
    tool_whitelist: string[];
  }[];
  active_version?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'START' | 'LLM' | 'AGENT' | 'TOOL' | 'CONDITION' | 'HUMAN_APPROVAL' | 'END';
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition_label?: string;
  condition_expr?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  project_id: string;
  current_draft: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    input_schema: Record<string, any>;
    output_schema: Record<string, any>;
    timeout_seconds: number;
  };
  published_versions: {
    version: string;
    published_at: string;
    published_by: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    snapshot: RunSnapshot;
  }[];
  active_version?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'FAKE' | 'OPENAI_COMPATIBLE' | 'GOOGLE_GEMINI';
  model_string: string;
  context_window: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  capabilities: {
    supports_structured_output: boolean;
    supports_tools: boolean;
    supports_vision: boolean;
    supports_streaming: boolean;
  };
  is_active: boolean;
  is_fake: boolean;
}
