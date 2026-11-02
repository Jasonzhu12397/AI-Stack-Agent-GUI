import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from './policyEngine';
import { Principal, ToolDefinition } from '../contracts/types';

const mockPrincipal: Principal = {
  actor_id: 'usr_dev_1',
  actor_name: 'Developer 1',
  actor_type: 'USER',
  tenant_id: 'tenant_acme',
  tenant_name: 'Acme Corp',
  project_ids: ['proj_default'],
  active_project_id: 'proj_default',
  role: 'APP_DEVELOPER',
  grants: ['TOOL_READ', 'TOOL_CALC'],
  auth_context: {
    authenticated_at: new Date().toISOString(),
    auth_method: 'LOCAL_DEV_IDENTITY',
    ip_address: '127.0.0.1',
    session_id: 'sess_1',
  },
};

const safeTool: ToolDefinition = {
  id: 'fake_calculator',
  name: 'Safe Calculator',
  version: '1.0.0',
  description: 'Calculates numbers',
  category: 'SYSTEM',
  input_schema: {},
  output_schema: {},
  permissions: ['TOOL_CALC'],
  risk: 'LOW',
  idempotency_mode: 'IDEMPOTENT',
  timeout_ms: 1000,
  retry_policy: { max_retries: 0, backoff_ms: 0 },
  network_targets: [],
  is_active: true,
  is_fake: true,
};

const dangerousTool: ToolDefinition = {
  id: 'fake_cloud_deploy',
  name: 'Cloud Deployer',
  version: '1.0.0',
  description: 'Deploys resources',
  category: 'CLOUD',
  input_schema: {},
  output_schema: {},
  permissions: ['CLOUD_DEPLOY'],
  risk: 'HIGH',
  idempotency_mode: 'NON_IDEMPOTENT',
  timeout_ms: 5000,
  retry_policy: { max_retries: 0, backoff_ms: 0 },
  network_targets: ['api.k8s.internal'],
  is_active: true,
  is_fake: true,
};

test('PolicyEngine permits low risk authorized tool calls', () => {
  const decision = PolicyEngine.evaluateToolCall({
    principal: mockPrincipal,
    agentWhitelist: ['fake_calculator'],
    tool: safeTool,
    args: { a: 10, b: 20, operation: 'add' },
  });

  assert.equal(decision.decision, 'ALLOW');
  assert.equal(decision.risk_level, 'LOW');
});

test('PolicyEngine denies tool call if tool not in Agent whitelist', () => {
  const decision = PolicyEngine.evaluateToolCall({
    principal: mockPrincipal,
    agentWhitelist: ['some_other_tool'],
    tool: safeTool,
    args: {},
  });

  assert.equal(decision.decision, 'DENY');
  assert.match(decision.reason, /not permitted by Agent whitelist/i);
});

test('PolicyEngine denies tool call if Principal lacks required permissions', () => {
  const decision = PolicyEngine.evaluateToolCall({
    principal: mockPrincipal, // lacks CLOUD_DEPLOY grant
    agentWhitelist: ['fake_cloud_deploy'],
    tool: dangerousTool,
    args: {},
  });

  assert.equal(decision.decision, 'DENY');
  assert.match(decision.reason, /lacks required permissions/i);
});

test('PolicyEngine requires approval for High Risk tools when user has grant', () => {
  const privilegedPrincipal: Principal = {
    ...mockPrincipal,
    grants: ['CLOUD_DEPLOY'],
  };

  const decision = PolicyEngine.evaluateToolCall({
    principal: privilegedPrincipal,
    agentWhitelist: ['fake_cloud_deploy'],
    tool: dangerousTool,
    args: { cluster: 'prod-cluster', replicas: 3 },
  });

  assert.equal(decision.decision, 'REQUIRE_APPROVAL');
  assert.equal(decision.risk_level, 'HIGH');
  assert.ok(decision.required_plan_hash);
});

test('PolicyEngine detects parameter tampering when approval hash does not match', () => {
  const privilegedPrincipal: Principal = {
    ...mockPrincipal,
    grants: ['CLOUD_DEPLOY'],
  };

  const originalHash = PolicyEngine.computePlanHash('fake_cloud_deploy', { cluster: 'prod-cluster', replicas: 3 });

  // Tampered args: changed replicas to 50
  const decision = PolicyEngine.evaluateToolCall({
    principal: privilegedPrincipal,
    agentWhitelist: ['fake_cloud_deploy'],
    tool: dangerousTool,
    args: { cluster: 'prod-cluster', replicas: 50 }, // modified!
    consumedApprovalHash: originalHash,
  });

  assert.equal(decision.decision, 'DENY');
  assert.match(decision.reason, /tampering|mismatch/i);
});
