import React, { useState } from 'react';
import { ApprovalRecord, Principal } from '../contracts/types';
import { PolicyEngine } from '../domain/policyEngine';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  UserCheck,
  RefreshCw,
  Hash,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface GovernanceViewProps {
  approvals: ApprovalRecord[];
  currentPrincipal: Principal | null;
  onDecideApproval: (id: string, decision: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>;
  onRefresh: () => void;
}

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  approvals,
  currentPrincipal,
  onDecideApproval,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [testCluster, setTestCluster] = useState('prod-us-east-1');
  const [testReplicas, setTestReplicas] = useState(4);

  const canApprove =
    currentPrincipal?.grants.includes('APPROVE_HIGH_RISK') ||
    currentPrincipal?.role === 'PLATFORM_ADMIN';

  // Live computed hash based on test inputs
  const liveCalculatedHash = PolicyEngine.computePlanHash('fake_cloud_deploy', {
    cluster: testCluster,
    manifest_name: 'ingress-controller-v3',
    replicas: Number(testReplicas),
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-amber-400 bg-amber-950/60 border border-amber-900/60 px-2 py-0.5 rounded flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              {t.invPlanHashTitle}
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-400 font-mono">{t.govGateActive}</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t.govTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {t.govSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.btnRefreshQueue}
          </button>
        </div>
      </div>

      {/* RBAC Notice if user cannot approve */}
      {!canApprove && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {t.rbacNoticeDesc
                .replace('{actor}', currentPrincipal?.actor_name || 'User')
                .replace('{role}', currentPrincipal?.role || 'NONE')}
            </span>
          </div>
        </div>
      )}

      {/* Main Approvals Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">{t.pendingQueueTitle} ({approvals.length})</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Time-of-Use Verification</span>
        </div>

        <div className="space-y-3">
          {approvals.map((appr) => {
            const isPending = appr.status === 'PENDING';
            const isApproved = appr.status === 'APPROVED';

            return (
              <div
                key={appr.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{appr.target_name}</span>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-rose-950 text-rose-400 border border-rose-800 font-semibold">
                        {appr.risk_level} RISK
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Requested by <span className="text-slate-200">{appr.requested_by}</span> for tool <code>{appr.tool_id}</code>
                    </div>
                  </div>

                  <span
                    className={`self-start sm:self-center text-[10px] font-mono px-2 py-1 rounded font-bold ${
                      isPending
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : isApproved
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    STATUS: {appr.status}
                  </span>
                </div>

                {/* Plan Hash & Arguments */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block mb-1">{t.targetArgsLabel}</span>
                    <pre className="bg-slate-950 p-2 rounded text-slate-300 overflow-x-auto">
                      {JSON.stringify(appr.args_summary, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">{t.boundHashLabel}</span>
                    <div className="p-2 rounded bg-slate-950 text-cyan-400 break-all select-all">
                      {appr.plan_hash}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-sans">
                      {t.hashExplainer}
                    </div>
                  </div>
                </div>

                {/* Decision Actions */}
                {isPending && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-slate-400">
                      Expires: {new Date(appr.expires_at).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDecideApproval(appr.id, 'REJECT', 'Rejected during security audit')}
                        disabled={!canApprove}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 font-medium transition disabled:opacity-40"
                      >
                        {t.btnReject}
                      </button>
                      <button
                        onClick={() => onDecideApproval(appr.id, 'APPROVE')}
                        disabled={!canApprove}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t.btnApprove}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Anti-Tampering Hash Verifier */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">{t.tamperTitle}</h3>
        </div>
        <p className="text-xs text-slate-400">
          {t.tamperDesc}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs text-slate-300 mb-1">{t.fieldCluster}</label>
            <input
              type="text"
              value={testCluster}
              onChange={(e) => setTestCluster(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">{t.fieldReplicas}</label>
            <input
              type="number"
              value={testReplicas}
              onChange={(e) => setTestReplicas(parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
          <div className="text-slate-400 mb-1">{t.recalculatedHash}</div>
          <div className="text-indigo-400 font-bold">{liveCalculatedHash}</div>
        </div>
      </div>
    </div>
  );
};
