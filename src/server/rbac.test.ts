import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from './api';
import { globalStore } from './store';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  return app;
}

test('API /members scopes results strictly to current tenant', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // Current principal is in tenant_acme_corp
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/members`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 3);
    for (const m of body.data) {
      assert.equal(m.tenant_id, 'tenant_acme_corp');
    }
  } finally {
    server.close();
  }
});

test('API /members blocks non-admin without USER_MANAGE grant', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // Switch to Alex Chen (APP_DEVELOPER, lacks USER_MANAGE)
    globalStore.switchPrincipal('usr_app_dev');

    const res = await fetch(`http://127.0.0.1:${port}/api/v1/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Eve Unauthorized',
        email: 'eve@evil.internal',
        role: 'APP_DEVELOPER',
      }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  } finally {
    server.close();
  }
});

test('API /members allows Elena (PLATFORM_ADMIN) to invite new member', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // Switch to Elena Rostova (PLATFORM_ADMIN)
    globalStore.switchPrincipal('usr_platform_admin');

    const res = await fetch(`http://127.0.0.1:${port}/api/v1/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Grace Hopper',
        email: 'grace@acme-corp.internal',
        role: 'APP_DEVELOPER',
        project_ids: ['proj_infra_ops'],
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.name, 'Grace Hopper');
    assert.equal(body.data.status, 'ACTIVE');
  } finally {
    server.close();
  }
});

test('API /members/:id/revoke revokes role and prevents subsequent mutations', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. Elena revokes member Alex Chen
    globalStore.switchPrincipal('usr_platform_admin');
    const revokeRes = await fetch(`http://127.0.0.1:${port}/api/v1/members/usr_app_dev/revoke`, {
      method: 'POST',
    });
    assert.equal(revokeRes.status, 200);

    // 2. Switch to Alex Chen
    globalStore.switchPrincipal('usr_app_dev');

    // 3. Alex tries to create an agent draft -> rejected with 403 ROLE_REVOKED
    const createRes = await fetch(`http://127.0.0.1:${port}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Malicious Agent After Revocation' }),
    });
    assert.equal(createRes.status, 403);
    const body = await createRes.json();
    assert.equal(body.error.code, 'ROLE_REVOKED');

    // Restore Alex Chen's role for remaining tests
    const m = globalStore.members.get('usr_app_dev')!;
    m.status = 'ACTIVE';
    globalStore.principals.get('usr_app_dev')!.grants = [
      'TOOL_CALC',
      'TOOL_READ',
      'DB_QUERY',
      'NOTIFY_SEND',
      'AGENT_DRAFT',
      'WORKFLOW_DRAFT',
    ];
  } finally {
    server.close();
  }
});

test('API ignores forged tenant_id in request body and preserves server-authoritative tenant', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    globalStore.switchPrincipal('usr_app_dev');

    // Attempt to inject tenant_id: 'tenant_rival_corp'
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tamper Tenant Test Agent',
        tenant_id: 'tenant_rival_corp',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    // Invariant: Created agent is STILL in Acme Corp, never rival corp!
    assert.equal(body.data.tenant_id, 'tenant_acme_corp');
  } finally {
    server.close();
  }
});

test('API enforces quota exhaustion and rejects runs with 429', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    globalStore.switchPrincipal('usr_platform_admin');
    const tenant = globalStore.tenants.get('tenant_acme_corp')!;
    const originalBudget = tenant.quota.monthly_budget_usd;
    const originalUsed = tenant.quota.used_budget_usd;

    // Simulate budget completely used up
    tenant.quota.used_budget_usd = 5000.0;
    tenant.quota.monthly_budget_usd = 5000.0;

    // Try to launch agent run
    const agent = Array.from(globalStore.agents.values())[0];
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/agents/${agent.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_query: 'Check budget limit' }),
    });

    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.error.code, 'MONTHLY_BUDGET_EXCEEDED');

    // Restore budget
    tenant.quota.monthly_budget_usd = originalBudget;
    tenant.quota.used_budget_usd = originalUsed;
  } finally {
    server.close();
  }
});

test('API /auth/oidc/verify enforces production guard', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    // 1. In development, local dev identity passes
    const devRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/oidc/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: 'development', provider: 'LOCAL_DEV_IDENTITY' }),
    });
    assert.equal(devRes.status, 200);

    // 2. In production, local dev identity is strictly forbidden!
    const prodRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/oidc/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env: 'production', provider: 'LOCAL_DEV_IDENTITY' }),
    });
    assert.equal(prodRes.status, 403);
    const body = await prodRes.json();
    assert.equal(body.error.code, 'OIDC_CONFIG_INVALID');
    assert.match(body.error.message, /DEV_IDENTITY_FORBIDDEN_IN_PRODUCTION/);
  } finally {
    server.close();
  }
});
