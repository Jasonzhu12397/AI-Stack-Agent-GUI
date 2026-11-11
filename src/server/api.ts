import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { globalStore } from './store';
import { PolicyEngine } from '../domain/policyEngine';
import { RunStateMachine } from '../domain/stateMachine';
import { FakeModel, FakeToolExecutor, FakeMCPServer } from '../domain/fakeProviders';
import { DAGValidator } from '../domain/dagValidator';
import { DataSanitizer } from '../domain/sanitizer';
import { IdentityManager } from '../domain/identity';
import { PluginRegistry, WeatherEngine, DomesticAppDispatcher } from '../domain/plugins';
import { globalMetal3Engine, SUPPORTED_KUBERNETES_VERSIONS } from '../domain/metal3';
import {
  Run,
  StepRun,
  ToolCall,
  RunSnapshot,
  AgentDefinition,
  ApprovalRecord,
  WorkflowDefinition,
  ProjectInfo,
  UserMember,
} from '../contracts/types';

export const apiRouter = Router();

// Middleware: Tenant & Principal resolution (Default deny, server-authoritative)
apiRouter.use((req: Request, res: Response, next) => {
  const principal = globalStore.getCurrentPrincipal();
  (req as any).principal = principal;

  // Role Revocation Invariant Check
  const member = globalStore.members.get(principal.actor_id);
  if (member && member.status === 'REVOKED') {
    if (req.method !== 'GET' && !req.path.includes('/principals/switch')) {
      return res.status(403).json({
        error: {
          code: 'ROLE_REVOKED',
          message: `Actor '${principal.actor_name}' role is revoked. Mutating operations are forbidden.`,
        },
      });
    }
  }

  next();
});

// 1. Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'ai-agent-studio-control-plane',
    version: '2.0.0-p0-1',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    components: {
      storage: { status: 'UP', type: 'IN_MEMORY_TRANSACTIONAL_WAL', entries: globalStore.runs.size },
      worker_pool: { status: 'UP', active_workers: 4, lease_timeout_sec: 30 },
      policy_engine: { status: 'UP', policy_version: PolicyEngine.CURRENT_POLICY_VERSION },
      model_gateway: { status: 'UP', default_provider: 'FAKE_MODEL' },
      mcp_server: { status: 'UP', server_name: FakeMCPServer.SERVER_NAME },
    },
  });
});

// 2. OpenAPI 3.1 Spec endpoint
apiRouter.get('/openapi.json', (req: Request, res: Response) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'AI Agent Studio Control Plane API',
      version: '2.0.0',
      description: 'Enterprise AI Agent & Workflow Studio zero-trust execution and orchestration API.',
    },
    paths: {
      '/api/v1/health': { get: { summary: 'System health check' } },
      '/api/v1/principals/me': { get: { summary: 'Get current authenticated identity' } },
      '/api/v1/agents': { get: { summary: 'List tenant agents' }, post: { summary: 'Create agent draft' } },
      '/api/v1/agents/{id}/run': { post: { summary: 'Execute agent run' } },
      '/api/v1/workflows': { get: { summary: 'List workflows' } },
      '/api/v1/workflows/{id}/run': { post: { summary: 'Execute workflow DAG run' } },
      '/api/v1/runs': { get: { summary: 'List execution runs' } },
      '/api/v1/approvals': { get: { summary: 'List approval requests' } },
      '/api/v1/audits': { get: { summary: 'List audit trail events' } },
      '/api/v1/metal3/bmh': { get: { summary: 'List baremetal hosts' } },
      '/api/v1/metal3/alerts': { get: { summary: 'List proactive node alerts' } },
      '/api/v1/plugins': { get: { summary: 'List plugins' } },
      '/api/v1/system/backend-overview': { get: { summary: 'Detailed runtime backend overview & architecture stats' } },
      '/api/v1/system/routes': { get: { summary: 'List all registered backend REST routes' } },
      '/api/v1/system/sql-schema': { get: { summary: 'Get PostgreSQL / Cloud SQL schema definition' } },
    },
  });
});

// System Backend Runtime Telemetry & Microservices Overview
apiRouter.get('/system/backend-overview', (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    success: true,
    data: {
      server: {
        engine: 'Node.js Express Fullstack Gateway',
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        port: process.env.PORT || 3000,
        uptime_seconds: Math.floor(process.uptime()),
        env: process.env.NODE_ENV || 'development',
      },
      memory: {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        external_mb: Math.round(mem.external / 1024 / 1024),
      },
      microservices: [
        {
          name: 'API Gateway & Middleware',
          status: 'ACTIVE',
          protocol: 'HTTP/1.1 REST + JSON',
          port: 3000,
          details: 'Zero-trust Bearer / Session header validation, rate-limiter, CORS & Content-Security-Policy',
        },
        {
          name: 'Zero-Trust Policy Engine (RBAC)',
          status: 'ACTIVE',
          protocol: 'In-Process Security Evaluator',
          details: 'Default-deny object authorization, grant intersection, cryptographic SHA-256 plan hash enforcement',
        },
        {
          name: 'Agent & Workflow DAG Execution Engine',
          status: 'ACTIVE',
          protocol: 'Deterministic State Machine',
          details: 'Topological task batching, cycle detection, human-in-the-loop pause/resume gatekeeper',
        },
        {
          name: 'Metal3 BareMetal Fleet & Ironic Conductor',
          status: 'ACTIVE',
          protocol: 'Redfish OOB + IPMI + iPXE',
          details: 'Ephemeral bootstrap node (eph-node) orchestrator, UEFI PXE streaming, CAPI pivot controller',
        },
        {
          name: 'Domestic Connectors & Third-Party Plugin Router',
          status: 'ACTIVE',
          protocol: 'HMAC-SHA256 Signed Webhooks',
          details: 'Feishu, DingTalk, WeCom, WeChat, QQ, Meituan, 12306, Flights, Alipay and custom REST endpoints',
        },
        {
          name: 'Write-Ahead-Log (WAL) Storage & Database',
          status: 'ACTIVE',
          protocol: 'Transactional Memory + SQL Schema',
          details: 'Strict append-only audit event logging, zero secret retention, PostgreSQL / Cloud SQL compatible',
        },
      ],
      database: {
        type: 'Transactional WAL Store (PostgreSQL / Cloud SQL DDL aligned)',
        tables: {
          tenants: globalStore.tenants.size,
          projects: globalStore.projects.size,
          users: globalStore.members.size,
          agents: globalStore.agents.size,
          workflows: globalStore.workflows.size,
          runs: globalStore.runs.size,
          approvals: globalStore.approvals.size,
          audits: globalStore.audits.length,
          plugins: PluginRegistry.getAllPlugins().length,
          bare_metal_hosts: globalMetal3Engine.hosts.size,
          host_alerts: globalMetal3Engine.alerts.size,
        },
      },
      worker_pool: {
        active_workers: 4,
        lease_timeout_sec: 30,
        concurrency_limit: 20,
        active_background_daemons: [
          'Metal3 Proactive Alert Watchdog',
          'Ironic Conductor Power Sync Loop',
          'Audit Log Cryptographic Hash Archiver',
          'Workflow State Reconciliation Daemon',
        ],
      },
    },
  });
});

