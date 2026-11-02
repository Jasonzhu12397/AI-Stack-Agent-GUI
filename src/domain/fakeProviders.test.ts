import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeModel, FakeToolExecutor, FakeMCPServer } from './fakeProviders';
import { ModelConfig, ToolDefinition, ToolCall, Principal } from '../contracts/types';

const fakeModelConfig: ModelConfig = {
  id: 'fake_fast_model',
  name: 'Deterministic Fake Engine v1',
  provider: 'FAKE',
  model_string: 'fake-deterministic-gpt',
  context_window: 128000,
  cost_per_1k_input: 0.001,
  cost_per_1k_output: 0.002,
  capabilities: {
    supports_structured_output: true,
    supports_tools: true,
    supports_vision: false,
    supports_streaming: true,
  },
  is_active: true,
  is_fake: true,
};

const mockPrincipal: Principal = {
  actor_id: 'usr_test',
  actor_name: 'Test Runner',
  actor_type: 'SYSTEM',
  tenant_id: 'tenant_test',
  tenant_name: 'Test Tenant',
  project_ids: ['proj_1'],
  active_project_id: 'proj_1',
  role: 'PLATFORM_ADMIN',
  grants: ['*'],
  auth_context: {
    authenticated_at: new Date().toISOString(),
    auth_method: 'LOCAL_DEV_IDENTITY',
    ip_address: '127.0.0.1',
    session_id: 'sess_test',
  },
};

test('FakeModel calculates deterministic output and token costs', async () => {
  const result = await FakeModel.generate({
    modelConfig: fakeModelConfig,
    systemPrompt: 'You are an agent evaluator.',
    messages: [{ role: 'user', content: 'Audit cluster health' }],
    structuredOutputSchema: { type: 'object' },
  });

  assert.equal(result.finish_reason, 'stop');
  assert.ok(result.usage.total_tokens > 0);
  assert.ok(result.usage.estimated_cost_usd >= 0);
  assert.ok(result.structured_data);
  assert.equal(result.structured_data.action, 'PROCEED');
});

test('FakeToolExecutor performs calculation and enforces idempotency', async () => {
  const toolDef: ToolDefinition = {
    id: 'fake_calculator',
    name: 'Calculator',
    version: '1.0.0',
    description: 'Basic math',
    category: 'SYSTEM',
    input_schema: { required: ['a', 'b', 'operation'] },
    output_schema: {},
    permissions: [],
    risk: 'LOW',
    idempotency_mode: 'IDEMPOTENT',
    timeout_ms: 1000,
    retry_policy: { max_retries: 0, backoff_ms: 0 },
    network_targets: [],
    is_active: true,
    is_fake: true,
  };

  const call: ToolCall = {
    tool_id: 'fake_calculator',
    version: '1.0.0',
    args: { a: 40, b: 2, operation: 'add' },
    actor: mockPrincipal,
    tenant_id: 'tenant_test',
    project_id: 'proj_1',
    run_id: 'run_100',
    step_id: 'step_1',
    trace_id: 'tr_test_1',
    idempotency_key: 'idem_key_unique_42',
  };

  const res1 = await FakeToolExecutor.execute(call, toolDef);
  assert.equal(res1.status, 'SUCCESS');
  assert.equal(res1.validated_output.result, 42);

  // Repeat with same idempotency key -> returns cached result
  const res2 = await FakeToolExecutor.execute(call, toolDef);
  assert.equal(res2.status, 'SUCCESS');
  assert.equal(res2.idempotency_cached, true);
});

test('FakeMCPServer exposes discoverable tools and executes safely', async () => {
  const tools = FakeMCPServer.getTools();
  assert.ok(tools.length >= 2);
  assert.ok(tools.some(t => t.id === 'mcp_filesystem_read'));

  // Test path traversal defense in MCP tool
  await assert.rejects(
    async () => {
      await FakeMCPServer.executeMCPTool('mcp_filesystem_read', { filepath: '../../etc/passwd' });
    },
    /path traversal detected/i
  );

  // Safe file read
  const safeRes = await FakeMCPServer.executeMCPTool('mcp_filesystem_read', { filepath: 'config.json' });
  assert.ok(safeRes.content);
});
