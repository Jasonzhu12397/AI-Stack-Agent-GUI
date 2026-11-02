import test from 'node:test';
import assert from 'node:assert/strict';
import { PluginRegistry, WeatherEngine, DomesticAppDispatcher } from './plugins';
import { FakeToolExecutor } from './fakeProviders';
import { ToolCall, ToolDefinition, Principal } from '../contracts/types';

test('PluginRegistry initializes Google Maps, Weather, and Domestic Connectors', () => {
  const plugins = PluginRegistry.getAllPlugins();
  assert.ok(plugins.length >= 6);

  const maps = PluginRegistry.getPlugin('google_maps_platform');
  assert.ok(maps);
  assert.equal(maps.category, 'MAPS');
  assert.equal(maps.provider, 'GOOGLE');
  assert.ok(maps.tools.some(t => t.id === 'maps_geocode'));

  const weather = PluginRegistry.getPlugin('global_weather_service');
  assert.ok(weather);
  assert.equal(weather.category, 'WEATHER');

  const feishu = PluginRegistry.getPlugin('feishu_lark_integration');
  assert.ok(feishu);
  assert.equal(feishu.category, 'DOMESTIC_APPS');

  const dingtalk = PluginRegistry.getPlugin('dingtalk_integration');
  assert.ok(dingtalk);

  const wecom = PluginRegistry.getPlugin('wecom_integration');
  assert.ok(wecom);
});

test('WeatherEngine queries meteorological conditions and computes forecasts', () => {
  const beijing = WeatherEngine.queryWeather('Beijing', 'metric');
  assert.equal(beijing.country, 'CN');
  assert.equal(beijing.temperature_unit, '°C');
  assert.ok(typeof beijing.temperature === 'number');
  assert.ok(beijing.air_quality.aqi > 0);
  assert.equal(beijing.forecast.length, 5);

  const tokyo = WeatherEngine.queryWeather('Tokyo', 'imperial');
  assert.equal(tokyo.country, 'JP');
  assert.equal(tokyo.temperature_unit, '°F');
  assert.ok(tokyo.temperature > 50);
});

test('DomesticAppDispatcher formats payloads for Feishu, DingTalk, and WeCom', async () => {
  const feishuRes = await DomesticAppDispatcher.dispatch({
    platform: 'feishu',
    message_type: 'card',
    title: 'Cluster Alert',
    content: 'Pod memory leak detected',
  });
  assert.equal(feishuRes.success, true);
  assert.equal(feishuRes.platform, 'feishu');
  assert.ok(feishuRes.sanitized_preview.card);

  const dingtalkRes = await DomesticAppDispatcher.dispatch({
    platform: 'dingtalk',
    message_type: 'markdown',
    title: 'Incident SRE',
    content: 'Replicas scaled down',
    is_at_all: true,
  });
  assert.equal(dingtalkRes.success, true);
  assert.equal(dingtalkRes.sanitized_preview.at.isAtAll, true);

  const wecomRes = await DomesticAppDispatcher.dispatch({
    platform: 'wecom',
    message_type: 'markdown',
    content: 'Rollout complete',
  });
  assert.equal(wecomRes.success, true);
  assert.equal(wecomRes.platform, 'wecom');
});

test('FakeToolExecutor natively executes plugin tools', async () => {
  const mockActor: Principal = {
    actor_id: 'usr_dev_test',
    actor_name: 'Tester',
    actor_type: 'USER',
    tenant_id: 'tenant_acme_corp',
    tenant_name: 'Acme',
    project_ids: ['proj_infra_ops'],
    active_project_id: 'proj_infra_ops',
    role: 'APP_DEVELOPER',
    grants: ['*'],
    auth_context: {
      authenticated_at: new Date().toISOString(),
      auth_method: 'LOCAL_DEV_IDENTITY',
      ip_address: '127.0.0.1',
      session_id: 'sess_1',
    },
  };

  const geocodeTool = PluginRegistry.getAllTools().find(t => t.id === 'maps_geocode')!;
  assert.ok(geocodeTool);

  const call: ToolCall = {
    tool_id: 'maps_geocode',
    version: '1.0.0',
    args: { address: 'San Francisco, CA' },
    actor: mockActor,
    tenant_id: 'tenant_acme_corp',
    project_id: 'proj_infra_ops',
    run_id: 'run_geo_test',
    step_id: 'step_1',
    trace_id: 'tr_geo_test',
  };

  const res = await FakeToolExecutor.execute(call, geocodeTool);
  assert.equal(res.status, 'SUCCESS');
  assert.ok(res.validated_output.lat > 37 && res.validated_output.lat < 38);
  assert.ok(res.validated_output.formatted_address.includes('San Francisco'));
});