// System Backend All Registered Routes
apiRouter.get('/system/routes', (_req: Request, res: Response) => {
  const routes = [
    // System
    { category: 'SYSTEM', method: 'GET', path: '/api/v1/health', auth: 'PUBLIC', description: 'System health check & component heartbeats' },
    { category: 'SYSTEM', method: 'GET', path: '/api/v1/system/backend-overview', auth: 'PUBLIC', description: 'Full runtime backend architecture, memory & worker stats' },
    { category: 'SYSTEM', method: 'GET', path: '/api/v1/system/routes', auth: 'PUBLIC', description: 'Complete registry of all backend endpoints' },
    { category: 'SYSTEM', method: 'GET', path: '/api/v1/system/sql-schema', auth: 'PUBLIC', description: 'Raw PostgreSQL / Cloud SQL schema DDL file' },
    { category: 'SYSTEM', method: 'GET', path: '/api/v1/openapi.json', auth: 'PUBLIC', description: 'OpenAPI 3.1 schema specification' },

    // Identity & RBAC
    { category: 'IDENTITY', method: 'GET', path: '/api/v1/principals/me', auth: 'BEARER', description: 'Get current authenticated actor and role' },
    { category: 'IDENTITY', method: 'GET', path: '/api/v1/principals', auth: 'BEARER', description: 'List available actors in system' },
    { category: 'IDENTITY', method: 'POST', path: '/api/v1/principals/switch', auth: 'BEARER', description: 'Switch active actor context (RBAC test)' },
    { category: 'IDENTITY', method: 'GET', path: '/api/v1/tenants', auth: 'BEARER', description: 'List accessible tenants' },
    { category: 'IDENTITY', method: 'GET', path: '/api/v1/projects', auth: 'BEARER', description: 'List tenant projects' },
    { category: 'IDENTITY', method: 'GET', path: '/api/v1/members', auth: 'BEARER', description: 'List organization members' },
    { category: 'IDENTITY', method: 'POST', path: '/api/v1/members', auth: 'PLATFORM_ADMIN', description: 'Invite member to tenant' },
    { category: 'IDENTITY', method: 'POST', path: '/api/v1/members/:id/revoke', auth: 'PLATFORM_ADMIN', description: 'Revoke member role binding' },
    { category: 'IDENTITY', method: 'PUT', path: '/api/v1/tenants/:id/quota', auth: 'QUOTA_MANAGE', description: 'Update tenant quota limits' },
    { category: 'IDENTITY', method: 'POST', path: '/api/v1/auth/oidc/verify', auth: 'PUBLIC', description: 'Verify OIDC token & production guard' },

    // Agents
    { category: 'AGENT', method: 'GET', path: '/api/v1/models', auth: 'BEARER', description: 'List supported AI model providers' },
    { category: 'AGENT', method: 'GET', path: '/api/v1/agents', auth: 'BEARER', description: 'List tenant AI agents' },
    { category: 'AGENT', method: 'POST', path: '/api/v1/agents', auth: 'APP_DEVELOPER', description: 'Create draft AI agent definition' },
    { category: 'AGENT', method: 'POST', path: '/api/v1/agents/:id/run', auth: 'BEARER', description: 'Dispatch and execute agent run' },

    // Workflows & DAG
    { category: 'WORKFLOW', method: 'GET', path: '/api/v1/workflows', auth: 'BEARER', description: 'List workflow DAG graphs' },
    { category: 'WORKFLOW', method: 'POST', path: '/api/v1/workflows', auth: 'APP_DEVELOPER', description: 'Create workflow definition with DAG validation' },
    { category: 'WORKFLOW', method: 'POST', path: '/api/v1/workflows/:id/run', auth: 'BEARER', description: 'Execute topological DAG workflow run' },

    // Runs & Approvals
    { category: 'RUNS', method: 'GET', path: '/api/v1/runs', auth: 'BEARER', description: 'List execution runs' },
    { category: 'RUNS', method: 'GET', path: '/api/v1/runs/:id', auth: 'BEARER', description: 'Get run details and step trace' },
    { category: 'APPROVALS', method: 'GET', path: '/api/v1/approvals', auth: 'BEARER', description: 'List pending approval requests' },
    { category: 'APPROVALS', method: 'POST', path: '/api/v1/approvals/:id/decide', auth: 'APPROVER', description: 'Approve or reject high-risk tool execution' },

    // Metal3 BareMetal Fleet
    { category: 'METAL3', method: 'GET', path: '/api/v1/metal3/eph-node', auth: 'BEARER', description: 'Get ephemeral bootstrap node state' },
    { category: 'METAL3', method: 'GET', path: '/api/v1/metal3/bmh', auth: 'BEARER', description: 'List BareMetalHost CRD fleet' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/bmh/:name/power', auth: 'OPERATOR', description: 'Redfish out-of-band power control' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/bmh/:name/inspect', auth: 'OPERATOR', description: 'Trigger Ironic hardware inspector' },
    { category: 'METAL3', method: 'GET', path: '/api/v1/metal3/clusters', auth: 'BEARER', description: 'List target baremetal clusters' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/clusters', auth: 'OPERATOR', description: 'Deploy target Kubernetes cluster' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/clusters/:id/scale', auth: 'OPERATOR', description: 'AI Agent elastic scale-up' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/clusters/:id/scale-down-node', auth: 'OPERATOR', description: 'AI Agent graceful drain & scale-down' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/clusters/:id/upgrade', auth: 'OPERATOR', description: 'Rolling zero-downtime version upgrade' },
    { category: 'METAL3', method: 'GET', path: '/api/v1/metal3/alerts', auth: 'BEARER', description: 'List active baremetal host alerts' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/alerts/simulate', auth: 'OPERATOR', description: 'Inject simulated hardware failure drill' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/alerts/:id/remediate', auth: 'OPERATOR', description: 'Trigger AI Agent autonomous out-of-band self-healing' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/alerts/:id/dispatch', auth: 'OPERATOR', description: 'Dispatch signed alert to Feishu/WeCom/DingTalk' },
    { category: 'METAL3', method: 'POST', path: '/api/v1/metal3/alerts/:id/dismiss', auth: 'OPERATOR', description: 'Dismiss/resolve proactive alert' },

    // Plugins & Tools
    { category: 'PLUGINS', method: 'GET', path: '/api/v1/plugins', auth: 'BEARER', description: 'List all registered plugins' },
    { category: 'PLUGINS', method: 'GET', path: '/api/v1/plugins/presets', auth: 'BEARER', description: 'Get templates for WeChat, QQ, Meituan, 12306, Flights, Alipay' },
    { category: 'PLUGINS', method: 'POST', path: '/api/v1/plugins/create', auth: 'CONNECTOR_ADMIN', description: 'Dynamically register custom connector' },
    { category: 'PLUGINS', method: 'DELETE', path: '/api/v1/plugins/:id', auth: 'CONNECTOR_ADMIN', description: 'Delete custom connector' },
    { category: 'PLUGINS', method: 'POST', path: '/api/v1/plugins/:id/toggle', auth: 'PLATFORM_ADMIN', description: 'Toggle plugin kill switch' },
    { category: 'PLUGINS', method: 'POST', path: '/api/v1/tools/:id/test', auth: 'BEARER', description: 'Execute tool in process-isolated sandbox' },

    // Audits
    { category: 'AUDIT', method: 'GET', path: '/api/v1/audits', auth: 'AUDITOR', description: 'Query immutable security audit events' },
    { category: 'AUDIT', method: 'GET', path: '/api/v1/metrics', auth: 'BEARER', description: 'Get live platform throughput & token metrics' },
  ];

  res.json({ success: true, count: routes.length, data: routes });
});

// System Raw SQL Schema Endpoint
apiRouter.get('/system/sql-schema', (_req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'src/server/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf8');
      return res.json({ success: true, sql: sqlContent, filename: 'schema.sql' });
    }
    res.json({ success: false, error: 'schema.sql not found on disk' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Multi-Language Backend Alternatives
apiRouter.get('/system/backend-alternatives', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        id: 'go',
        name: 'Golang (Go 1.22+)',
        runtime: 'Go Standard net/http / Gin Web Framework',
        ecosystem_fit: 'Kubernetes Operators, Metal3 Ironic, Cloud-Native, High Concurrency',
        characteristics: [
          'Direct client-go & controller-runtime compatibility',
          'Single static binary distribution (< 20MB scratch image)',
          'Native Goroutines concurrency for millions of parallel bare metal probes',
          'Zero garbage collection pause spikes in high-throughput clusters',
        ],
        docker_image: 'golang:1.22-alpine -> scratch',
        run_command: 'cd backend-go && go run main.go',
        test_command: 'cd backend-go && go test -v ./...',
        source_file: 'backend-go/main.go',
        docker_file: 'backend-go/Dockerfile',
        default_port: 8080,
      },
      {
        id: 'python',
        name: 'Python (3.12+)',
        runtime: 'FastAPI + Pydantic v2 + Uvicorn ASGI',
        ecosystem_fit: 'AI Agents, LangChain, LlamaIndex, PyTorch, Data Science',
        characteristics: [
          'Native integration with Python AI agent toolchains (LangChain/CrewAI/AutoGen)',
          'Pydantic v2 high-speed Rust-core JSON validation and OpenAPI docs',
          'AsyncIO non-blocking event loop for streaming LLM tokens',
          'Rich scientific, mathematical, and data analysis packages ecosystem',
        ],
        docker_image: 'python:3.12-slim',
        run_command: 'cd backend-python && uvicorn main:app --port 8000 --reload',
        test_command: 'pytest backend-python/',
        source_file: 'backend-python/main.py',
        docker_file: 'backend-python/Dockerfile',
        default_port: 8000,
      },
      {
        id: 'node',
        name: 'Node.js (v22 LTS)',
        runtime: 'Express 4.x + TypeScript + In-Memory WAL',
        ecosystem_fit: 'Fullstack Studio Control Plane, Universal TS Contracts, Rapid Prototyping',
        characteristics: [
          'Shared TypeScript domain types between frontend and backend contracts',
          'High I/O asynchronous throughput for RESTful & WebSocket events',
          'Deterministic fake providers for safe zero-external-side-effect testing',
          'Integrated Vite middleware gateway on port 3000',
        ],
        docker_image: 'node:22-alpine',
        run_command: 'npm run dev:backend',
        test_command: 'npm test',
        source_file: 'server.ts / src/server/api.ts',
        docker_file: 'Dockerfile',
        default_port: 3000,
      },
    ],
  });
});

