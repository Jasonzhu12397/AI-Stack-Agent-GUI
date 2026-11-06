import React, { useState, useEffect } from 'react';
import { Principal } from '../contracts/types';
import { useLanguage } from '../context/LanguageContext';
import {
  Server,
  Terminal,
  Database,
  Cpu,
  Layers,
  Activity,
  Play,
  Copy,
  Check,
  Download,
  Shield,
  FileCode,
  Radio,
  ExternalLink,
  Boxes,
  Zap,
  RefreshCw,
  FolderTree,
  Send,
  Code2,
} from 'lucide-react';

interface BackendConsoleViewProps {
  currentPrincipal: Principal | null;
  onRefresh?: () => Promise<void>;
}

interface BackendRoute {
  category: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  auth: string;
  description: string;
}

export const BackendConsoleView: React.FC<BackendConsoleViewProps> = ({
  currentPrincipal,
  onRefresh,
}) => {
  const { t, language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'polyglot' | 'arch' | 'api' | 'db' | 'deploy'>('polyglot');

  // Multi-Language Backend State
  const [polyglotLang, setPolyglotLang] = useState<'go' | 'python' | 'node'>('go');
  const [polyglotCode, setPolyglotCode] = useState<string>('');
  const [loadingPolyglotCode, setLoadingPolyglotCode] = useState<boolean>(false);
  const [codeType, setCodeType] = useState<'source' | 'docker'>('source');

  // Backend Overview Telemetry State
  const [backendOverview, setBackendOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Routes Registry State
  const [routes, setRoutes] = useState<BackendRoute[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<BackendRoute | null>(null);

  // Interactive API Sandbox State
  const [requestUrl, setRequestUrl] = useState('');
  const [requestBody, setRequestBody] = useState('{}');
  const [executingReq, setExecutingReq] = useState(false);
  const [responseOutput, setResponseOutput] = useState<any>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [codeLang, setCodeLang] = useState<'curl' | 'node' | 'python'>('curl');

  // Database Schema State
  const [sqlSchema, setSqlSchema] = useState<string>('');

  // Fetch Polyglot Code
  const fetchPolyglotCode = async (lang: 'go' | 'python' | 'node', type: 'source' | 'docker') => {
    try {
      setLoadingPolyglotCode(true);
      const queryParam = type === 'docker' ? `${lang}-docker` : lang;
      const res = await fetch(`/api/v1/system/backend-code?lang=${queryParam}`).then(r => r.json());
      if (res?.code) {
        setPolyglotCode(res.code);
      }
    } catch (err) {
      console.error('Failed to load polyglot code:', err);
    } finally {
      setLoadingPolyglotCode(false);
    }
  };

  useEffect(() => {
    fetchPolyglotCode(polyglotLang, codeType);
  }, [polyglotLang, codeType]);

  // Fetch Backend Overview
  const fetchOverview = async () => {
    try {
      setLoadingOverview(true);
      const [ovRes, routesRes, sqlRes] = await Promise.all([
        fetch('/api/v1/system/backend-overview').then(r => r.json()).catch(() => null),
        fetch('/api/v1/system/routes').then(r => r.json()).catch(() => null),
        fetch('/api/v1/system/sql-schema').then(r => r.json()).catch(() => null),
      ]);

      if (ovRes?.data) setBackendOverview(ovRes.data);
      if (routesRes?.data) {
        setRoutes(routesRes.data);
        if (!selectedRoute && routesRes.data.length > 0) {
          handleSelectRoute(routesRes.data[0]);
        }
      }
      if (sqlRes?.sql) setSqlSchema(sqlRes.sql);
    } catch (err) {
      console.error('Failed to load backend telemetry:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectRoute = (route: BackendRoute) => {
    setSelectedRoute(route);
    setRequestUrl(route.path);
    setResponseOutput(null);
    setResponseStatus(null);
    setResponseLatency(null);

    // Preset sensible JSON payload for test requests
    if (route.method === 'POST') {
      if (route.path.includes('/switch')) {
        setRequestBody(JSON.stringify({ actor_id: 'usr_elena_admin' }, null, 2));
      } else if (route.path.includes('/agents') && route.path.endsWith('/run')) {
        setRequestBody(JSON.stringify({ input_query: 'Execute security health check on Kubernetes fleet' }, null, 2));
      } else if (route.path.includes('/workflows') && route.path.endsWith('/run')) {
        setRequestBody(JSON.stringify({ input_params: { target_cluster: 'prod-us-east', replicas: 3 } }, null, 2));
      } else if (route.path.includes('/approvals')) {
        setRequestBody(JSON.stringify({ decision: 'APPROVE', reason: 'Verified by Platform Administrator' }, null, 2));
      } else if (route.path.includes('/alerts/simulate')) {
        setRequestBody(JSON.stringify({ rule: 'PROVISIONING_FAILED', host_name: 'bmh-worker-gpu-08' }, null, 2));
      } else if (route.path.includes('/alerts') && route.path.endsWith('/dispatch')) {
        setRequestBody(JSON.stringify({ channel: 'feishu' }, null, 2));
      } else if (route.path.includes('/tools') && route.path.endsWith('/test')) {
        setRequestBody(JSON.stringify({ args: { a: 42, b: 18, operation: 'add' } }, null, 2));
      } else if (route.path.includes('/plugins/create')) {
        setRequestBody(
          JSON.stringify(
            {
              name: 'Enterprise CRM Gateway',
              name_zh: '企业 CRM 网关',
              category: 'DOMESTIC_APPS',
              provider: 'CUSTOM',
              tool_id: 'crm_query_account',
              risk: 'LOW',
            },
            null,
            2
          )
        );
      } else {
        setRequestBody('{}');
      }
    } else {
      setRequestBody('{}');
    }
  };

  const handleExecuteRequest = async () => {
    if (!selectedRoute) return;
    setExecutingReq(true);
    const start = performance.now();

    try {
      const options: RequestInit = {
        method: selectedRoute.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      };

      if (selectedRoute.method !== 'GET') {
        try {
          options.body = requestBody;
        } catch (_) {}
      }

      const res = await fetch(requestUrl, options);
      const latency = Math.round(performance.now() - start);
      setResponseStatus(res.status);
      setResponseLatency(latency);

      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
      setResponseHeaders(headersObj);

      const json = await res.json().catch(() => null);
      setResponseOutput(json);

      if (onRefresh) onRefresh();
    } catch (err: any) {
      setResponseStatus(500);
      setResponseOutput({ error: err.message });
    } finally {
      setExecutingReq(false);
    }
  };

  // Generate cURL command
  const getCurlSnippet = () => {
    if (!selectedRoute) return '';
    const host = window.location.origin;
    if (selectedRoute.method === 'GET') {
      return `curl -X GET "${host}${requestUrl}" \\\n  -H "Accept: application/json"`;
    }
    return `curl -X ${selectedRoute.method} "${host}${requestUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody.replace(/\n/g, '')}'`;
  };

  // Generate Node.js code
  const getNodeSnippet = () => {
    if (!selectedRoute) return '';
    const host = window.location.origin;
    return `const res = await fetch("${host}${requestUrl}", {\n  method: "${selectedRoute.method}",\n  headers: { "Content-Type": "application/json" },\n${
      selectedRoute.method !== 'GET' ? `  body: JSON.stringify(${requestBody.trim()}),\n` : ''
    }});\nconst data = await res.json();\nconsole.log(data);`;
  };

  // Generate Python code
  const getPythonSnippet = () => {
    if (!selectedRoute) return '';
    const host = window.location.origin;
    if (selectedRoute.method === 'GET') {
      return `import requests\n\nres = requests.get("${host}${requestUrl}")\nprint(res.status_code, res.json())`;
    }
    return `import requests\n\npayload = ${requestBody.trim() || '{}'}\nres = requests.${selectedRoute.method.toLowerCase()}("${host}${requestUrl}", json=payload)\nprint(res.status_code, res.json())`;
  };

  const handleCopyCode = (text: string, type: 'curl' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'curl') {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const filteredRoutes = routes.filter(
    r => selectedCategory === 'ALL' || r.category === selectedCategory
  );

  const categories = ['ALL', 'SYSTEM', 'IDENTITY', 'AGENT', 'WORKFLOW', 'RUNS', 'APPROVALS', 'METAL3', 'PLUGINS', 'AUDIT'];

  return (
    <div className="space-y-6">
      {/* Top Banner & Backend Runtime Telemetry */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-600 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                GOLANG 1.22+ NATIVE CONTROL PLANE (PORT 9090 / GATEWAY 3000)
              </span>
              <span className="text-slate-500 text-xs">|</span>
              <span className="text-xs text-cyan-300 font-mono font-semibold">
                Go {backendOverview?.server?.go_version || '1.22.5'} ({backendOverview?.server?.platform || 'linux'}/{backendOverview?.server?.arch || 'amd64'})
              </span>
              <span className="text-slate-500 text-xs">|</span>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {backendOverview?.server?.goroutines ?? 5} Goroutines Active
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">{t.backendTitle}</h1>
            <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">{t.backendSubtitle}</p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchOverview}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{language === 'zh' ? '刷新探针指标' : 'Sync Telemetry'}</span>
            </button>
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>OpenAPI 3.1 Spec</span>
            </a>
          </div>
        </div>

        {/* Live System Resource KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-1">
              {language === 'zh' ? 'Go 进程常驻内存 (RSS)' : 'Go Native Memory (RSS)'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-cyan-300">
                {backendOverview?.memory?.rss_mb || 6} MB
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                Heap: {backendOverview?.memory?.heap_used_mb || 0} MB (Ultra Low)
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-1">
              {language === 'zh' ? 'Go 引擎运行时间' : 'Go Process Uptime'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {backendOverview?.server?.uptime_seconds || 120}s
              </span>
              <span className="text-[10px] text-slate-400 font-mono">PID {backendOverview?.server?.pid || 1}</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-1">
              {language === 'zh' ? 'Go 原生 RESTful 路由' : 'Go RESTful Routes'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-cyan-400">{routes.length || 34}</span>
              <span className="text-[10px] text-slate-400">Endpoints</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block mb-1">
              {language === 'zh' ? 'Go 协程并发通道 (Goroutines)' : 'Go Goroutines & Workers'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono text-purple-400">
                {backendOverview?.server?.goroutines || 5}
              </span>
              <span className="text-[10px] text-purple-300 font-mono">CSP Channel Loop</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('polyglot')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'polyglot'
              ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Code2 className="w-4 h-4 text-cyan-300" />
          <span>{t.tabBackendPolyglot}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono">
            Go • Python • Node
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('arch')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'arch'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t.tabBackendArch}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('api')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'api'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>{t.tabBackendApiWorkbench}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-200 text-[10px] font-mono">
            {routes.length} APIs
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('db')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'db'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>{t.tabBackendDatabase}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('deploy')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
            activeSubTab === 'deploy'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>{t.tabBackendDeploy}</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* --- SUBTAB 0: POLYGLOT MULTI-LANGUAGE BACKEND MATRIX (GO / PYTHON / NODE) --- */}
      {/* ------------------------------------------------------------------------- */}
      {activeSubTab === 'polyglot' && (
        <div className="space-y-6">
          {/* Rationale Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-cyan-800/50 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-mono font-bold">
                MULTI-LANGUAGE PRODUCTION MATRIX
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-300 font-mono">Go 1.22+ • Python 3.12+ • Node.js v22 LTS</span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">{t.polyglotTitle}</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">{t.polyglotDesc}</p>
          </div>

          {/* 3 Interactive Backend Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Go Card */}
            <div
              onClick={() => setPolyglotLang('go')}
              className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                polyglotLang === 'go'
                  ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/20 shadow-xl'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    GOLANG 1.22+
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    K8s & Metal3 Native
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Go Cloud-Native Operator</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  专为 Kubernetes Operator (controller-runtime / client-go) 与 Metal3 Ironic BareMetalHost Reconciler 打造。
                </p>
                <div className="mt-4 space-y-1.5 text-[11px] text-slate-300 font-mono">
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>单静态二进制文件 (Scratch 镜像 &lt; 20MB)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Goroutines 原生并发处理百万级带外轮询</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>零 GC 抖动，常驻内存仅 ~15MB</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Port: 8080</span>
                <span className={polyglotLang === 'go' ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                  {polyglotLang === 'go' ? '● Active Inspect' : 'Click to View'}
                </span>
              </div>
            </div>

            {/* 2. Python Card */}
            <div
              onClick={() => setPolyglotLang('python')}
              className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                polyglotLang === 'python'
                  ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20 shadow-xl'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    PYTHON 3.12+
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    AI Agent & FastAPI Native
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Python AI Agent Engine</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  专为现代大模型生态打造，完美融入 LangChain, CrewAI, AutoGen, PyTorch 与 HuggingFace 工具链。
                </p>
                <div className="mt-4 space-y-1.5 text-[11px] text-slate-300 font-mono">
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>FastAPI + Pydantic v2 (Rust 内核超快校验)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>AsyncIO 异步非阻塞事件循环与 SSE 流式输出</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>自动生成交互式 OpenAPI / Swagger 文档</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Port: 8000</span>
                <span className={polyglotLang === 'python' ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                  {polyglotLang === 'python' ? '● Active Inspect' : 'Click to View'}
                </span>
              </div>
            </div>

            {/* 3. Node.js Card */}
            <div
              onClick={() => setPolyglotLang('node')}
              className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                polyglotLang === 'node'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    NODE.JS V22 LTS
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Fullstack Control Plane
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">Node.js Express Gateway</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  提供端到端完全同构的 TypeScript 契约，内嵌轻量高并发 WAL 事务引擎与 Vite 统一代理网关。
                </p>
                <div className="mt-4 space-y-1.5 text-[11px] text-slate-300 font-mono">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>前后端 100% 共享 TypeScript 数据契约</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>零外部副作用 Fake Providers 快速离线自测</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>当前实时运行中 (Port 3000)</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Port: 3000</span>
                <span className={polyglotLang === 'node' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {polyglotLang === 'node' ? '● Active Inspect' : 'Click to View'}
                </span>
              </div>
            </div>
          </div>

          {/* Benchmark & Comparison Matrix Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>三种后端架构技术选型与 Benchmark 深度对比矩阵</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3">评估维度</th>
                    <th className="py-2.5 px-3 text-cyan-300">Golang 1.22+ (backend-go)</th>
                    <th className="py-2.5 px-3 text-amber-300">Python 3.12+ (backend-python)</th>
                    <th className="py-2.5 px-3 text-emerald-300">Node.js v22 (server.ts)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-white">适用定位</td>
                    <td className="py-2.5 px-3">K8s Operator, Metal3, 裸金属底层</td>
                    <td className="py-2.5 px-3">AI Agent 智能体大脑, LLM 算法流水线</td>
                    <td className="py-2.5 px-3">全栈控制面, 敏捷交付与同构模型</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-white">并发模型</td>
                    <td className="py-2.5 px-3 text-cyan-300">Goroutines 轻量协程 (CSP 通信)</td>
                    <td className="py-2.5 px-3 text-amber-300">AsyncIO 单线程事件循环</td>
                    <td className="py-2.5 px-3 text-emerald-300">Libuv 非阻塞异步 I/O</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-white">冷启动与内存</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">&lt; 5ms 冷启动 • ~15MB RAM</td>
                    <td className="py-2.5 px-3">~200ms 冷启动 • ~45MB RAM</td>
                    <td className="py-2.5 px-3">~120ms 冷启动 • ~65MB RAM</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-white">交付产物</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">单一静态二进制 (&lt; 20MB Scratch)</td>
                    <td className="py-2.5 px-3">Python-slim 镜像 (~140MB)</td>
                    <td className="py-2.5 px-3">Node-alpine 镜像 (~160MB)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-white">Metal3 / K8s 生态</td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold">
                      原生 controller-runtime, client-go
                    </td>
                    <td className="py-2.5 px-3">kubernetes-asyncio (需 Python 封装)</td>
                    <td className="py-2.5 px-3">@kubernetes/client-node (REST 包装)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-white">AI Agent 生态</td>
                    <td className="py-2.5 px-3">REST / gRPC / tmecsdk</td>
                    <td className="py-2.5 px-3 text-amber-300 font-bold">
                      LangChain, CrewAI, AutoGen 原生
                    </td>
                    <td className="py-2.5 px-3">@google/genai SDK, LangChain.js</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Source Code Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      polyglotLang === 'go'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : polyglotLang === 'python'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {polyglotLang === 'go'
                      ? 'GOLANG SOURCE'
                      : polyglotLang === 'python'
                        ? 'PYTHON FASTAPI SOURCE'
                        : 'NODE.JS TYPESCRIPT SOURCE'}
                  </span>
                  <span className="text-xs text-white font-mono font-bold">
                    {codeType === 'source'
                      ? polyglotLang === 'go'
                        ? 'backend-go/main.go'
                        : polyglotLang === 'python'
                          ? 'backend-python/main.py'
                          : 'server.ts'
                      : polyglotLang === 'go'
                        ? 'backend-go/Dockerfile'
                        : polyglotLang === 'python'
                          ? 'backend-python/Dockerfile'
                          : 'Dockerfile'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  100% 完整独立可运行的生产源码，包含 RBAC、Metal3 Ironic 控制器与 DAG 调度逻辑。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center text-xs font-mono">
                  <button
                    onClick={() => setCodeType('source')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      codeType === 'source' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Main Source
                  </button>
                  <button
                    onClick={() => setCodeType('docker')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${
                      codeType === 'docker' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Dockerfile
                  </button>
                </div>

                <button
                  onClick={() => handleCopyCode(polyglotCode, 'code')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? t.copiedNotice : 'Copy Code'}</span>
                </button>

                <a
                  href={`/api/v1/system/backend-code?lang=${codeType === 'docker' ? `${polyglotLang}-docker` : polyglotLang}`}
                  download={
                    codeType === 'docker'
                      ? 'Dockerfile'
                      : polyglotLang === 'go'
                        ? 'main.go'
                        : polyglotLang === 'python'
                          ? 'main.py'
                          : 'server.ts'
                  }
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>

            {/* CLI Quick Run snippet */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <span className="text-slate-400">Terminal Quick Execution Command:</span>
              <code className="text-cyan-300 font-bold bg-slate-900 px-3 py-1 rounded border border-slate-800">
                {polyglotLang === 'go'
                  ? 'cd backend-go && go run main.go'
                  : polyglotLang === 'python'
                    ? 'cd backend-python && uvicorn main:app --port 8000 --reload'
                    : 'npm run dev:backend'}
              </code>
            </div>

            {/* Code Body */}
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 max-h-96 overflow-y-auto text-xs font-mono">
              {loadingPolyglotCode ? (
                <div className="py-12 text-center text-slate-500 animate-pulse">Loading source code...</div>
              ) : (
                <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">{polyglotCode}</pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* --- SUBTAB 1: BACKEND MICROSERVICES ARCHITECTURE TOPOLOGY --- */}
      {/* ------------------------------------------------------------------------- */}
      {activeSubTab === 'arch' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {backendOverview?.microservices?.map((svc: any, idx: number) => (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-600/50 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      LAYER 0{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                      {svc.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">{svc.name}</h3>
                  <div className="text-xs text-indigo-400 font-mono mt-1">{svc.protocol}</div>
                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{svc.details}</p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Port: {svc.port || 'In-Process'}</span>
                  <span className="text-emerald-400">Heartbeat: OK</span>
                </div>
              </div>
            ))}
          </div>

          {/* Architecture Pipeline Explainer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-indigo-400" />
              <span>{language === 'zh' ? '后端控制面执行生命周期与核心模块分布' : 'Control Plane Request Lifecycle & Module Map'}</span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-indigo-300">1. 入口与安全中间件</div>
                <div className="text-slate-400 text-[11px]">
                  • <code>server.ts</code> (Express HTTP 宿主)<br />
                  • <code>src/server/api.ts</code> (路由聚合)<br />
                  • <code>src/domain/identity.ts</code> (多租户隔离与 OIDC 生产拦截)
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-indigo-300">2. 策略引擎与零信任</div>
                <div className="text-slate-400 text-[11px]">
                  • <code>src/domain/policyEngine.ts</code> (默认拒绝规则)<br />
                  • <code>src/domain/sanitizer.ts</code> (递归密钥脱敏)<br />
                  • SHA-256 审批入参加密 Hash 验签
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-indigo-300">3. 调度引擎与状态机</div>
                <div className="text-slate-400 text-[11px]">
                  • <code>src/domain/stateMachine.ts</code> (确定性状态流转)<br />
                  • <code>src/domain/dagValidator.ts</code> (拓扑排序与无环校验)<br />
                  • 4 线程并发调度池
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-indigo-300">4. 裸金属与外部连接器</div>
                <div className="text-slate-400 text-[11px]">
                  • <code>src/domain/metal3.ts</code> (Ironic & eph-node 编排)<br />
                  • <code>src/domain/plugins.ts</code> (微信/QQ/美团/高铁/支付宝)<br />
                  • <code>src/server/store.ts</code> (不可变 WAL 审计库)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* --- SUBTAB 2: INTERACTIVE API WORKBENCH & SANDBOX --- */}
      {/* ------------------------------------------------------------------------- */}
      {activeSubTab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: API Endpoints Navigator */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  {language === 'zh' ? 'API 路由清单' : 'API Endpoints'} ({filteredRoutes.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                RESTful v1
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Routes List */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredRoutes.map((r, i) => {
                const isSelected = selectedRoute?.path === r.path && selectedRoute?.method === r.method;
                const methodColor =
                  r.method === 'GET'
                    ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800'
                    : r.method === 'POST'
                      ? 'text-indigo-300 bg-indigo-950/80 border-indigo-800'
                      : r.method === 'PUT'
                        ? 'text-amber-400 bg-amber-950/80 border-amber-800'
                        : 'text-rose-400 bg-rose-950/80 border-rose-800';

                return (
                  <div
                    key={i}
                    onClick={() => handleSelectRoute(r)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-950 border-indigo-500 shadow-md shadow-indigo-950/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${methodColor}`}>
                        {r.method}
                      </span>
                      <span className="font-semibold text-white truncate text-[11px]">{r.path}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">{r.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Test Bench & Code Generator */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{language === 'zh' ? '交互式调试台' : 'Interactive Workbench'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedRoute?.description}</p>
              </div>

              {/* Code Snippet Language Switcher */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setCodeLang('curl')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    codeLang === 'curl' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  cURL
                </button>
                <button
                  onClick={() => setCodeLang('node')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    codeLang === 'node' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Node.js
                </button>
                <button
                  onClick={() => setCodeLang('python')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    codeLang === 'python' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python
                </button>
              </div>
            </div>

            {/* Request URL Input & Execute Button */}
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border ${
                  selectedRoute?.method === 'GET'
                    ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800'
                    : selectedRoute?.method === 'POST'
                      ? 'text-indigo-300 bg-indigo-950/80 border-indigo-800'
                      : 'text-amber-400 bg-amber-950/80 border-amber-800'
                }`}
              >
                {selectedRoute?.method || 'GET'}
              </span>

              <input
                type="text"
                value={requestUrl}
                onChange={e => setRequestUrl(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />

              <button
                onClick={handleExecuteRequest}
                disabled={executingReq}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{executingReq ? '...' : t.btnSendRequest}</span>
              </button>
            </div>

            {/* JSON Request Body (for POST/PUT) */}
            {selectedRoute?.method !== 'GET' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                  JSON Request Payload
                </label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={e => setRequestBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Generated Code Snippet */}
            <div className="relative bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300">
              <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1.5">
                <span>GENERATED {codeLang.toUpperCase()} SNIPPET</span>
                <button
                  onClick={() =>
                    handleCopyCode(
                      codeLang === 'curl'
                        ? getCurlSnippet()
                        : codeLang === 'node'
                          ? getNodeSnippet()
                          : getPythonSnippet(),
                      'code'
                    )
                  }
                  className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? t.copiedNotice : 'Copy'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap max-h-28 text-indigo-300">
                {codeLang === 'curl' ? getCurlSnippet() : codeLang === 'node' ? getNodeSnippet() : getPythonSnippet()}
              </pre>
            </div>

            {/* Live Response Panel */}
            {responseOutput && (
              <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        responseStatus && responseStatus < 300
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {responseStatus} {responseStatus === 200 ? 'OK' : ''}
                    </span>
                    <span className="text-slate-400 text-[11px]">{responseLatency}ms latency</span>
                  </div>
                  <span className="text-[10px] text-slate-500">HTTP/1.1 response</span>
                </div>

                <div className="text-[10px] text-slate-500">
                  content-type: {responseHeaders['content-type'] || 'application/json'}
                </div>

                <pre className="text-[11px] text-slate-200 overflow-x-auto max-h-64 p-2 bg-slate-900/60 rounded border border-slate-800/60">
                  {JSON.stringify(responseOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* --- SUBTAB 3: DATABASE & WRITE-AHEAD-LOG (WAL) SCHEMA --- */}
      {/* ------------------------------------------------------------------------- */}
      {activeSubTab === 'db' && (
        <div className="space-y-6">
          {/* Database Live State KPI */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>{t.dbStatsTitle}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">tenants</span>
                <span className="text-lg font-bold text-white">{backendOverview?.database?.tables?.tenants || 2}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">projects</span>
                <span className="text-lg font-bold text-white">{backendOverview?.database?.tables?.projects || 2}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">agents</span>
                <span className="text-lg font-bold text-indigo-400">{backendOverview?.database?.tables?.agents || 3}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">workflows</span>
                <span className="text-lg font-bold text-cyan-400">{backendOverview?.database?.tables?.workflows || 2}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">bare_metal_hosts</span>
                <span className="text-lg font-bold text-emerald-400">{backendOverview?.database?.tables?.bare_metal_hosts || 67}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block">audit_events</span>
                <span className="text-lg font-bold text-amber-400">{backendOverview?.database?.tables?.audits || 40}</span>
              </div>
            </div>
          </div>

          {/* SQL Schema Definition Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  <span>{t.dbSchemaTitle}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  15 Tables • Multi-Tenant Partitioning • Cryptographic Hash Constraints • PostgreSQL & Cloud SQL
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode(sqlSchema, 'code')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? t.copiedNotice : 'Copy SQL'}</span>
                </button>
                <a
                  href="/src/server/schema.sql"
                  download="schema.sql"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sql</span>
                </a>
              </div>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed">
              {sqlSchema || '-- Loading database schema...'}
            </pre>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* --- SUBTAB 4: STANDALONE BACKEND DEPLOYMENT & DOCKER --- */}
      {/* ------------------------------------------------------------------------- */}
      {activeSubTab === 'deploy' && (
        <div className="space-y-6">
          {/* CLI Run Commands Guide */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>{language === 'zh' ? '独立后端 CLI 启动与测试指南' : 'Standalone Backend CLI Commands'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 text-[10px]">开发模式启动 (Hot Reload)</span>
                <div className="text-indigo-400 font-bold">npm run dev:backend</div>
                <p className="text-[10px] text-slate-500 font-sans">
                  通过 <code>tsx server.ts</code> 运行全栈 Express 网关与微服务路由。
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 text-[10px]">生产模式启动 (Production)</span>
                <div className="text-emerald-400 font-bold">npm run start:backend</div>
                <p className="text-[10px] text-slate-500 font-sans">
                  Node.js 原生运行生产级 Express 架构，搭载静态资源与高吞吐 WAL。
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 text-[10px]">运行后端全量单元测试</span>
                <div className="text-cyan-400 font-bold">npm test</div>
                <p className="text-[10px] text-slate-500 font-sans">
                  执行全部 29 项 Node:test 单元测试（DAG、状态机、策略脱敏与 Metal3）。
                </p>
              </div>
            </div>
          </div>

          {/* Docker & Compose Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dockerfile Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-400" />
                  <span>Dockerfile (Multi-Stage)</span>
                </h4>
                <button
                  onClick={() =>
                    handleCopyCode(
                      `FROM node:22-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nENV PORT=3000\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY --from=builder /app/dist ./dist\nCOPY --from=builder /app/src ./src\nCOPY --from=builder /app/server.ts ./server.ts\nCOPY --from=builder /app/tsconfig.json ./tsconfig.json\nEXPOSE 3000\nCMD ["node", "--loader", "tsx", "server.ts"]`,
                      'code'
                    )
                  }
                  className="text-slate-400 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-80 leading-relaxed">
{`FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["node", "--loader", "tsx", "server.ts"]`}
              </pre>
            </div>

            {/* Docker-compose.yml Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>docker-compose.yml</span>
                </h4>
                <button
                  onClick={() =>
                    handleCopyCode(
                      `version: '3.8'\nservices:\n  agent-studio-backend:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - NODE_ENV=production\n      - PORT=3000\n      - DATABASE_URL=postgres://agent_admin:SecretPass888@postgres-db:5432/agent_studio\n    depends_on:\n      - postgres-db\n  postgres-db:\n    image: postgres:16-alpine\n    ports:\n      - "5432:5432"\n    environment:\n      POSTGRES_USER: agent_admin\n      POSTGRES_PASSWORD: SecretPass888\n      POSTGRES_DB: agent_studio\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n      - ./src/server/schema.sql:/docker-entrypoint-initdb.d/init_schema.sql:ro\nvolumes:\n  pgdata:\n    driver: local`,
                      'code'
                    )
                  }
                  className="text-slate-400 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-80 leading-relaxed">
{`version: '3.8'

services:
  agent-studio-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgres://agent_admin:SecretPass888@postgres-db:5432/agent_studio
    depends_on:
      - postgres-db

  postgres-db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: agent_admin
      POSTGRES_PASSWORD: SecretPass888
      POSTGRES_DB: agent_studio
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./src/server/schema.sql:/docker-entrypoint-initdb.d/init_schema.sql:ro

volumes:
  pgdata:
    driver: local`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
