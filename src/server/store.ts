import {
  Principal,
  ToolDefinition,
  ModelConfig,
  AgentDefinition,
  WorkflowDefinition,
  Run,
  StepRun,
  ApprovalRecord,
  AuditEvent,
  RunSnapshot,
  RoleBinding,
  UserMember,
  UserRole,
} from '../contracts/types';
import { FakeMCPServer, FakeModel, FakeToolExecutor } from '../domain/fakeProviders';
import { PolicyEngine } from '../domain/policyEngine';
import { RunStateMachine } from '../domain/stateMachine';
import { DataSanitizer } from '../domain/sanitizer';
import { DEFAULT_ROLE_GRANTS } from '../domain/identity';
import { PluginRegistry } from '../domain/plugins';

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

export interface ProjectInfo {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
}

export class MemoryStore {
  public tenants: Map<string, TenantInfo> = new Map();
  public projects: Map<string, ProjectInfo> = new Map();
  public principals: Map<string, Principal> = new Map();
  public members: Map<string, UserMember> = new Map();
  public roleBindings: Map<string, RoleBinding> = new Map();
  public currentPrincipalId: string = 'usr_app_dev';

  public models: Map<string, ModelConfig> = new Map();
  public tools: Map<string, ToolDefinition> = new Map();
  public agents: Map<string, AgentDefinition> = new Map();
  public workflows: Map<string, WorkflowDefinition> = new Map();
  public runs: Map<string, Run> = new Map();
  public approvals: Map<string, ApprovalRecord> = new Map();
  public audits: AuditEvent[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    // 1. Tenants
    this.tenants.set('tenant_acme_corp', {
      id: 'tenant_acme_corp',
      name: 'Acme Enterprise Global',
      plan: 'ENTERPRISE_PREMIUM',
      quota: {
        max_concurrent_runs: 50,
        monthly_budget_usd: 5000.0,
        used_budget_usd: 142.85,
      },
    });

    this.tenants.set('tenant_fintech_labs', {
      id: 'tenant_fintech_labs',
      name: 'FinTech Secure Labs',
      plan: 'ENTERPRISE_PREMIUM',
      quota: {
        max_concurrent_runs: 20,
        monthly_budget_usd: 2000.0,
        used_budget_usd: 48.2,
      },
    });

    // 2. Projects
    this.projects.set('proj_infra_ops', {
      id: 'proj_infra_ops',
      tenant_id: 'tenant_acme_corp',
      name: 'Cloud Infrastructure & SRE',
      description: 'Production cluster management and automated incident remediation.',
    });

    this.projects.set('proj_sec_compliance', {
      id: 'proj_sec_compliance',
      tenant_id: 'tenant_acme_corp',
      name: 'Security & Zero-Trust Audit',
      description: 'Continuous compliance monitoring and privilege validation.',
    });

    // 3. Principals
    const p1: Principal = {
      actor_id: 'usr_app_dev',
      actor_name: 'Alex Chen (App Developer)',
      actor_type: 'USER',
      tenant_id: 'tenant_acme_corp',
      tenant_name: 'Acme Enterprise Global',
      project_ids: ['proj_infra_ops', 'proj_sec_compliance'],
      active_project_id: 'proj_infra_ops',
      role: 'APP_DEVELOPER',
      grants: [
        'TOOL_CALC',
        'TOOL_READ',
        'DB_QUERY',
        'NOTIFY_SEND',
        'AGENT_DRAFT',
        'WORKFLOW_DRAFT',
        'MAPS_GEOCODE',
        'MAPS_PLACES',
        'WEATHER_READ',
        'FEISHU_DISPATCH',
        'DINGTALK_DISPATCH',
        'WECOM_DISPATCH',
        'AMAP_GEOCODE',
      ],
      auth_context: {
        authenticated_at: new Date().toISOString(),
        auth_method: 'LOCAL_DEV_IDENTITY',
        ip_address: '127.0.0.1',
        session_id: 'sess_dev_991',
      },
    };

    const p2: Principal = {
      actor_id: 'usr_platform_admin',
      actor_name: 'Elena Rostova (Platform Admin)',
      actor_type: 'USER',
      tenant_id: 'tenant_acme_corp',
      tenant_name: 'Acme Enterprise Global',
      project_ids: ['proj_infra_ops', 'proj_sec_compliance'],
      active_project_id: 'proj_infra_ops',
      role: 'PLATFORM_ADMIN',
      grants: ['*'],
      auth_context: {
        authenticated_at: new Date().toISOString(),
        auth_method: 'LOCAL_DEV_IDENTITY',
        ip_address: '127.0.0.1',
        session_id: 'sess_admin_001',
      },
    };

    const p3: Principal = {
      actor_id: 'usr_security_approver',
      actor_name: 'Marcus Vance (SecOps Approver)',
      actor_type: 'USER',
      tenant_id: 'tenant_acme_corp',
      tenant_name: 'Acme Enterprise Global',
      project_ids: ['proj_infra_ops'],
      active_project_id: 'proj_infra_ops',
      role: 'APPROVER',
      grants: ['APPROVE_HIGH_RISK', 'AUDIT_READ'],
      auth_context: {
        authenticated_at: new Date().toISOString(),
        auth_method: 'LOCAL_DEV_IDENTITY',
        ip_address: '127.0.0.1',
        session_id: 'sess_appr_420',
      },
    };

    this.principals.set(p1.actor_id, p1);
    this.principals.set(p2.actor_id, p2);
    this.principals.set(p3.actor_id, p3);

    // 3.5. Seed members & role bindings
    const m1: UserMember = {
      id: p1.actor_id,
      email: 'alex.chen@acme-corp.internal',
      name: p1.actor_name,
      tenant_id: p1.tenant_id,
      project_ids: p1.project_ids,
      role: p1.role,
      grants: p1.grants,
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    };

    const m2: UserMember = {
      id: p2.actor_id,
      email: 'elena.rostova@acme-corp.internal',
      name: p2.actor_name,
      tenant_id: p2.tenant_id,
      project_ids: p2.project_ids,
      role: p2.role,
      grants: p2.grants,
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    };

    const m3: UserMember = {
      id: p3.actor_id,
      email: 'marcus.vance@acme-corp.internal',
      name: p3.actor_name,
      tenant_id: p3.tenant_id,
      project_ids: p3.project_ids,
      role: p3.role,
      grants: p3.grants,
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    };

    const m4: UserMember = {
      id: 'usr_revoked_contractor',
      email: 'temp.contractor@external-agency.com',
      name: 'Devon Lee (Revoked Contractor)',
      tenant_id: 'tenant_acme_corp',
      project_ids: ['proj_infra_ops'],
      role: 'APP_DEVELOPER',
      grants: ['TOOL_READ'],
      status: 'REVOKED',
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    };

    this.members.set(m1.id, m1);
    this.members.set(m2.id, m2);
    this.members.set(m3.id, m3);
    this.members.set(m4.id, m4);

    this.roleBindings.set('rb_1', {
      id: 'rb_1',
      user_id: m1.id,
      tenant_id: m1.tenant_id,
      role: m1.role,
      grants: m1.grants,
      assigned_at: m1.created_at,
      assigned_by: m2.id,
      is_active: true,
    });
    this.roleBindings.set('rb_2', {
      id: 'rb_2',
      user_id: m2.id,
      tenant_id: m2.tenant_id,
      role: m2.role,
      grants: m2.grants,
      assigned_at: m2.created_at,
      assigned_by: 'ROOT_PROVISIONER',
      is_active: true,
    });
    this.roleBindings.set('rb_3', {
      id: 'rb_3',
      user_id: m3.id,
      tenant_id: m3.tenant_id,
      role: m3.role,
      grants: m3.grants,
      assigned_at: m3.created_at,
      assigned_by: m2.id,
      is_active: true,
    });
    this.roleBindings.set('rb_4', {
      id: 'rb_4',
      user_id: m4.id,
      tenant_id: m4.tenant_id,
      role: m4.role,
      grants: m4.grants,
      assigned_at: m4.created_at,
      assigned_by: m2.id,
      revoked_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      revoked_by: m2.id,
      is_active: false,
    });

    // 4. Models
    this.models.set('fake_fast_model', {
      id: 'fake_fast_model',
      name: 'Deterministic Fake Engine v1 (Fast)',
      provider: 'FAKE',
      model_string: 'fake-deterministic-gpt-v1',
      context_window: 128000,
      cost_per_1k_input: 0.0015,
      cost_per_1k_output: 0.003,
      capabilities: {
        supports_structured_output: true,
        supports_tools: true,
        supports_vision: false,
        supports_streaming: true,
      },
      is_active: true,
      is_fake: true,
    });

    this.models.set('fake_reasoning_model', {
      id: 'fake_reasoning_model',
      name: 'Deterministic Fake DeepReasoner v2',
      provider: 'FAKE',
      model_string: 'fake-reasoning-large-v2',
      context_window: 256000,
      cost_per_1k_input: 0.005,
      cost_per_1k_output: 0.015,
      capabilities: {
        supports_structured_output: true,
        supports_tools: true,
        supports_vision: false,
        supports_streaming: true,
      },
      is_active: true,
      is_fake: true,
    });

    // 5. Tools
    const defaultTools: ToolDefinition[] = [
      {
        id: 'fake_calculator',
        name: 'Deterministic Math Calculator',
        version: '1.2.0',
        description: 'Performs precision integer and float calculations with zero side-effects.',
        category: 'SYSTEM',
        input_schema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'Operand A' },
            b: { type: 'number', description: 'Operand B' },
            operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          },
          required: ['a', 'b', 'operation'],
        },
        output_schema: {
          type: 'object',
          properties: {
            result: { type: 'number' },
            operation: { type: 'string' },
          },
        },
        permissions: ['TOOL_CALC'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 2000,
        retry_policy: { max_retries: 2, backoff_ms: 100 },
        network_targets: [],
        is_active: true,
        is_fake: true,
      },
      {
        id: 'fake_db_query',
        name: 'Read-Only Tenant Database Inspector',
        version: '1.0.0',
        description: 'Executes indexed read-only queries with strict tenant column enforcement.',
        category: 'DATABASE',
        input_schema: {
          type: 'object',
          properties: {
            query_type: { type: 'string', enum: ['list_users', 'get_metrics'] },
          },
          required: ['query_type'],
        },
        output_schema: {
          type: 'object',
          properties: {
            rows: { type: 'array' },
            row_count: { type: 'number' },
          },
        },
        permissions: ['DB_QUERY'],
        risk: 'LOW',
        idempotency_mode: 'IDEMPOTENT',
        timeout_ms: 3000,
        retry_policy: { max_retries: 1, backoff_ms: 200 },
        network_targets: ['db.internal.cluster'],
        is_active: true,
        is_fake: true,
      },
      {
        id: 'fake_send_notification',
        name: 'Enterprise Alert Dispatcher',
        version: '2.1.0',
        description: 'Dispatches sanitized alert messages to Slack/Teams channels.',
        category: 'COMMUNICATION',
        input_schema: {
          type: 'object',
          properties: {
            channel: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['channel', 'message'],
        },
        output_schema: {
          type: 'object',
          properties: {
            delivered: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
        permissions: ['NOTIFY_SEND'],
        risk: 'MEDIUM',
        idempotency_mode: 'AT_LEAST_ONCE',
        timeout_ms: 4000,
        retry_policy: { max_retries: 2, backoff_ms: 500 },
        network_targets: ['hooks.slack.com'],
        is_active: true,
        is_fake: true,
      },
      {
        id: 'fake_cloud_deploy',
        name: 'Cloud Cluster Pod Manifest Declarer',
        version: '1.0.0',
        description: 'HIGH RISK: Applies manifest declarations to production Kubernetes cluster namespace.',
        category: 'CLOUD',
        input_schema: {
          type: 'object',
          properties: {
            cluster: { type: 'string' },
            manifest_name: { type: 'string' },
            replicas: { type: 'number' },
          },
          required: ['cluster', 'manifest_name'],
        },
        output_schema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
          },
        },
        permissions: ['CLOUD_DEPLOY'],
        risk: 'HIGH',
        idempotency_mode: 'NON_IDEMPOTENT',
        timeout_ms: 8000,
        retry_policy: { max_retries: 0, backoff_ms: 0 },
        network_targets: ['api.k8s.prod.internal'],
        is_active: true,
        is_fake: true,
      },
      ...FakeMCPServer.getTools(),
      ...PluginRegistry.getAllTools(),
    ];