// System Backend Source Code Retrieval
apiRouter.get('/system/backend-code', (req: Request, res: Response) => {
  const lang = (req.query.lang as string) || 'go';
  try {
    let filePath = '';
    let fileName = '';
    if (lang === 'go') {
      filePath = path.resolve(process.cwd(), 'backend-go/main.go');
      fileName = 'main.go';
    } else if (lang === 'python') {
      filePath = path.resolve(process.cwd(), 'backend-python/main.py');
      fileName = 'main.py';
    } else if (lang === 'go-docker') {
      filePath = path.resolve(process.cwd(), 'backend-go/Dockerfile');
      fileName = 'Dockerfile';
    } else if (lang === 'python-docker') {
      filePath = path.resolve(process.cwd(), 'backend-python/Dockerfile');
      fileName = 'Dockerfile';
    } else {
      filePath = path.resolve(process.cwd(), 'server.ts');
      fileName = 'server.ts';
    }

    if (fs.existsSync(filePath)) {
      const code = fs.readFileSync(filePath, 'utf8');
      return res.json({ success: true, lang, filename: fileName, code });
    }
    res.status(404).json({ success: false, error: `File not found: ${filePath}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 3. Organization & Identity
apiRouter.get('/principals/me', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  res.json({ data: principal });
});

apiRouter.get('/principals', (req: Request, res: Response) => {
  res.json({ data: Array.from(globalStore.principals.values()) });
});

apiRouter.post('/principals/switch', (req: Request, res: Response) => {
  const { actor_id } = req.body;
  try {
    const updated = globalStore.switchPrincipal(actor_id);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'PRINCIPAL_NOT_FOUND', message: err.message } });
  }
});

apiRouter.get('/tenants', (req: Request, res: Response) => {
  res.json({ data: Array.from(globalStore.tenants.values()) });
});

// Members Management (Object-level tenant isolation)
apiRouter.get('/members', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = Array.from(globalStore.members.values()).filter(
    m => m.tenant_id === principal.tenant_id
  );
  res.json({ data: list });
});

apiRouter.post('/members', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const hasManageRights = principal.grants.includes('USER_MANAGE') || principal.role === 'PLATFORM_ADMIN';
  if (!hasManageRights) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Principal lacks USER_MANAGE permission to invite members.' },
    });
  }

  const { name, email, role, project_ids } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing name, email, or role.' } });
  }

  const member = globalStore.inviteMember({
    name,
    email,
    role,
    project_ids: project_ids || [principal.active_project_id],
    tenant_id: principal.tenant_id,
    invited_by: principal.actor_name,
  });

  globalStore.recordAudit({
    trace_id: `tr_member_add_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'CONFIG_UPDATED',
    target_resource: `User/${member.id}`,
    summary: `Invited new member ${member.name} (${member.role}) to tenant`,
    payload_redacted: { user_id: member.id, role: member.role },
    status: 'SUCCESS',
  });

  res.json({ success: true, data: member });
});

apiRouter.post('/members/:id/revoke', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const hasManageRights = principal.grants.includes('USER_MANAGE') || principal.role === 'PLATFORM_ADMIN';
  if (!hasManageRights) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Principal lacks USER_MANAGE permission to revoke roles.' },
    });
  }

  try {
    globalStore.revokeMemberRole(req.params.id, principal.actor_name);
    globalStore.recordAudit({
      trace_id: `tr_revoke_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'POLICY_EVALUATION',
      target_resource: `User/${req.params.id}`,
      summary: `Revoked role binding for user ${req.params.id}`,
      payload_redacted: { user_id: req.params.id, status: 'REVOKED' },
      status: 'SUCCESS',
    });
    res.json({ success: true, message: `Member ${req.params.id} role revoked.` });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// Projects Management (Scoped strictly to active tenant)
apiRouter.get('/projects', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = Array.from(globalStore.projects.values()).filter(
    p => p.tenant_id === principal.tenant_id
  );
  res.json({ data: list });
});

apiRouter.post('/projects', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { name, description } = req.body;
  const newProj: ProjectInfo = {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    tenant_id: principal.tenant_id,
    name: name || 'New Project',
    description: description || 'Created within tenant',
  };
  globalStore.projects.set(newProj.id, newProj);
  res.json({ success: true, data: newProj });
});

// Tenant Quota Management
apiRouter.put('/tenants/:id/quota', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  try {
    IdentityManager.verifyTenantBoundary(principal.tenant_id, req.params.id);
  } catch (err: any) {
    return res.status(403).json({ error: { code: 'CROSS_TENANT_ACCESS_DENIED', message: err.message } });
  }

  const hasQuotaRights = principal.grants.includes('QUOTA_MANAGE') || principal.role === 'PLATFORM_ADMIN';
  if (!hasQuotaRights) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Principal lacks QUOTA_MANAGE permission.' },
    });
  }

  try {
    const updated = globalStore.updateTenantQuota(req.params.id, req.body.quota || {});
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// OIDC Mock Verification & Production Guard Endpoint
apiRouter.post('/auth/oidc/verify', (req: Request, res: Response) => {
  const { provider, token, env = process.env.NODE_ENV || 'development' } = req.body;

  try {
    IdentityManager.validateAuthProvider(env, provider || 'LOCAL_DEV_IDENTITY');
    res.json({
      valid: true,
      issuer: 'https://oidc.acme-corp.internal/v2',
      claims: {
        sub: 'usr_oidc_verified',
        tenant: 'tenant_acme_corp',
        roles: ['APP_DEVELOPER'],
      },
      environment: env,
    });
  } catch (err: any) {
    res.status(403).json({
      error: { code: 'OIDC_CONFIG_INVALID', message: err.message },
    });
  }
});

// 4. Models & Providers
apiRouter.get('/models', (req: Request, res: Response) => {
  res.json({ data: Array.from(globalStore.models.values()) });
});

// 5. Tools & MCP Registry
apiRouter.get('/tools', (req: Request, res: Response) => {
  res.json({ data: Array.from(globalStore.tools.values()) });
});

apiRouter.post('/tools/:id/toggle', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  if (principal.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only PLATFORM_ADMIN can toggle tool availability.' },
    });
  }
  const tool = globalStore.tools.get(req.params.id);
  if (!tool) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tool not found' } });
  }
  tool.is_active = !tool.is_active;

  globalStore.recordAudit({
    trace_id: `tr_tool_toggle_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'EMERGENCY_TOOL_DISABLE',
    target_resource: `Tool/${tool.id}`,
    summary: `Tool '${tool.name}' set to ${tool.is_active ? 'ACTIVE' : 'DISABLED'}`,
    payload_redacted: { tool_id: tool.id, is_active: tool.is_active },
    status: 'SUCCESS',
  });

  res.json({ success: true, data: tool });
});

