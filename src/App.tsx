import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { AgentStudioView } from './components/AgentStudioView';
import { WorkflowStudioView } from './components/WorkflowStudioView';
import { GovernanceView } from './components/GovernanceView';
import { IntegrationHubView } from './components/IntegrationHubView';
import { AuditView } from './components/AuditView';
import { DocsAndMatrixView } from './components/DocsAndMatrixView';
import { OrgMembersView } from './components/OrgMembersView';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import {
  Principal,
  TenantInfo,
  ProjectInfo,
  UserMember,
  UserRole,
  ModelConfig,
  ToolDefinition,
  AgentDefinition,
  WorkflowDefinition,
  Run,
  ApprovalRecord,
  AuditEvent,
} from './contracts/types';

function AppContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingRun, setLoadingRun] = useState<boolean>(false);

  // Core State
  const [health, setHealth] = useState<any>(null);
  const [currentPrincipal, setCurrentPrincipal] = useState<Principal | null>(null);
  const [principals, setPrincipals] = useState<Principal[]>([]);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [members, setMembers] = useState<UserMember[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [latestRun, setLatestRun] = useState<Run | null>(null);

  // Fetch all initial data from `/api/v1/*`
  const fetchAllData = async () => {
    try {
      const [
        healthRes,
        meRes,
        principalsRes,
        tenantsRes,
        projectsRes,
        membersRes,
        modelsRes,
        toolsRes,
        agentsRes,
        workflowsRes,
        runsRes,
        approvalsRes,
        auditsRes,
        metricsRes,
      ] = await Promise.all([
        fetch('/api/v1/health').then(r => r.json()).catch(() => null),
        fetch('/api/v1/principals/me').then(r => r.json()).catch(() => null),
        fetch('/api/v1/principals').then(r => r.json()).catch(() => null),
        fetch('/api/v1/tenants').then(r => r.json()).catch(() => null),
        fetch('/api/v1/projects').then(r => r.json()).catch(() => null),
        fetch('/api/v1/members').then(r => r.json()).catch(() => null),
        fetch('/api/v1/models').then(r => r.json()).catch(() => null),
        fetch('/api/v1/tools').then(r => r.json()).catch(() => null),
        fetch('/api/v1/agents').then(r => r.json()).catch(() => null),
        fetch('/api/v1/workflows').then(r => r.json()).catch(() => null),
        fetch('/api/v1/runs').then(r => r.json()).catch(() => null),
        fetch('/api/v1/approvals').then(r => r.json()).catch(() => null),
        fetch('/api/v1/audits').then(r => r.json()).catch(() => null),
        fetch('/api/v1/metrics').then(r => r.json()).catch(() => null),
      ]);

      if (healthRes) setHealth(healthRes);
      if (meRes?.data) setCurrentPrincipal(meRes.data);
      if (principalsRes?.data) setPrincipals(principalsRes.data);
      if (tenantsRes?.data) setTenants(tenantsRes.data);
      if (projectsRes?.data) setProjects(projectsRes.data);
      if (membersRes?.data) setMembers(membersRes.data);
      if (modelsRes?.data) setModels(modelsRes.data);
      if (toolsRes?.data) setTools(toolsRes.data);
      if (agentsRes?.data) setAgents(agentsRes.data);
      if (workflowsRes?.data) setWorkflows(workflowsRes.data);
      if (runsRes?.data) {
        setRuns(runsRes.data);
        if (runsRes.data.length > 0 && !latestRun) {
          setLatestRun(runsRes.data[0]);
        }
      }
      if (approvalsRes?.data) setApprovals(approvalsRes.data);
      if (auditsRes?.data) setAudits(auditsRes.data);
      if (metricsRes?.data) setMetrics(metricsRes.data);
    } catch (err) {
      console.error('Failed to sync data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Member & RBAC handlers
  const handleInviteMember = async (data: { name: string; email: string; role: UserRole; project_ids: string[] }) => {
    const res = await fetch('/api/v1/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json());

    if (res.error) {
      alert(`Invite Failed: ${res.error.message}`);
      throw new Error(res.error.message);
    }
    await fetchAllData();
  };

  const handleRevokeMember = async (userId: string) => {
    const res = await fetch(`/api/v1/members/${userId}/revoke`, {
      method: 'POST',
    }).then(r => r.json());

    if (res.error) {
      alert(`Revocation Failed: ${res.error.message}`);
      throw new Error(res.error.message);
    }
    await fetchAllData();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // 1. Switch Principal
  const handleSwitchPrincipal = async (actorId: string) => {
    try {
      const res = await fetch('/api/v1/principals/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: actorId }),
      }).then(r => r.json());

      if (res.data) {
        setCurrentPrincipal(res.data);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Update Agent Draft
  const handleUpdateAgent = async (id: string, current_draft: any) => {
    await fetch(`/api/v1/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_draft }),
    });
    fetchAllData();
  };

  // 3. Publish Agent
  const handlePublishAgent = async (id: string) => {
    const res = await fetch(`/api/v1/agents/${id}/publish`, {
      method: 'POST',
    }).then(r => r.json());

    if (res.error) {
      throw new Error(res.error.message);
    }
    await fetchAllData();
  };

  // 4. Run Agent
  const handleRunAgent = async (id: string, inputQuery: string) => {
    setLoadingRun(true);
    try {
      const res = await fetch(`/api/v1/agents/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_query: inputQuery }),
      }).then(r => r.json());

      if (res.error) {
        alert(`Run Failed: ${res.error.message}`);
        return null;
      }

      setLatestRun(res.data);
      await fetchAllData();
      return res.data;
    } finally {
      setLoadingRun(false);
    }
  };

  // 5. Create Agent
  const handleCreateAgent = async (name: string, description: string) => {
    await fetch('/api/v1/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    fetchAllData();
  };

  // 6. Validate DAG
  const handleValidateDAG = async (wfId: string) => {
    const res = await fetch(`/api/v1/workflows/${wfId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.json());
    return res.data;
  };

  // 7. Publish Workflow
  const handlePublishWorkflow = async (wfId: string) => {
    const res = await fetch(`/api/v1/workflows/${wfId}/publish`, {
      method: 'POST',
    }).then(r => r.json());

    if (res.error) {
      throw new Error(res.error.message);
    }
    fetchAllData();
  };

  // 8. Decide Approval
  const handleDecideApproval = async (id: string, decision: 'APPROVE' | 'REJECT', reason?: string) => {
    const res = await fetch(`/api/v1/approvals/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    }).then(r => r.json());

    if (res.error) {
      alert(`Approval Blocked: ${res.error.message}`);
      return;
    }
    fetchAllData();
  };

  // 9. Toggle Tool Kill Switch
  const handleToggleTool = async (id: string) => {
    const res = await fetch(`/api/v1/tools/${id}/toggle`, {
      method: 'POST',
    }).then(r => r.json());

    if (res.error) {
      alert(`Action Forbidden: ${res.error.message}`);
      return;
    }
    fetchAllData();
  };

  // 10. Test Tool in Sandbox
  const handleTestTool = async (id: string, args: Record<string, any>) => {
    const res = await fetch(`/api/v1/tools/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args }),
    }).then(r => r.json());
    return res;
  };

  // Trigger default run from Overview
  const handleTriggerQuickRun = (inputQuery?: string) => {
    if (agents.length > 0) {
      handleRunAgent(agents[0].id, inputQuery || 'Check cluster health');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header & Role Switcher */}
      <Header
        currentPrincipal={currentPrincipal}
        principals={principals}
        tenants={tenants}
        onSwitchPrincipal={handleSwitchPrincipal}
        health={health}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 font-mono text-sm">
            <span className="animate-pulse">Loading AI Agent Studio Control Plane...</span>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                metrics={metrics}
                runs={runs}
                health={health}
                currentPrincipal={currentPrincipal}
                onNavigate={setActiveTab}
                onTriggerRun={handleTriggerQuickRun}
                onRefresh={fetchAllData}
                loadingRun={loadingRun}
              />
            )}

            {activeTab === 'agents' && (
              <AgentStudioView
                agents={agents}
                tools={tools}
                models={models}
                onUpdateAgent={handleUpdateAgent}
                onPublishAgent={handlePublishAgent}
                onRunAgent={handleRunAgent}
                onCreateAgent={handleCreateAgent}
                latestRun={latestRun}
              />
            )}

            {activeTab === 'workflows' && (
              <WorkflowStudioView
                workflows={workflows}
                tools={tools}
                models={models}
                onValidateDAG={handleValidateDAG}
                onPublishWorkflow={handlePublishWorkflow}
                onTriggerRun={handleTriggerQuickRun}
              />
            )}

            {activeTab === 'approvals' && (
              <GovernanceView
                approvals={approvals}
                currentPrincipal={currentPrincipal}
                onDecideApproval={handleDecideApproval}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'tools' && (
              <IntegrationHubView
                tools={tools}
                currentPrincipal={currentPrincipal}
                onToggleTool={handleToggleTool}
                onTestTool={handleTestTool}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'audits' && <AuditView audits={audits} />}

            {activeTab === 'org' && (
              <OrgMembersView
                members={members}
                currentPrincipal={currentPrincipal}
                tenants={tenants}
                projects={projects}
                onInviteMember={handleInviteMember}
                onRevokeMember={handleRevokeMember}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'matrix' && <DocsAndMatrixView />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        {t.footerText}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
