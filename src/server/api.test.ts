import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from './api';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  return app;
}

test('API /health endpoint returns healthy status and component diagnostics', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'HEALTHY');
    assert.equal(body.service, 'ai-agent-studio-control-plane');
    assert.ok(body.components.policy_engine.policy_version);
    assert.equal(body.components.model_gateway.default_provider, 'FAKE_MODEL');
  } finally {
    server.close();
  }
});

test('API /openapi.json returns valid OpenAPI 3.1 schema', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/openapi.json`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.openapi, '3.1.0');
    assert.ok(body.paths['/api/v1/health']);
    assert.ok(body.paths['/api/v1/agents']);
  } finally {
    server.close();
  }
});

test('API /agents and /agents/:id/run executes deterministic fake flow', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. Get agents
    const listRes = await fetch(`http://127.0.0.1:${port}/api/v1/agents`);
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(listBody.data.length > 0);
    const agentId = listBody.data[0].id;

    // 2. Trigger run
    const runRes = await fetch(`http://127.0.0.1:${port}/api/v1/agents/${agentId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_query: 'Compute memory headroom' }),
    });
    assert.equal(runRes.status, 200);
    const runBody = await runRes.json();
    assert.equal(runBody.success, true);
    assert.ok(runBody.data.id.startsWith('run_'));
    assert.ok(runBody.data.steps.length >= 1);
  } finally {
    server.close();
  }
});