    for (const tool of defaultTools) {
      this.tools.set(tool.id, tool);
    }

    // 6. Seed an Agent
    const agentId = 'agent_infra_sentinel';
    const sentinelAgent: AgentDefinition = {
      id: agentId,
      name: 'SRE Sentinel Agent',
      description: 'Monitors cluster workloads, verifies query health, and alerts on anomalies.',
      tenant_id: 'tenant_acme_corp',
      project_id: 'proj_infra_ops',
      current_draft: {
        system_prompt: 'You are the Acme SRE Sentinel Agent. Diagnose system anomalies and calculate resource metrics.',
        model_id: 'fake_fast_model',
        temperature: 0.2,
        max_steps: 6,
        timeout_seconds: 60,
        budget_limit_usd: 1.0,
        tool_whitelist: ['fake_calculator', 'fake_db_query', 'fake_send_notification', 'fake_cloud_deploy'],
        output_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            summary: { type: 'string' },
          },
        },
        memory_mode: 'BUFFER_WINDOW',
      },
      published_versions: [
        {
          version: 'v1.0.0',
          published_at: new Date(Date.now() - 3600000).toISOString(),
          published_by: 'Alex Chen',
          snapshot: {
            definition_id: agentId,
            definition_version: 'v1.0.0',
            definition_name: 'SRE Sentinel Agent',
            model_id: 'fake_fast_model',
            model_version: '2026.11',
            tool_versions: {
              fake_calculator: '1.2.0',
              fake_db_query: '1.0.0',
              fake_send_notification: '2.1.0',
            },
            skill_versions: {},
            policy_version: 'v1.4.0-strict',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            snapshot_hash: 'snap_hash_sentinel_v1_immutable',
          },
          system_prompt: 'You are the Acme SRE Sentinel Agent.',
          tool_whitelist: ['fake_calculator', 'fake_db_query'],
        },
      ],
      active_version: 'v1.0.0',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.agents.set(agentId, sentinelAgent);

    // 7. Seed a Workflow
    const wfId = 'wf_cluster_incident_response';
    const incidentWf: WorkflowDefinition = {
      id: wfId,
      name: 'Cluster Incident Auto-Triage & Remediation',
      description: 'End-to-end incident ingestion, diagnosis, human approval for patch, and post-action notification.',
      tenant_id: 'tenant_acme_corp',
      project_id: 'proj_infra_ops',
      current_draft: {
        nodes: [
          { id: 'start_node', name: 'Incident Webhook', type: 'START', config: {}, position: { x: 50, y: 150 } },
          { id: 'diagnose_llm', name: 'LLM Triage & Diagnostic', type: 'LLM', config: { model_id: 'fake_fast_model' }, position: { x: 260, y: 150 } },
          { id: 'calc_capacity', name: 'Compute Deficit', type: 'TOOL', config: { tool_id: 'fake_calculator' }, position: { x: 480, y: 150 } },
          { id: 'human_gate', name: 'SecOps Human Approval', type: 'HUMAN_APPROVAL', config: { risk: 'HIGH', tool_id: 'fake_cloud_deploy' }, position: { x: 700, y: 150 } },
          { id: 'end_node', name: 'Remediation Finished', type: 'END', config: {}, position: { x: 920, y: 150 } },
        ],
        edges: [
          { id: 'e1', source: 'start_node', target: 'diagnose_llm' },
          { id: 'e2', source: 'diagnose_llm', target: 'calc_capacity' },
          { id: 'e3', source: 'calc_capacity', target: 'human_gate' },
          { id: 'e4', source: 'human_gate', target: 'end_node' },
        ],
        input_schema: { type: 'object', properties: { incident_id: { type: 'string' } } },
        output_schema: { type: 'object', properties: { status: { type: 'string' } } },
        timeout_seconds: 120,
      },
      published_versions: [
        {
          version: 'v1.0.0',
          published_at: new Date(Date.now() - 7200000).toISOString(),
          published_by: 'Alex Chen',
          nodes: [
            { id: 'start_node', name: 'Incident Webhook', type: 'START', config: {}, position: { x: 50, y: 150 } },
            { id: 'diagnose_llm', name: 'LLM Triage & Diagnostic', type: 'LLM', config: { model_id: 'fake_fast_model' }, position: { x: 260, y: 150 } },
            { id: 'calc_capacity', name: 'Compute Deficit', type: 'TOOL', config: { tool_id: 'fake_calculator' }, position: { x: 480, y: 150 } },
            { id: 'end_node', name: 'Remediation Finished', type: 'END', config: {}, position: { x: 700, y: 150 } },
          ],
          edges: [
            { id: 'e1', source: 'start_node', target: 'diagnose_llm' },
            { id: 'e2', source: 'diagnose_llm', target: 'calc_capacity' },
            { id: 'e3', source: 'calc_capacity', target: 'end_node' },
          ],
          snapshot: {
            definition_id: wfId,
            definition_version: 'v1.0.0',
            definition_name: 'Cluster Incident Auto-Triage',
            model_id: 'fake_fast_model',
            model_version: '2026.11',
            tool_versions: { fake_calculator: '1.2.0' },
            skill_versions: {},
            policy_version: 'v1.4.0-strict',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            snapshot_hash: 'snap_hash_wf_v1_immutable',
          },
        },
      ],
      active_version: 'v1.0.0',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.workflows.set(wfId, incidentWf);

    // 8. Seed an Initial Completed Run
    const run1: Run = {
      id: 'run_baseline_101',
      target_type: 'AGENT',
      target_id: agentId,
      target_version: 'v1.0.0',
      target_name: 'SRE Sentinel Agent',
      tenant_id: 'tenant_acme_corp',
      project_id: 'proj_infra_ops',
      state: 'SUCCEEDED',
      created_at: new Date(Date.now() - 1200000).toISOString(),
      updated_at: new Date(Date.now() - 1180000).toISOString(),
      started_at: new Date(Date.now() - 1198000).toISOString(),
      completed_at: new Date(Date.now() - 1180000).toISOString(),
      initiator: p1,
      snapshot: sentinelAgent.published_versions[0].snapshot,
      steps: [
        {
          step_id: 'st_1',
          step_name: 'Analyze telemetry',
          node_type: 'LLM',
          state: 'SUCCEEDED',
          input: { query: 'Check cluster memory deficit' },
          output: { action: 'PROCEED', diagnosis: 'Memory buffer safe, running calculation' },
          duration_ms: 120,
          token_usage: { prompt_tokens: 42, completion_tokens: 38, total_tokens: 80, estimated_cost_usd: 0.000177 },
        },
        {
          step_id: 'st_2',
          step_name: 'Perform safe math',
          node_type: 'TOOL',
          state: 'SUCCEEDED',
          input: { a: 16, b: 4, operation: 'multiply' },
          output: { result: 64, operation: 'multiply' },
          duration_ms: 18,
        },
      ],
      input_data: { query: 'Check cluster memory deficit' },
      final_output: { status: 'NORMAL', cluster_status: 'Healthy', computed_reserve_gb: 64 },
      trace_id: 'tr_seed_98a71b',
      total_tokens: 80,
      total_cost_usd: 0.000177,
    };
    this.runs.set(run1.id, run1);

    // 9. Seed a Pending Approval for Marcus Vance
    const approvalPlanHash = PolicyEngine.computePlanHash('fake_cloud_deploy', {
      cluster: 'prod-us-east-1',
      manifest_name: 'ingress-controller-v3',
      replicas: 4,
    });

    const appr1: ApprovalRecord = {
      id: 'appr_pending_01',
      run_id: 'run_awaiting_deploy_02',
      step_id: 'st_deploy_step',
      target_name: 'Cluster Ingress Controller Upgrade',
      tool_id: 'fake_cloud_deploy',
      tenant_id: 'tenant_acme_corp',
      project_id: 'proj_infra_ops',
      risk_level: 'HIGH',
      plan_hash: approvalPlanHash,
      args_summary: {
        cluster: 'prod-us-east-1',
        manifest_name: 'ingress-controller-v3',
        replicas: 4,
      },
      status: 'PENDING',
      requested_at: new Date(Date.now() - 600000).toISOString(),
      requested_by: 'Alex Chen (App Developer)',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };
    this.approvals.set(appr1.id, appr1);

    // 10. Seed Audits
    this.recordAudit({
      trace_id: 'tr_sys_boot_001',
      tenant_id: 'tenant_acme_corp',
      project_id: 'proj_infra_ops',
      actor_id: 'SYSTEM',
      actor_name: 'System Bootloader',
      actor_role: 'SYSTEM',
      event_type: 'CONFIG_UPDATED',
      target_resource: 'PolicyEngine',
      summary: 'Policy v1.4.0-strict initialized. Zero-trust defaults loaded.',
      payload_redacted: { policy_version: 'v1.4.0-strict' },
      status: 'SUCCESS',
    });
  }

  public recordAudit(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    const fullEvent: AuditEvent = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      payload_redacted: DataSanitizer.sanitizeObject(event.payload_redacted || {}),
    };
    this.audits.unshift(fullEvent);
    if (this.audits.length > 200) {
      this.audits.pop();
    }
    return fullEvent;
  }

  public getCurrentPrincipal(): Principal {
    return this.principals.get(this.currentPrincipalId) || this.principals.values().next().value!;
  }

  public switchPrincipal(actorId: string): Principal {
    if (this.principals.has(actorId)) {
      this.currentPrincipalId = actorId;
      const principal = this.principals.get(actorId)!;
      this.recordAudit({
        trace_id: `tr_switch_${Date.now()}`,
        tenant_id: principal.tenant_id,
        project_id: principal.active_project_id,
        actor_id: principal.actor_id,
        actor_name: principal.actor_name,
        actor_role: principal.role,
        event_type: 'POLICY_EVALUATION',
        target_resource: `Principal/${actorId}`,
        summary: `Switched active identity to ${principal.actor_name} (${principal.role})`,
        payload_redacted: { actor_id: actorId, role: principal.role },
        status: 'SUCCESS',
      });
      return principal;
    }
    throw new Error(`Principal '${actorId}' not found`);
  }

  public inviteMember(params: {
    name: string;
    email: string;
    role: UserRole;
    project_ids: string[];
    tenant_id: string;
    invited_by: string;
  }): UserMember {
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const grants = DEFAULT_ROLE_GRANTS[params.role] || [];
    const member: UserMember = {
      id: userId,
      email: params.email,
      name: params.name,
      tenant_id: params.tenant_id,
      project_ids: params.project_ids,
      role: params.role,
      grants,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    const binding: RoleBinding = {
      id: `rb_${Date.now()}`,
      user_id: userId,
      tenant_id: params.tenant_id,
      role: params.role,
      grants,
      assigned_at: new Date().toISOString(),
      assigned_by: params.invited_by,
      is_active: true,
    };

    this.members.set(userId, member);
    this.roleBindings.set(binding.id, binding);

    // Also register as a selectable principal
    this.principals.set(userId, {
      actor_id: userId,
      actor_name: member.name,
      actor_type: 'USER',
      tenant_id: member.tenant_id,
      tenant_name: this.tenants.get(member.tenant_id)?.name || 'Acme Enterprise',
      project_ids: member.project_ids,
      active_project_id: member.project_ids[0] || 'proj_infra_ops',
      role: member.role,
      grants: member.grants,
      auth_context: {
        authenticated_at: new Date().toISOString(),
        auth_method: 'LOCAL_DEV_IDENTITY',
        ip_address: '127.0.0.1',
        session_id: `sess_${userId}`,
      },
    });

    return member;
  }

  public revokeMemberRole(userId: string, revokedBy: string): void {
    const member = this.members.get(userId);
    if (!member) {
      throw new Error(`Member '${userId}' not found.`);
    }
    member.status = 'REVOKED';

    for (const binding of this.roleBindings.values()) {
      if (binding.user_id === userId && binding.is_active) {
        binding.is_active = false;
        binding.revoked_at = new Date().toISOString();
        binding.revoked_by = revokedBy;
      }
    }

    // Strip grants on active principal
    const p = this.principals.get(userId);
    if (p) {
      p.grants = [];
    }
  }

  public updateTenantQuota(tenantId: string, quota: Partial<TenantInfo['quota']>): TenantInfo {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant '${tenantId}' not found.`);
    tenant.quota = { ...tenant.quota, ...quota };
    return tenant;
  }
}

export const globalStore = new MemoryStore();