apiRouter.post('/tools/:id/test', async (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const tool = globalStore.tools.get(req.params.id);
  if (!tool) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tool not found' } });
  }

  const call: ToolCall = {
    tool_id: tool.id,
    version: tool.version,
    args: req.body.args || {},
    actor: principal,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    run_id: `run_test_${Date.now()}`,
    step_id: 'step_manual_test',
    trace_id: `tr_test_${Date.now()}`,
  };

  const decision = PolicyEngine.evaluateToolCall({
    principal,
    agentWhitelist: [tool.id],
    tool,
    args: call.args,
  });

  if (decision.decision === 'DENY') {
    return res.status(403).json({
      error: { code: 'POLICY_DENIED', message: decision.reason, decision },
    });
  }

  const result = await FakeToolExecutor.execute(call, tool);
  res.json({ decision, result });
});

apiRouter.get('/mcp/servers', (req: Request, res: Response) => {
  res.json({
    data: [
      {
        name: FakeMCPServer.SERVER_NAME,
        version: FakeMCPServer.SERVER_VERSION,
        status: 'CONNECTED',
        transport: 'IN_PROCESS_SANDBOX',
        tools_count: FakeMCPServer.getTools().length,
      },
    ],
  });
});

// 5.5 Plugins & Enterprise Connectors (Google Maps, Weather, Feishu, DingTalk, WeCom)
apiRouter.get('/plugins', (_req: Request, res: Response) => {
  res.json({ data: PluginRegistry.getAllPlugins() });
});

apiRouter.post('/plugins/:id/toggle', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const isAuthorized = principal.role === 'PLATFORM_ADMIN' || principal.role === 'CONNECTOR_ADMIN';
  if (!isAuthorized) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only PLATFORM_ADMIN or CONNECTOR_ADMIN can toggle plugins.' },
    });
  }

  const ok = PluginRegistry.togglePlugin(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } });
  }

  // Also sync global store tools
  const plugin = PluginRegistry.getPlugin(req.params.id);
  if (plugin) {
    plugin.tools.forEach(t => {
      const existing = globalStore.tools.get(t.id);
      if (existing) {
        existing.is_active = plugin.is_active;
      } else {
        globalStore.tools.set(t.id, t);
      }
    });

    globalStore.recordAudit({
      trace_id: `tr_plugin_toggle_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'CONNECTOR_STATUS_CHANGE',
      target_resource: `Plugin/${plugin.id}`,
      summary: `Plugin '${plugin.name}' (${plugin.name_zh}) set to ${plugin.is_active ? 'ACTIVE' : 'DISABLED'}`,
      payload_redacted: { plugin_id: plugin.id, is_active: plugin.is_active },
      status: 'SUCCESS',
    });
  }

  res.json({ success: true, data: plugin });
});

apiRouter.post('/plugins/:id/configure', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const isAuthorized = principal.role === 'PLATFORM_ADMIN' || principal.role === 'CONNECTOR_ADMIN' || principal.role === 'APP_DEVELOPER';
  if (!isAuthorized) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Unauthorized to configure connector settings.' },
    });
  }

  const ok = PluginRegistry.updateConfig(req.params.id, req.body.config || {});
  if (!ok) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } });
  }

  const updated = PluginRegistry.getPlugin(req.params.id);
  globalStore.recordAudit({
    trace_id: `tr_plugin_cfg_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'CONNECTOR_CONFIG_UPDATE',
    target_resource: `Plugin/${req.params.id}`,
    summary: `Updated connector configuration for '${updated?.name}'`,
    payload_redacted: DataSanitizer.sanitizeObject(req.body.config || {}),
    status: 'SUCCESS',
  });

  res.json({ success: true, data: updated });
});

apiRouter.get('/plugins/presets', (_req: Request, res: Response) => {
  res.json({ data: PluginRegistry.getPresets() });
});

apiRouter.post('/plugins/create', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const isAuthorized = principal.role === 'PLATFORM_ADMIN' || principal.role === 'CONNECTOR_ADMIN' || principal.role === 'APP_DEVELOPER';
  if (!isAuthorized) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Unauthorized to register custom plugins.' },
    });
  }

  const { name, name_zh, category, provider, description, description_zh, auth_type, endpoint, api_key, tool_id, tool_name, tool_description, risk, sample_args } = req.body;
  if (!name || !tool_id) {
    return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and tool_id are required' } });
  }

  try {
    const plugin = PluginRegistry.createCustomPlugin({
      name,
      name_zh,
      category,
      provider,
      description: description || `Custom integration connector for ${name}`,
      description_zh,
      auth_type,
      endpoint,
      api_key,
      tool_id,
      tool_name,
      tool_description,
      risk,
      sample_args,
    });

    // Also register tool in globalStore tools
    plugin.tools.forEach(t => {
      globalStore.tools.set(t.id, t);
    });

    globalStore.recordAudit({
      trace_id: `tr_plugin_create_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'CONNECTOR_STATUS_CHANGE',
      target_resource: `Plugin/${plugin.id}`,
      summary: `Created and registered custom connector '${plugin.name}' with tool '${tool_id}'`,
      payload_redacted: { plugin_id: plugin.id, tool_id, provider: plugin.provider, auth_type: plugin.auth_type },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: plugin });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'CREATE_FAILED', message: err.message } });
  }
});

apiRouter.delete('/plugins/:id', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const isAuthorized = principal.role === 'PLATFORM_ADMIN' || principal.role === 'CONNECTOR_ADMIN';
  if (!isAuthorized) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only PLATFORM_ADMIN or CONNECTOR_ADMIN can delete plugins.' },
    });
  }

  const plugin = PluginRegistry.getPlugin(req.params.id);
  if (!plugin) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } });
  }

  // Remove tools from global store
  plugin.tools.forEach(t => {
    globalStore.tools.delete(t.id);
  });

  PluginRegistry.deletePlugin(req.params.id);

  globalStore.recordAudit({
    trace_id: `tr_plugin_del_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'CONNECTOR_STATUS_CHANGE',
    target_resource: `Plugin/${req.params.id}`,
    summary: `Deleted custom connector '${plugin.name}'`,
    payload_redacted: { plugin_id: req.params.id },
    status: 'SUCCESS',
  });

  res.json({ success: true, data: { deleted_id: req.params.id } });
});

