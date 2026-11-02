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

  useEffect(() => {
    fetchPlugins();
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Top Plugin Hub Navigation Tabs */}
      <div className="border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSubTab('catalog')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
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
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
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
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
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
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
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
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              subTab === 'mcp'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.tabMCPSandbox}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Zero-Trust Grant Intersection Active</span>
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

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {plugins.filter((p) => p.is_active).length} / {plugins.length} Active
              </span>
            </div>
          </div>

          {/* Plugin Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plugins.map((plugin) => {
              const isMaps = plugin.id === 'google_maps_platform';
              const isWeather = plugin.id === 'global_weather_service';
              const isDomestic = plugin.category === 'DOMESTIC_APPS';

              return (
                <div
                  key={plugin.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-sm"
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
                            <Boxes className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">
                            {language === 'zh' ? plugin.name_zh : plugin.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">v{plugin.version} • {plugin.provider}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          plugin.is_active
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {plugin.is_active ? t.pluginActive : t.pluginDisabled}
                      </span>
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
                        else setSubTab('mcp');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Zap className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{language === 'zh' ? '进入调试控制台' : 'Open Console'}</span>
                    </button>

                    <button
                      onClick={() => handleTogglePlugin(plugin.id)}
                      disabled={!isAdmin}
                      title={isAdmin ? 'Toggle status' : 'PLATFORM_ADMIN only'}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1 transition ${
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
                          className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition ${
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
                rows={5}
                value={testArgsJson}
                onChange={(e) => setTestArgsJson(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleRunTest}
              disabled={isExecuting || !tool?.is_active}
              className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
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
    </div>
  );
};
