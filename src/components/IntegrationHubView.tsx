import React, { useState, useEffect } from 'react';
import { ToolDefinition, Principal } from '../contracts/types';
import { PluginItem } from '../domain/plugins';
import { GoogleMapsView } from './GoogleMapsView';
import { WeatherPluginView } from './WeatherPluginView';
import { DomesticConnectorsView } from './DomesticConnectorsView';
import {
  Terminal,
  Play,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Server,
  Layers,
  Power,
  RotateCw,
  MapPin,
  CloudSun,
  Send,
  Boxes,
  ExternalLink,
  Zap,
  Plus,
  Trash2,
  Sparkles,
  MessageCircle,
  Bot,
  ShoppingBag,
  Train,
  Plane,
  CreditCard,
  X,
  Check,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface IntegrationHubViewProps {
  tools: ToolDefinition[];
  currentPrincipal: Principal | null;
  onToggleTool: (id: string) => Promise<void>;
  onTestTool: (id: string, args: Record<string, any>) => Promise<any>;
  onRefresh?: () => Promise<void>;
}

export const IntegrationHubView: React.FC<IntegrationHubViewProps> = ({
  tools,
  currentPrincipal,
  onToggleTool,
  onTestTool,
  onRefresh,
}) => {
  const { t, language } = useLanguage();
  const [subTab, setSubTab] = useState<'catalog' | 'maps' | 'weather' | 'domestic' | 'mcp'>('catalog');
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>(tools[0]?.id || 'fake_calculator');
  const tool = tools.find((tItem) => tItem.id === selectedToolId) || tools[0];

  const [testArgsJson, setTestArgsJson] = useState('{\n  "a": 128,\n  "b": 32,\n  "operation": "add"\n}');
  const [testOutput, setTestOutput] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Custom Plugin Creation Modal & Presets State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [presets, setPresets] = useState<any[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formNameZh, setFormNameZh] = useState('');
  const [formCategory, setFormCategory] = useState<'DOMESTIC_APPS' | 'SYSTEM_TOOLS' | 'CLOUD' | 'CUSTOM'>('DOMESTIC_APPS');
  const [formProvider, setFormProvider] = useState('CUSTOM');
  const [formAuthType, setFormAuthType] = useState<'API_KEY' | 'WEBHOOK_SECRET' | 'HMAC_SHA256' | 'BEARER_TOKEN' | 'NONE'>('API_KEY');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formToolId, setFormToolId] = useState('');
  const [formToolName, setFormToolName] = useState('');
  const [formToolDesc, setFormToolDesc] = useState('');
  const [formRisk, setFormRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');
  const [formSampleArgs, setFormSampleArgs] = useState('{}');

  const isAdmin = currentPrincipal?.role === 'PLATFORM_ADMIN';

  const fetchPlugins = async () => {
    try {
      const res = await fetch('/api/v1/plugins');
      const json = await res.json();
      if (json.data) {
        setPlugins(json.data);
      }
    } catch (e) {
      console.error('Error fetching plugins:', e);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/v1/plugins/presets');
      const json = await res.json();
      if (json.data) {
        setPresets(json.data);
      }
    } catch (e) {
      console.error('Error fetching presets:', e);
    }
  };

  useEffect(() => {
    fetchPlugins();
    fetchPresets();
  }, []);

  const handleApplyPreset = (preset: any) => {
    setActivePresetId(preset.id);
    setFormName(preset.name);
    setFormNameZh(preset.name_zh || preset.name);
    setFormCategory(preset.category || 'DOMESTIC_APPS');
    setFormProvider(preset.provider || 'CUSTOM');
    setFormAuthType(preset.auth_type || 'API_KEY');
    setFormEndpoint(preset.endpoint || '');
    setFormApiKey(preset.auth_type !== 'NONE' ? 'sk_live_app_token_sec_' + Math.random().toString(36).substring(2, 8) : '');
    setFormToolId(preset.tool_id);
    setFormToolName(preset.tool_name || preset.name);
    setFormToolDesc(language === 'zh' ? (preset.description_zh || preset.description) : preset.description);
    setFormRisk(preset.risk || 'LOW');
    setFormSampleArgs(JSON.stringify(preset.sample_args || {}, null, 2));
  };

  const handleOpenBlankModal = () => {
    setActivePresetId('blank');
    setFormName('Custom OpenAPI Connector');
    setFormNameZh('自定义 OpenAPI 连接器');
    setFormCategory('CUSTOM');
    setFormProvider('CUSTOM');
    setFormAuthType('API_KEY');
    setFormEndpoint('https://api.my-enterprise-gateway.com/v1');
    setFormApiKey('sk_test_mock_sec_token');
    setFormToolId('custom_service_dispatch');
    setFormToolName('Custom Service Dispatcher');
    setFormToolDesc('Direct REST API invocation proxy with zero-trust payload redaction');
    setFormRisk('LOW');
    setFormSampleArgs('{\n  "target": "order_service",\n  "payload": { "id": 1001 }\n}');
    setShowCreateModal(true);
  };

  const handleCreatePlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formToolId.trim()) return;

    setIsSubmitting(true);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(formSampleArgs);
      } catch (_) {}

      const res = await fetch('/api/v1/plugins/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          name_zh: formNameZh,
          category: formCategory,
          provider: formProvider,
          description: formToolDesc,
          description_zh: formNameZh,
          auth_type: formAuthType,
          endpoint: formEndpoint,
          api_key: formApiKey,
          tool_id: formToolId,
          tool_name: formToolName,
          tool_description: formToolDesc,
          risk: formRisk,
          sample_args: parsedArgs,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateSuccessMsg(t.pluginCreatedSuccess);
        await fetchPlugins();
        if (onRefresh) await onRefresh();
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateSuccessMsg(null);
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to create plugin:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlugin = async (pluginId: string, pluginName: string) => {
    if (!confirm(language === 'zh' ? `确认移除自定义连接器 "${pluginName}"？` : `Delete custom connector "${pluginName}"?`)) {
      return;
    }
    try {
      await fetch(`/api/v1/plugins/${pluginId}`, { method: 'DELETE' });
      await fetchPlugins();
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error('Delete plugin failed:', e);
    }
  };

  const handleTogglePlugin = async (pluginId: string) => {
    try {
      await fetch(`/api/v1/plugins/${pluginId}/toggle`, { method: 'POST' });
      await fetchPlugins();
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTool = (tItem: ToolDefinition) => {
    setSelectedToolId(tItem.id);
    setTestOutput(null);
    if (tItem.id === 'fake_calculator') {
      setTestArgsJson('{\n  "a": 128,\n  "b": 32,\n  "operation": "add"\n}');
    } else if (tItem.id === 'fake_db_query') {
      setTestArgsJson('{\n  "query_type": "list_users"\n}');
    } else if (tItem.id === 'fake_cloud_deploy') {
      setTestArgsJson('{\n  "cluster": "k8s-prod-us-east",\n  "manifest_name": "worker-pool-v2",\n  "replicas": 3\n}');
    } else if (tItem.id === 'fake_send_notification') {
      setTestArgsJson('{\n  "channel": "#alerts",\n  "message": "Cluster memory nominal"\n}');
    } else if (tItem.id === 'maps_geocode') {
      setTestArgsJson('{\n  "address": "San Francisco, CA"\n}');
    } else if (tItem.id === 'maps_places_search') {
      setTestArgsJson('{\n  "query": "Tech Data Center"\n}');
    } else if (tItem.id === 'weather_current') {
      setTestArgsJson('{\n  "city": "Shanghai",\n  "units": "metric"\n}');
    } else if (tItem.id === 'feishu_bot_notify') {
      setTestArgsJson('{\n  "title": "Agent Notification",\n  "content": "Workload scale success",\n  "message_type": "card"\n}');
    } else if (tItem.id === 'dingtalk_bot_notify') {
      setTestArgsJson('{\n  "title": "DingTalk Alert",\n  "content": "Pipeline built cleanly",\n  "is_at_all": false\n}');
    } else if (tItem.id === 'wecom_bot_notify') {
      setTestArgsJson('{\n  "content": "WeCom incident resolved"\n}');
    } else if (tItem.id === 'wechat_send_template_msg') {
      setTestArgsJson('{\n  "touser": "oUpF8uMuAJO_M2pxb1Q9zNjWeChat",\n  "template_id": "tpl_notice_8899",\n  "data": { "first": "高铁余票已锁定", "keyword1": "G1024", "keyword2": "一等座" }\n}');
    } else if (tItem.id === 'qq_bot_send_msg') {
      setTestArgsJson('{\n  "channel_id": "1099238821",\n  "content": "QQ Bot: BareMetal Node Ready",\n  "msg_type": "text"\n}');
    } else if (tItem.id === 'meituan_order_query') {
      setTestArgsJson('{\n  "order_id": "MT_20261103_889921",\n  "poi_id": "poi_shanghai_central_01",\n  "include_rider_tracking": true\n}');
    } else if (tItem.id === 'rail12306_search_tickets') {
      setTestArgsJson('{\n  "from_station": "BJP (北京)",\n  "to_station": "SHH (上海)",\n  "travel_date": "2026-11-05",\n  "train_type": "G_HIGH_SPEED"\n}');
    } else if (tItem.id === 'flight_query_status') {
      setTestArgsJson('{\n  "departure_code": "PEK",\n  "arrival_code": "SHA",\n  "flight_date": "2026-11-06",\n  "airline": "CA"\n}');
    } else if (tItem.id === 'alipay_create_trade') {
      setTestArgsJson('{\n  "out_trade_no": "ALI_TR_20261103_0019",\n  "total_amount": "128.50",\n  "subject": "Cloud Quota License"\n}');
    } else if (tItem.id === 'mcp_filesystem_read') {
      setTestArgsJson('{\n  "filepath": "config.json"\n}');
    } else {
      setTestArgsJson('{}');
    }
  };

  const handleRunTest = async () => {
    if (!tool) return;
    setIsExecuting(true);
    try {
      const parsedArgs = JSON.parse(testArgsJson);
      const res = await onTestTool(tool.id, parsedArgs);
      setTestOutput(res);
    } catch (err: any) {
      setTestOutput({ error: err.message });
    } finally {
      setIsExecuting(false);
    }
  };

  // Helper for preset icons
  const renderPresetIcon = (provider: string) => {
    switch (provider) {
      case 'WECHAT':
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'QQ':
        return <Bot className="w-3.5 h-3.5 text-blue-400" />;
      case 'MEITUAN':
        return <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />;
      case 'RAIL12306':
        return <Train className="w-3.5 h-3.5 text-cyan-400" />;
      case 'AIRLINE_FLIGHTS':
        return <Plane className="w-3.5 h-3.5 text-sky-400" />;
      case 'ALIPAY':
        return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const defaultPluginIds = [
    'google_maps_platform',
    'global_weather_service',
    'feishu_integration',
    'dingtalk_integration',
    'wecom_integration',
    'amap_integration',
  ];

  return (
    <div className="space-y-6">
      {/* Top Plugin Hub Navigation Tabs */}
      <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSubTab('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              subTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{t.tabPluginsCatalog}</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono">
              {plugins.length || 6}
            </span>
          </button>

          <button
            onClick={() => setSubTab('maps')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              subTab === 'maps'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.tabGoogleMaps}</span>
          </button>

          <button
            onClick={() => setSubTab('weather')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              subTab === 'weather'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.tabWeather}</span>
          </button>

          <button
            onClick={() => setSubTab('domestic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              subTab === 'domestic'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.tabDomesticApps}</span>
          </button>

          <button
            onClick={() => setSubTab('mcp')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
              subTab === 'mcp'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.tabMCPSandbox}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenBlankModal}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.btnCreatePlugin}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Zero-Trust Gateway Active</span>
          </div>
        </div>
      </div>

      {/* 1. Google Maps View */}
      {subTab === 'maps' && <GoogleMapsView />}

      {/* 2. Weather View */}
      {subTab === 'weather' && <WeatherPluginView />}

      {/* 3. Domestic Apps View */}
      {subTab === 'domestic' && <DomesticConnectorsView />}

      {/* 4. Plugin Catalog Overview */}
      {subTab === 'catalog' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800 px-2.5 py-0.5 rounded flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  Connector & Plugin Governance Registry
                </span>
                <span className="text-xs text-slate-500">|</span>
                <span className="text-xs text-slate-400 font-mono">Process-Isolated Plugin Router</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t.hubTitle}</h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{t.hubSubtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenBlankModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.btnCreatePlugin}</span>
              </button>

              <span className="text-xs text-slate-400 font-mono px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                {plugins.filter((p) => p.is_active).length} / {plugins.length} Active
              </span>
            </div>
          </div>

          {/* Preset Quick Actions Bar */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{t.presetTemplatesTitle}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    handleApplyPreset(preset);
                    setShowCreateModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition hover:border-indigo-500 cursor-pointer"
                >
                  {renderPresetIcon(preset.provider)}
                  <span>{language === 'zh' ? (preset.name_zh || preset.name) : preset.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Plugin Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plugins.map((plugin) => {
              const isMaps = plugin.id === 'google_maps_platform';
              const isWeather = plugin.id === 'global_weather_service';
              const isDomestic = plugin.category === 'DOMESTIC_APPS';
              const isCustom = !defaultPluginIds.includes(plugin.id);

              return (
                <div
                  key={plugin.id}
                  className={`p-5 rounded-2xl bg-slate-900 border transition flex flex-col justify-between space-y-4 shadow-sm ${
                    isCustom ? 'border-indigo-900/60 hover:border-indigo-500/80' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-indigo-400">
                          {isMaps ? (
                            <MapPin className="w-5 h-5 text-cyan-400" />
                          ) : isWeather ? (
                            <CloudSun className="w-5 h-5 text-amber-400" />
                          ) : isDomestic ? (
                            <Send className="w-5 h-5 text-blue-400" />
                          ) : (
                            renderPresetIcon(plugin.provider)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            <span>{language === 'zh' ? plugin.name_zh : plugin.name}</span>
                            {isCustom && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 text-[9px] font-mono">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">v{plugin.version} • {plugin.provider}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            plugin.is_active
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {plugin.is_active ? t.pluginActive : t.pluginDisabled}
                        </span>

                        {isCustom && (
                          <button
                            onClick={() => handleDeletePlugin(plugin.id, plugin.name)}
                            className="p-1 rounded bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition cursor-pointer"
                            title={t.btnDeletePlugin}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {language === 'zh' ? plugin.description_zh : plugin.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        Auth: {plugin.auth_type}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        Calls: {plugin.metrics.total_calls}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 text-emerald-400 border border-slate-800">
                        P95: {plugin.metrics.p95_latency_ms}ms
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        if (isMaps) setSubTab('maps');
                        else if (isWeather) setSubTab('weather');
                        else if (isDomestic) setSubTab('domestic');
                        else {
                          if (plugin.tools[0]) {
                            handleSelectTool(plugin.tools[0]);
                          }
                          setSubTab('mcp');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{language === 'zh' ? '进入调试控制台' : 'Open Console'}</span>
                    </button>

                    <button
                      onClick={() => handleTogglePlugin(plugin.id)}
                      disabled={!isAdmin}
                      title={isAdmin ? 'Toggle status' : 'PLATFORM_ADMIN only'}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1 transition cursor-pointer ${
                        plugin.is_active
                          ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400 hover:bg-rose-950 hover:border-rose-800 hover:text-rose-400'
                          : 'bg-rose-950 border border-rose-800 text-rose-400'
                      } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{plugin.is_active ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Native MCP & Tools Sandbox */}
      {subTab === 'mcp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Registered Tools List */}
          <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">
                  {t.registeredToolsTitle} ({tools.length})
                </h2>
              </div>
              {!isAdmin && (
                <span className="text-[10px] text-slate-400">
                  (Switch to Elena Rostova to toggle emergency kill-switch)
                </span>
              )}
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1">
              {tools.map((tItem) => {
                const isSelected = tItem.id === selectedToolId;
                const isHigh = tItem.risk === 'HIGH' || tItem.risk === 'CRITICAL';

                return (
                  <div
                    key={tItem.id}
                    onClick={() => handleSelectTool(tItem)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-950 border-indigo-500 shadow-md shadow-indigo-950/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{tItem.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">({tItem.id})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {tItem.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mt-2 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                            Cat: {tItem.category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                            Timeout: {tItem.timeout_ms}ms
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                            Mode: {tItem.idempotency_mode}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            isHigh
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {tItem.risk}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAdmin) onToggleTool(tItem.id);
                          }}
                          disabled={!isAdmin}
                          title={isAdmin ? 'Toggle Tool Killswitch' : 'PLATFORM_ADMIN only'}
                          className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition cursor-pointer ${
                            tItem.is_active
                              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400 hover:bg-rose-950 hover:border-rose-800 hover:text-rose-400'
                              : 'bg-rose-950 border border-rose-800 text-rose-400'
                          } ${!isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <Power className="w-3 h-3" />
                          {tItem.is_active ? 'ACTIVE' : 'DISABLED'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Test Bench */}
          <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white">{t.toolTestBenchTitle}</h2>
              <span className="text-[10px] font-mono text-cyan-400">Strict Schema Verification</span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-200">{tool?.name}</div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {t.targetPerms}: [{tool?.permissions.join(', ') || 'NONE'}]
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.jsonArgsLabel}
              </label>
              <textarea
                rows={6}
                value={testArgsJson}
                onChange={(e) => setTestArgsJson(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleRunTest}
              disabled={isExecuting || !tool?.is_active}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isExecuting ? '...' : t.btnRunToolTest}
            </button>

            {!tool?.is_active && (
              <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-[11px] text-rose-300">
                {t.disabledNotice}
              </div>
            )}

            {testOutput && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2 font-mono">
                <div className="text-slate-400 font-sans font-semibold">{t.toolOutputTitle}</div>
                <pre className="text-[11px] text-slate-300 overflow-x-auto max-h-48">
                  {JSON.stringify(testOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Plugin Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t.modalCreatePluginTitle}</h3>
                  <p className="text-xs text-slate-400">{t.btnCreatePluginDesc}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preset Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.presetTemplatesTitle}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer ${
                      activePresetId === preset.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {renderPresetIcon(preset.provider)}
                    <span>{language === 'zh' ? (preset.name_zh || preset.name) : preset.name.split(' ')[0]}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleOpenBlankModal}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer ${
                    activePresetId === 'blank'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{language === 'zh' ? '空白通用 REST' : 'Blank REST'}</span>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePlugin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldPluginName}</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. WeChat Service Account"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldPluginNameZh}</label>
                  <input
                    type="text"
                    value={formNameZh}
                    onChange={(e) => setFormNameZh(e.target.value)}
                    placeholder="例如: 微信服务号与小程序消息管理"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldCategory}</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DOMESTIC_APPS">DOMESTIC_APPS</option>
                    <option value="SYSTEM_TOOLS">SYSTEM_TOOLS</option>
                    <option value="CLOUD">CLOUD</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldProvider}</label>
                  <input
                    type="text"
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value)}
                    placeholder="WECHAT / QQ / MEITUAN / ALIPAY"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldAuthType}</label>
                  <select
                    value={formAuthType}
                    onChange={(e) => setFormAuthType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="API_KEY">API_KEY</option>
                    <option value="BEARER_TOKEN">BEARER_TOKEN</option>
                    <option value="HMAC_SHA256">HMAC_SHA256</option>
                    <option value="WEBHOOK_SECRET">WEBHOOK_SECRET</option>
                    <option value="NONE">NONE (Public)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldEndpoint}</label>
                <input
                  type="text"
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1/..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldApiKey}</label>
                <input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="sk_live_... (encrypted and stored in vault)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldToolId}</label>
                  <input
                    type="text"
                    required
                    value={formToolId}
                    onChange={(e) => setFormToolId(e.target.value)}
                    placeholder="e.g. wechat_send_template_msg"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldRiskLevel}</label>
                  <select
                    value={formRisk}
                    onChange={(e) => setFormRisk(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">LOW (Read-only / Safe)</option>
                    <option value="MEDIUM">MEDIUM (Notification / Batch)</option>
                    <option value="HIGH">HIGH (Payment / Destructive)</option>
                    <option value="CRITICAL">CRITICAL (System Kernel)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.fieldToolDesc}</label>
                <textarea
                  rows={2}
                  value={formToolDesc}
                  onChange={(e) => setFormToolDesc(e.target.value)}
                  placeholder="Explains what this tool does so the AI Agent can reason and invoke it accurately"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {language === 'zh' ? '预设测试入参 (JSON 样例)' : 'Sample Arguments (JSON)'}
                </label>
                <textarea
                  rows={3}
                  value={formSampleArgs}
                  onChange={(e) => setFormSampleArgs(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {createSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{createSuccessMsg}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? '...' : t.btnSaveAndRegister}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