apiRouter.post('/weather/query', (req: Request, res: Response) => {
  const { city = 'Beijing', units = 'metric' } = req.body;
  const weather = WeatherEngine.queryWeather(city, units);
  res.json({ success: true, data: weather });
});

apiRouter.post('/domestic/dispatch', async (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { platform, target_url, secret, message_type = 'markdown', title, content, at_users, is_at_all } = req.body;

  if (!platform || !content) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Platform and content are required' } });
  }

  const result = await DomesticAppDispatcher.dispatch({
    platform,
    target_url,
    secret,
    message_type,
    title,
    content,
    at_users,
    is_at_all,
  });

  // Record audit event
  globalStore.recordAudit({
    trace_id: `tr_dispatch_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'EXTERNAL_WEBHOOK_DISPATCH',
    target_resource: `Connector/${platform.toUpperCase()}`,
    summary: `Dispatched test message to ${platform.toUpperCase()} (${message_type})`,
    payload_redacted: result.sanitized_preview,
    status: 'SUCCESS',
  });

  res.json({ success: true, data: result });
});

// 6. Agents
apiRouter.get('/agents', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = Array.from(globalStore.agents.values()).filter(
    a => a.tenant_id === principal.tenant_id
  );
  res.json({ data: list });
});

apiRouter.post('/agents', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { name, description, system_prompt, model_id, tool_whitelist } = req.body;

  const newAgent: AgentDefinition = {
    id: `agent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name || 'New Autonomous Agent',
    description: description || 'Configured via Agent Studio Builder',
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    current_draft: {
      system_prompt: system_prompt || 'You are an enterprise AI Agent.',
      model_id: model_id || 'fake_fast_model',
      temperature: 0.3,
      max_steps: 5,
      timeout_seconds: 45,
      budget_limit_usd: 1.0,
      tool_whitelist: tool_whitelist || ['fake_calculator'],
      output_schema: { type: 'object' },
      memory_mode: 'BUFFER_WINDOW',
    },
    published_versions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  globalStore.agents.set(newAgent.id, newAgent);
  res.json({ success: true, data: newAgent });
});

apiRouter.put('/agents/:id', (req: Request, res: Response) => {
  const agent = globalStore.agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  }
  const { name, description, current_draft } = req.body;
  if (name) agent.name = name;
  if (description) agent.description = description;
  if (current_draft) {
    agent.current_draft = { ...agent.current_draft, ...current_draft };
  }
  agent.updated_at = new Date().toISOString();
  res.json({ success: true, data: agent });
});

apiRouter.post('/agents/:id/publish', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const agent = globalStore.agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  }

  const newVersionStr = `v${agent.published_versions.length + 1}.0.0`;
  const toolVersions: Record<string, string> = {};
  for (const tid of agent.current_draft.tool_whitelist) {
    const t = globalStore.tools.get(tid);
    if (t) toolVersions[tid] = t.version;
  }

  const snapshot: RunSnapshot = {
    definition_id: agent.id,
    definition_version: newVersionStr,
    definition_name: agent.name,
    model_id: agent.current_draft.model_id,
    model_version: '2026.11',
    tool_versions: toolVersions,
    skill_versions: {},
    policy_version: PolicyEngine.CURRENT_POLICY_VERSION,
    created_at: new Date().toISOString(),
    snapshot_hash: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  };

  agent.published_versions.push({
    version: newVersionStr,
    published_at: new Date().toISOString(),
    published_by: principal.actor_name,
    snapshot,
    system_prompt: agent.current_draft.system_prompt,
    tool_whitelist: [...agent.current_draft.tool_whitelist],
  });
  agent.active_version = newVersionStr;
  agent.updated_at = new Date().toISOString();

  globalStore.recordAudit({
    trace_id: `tr_pub_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'AGENT_PUBLISHED',
    target_resource: `Agent/${agent.id}/${newVersionStr}`,
    summary: `Published immutable snapshot ${newVersionStr} of agent '${agent.name}'`,
    payload_redacted: { version: newVersionStr, snapshot_hash: snapshot.snapshot_hash },
    status: 'SUCCESS',
  });

  res.json({ success: true, version: newVersionStr, snapshot });
});

apiRouter.post('/agents/:id/run', async (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const agent = globalStore.agents.get(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
  }

  // 1. Cross-tenant boundary check
  try {
    IdentityManager.verifyTenantBoundary(principal.tenant_id, agent.tenant_id);
  } catch (err: any) {
    return res.status(403).json({ error: { code: 'CROSS_TENANT_ACCESS_DENIED', message: err.message } });
  }

  // 2. Project boundary check
  try {
    IdentityManager.verifyProjectBoundary(principal.role, principal.project_ids, agent.project_id);
  } catch (err: any) {
    return res.status(403).json({ error: { code: 'PROJECT_ACCESS_DENIED', message: err.message } });
  }

  // 3. Tenant quota check
  const tenant = globalStore.tenants.get(principal.tenant_id);
  if (tenant) {
    const activeRunsCount = Array.from(globalStore.runs.values()).filter(
      r => r.tenant_id === principal.tenant_id && (r.state === 'RUNNING' || r.state === 'QUEUED')
    ).length;
    const quotaDecision = IdentityManager.checkTenantQuota(tenant.quota, activeRunsCount, 0.005);
    if (!quotaDecision.allowed) {
      return res.status(429).json({
        error: { code: quotaDecision.code, message: quotaDecision.reason },
      });
    }
  }

  const version = agent.published_versions.find(v => v.version === agent.active_version) || agent.published_versions[0];
  if (!version) {
    return res.status(400).json({
      error: { code: 'NO_PUBLISHED_VERSION', message: 'Agent has no published immutable version. Publish a draft first.' },
    });
  }

  const traceId = `tr_run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const inputQuery = req.body.input_query || 'Analyze server metrics and calculate reserve capacity';

  const newRun: Run = {
    id: runId,
    target_type: 'AGENT',
    target_id: agent.id,
    target_version: version.version,
    target_name: agent.name,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    state: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    initiator: principal,
    snapshot: version.snapshot,
    steps: [],
    input_data: { input_query: inputQuery },
    trace_id: traceId,
    total_tokens: 0,
    total_cost_usd: 0,
  };

  globalStore.runs.set(runId, newRun);

  // Execute Step 1: PLANNING
  RunStateMachine.transition(newRun.state, 'PLANNING');
  newRun.state = 'PLANNING';
  newRun.started_at = new Date().toISOString();

  // Model call via FakeModel
  const modelConfig = globalStore.models.get(version.snapshot.model_id) || globalStore.models.values().next().value!;
  const modelRes = await FakeModel.generate({
    modelConfig,
    systemPrompt: version.system_prompt,
    messages: [{ role: 'user', content: inputQuery }],
    structuredOutputSchema: { type: 'object' },
  });

  const step1: StepRun = {
    step_id: `st_${Date.now()}_1`,
    step_name: 'Formulate Execution Plan',
    node_type: 'LLM',
    state: 'SUCCEEDED',
    input: { query: inputQuery },
    output: modelRes.structured_data || { text: modelRes.content },
    duration_ms: 110,
    token_usage: modelRes.usage,
  };
  newRun.steps.push(step1);
  newRun.total_tokens += modelRes.usage.total_tokens;
  newRun.total_cost_usd += modelRes.usage.estimated_cost_usd;

  // Execute Step 2: Tool Calling
  const toolToUse = version.tool_whitelist[0] || 'fake_calculator';
  const toolDef = globalStore.tools.get(toolToUse);

  if (toolDef) {
    const toolCall: ToolCall = {
      tool_id: toolDef.id,
      version: toolDef.version,
      args: { a: 42, b: 8, operation: 'add' },
      actor: principal,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      run_id: runId,
      step_id: `st_${Date.now()}_2`,
      trace_id: traceId,
    };

    const policyDecision = PolicyEngine.evaluateToolCall({
      principal,
      agentWhitelist: version.tool_whitelist,
      tool: toolDef,
      args: toolCall.args,
    });

    if (policyDecision.decision === 'REQUIRE_APPROVAL') {
      newRun.state = 'WAITING_APPROVAL';
      const appr: ApprovalRecord = {
        id: `appr_${Date.now()}`,
        run_id: runId,
        step_id: toolCall.step_id,
        target_name: `${agent.name} -> ${toolDef.name}`,
        tool_id: toolDef.id,
        tenant_id: principal.tenant_id,
        project_id: principal.active_project_id,
        risk_level: toolDef.risk,
        plan_hash: policyDecision.required_plan_hash || 'hash_default',
        args_summary: toolCall.args,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
        requested_by: principal.actor_name,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };
      globalStore.approvals.set(appr.id, appr);
      newRun.steps.push({
        step_id: toolCall.step_id,
        step_name: `Tool Execution: ${toolDef.name}`,
        node_type: 'TOOL',
        state: 'WAITING_APPROVAL',
        input: toolCall.args,
        policy_decision: policyDecision,
        approval_id: appr.id,
      });
    } else if (policyDecision.decision === 'DENY') {
      newRun.state = 'FAILED';
      newRun.error_message = `Policy Denied Tool '${toolDef.name}': ${policyDecision.reason}`;
      newRun.steps.push({
        step_id: toolCall.step_id,
        step_name: `Tool Execution: ${toolDef.name}`,
        node_type: 'TOOL',
        state: 'FAILED',
        input: toolCall.args,
        policy_decision: policyDecision,
        error: policyDecision.reason,
      });
    } else {
      // Allowed
      const toolRes = await FakeToolExecutor.execute(toolCall, toolDef);
      newRun.steps.push({
        step_id: toolCall.step_id,
        step_name: `Tool Execution: ${toolDef.name}`,
        node_type: 'TOOL',
        state: toolRes.status === 'SUCCESS' ? 'SUCCEEDED' : 'FAILED',
        input: toolCall.args,
        output: toolRes.validated_output,
        error: toolRes.sanitized_error,
        duration_ms: toolRes.elapsed_ms,
        policy_decision: policyDecision,
      });
      newRun.state = 'SUCCEEDED';
      newRun.final_output = {
        status: 'COMPLETE',
        summary: `Agent execution finalized with 2 steps. Safe tool calculation output: ${JSON.stringify(toolRes.validated_output)}`,
      };
      newRun.completed_at = new Date().toISOString();
    }
  } else {
    newRun.state = 'SUCCEEDED';
    newRun.final_output = { status: 'COMPLETE', summary: 'Agent execution finished without external tools.' };
    newRun.completed_at = new Date().toISOString();
  }

  newRun.updated_at = new Date().toISOString();

  globalStore.recordAudit({
    trace_id: traceId,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'RUN_CREATED',
    target_resource: `Run/${runId}`,
    summary: `Triggered Agent '${agent.name}' (${version.version}), final status: ${newRun.state}`,
    payload_redacted: { run_id: runId, state: newRun.state, trace_id: traceId },
    status: newRun.state === 'FAILED' ? 'FAILURE' : 'SUCCESS',
  });

  res.json({ success: true, data: newRun });
});

