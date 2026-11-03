import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PluginRegistry } from './plugins';
import { Metal3Engine } from './metal3';

test('PluginRegistry provides rich presets including WeChat, QQ, Meituan, 12306, Flights, Alipay', () => {
  const presets = PluginRegistry.getPresets();
  assert.ok(Array.isArray(presets));
  assert.ok(presets.length >= 6);

  const ids = presets.map((p: any) => p.id);
  assert.ok(ids.includes('wechat_app_connector'), 'WeChat preset must exist');
  assert.ok(ids.includes('qq_bot_connector'), 'QQ Bot preset must exist');
  assert.ok(ids.includes('meituan_open_connector'), 'Meituan preset must exist');
  assert.ok(ids.includes('rail12306_connector'), '12306 Rail preset must exist');
  assert.ok(ids.includes('flight_booking_connector'), 'Flight Booking preset must exist');
  assert.ok(ids.includes('alipay_connector'), 'Alipay preset must exist');
});

test('PluginRegistry allows creating and deleting custom plugins dynamically', () => {
  const custom = PluginRegistry.createCustomPlugin({
    id: 'test_custom_crm',
    name: 'Enterprise CRM Connector',
    name_zh: '企业 CRM 客户连接器',
    category: 'DOMESTIC_APPS',
    provider: 'CUSTOM',
    description: 'Syncs enterprise CRM leads and tickets',
    tool_id: 'crm_sync_lead',
    tool_name: 'CRM Lead Syncer',
    risk: 'MEDIUM',
    sample_args: { customer_id: 'CUST_991' },
  });

  assert.equal(custom.id, 'test_custom_crm');
  assert.equal(custom.tools.length, 1);
  assert.equal(custom.tools[0].id, 'crm_sync_lead');

  // Verify retrieval
  const retrieved = PluginRegistry.getPlugin('test_custom_crm');
  assert.ok(retrieved);
  assert.equal(retrieved.name, 'Enterprise CRM Connector');

  // Verify deletion
  const deleted = PluginRegistry.deletePlugin('test_custom_crm');
  assert.equal(deleted, true);
  assert.equal(PluginRegistry.getPlugin('test_custom_crm'), undefined);
});

test('Metal3Engine proactive alerts: simulation, auto-remediation, and bot dispatch', () => {
  const engine = new Metal3Engine();
  const initialAlerts = engine.getAlerts();
  assert.ok(initialAlerts.length >= 1, 'Initial seeded alert must exist');

  // 1. Simulate new failure alert
  const simulated = engine.simulateAlert('bmh-gpu-supernode-01', 'NODE_DEGRADED');
  assert.ok(simulated.id.startsWith('alt_bmh-gpu-supernode-01'));
  assert.equal(simulated.status, 'ACTIVE');
  assert.equal(simulated.rule, 'NODE_DEGRADED');

  const host = engine.hosts.get('bmh-gpu-supernode-01');
  assert.ok(host);
  assert.equal(host.provisioning_status, 'Degraded');

  // 2. Dispatch to enterprise app
  const dispatchRes = engine.dispatchAlertToEnterpriseApp(simulated.id, 'feishu');
  assert.equal(dispatchRes.success, true);
  assert.equal(dispatchRes.channel, 'feishu');
  assert.ok(simulated.dispatched_channels.includes('feishu'));

  // 3. AI Agent Auto-Remediate
  const remediationRes = engine.autoRemediateAlert(simulated.id);
  assert.equal(remediationRes.success, true);
  assert.ok(remediationRes.actions_taken.length >= 4);
  assert.equal(host.provisioning_status, 'Available');
  assert.equal(simulated.status, 'RESOLVED');

  // 4. Dismiss alert
  const dismissRes = engine.dismissAlert(initialAlerts[0].id);
  assert.equal(dismissRes, true);
  assert.equal(initialAlerts[0].status, 'RESOLVED');
});
