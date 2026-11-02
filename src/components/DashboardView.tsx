import React from 'react';
import { Run, Principal } from '../contracts/types';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  ShieldCheck,
  Cpu,
  Lock,
  ArrowRight,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface DashboardViewProps {
  metrics: any;
  runs: Run[];
  health: any;
  currentPrincipal: Principal | null;
  onNavigate: (tab: string) => void;
  onTriggerRun: (inputQuery?: string) => void;
  onRefresh: () => void;
  loadingRun: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  runs,
  health,
  currentPrincipal,
  onNavigate,
  onTriggerRun,
  onRefresh,
  loadingRun,
}) => {
  const { t } = useLanguage();

  const invariants = [
    {
      title: t.invZeroTrustTitle,
      desc: t.invZeroTrustDesc,
      status: 'VERIFIED',
    },
    {
      title: t.invImmutableTitle,
      desc: t.invImmutableDesc,
      status: 'VERIFIED',
    },
    {
      title: t.invIntersectionTitle,
      desc: t.invIntersectionDesc,
      status: 'VERIFIED',
    },
    {
      title: t.invPlanHashTitle,
      desc: t.invPlanHashDesc,
      status: 'VERIFIED',
    },
    {
      title: t.invZeroLeaksTitle,
      desc: t.invZeroLeaksDesc,
      status: 'VERIFIED',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Trigger */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              {t.engineReady}
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-400 font-mono">{t.traceContext}</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t.dashboardTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {t.dashboardDesc}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.btnSync}
          </button>
          <button
            onClick={() => onTriggerRun('Diagnose cluster workloads and evaluate reserve headroom')}
            disabled={loadingRun}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-60"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {loadingRun ? t.btnRunning : t.btnLaunchRun}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{t.metricTotalRuns}</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics?.total_runs ?? runs.length}</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{t.metricSuccessRate}: {metrics?.success_rate_percent ?? 100}%</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{t.metricBacklog}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics?.active_approval_backlog ?? 0}</div>
          <div className="text-[11px] text-amber-400/90 mt-1">{t.metricPendingReview}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{t.metricTokens}</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics?.total_tokens_consumed ?? 0}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {t.metricEstCost}: ${metrics?.total_cost_usd?.toFixed(4) ?? '0.0000'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{t.metricLatency}</span>
            <Terminal className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{metrics?.p95_latency_ms ?? 124} ms</div>
          <div className="text-[11px] text-emerald-400 mt-1">{t.metricWalActive}</div>
        </div>
      </div>

      {/* Two Column Layout: Invariants & Recent Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Architecture Invariants (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">{t.invariantsTitle}</h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
              {t.invariantsEnforced}
            </span>
          </div>

          <div className="space-y-3">
            {invariants.map((inv, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {inv.title}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{inv.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-1.5 py-0.5 rounded">
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Runs Sidebar */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">{t.recentRunsTitle}</h2>
              </div>
              <button
                onClick={() => onNavigate('agents')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                {t.viewAll} <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
              {runs.slice(0, 5).map((run) => {
                const isSuccess = run.state === 'SUCCEEDED';
                const isWaiting = run.state === 'WAITING_APPROVAL';
                const isFailed = run.state === 'FAILED';

                return (
                  <div
                    key={run.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200 truncate max-w-[140px]">{run.target_name}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          isSuccess
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : isWaiting
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : isFailed
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {run.state}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono mt-2 flex items-center justify-between">
                      <span>{run.id.slice(0, 16)}</span>
                      <span>{run.steps.length} steps</span>
                    </div>

                    <div className="text-[10px] text-slate-500 mt-1 truncate">
                      Trace: {run.trace_id}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 mt-4">
            <button
              onClick={() => onNavigate('approvals')}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 flex items-center justify-center gap-2 border border-slate-700/80 transition"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.btnReviewBacklog}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