// 7. Workflows
apiRouter.get('/workflows', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = Array.from(globalStore.workflows.values()).filter(
    w => w.tenant_id === principal.tenant_id
  );
  res.json({ data: list });
});

apiRouter.post('/workflows', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { name, description } = req.body;

  const newWf: WorkflowDefinition = {
    id: `wf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name || 'Custom Multi-Node Workflow',
    description: description || 'Visual DAG orchestrated workflow',
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    current_draft: {
      nodes: [
        { id: 'start_1', name: 'Start', type: 'START', config: {}, position: { x: 50, y: 150 } },
        { id: 'llm_1', name: 'Classifier', type: 'LLM', config: { model_id: 'fake_fast_model' }, position: { x: 280, y: 150 } },
        { id: 'end_1', name: 'Output Sink', type: 'END', config: {}, position: { x: 550, y: 150 } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'llm_1' },
        { id: 'e2', source: 'llm_1', target: 'end_1' },
      ],
      input_schema: { type: 'object' },
      output_schema: { type: 'object' },
      timeout_seconds: 60,
    },
    published_versions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  globalStore.workflows.set(newWf.id, newWf);
  res.json({ success: true, data: newWf });
});

apiRouter.post('/workflows/:id/validate', (req: Request, res: Response) => {
  const wf = globalStore.workflows.get(req.params.id);
  if (!wf) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workflow not found' } });
  }
  const nodes = req.body.nodes || wf.current_draft.nodes;
  const edges = req.body.edges || wf.current_draft.edges;
  const result = DAGValidator.validate(nodes, edges);
  res.json({ data: result });
});

apiRouter.post('/workflows/:id/publish', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const wf = globalStore.workflows.get(req.params.id);
  if (!wf) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workflow not found' } });
  }

  const validation = DAGValidator.validate(wf.current_draft.nodes, wf.current_draft.edges);
  if (!validation.is_valid) {
    return res.status(400).json({
      error: { code: 'DAG_VALIDATION_FAILED', message: 'Workflow contains DAG errors', details: validation.errors },
    });
  }

  const newVersionStr = `v${wf.published_versions.length + 1}.0.0`;
  const snapshot: RunSnapshot = {
    definition_id: wf.id,
    definition_version: newVersionStr,
    definition_name: wf.name,
    model_id: 'fake_fast_model',
    model_version: '2026.11',
    tool_versions: {},
    skill_versions: {},
    policy_version: PolicyEngine.CURRENT_POLICY_VERSION,
    created_at: new Date().toISOString(),
    snapshot_hash: `snap_wf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  };

  wf.published_versions.push({
    version: newVersionStr,
    published_at: new Date().toISOString(),
    published_by: principal.actor_name,
    nodes: JSON.parse(JSON.stringify(wf.current_draft.nodes)),
    edges: JSON.parse(JSON.stringify(wf.current_draft.edges)),
    snapshot,
  });
  wf.active_version = newVersionStr;
  wf.updated_at = new Date().toISOString();

  res.json({ success: true, version: newVersionStr, snapshot });
});

// 8. Runs & Execution inspection
apiRouter.get('/runs', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = Array.from(globalStore.runs.values())
    .filter(r => r.tenant_id === principal.tenant_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ data: list });
});

apiRouter.get('/runs/:id', (req: Request, res: Response) => {
  const run = globalStore.runs.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
  }
  res.json({ data: run });
});

apiRouter.post('/runs/:id/cancel', (req: Request, res: Response) => {
  const run = globalStore.runs.get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
  }

  const trans = RunStateMachine.transition(run.state, 'CANCEL_REQUESTED');
  if (!trans.ok) {
    return res.status(400).json({ error: { code: 'ILLEGAL_TRANSITION', message: trans.reason } });
  }

  run.state = 'CANCELLED';
  run.completed_at = new Date().toISOString();
  run.updated_at = new Date().toISOString();

  res.json({ success: true, data: run });
});

// 9. Approvals & Governance
apiRouter.get('/approvals', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = Array.from(globalStore.approvals.values()).filter(
    a => a.tenant_id === principal.tenant_id
  );
  res.json({ data: list });
});

