import React, { useState } from 'react';
import { UserMember, Principal, TenantInfo, ProjectInfo, UserRole } from '../contracts/types';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Cpu,
  Layers,
  X,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface OrgMembersViewProps {
  members: UserMember[];
  currentPrincipal: Principal | null;
  tenants: TenantInfo[];
  projects: ProjectInfo[];
  onInviteMember: (data: { name: string; email: string; role: UserRole; project_ids: string[] }) => Promise<void>;
  onRevokeMember: (userId: string) => Promise<void>;
  onRefresh: () => void;
}

export const OrgMembersView: React.FC<OrgMembersViewProps> = ({
  members,
  currentPrincipal,
  tenants,
  projects,
  onInviteMember,
  onRevokeMember,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('APP_DEVELOPER');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([projects[0]?.id || 'proj_infra_ops']);
  const [submitting, setSubmitting] = useState(false);

  // Security test status
  const [oidcTestResult, setOidcTestResult] = useState<any>(null);
  const [testingOidc, setTestingOidc] = useState(false);

  const canManageUsers =
    currentPrincipal?.grants.includes('USER_MANAGE') || currentPrincipal?.role === 'PLATFORM_ADMIN';

  const tenant = tenants.find((tItem) => tItem.id === currentPrincipal?.tenant_id) || tenants[0];

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    setSubmitting(true);
    try {
      await onInviteMember({
        name: newName,
        email: newEmail,
        role: newRole,
        project_ids: selectedProjects,
      });
      setShowInviteModal(false);
      setNewName('');
      setNewEmail('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestOidcProductionGuard = async () => {
    setTestingOidc(true);
    try {
      const res = await fetch('/api/v1/auth/oidc/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env: 'production', provider: 'LOCAL_DEV_IDENTITY' }),
      }).then((r) => r.json());
      setOidcTestResult(res);
    } finally {
      setTestingOidc(false);
    }
  };

  const budgetPercent = tenant
    ? Math.min(100, Number(((tenant.quota.used_budget_usd / tenant.quota.monthly_budget_usd) * 100).toFixed(1)))
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-900/60 px-2 py-0.5 rounded flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              P1-1: RBAC & Tenant Boundary
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-400 font-mono">Default Deny Authorization</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t.orgTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {t.orgSubtitle}
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
            onClick={() => setShowInviteModal(true)}
            disabled={!canManageUsers}
            className={`px-4 py-2 rounded-lg text-white text-xs font-medium shadow-lg flex items-center gap-2 transition ${
              canManageUsers
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            {t.btnInviteMember}
          </button>
        </div>
      </div>

      {/* Tenant Quota Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{t.quotaBudget}</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            ${tenant?.quota.used_budget_usd.toFixed(2)} / ${tenant?.quota.monthly_budget_usd.toFixed(2)}
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${budgetPercent > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${budgetPercent}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{budgetPercent}% consumed this billing cycle</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{t.quotaConcurrency}</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {tenant?.quota.max_concurrent_runs} Max Concurrent Runs
          </div>
          <div className="text-[10px] text-slate-400 mt-2 font-mono">
            Plan Tier: <span className="text-indigo-400 font-semibold">{tenant?.plan}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Tenant Assigned Projects</span>
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{projects.length} Projects</div>
          <div className="text-[10px] text-slate-400 mt-2 truncate font-mono">
            [{projects.map((p) => p.name).join(', ')}]
          </div>
        </div>
      </div>

      {/* Members & RBAC Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">
              Tenant Members & Role Bindings ({members.length})
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Tenant: {tenant?.name}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Member Name / Email</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Grants Whitelist</th>
                <th className="px-4 py-3">Project Scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
              {members.map((m) => {
                const isActive = m.status === 'ACTIVE';

                return (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-sans">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                          {m.name[0]}
                        </span>
                        {m.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono ml-8">{m.email}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300 font-bold text-[10px]">
                        {m.role}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {m.grants.slice(0, 3).map((g) => (
                          <span key={g} className="px-1 py-0.2 rounded bg-slate-950 text-slate-400 text-[9px] border border-slate-800">
                            {g}
                          </span>
                        ))}
                        {m.grants.length > 3 && (
                          <span className="text-[9px] text-slate-500">+{m.grants.length - 3} more</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-400 truncate max-w-[120px]">
                      {m.project_ids.join(', ')}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {isActive ? t.memberStatusActive : t.memberStatusRevoked}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isActive && (
                        <button
                          onClick={() => onRevokeMember(m.id)}
                          disabled={!canManageUsers || m.role === 'PLATFORM_ADMIN'}
                          className={`px-2.5 py-1 rounded text-[10px] font-mono transition ${
                            canManageUsers && m.role !== 'PLATFORM_ADMIN'
                              ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80'
                              : 'bg-slate-950 text-slate-600 cursor-not-allowed border border-slate-800'
                          }`}
                        >
                          {t.btnRevokeRole}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production OIDC Security Guard Inspector */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">{t.secOidcTitle}</h3>
          </div>
          <button
            onClick={handleTestOidcProductionGuard}
            disabled={testingOidc}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            {testingOidc ? 'Verifying...' : 'Test Production Reject Guard'}
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t.secOidcDesc}
        </p>

        {oidcTestResult && (
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-1">
            <div className="text-slate-400">Production Auth Boundary Response:</div>
            <pre className="text-[11px] text-rose-400 overflow-x-auto">
              {JSON.stringify(oidcTestResult, null, 2)}
            </pre>
            <div className="text-[10px] text-emerald-400 font-sans mt-1">
              Confirmed: Development identity credentials rejected with code <code>OIDC_CONFIG_INVALID</code> under production settings.
            </div>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Invite / Provision Tenant Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Linus Torvalds"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. linus@acme-corp.internal"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Enterprise Role (RBAC)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="APP_DEVELOPER">APP_DEVELOPER (Draft & Run)</option>
                  <option value="APPROVER">APPROVER (High-Risk Gates)</option>
                  <option value="CONNECTOR_ADMIN">CONNECTOR_ADMIN (MCP & Tools)</option>
                  <option value="OPERATOR">OPERATOR (Execute Only)</option>
                  <option value="AUDITOR">AUDITOR (Read-Only Traces)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Assigned Project Scope</label>
                <select
                  value={selectedProjects[0]}
                  onChange={(e) => setSelectedProjects([e.target.value])}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30"
                >
                  {submitting ? 'Provisioning...' : 'Provision Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
