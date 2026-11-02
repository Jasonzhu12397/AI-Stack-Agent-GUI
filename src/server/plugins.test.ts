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

test('API /plugins returns registered connectors and status', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/plugins`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 6);

    const maps = body.data.find((p: any) => p.id === 'google_maps_platform');
    assert.ok(maps);
    assert.equal(maps.category, 'MAPS');

    const feishu = body.data.find((p: any) => p.id === 'feishu_lark_integration');
    assert.ok(feishu);
    assert.equal(feishu.provider, 'FEISHU');
  } finally {
    server.close();
  }
});

test('API /weather/query returns live weather data for cities', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/weather/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: 'Shanghai', units: 'metric' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.city.includes('Shanghai'));
    assert.equal(body.data.country, 'CN');
    assert.ok(body.data.temperature > 0);
    assert.ok(body.data.forecast.length === 5);
  } finally {
    server.close();
  }
});

test('API /domestic/dispatch dispatches test notification with audit log', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const address = server.address() as any;
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/domestic/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'feishu',
        message_type: 'card',
        title: 'CI/CD Pipeline Success',
        content: 'Worker image v2.4.0 passed zero-trust vulnerability check.',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.platform, 'feishu');
    assert.ok(body.data.message_id.startsWith('msg_feishu'));
    assert.equal(body.data.signature_verified, true);
  } finally {
    server.close();
  }
});