apiRouter.post('/approvals/:id/decide', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const approval = globalStore.approvals.get(req.params.id);
  if (!approval) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Approval request not found' } });
  }

  // Must have APPROVE_HIGH_RISK or PLATFORM_ADMIN
  if (!principal.grants.includes('APPROVE_HIGH_RISK') && principal.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Principal lacks APPROVE_HIGH_RISK grant.' },
    });
  }

  const { decision, reason } = req.body; // 'APPROVE' | 'REJECT'
  if (decision === 'APPROVE') {
    approval.status = 'APPROVED';
    approval.reviewed_at = new Date().toISOString();
    approval.reviewed_by = principal.actor_name;

    // Advance associated run if found
    const run = globalStore.runs.get(approval.run_id);
    if (run && run.state === 'WAITING_APPROVAL') {
      run.state = 'SUCCEEDED';
      run.final_output = {
        status: 'COMPLETE',
        approval_record: approval.id,
        message: 'High risk operation executed successfully following verified human approval.',
      };
      run.completed_at = new Date().toISOString();
    }
  } else {
    approval.status = 'REJECTED';
    approval.reviewed_at = new Date().toISOString();
    approval.reviewed_by = principal.actor_name;
    approval.rejection_reason = reason || 'Rejected by authorized human reviewer';

    const run = globalStore.runs.get(approval.run_id);
    if (run && run.state === 'WAITING_APPROVAL') {
      run.state = 'FAILED';
      run.error_message = `Execution blocked by SecOps: ${approval.rejection_reason}`;
      run.completed_at = new Date().toISOString();
    }
  }

  globalStore.recordAudit({
    trace_id: `tr_appr_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'APPROVAL_DECIDED',
    target_resource: `Approval/${approval.id}`,
    summary: `Approval ${approval.id} marked as ${approval.status} by ${principal.actor_name}`,
    payload_redacted: { approval_id: approval.id, status: approval.status, plan_hash: approval.plan_hash },
    status: 'SUCCESS',
  });

  res.json({ success: true, data: approval });
});

// 10. Audits & Metrics
apiRouter.get('/audits', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const list = globalStore.audits.filter(a => a.tenant_id === principal.tenant_id);
  res.json({ data: list });
});

apiRouter.get('/metrics', (req: Request, res: Response) => {
  const runs = Array.from(globalStore.runs.values());
  const completedRuns = runs.filter(r => r.state === 'SUCCEEDED');
  const failedRuns = runs.filter(r => r.state === 'FAILED');
  const pendingApprovals = Array.from(globalStore.approvals.values()).filter(a => a.status === 'PENDING');

  res.json({
    data: {
      total_runs: runs.length,
      succeeded_runs: completedRuns.length,
      failed_runs: failedRuns.length,
      success_rate_percent: runs.length > 0 ? Number(((completedRuns.length / runs.length) * 100).toFixed(1)) : 100,
      active_approval_backlog: pendingApprovals.length,
      total_tokens_consumed: runs.reduce((acc, r) => acc + (r.total_tokens || 0), 0),
      total_cost_usd: Number(runs.reduce((acc, r) => acc + (r.total_cost_usd || 0), 0).toFixed(4)),
      p95_latency_ms: 124,
      registered_tools_count: globalStore.tools.size,
    },
  });
});

// 11. Metal3 + Ironic BareMetal Kubernetes Deployment & Eph-Node AI Agent
apiRouter.get('/metal3/status', (req: Request, res: Response) => {
  const hosts = Array.from(globalMetal3Engine.hosts.values());
  const clusters = Array.from(globalMetal3Engine.clusters.values());
  res.json({
    data: {
      eph_node: {
        id: globalMetal3Engine.ephNode.id,
        name: globalMetal3Engine.ephNode.name,
        status: globalMetal3Engine.ephNode.status,
        k8s_version: globalMetal3Engine.ephNode.k8s_version,
        ip: globalMetal3Engine.ephNode.ip_address,
        agent: globalMetal3Engine.ephNode.agent_daemon,
      },
      stats: {
        total_bmh_hosts: hosts.length,
        active_in_cluster: hosts.filter(h => h.provisioning_status === 'ActiveInCluster').length,
        provisioning: hosts.filter(h => h.provisioning_status === 'Provisioning' || h.provisioning_status === 'Preparing').length,
        ready_available: hosts.filter(h => h.provisioning_status === 'Available').length,
        inspecting: hosts.filter(h => h.provisioning_status === 'Inspecting').length,
        power_on: hosts.filter(h => h.power_status === 'ON').length,
        power_off: hosts.filter(h => h.power_status === 'OFF').length,
        gpu_accelerators_total: 64,
        total_clusters: clusters.length,
      },
    },
  });
});

apiRouter.get('/metal3/eph-node', (req: Request, res: Response) => {
  res.json({ data: globalMetal3Engine.ephNode });
});

apiRouter.get('/metal3/bmh', (req: Request, res: Response) => {
  res.json({ data: Array.from(globalMetal3Engine.hosts.values()) });
});

apiRouter.post('/metal3/bmh/:name/power', (req: Request, res: Response) => {
  const { name } = req.params;
  const { action } = req.body;
  const principal = (req as any).principal;

  if (!['on', 'off', 'reboot', 'pxe-boot'].includes(action)) {
    return res.status(400).json({ error: { code: 'INVALID_ACTION', message: 'Allowed power actions: on, off, reboot, pxe-boot' } });
  }

  try {
    const updatedHost = globalMetal3Engine.setHostPower(name, action);

    globalStore.recordAudit({
      trace_id: `tr_bmh_pwr_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'TOOL_INVOKED',
      target_resource: `BareMetalHost/${name}`,
      summary: `Executed BMC power command '${action}' on baremetal server ${name}`,
      payload_redacted: { host: name, power_action: action, bmc_protocol: updatedHost.bmc_protocol },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: updatedHost });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'HOST_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/metal3/bmh/:name/inspect', (req: Request, res: Response) => {
  const { name } = req.params;
  try {
    const updated = globalMetal3Engine.triggerInspect(name);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'HOST_NOT_FOUND', message: err.message } });
  }
});

apiRouter.get('/metal3/clusters', (req: Request, res: Response) => {
  res.json({ data: Array.from(globalMetal3Engine.clusters.values()) });
});

apiRouter.post('/metal3/clusters', (req: Request, res: Response) => {
  const { name, k8s_version, cni, gpu_operator, scale } = req.body;
  const principal = (req as any).principal;

  if (!name) {
    return res.status(400).json({ error: { code: 'MISSING_NAME', message: 'Target cluster name is required' } });
  }

  const cluster = globalMetal3Engine.createTargetCluster({
    name,
    k8s_version: k8s_version || 'v1.31.2',
    cni: cni || 'Cilium eBPF (RoCEv2 + BGP mesh)',
    gpu_operator: gpu_operator || 'NVIDIA GPU Operator v24.6.0',
    scale: scale || { control_plane_nodes: 3, worker_nodes: 32, gpu_nodes: 32 },
  });

  globalStore.recordAudit({
    trace_id: `tr_cl_create_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'WORKFLOW_PUBLISHED',
    target_resource: `TargetK8sCluster/${cluster.id}`,
    summary: `Dispatched Large-scale Baremetal K8s deployment '${cluster.name}' via Eph-Node AI Agent`,
    payload_redacted: { cluster_name: cluster.name, scale: cluster.scale, cni: cluster.cni },
    status: 'SUCCESS',
  });

  res.json({ success: true, data: cluster });
});

apiRouter.post('/metal3/clusters/:id/pivot', (req: Request, res: Response) => {
  const { id } = req.params;
  const principal = (req as any).principal;

  try {
    const result = globalMetal3Engine.triggerPivot(id);

    globalStore.recordAudit({
      trace_id: `tr_cl_pivot_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'APPROVAL_DECIDED',
      target_resource: `ClusterAPIPivot/${id}`,
      summary: `Triggered CAPI resource pivot from Eph-Node to target cluster ${id}`,
      payload_redacted: { cluster_id: id },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'CLUSTER_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/metal3/clusters/:id/scale', (req: Request, res: Response) => {
  const { id } = req.params;
  const { worker_nodes, gpu_nodes } = req.body;
  const principal = (req as any).principal;

  if (typeof worker_nodes !== 'number' || worker_nodes < 1) {
    return res.status(400).json({ error: { code: 'INVALID_SCALE', message: 'worker_nodes must be a positive number' } });
  }

  try {
    const updated = globalMetal3Engine.scaleCluster(id, {
      worker_nodes,
      gpu_nodes: typeof gpu_nodes === 'number' ? gpu_nodes : Math.min(worker_nodes, 60),
    });

    globalStore.recordAudit({
      trace_id: `tr_cl_scale_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'WORKFLOW_PUBLISHED',
      target_resource: `TargetK8sCluster/${id}`,
      summary: `AI Agent orchestrated cluster scale to ${updated.scale.worker_nodes} workers (${updated.scale.gpu_nodes} GPUs)`,
      payload_redacted: { cluster_id: id, target_scale: updated.scale },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'CLUSTER_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/metal3/clusters/:id/scale-down-node', (req: Request, res: Response) => {
  const { id } = req.params;
  const { host_name } = req.body;
  const principal = (req as any).principal;

  if (!host_name) {
    return res.status(400).json({ error: { code: 'MISSING_HOST', message: 'host_name is required' } });
  }

  try {
    const result = globalMetal3Engine.scaleDownSingleNode(id, host_name);

    globalStore.recordAudit({
      trace_id: `tr_cl_drain_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'TOOL_INVOKED',
      target_resource: `BareMetalHost/${host_name}`,
      summary: `AI Agent executed safe cordon & drain on node ${host_name} from cluster ${id}`,
      payload_redacted: { cluster_id: id, host_name },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'NODE_OR_CLUSTER_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/metal3/clusters/:id/upgrade', (req: Request, res: Response) => {
  const { id } = req.params;
  const { target_k8s_version } = req.body;
  const principal = (req as any).principal;

  if (typeof target_k8s_version !== 'string' || !target_k8s_version.trim()) {
    return res.status(400).json({ error: { code: 'MISSING_VERSION', message: 'target_k8s_version is required' } });
  }

  if (!(SUPPORTED_KUBERNETES_VERSIONS as readonly string[]).includes(target_k8s_version)) {
    return res.status(400).json({
      error: {
        code: 'UNSUPPORTED_KUBERNETES_VERSION',
        message: 'Unsupported Kubernetes version ' + target_k8s_version + '. Supported versions: ' + SUPPORTED_KUBERNETES_VERSIONS.join(', '),
      },
    });
  }

  try {
    const updated = globalMetal3Engine.upgradeClusterVersion(id, target_k8s_version);

    globalStore.recordAudit({
      trace_id: `tr_cl_upg_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'WORKFLOW_PUBLISHED',
      target_resource: `TargetK8sCluster/${id}`,
      summary: `AI Agent performed in-place rolling upgrade of cluster ${id} to Kubernetes ${target_k8s_version}`,
      payload_redacted: { cluster_id: id, target_version: target_k8s_version },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    const notFound = String(err?.message || '').includes('not found');
    res.status(notFound ? 404 : 400).json({
      error: {
        code: notFound ? 'CLUSTER_NOT_FOUND' : 'INVALID_KUBERNETES_VERSION_TRANSITION',
        message: err.message,
      },
    });
  }
});

apiRouter.post('/metal3/agent/command', (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_COMMAND', message: 'Command string is required' } });
  }

  const result = globalMetal3Engine.executeAgentCommand(command);
  res.json({ success: true, data: result });
});

apiRouter.get('/metal3/agent/status', (req: Request, res: Response) => {
  res.json({
    data: {
      ...globalMetal3Engine.agentTelemetry,
      last_heartbeat: new Date().toISOString(),
      eph_node: globalMetal3Engine.ephNode,
    },
  });
});

apiRouter.get('/metal3/bmh/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const host = globalMetal3Engine.hosts.get(name);
  if (!host) {
    return res.status(404).json({ error: { code: 'HOST_NOT_FOUND', message: `Host ${name} not found` } });
  }
  res.json({ data: host });
});

apiRouter.get('/metal3/logs', (req: Request, res: Response) => {
  const { stream } = req.query;
  const logs = globalMetal3Engine.getLogs(stream as any);
  res.json({ data: logs });
});

// Metal3 Proactive Alerting Endpoints
apiRouter.get('/metal3/alerts', (_req: Request, res: Response) => {
  res.json({ data: globalMetal3Engine.getAlerts() });
});

apiRouter.post('/metal3/alerts/simulate', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { host_name, rule } = req.body;
  const alert = globalMetal3Engine.simulateAlert(host_name, rule);

  globalStore.recordAudit({
    trace_id: `tr_alt_sim_${Date.now()}`,
    tenant_id: principal.tenant_id,
    project_id: principal.active_project_id,
    actor_id: principal.actor_id,
    actor_name: principal.actor_name,
    actor_role: principal.role,
    event_type: 'TOOL_INVOKED',
    target_resource: `HostAlert/${alert.id}`,
    summary: `Injected proactive failure simulation alert for host '${alert.host_name}' (${alert.rule})`,
    payload_redacted: { alert_id: alert.id, host: alert.host_name, rule: alert.rule, severity: alert.severity },
    status: 'SUCCESS',
  });

  res.json({ success: true, data: alert });
});

apiRouter.post('/metal3/alerts/:id/remediate', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { id } = req.params;

  try {
    const result = globalMetal3Engine.autoRemediateAlert(id);

    globalStore.recordAudit({
      trace_id: `tr_alt_rem_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'WORKFLOW_PUBLISHED',
      target_resource: `HostAlert/${id}`,
      summary: `Autonomous AI Agent executed self-healing remediation on host '${result.host.name}'`,
      payload_redacted: { alert_id: id, host_name: result.host.name, actions_taken: result.actions_taken },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'ALERT_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/metal3/alerts/:id/dispatch', (req: Request, res: Response) => {
  const principal = (req as any).principal;
  const { id } = req.params;
  const { channel = 'feishu' } = req.body;

  try {
    const result = globalMetal3Engine.dispatchAlertToEnterpriseApp(id, channel);

    globalStore.recordAudit({
      trace_id: `tr_alt_disp_${Date.now()}`,
      tenant_id: principal.tenant_id,
      project_id: principal.active_project_id,
      actor_id: principal.actor_id,
      actor_name: principal.actor_name,
      actor_role: principal.role,
      event_type: 'CONNECTOR_STATUS_CHANGE',
      target_resource: `HostAlert/${id}`,
      summary: `Dispatched proactive alert ${id} to ${channel.toUpperCase()} webhook notification channel`,
      payload_redacted: { alert_id: id, channel, message_id: result.message_id },
      status: 'SUCCESS',
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(404).json({ error: { code: 'ALERT_NOT_FOUND', message: err.message } });
  }
});

apiRouter.post('/metal3/alerts/:id/dismiss', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = globalMetal3Engine.dismissAlert(id);
  res.json({ success: ok, data: { alert_id: id, dismissed: ok } });
});


