import React, { useState } from 'react';
import { AgentDefinition, ToolDefinition, ModelConfig, Run } from '../contracts/types';
import {
  Cpu,
  Play,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  History,
  Lock,
  Plus,
  Terminal,
  Shield,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface AgentStudioViewProps {
  agents: AgentDefinition[];
  tools: ToolDefinition[];
  models: ModelConfig[];
  onUpdateAgent: (id: string, draft: any) => Promise<void>;
  onPublishAgent: (id: string) => Promise<void>;
  onRunAgent: (id: string, inputQuery: string) => Promise<Run | null>;
  onCreateAgent: (name: string, description: string) => Promise<void>;
  latestRun: Run | null;
}

export const AgentStudioView: React.FC<AgentStudioViewProps> = ({
  agents,
  tools,
  models,
  onUpdateAgent,
  onPublishAgent,
  onRunAgent,
  onCreateAgent,
  latestRun,
}) => {
  const { t } = useLanguage();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const agent = agents.find(a => a.id === selectedAgentId) || agents[0];

  const [prompt, setPrompt] = useState(agent?.current_draft.system_prompt || '');
  const [modelId, setModelId] = useState(agent?.current_draft.model_id || 'fake_fast_model');
  const [whitelist, setWhitelist] = useState<string[]>(agent?.current_draft.tool_whitelist || []);
  const [maxSteps, setMaxSteps] = useState(agent?.current_draft.max_steps || 5);
  const [budgetLimit, setBudgetLimit] = useState(agent?.current_draft.budget_limit_usd || 1.0);

  const [inputQuery, setInputQuery] = useState(
    'Calculate memory shortfall for 16 nodes and check diagnostic database'
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveNotification, setSaveNotification] = useState('');
  const [activeRun, setActiveRun] = useState<Run | null>(latestRun);

  // Sync state if selected agent changes
  React.useEffect(() => {
    if (agent) {
      setPrompt(agent.current_draft.system_prompt);
      setModelId(agent.current_draft.model_id);
      setWhitelist(agent.current_draft.tool_whitelist);
      setMaxSteps(agent.current_draft.max_steps);
      setBudgetLimit(agent.current_draft.budget_limit_usd);
    }
  }, [selectedAgentId]);

  const toggleToolWhitelist = (toolId: string) => {
    if (whitelist.includes(toolId)) {
      setWhitelist(whitelist.filter(id => id !== toolId));
    } else {
      setWhitelist([...whitelist, toolId]);
    }
  };

  const handleSaveDraft = async () => {
    if (!agent) return;
    await onUpdateAgent(agent.id, {
      system_prompt: prompt,
      model_id: modelId,
      tool_whitelist: whitelist,
      max_steps: maxSteps,
      budget_limit_usd: budgetLimit,
    });
    setSaveNotification(t.savedNotice);
    setTimeout(() => setSaveNotification(''), 3000);
  };

  const handlePublish = async () => {
    if (!agent) return;
    setIsPublishing(true);
    try {
      await onPublishAgent(agent.id);
      setSaveNotification(t.publishedNotice);
      setTimeout(() => setSaveNotification(''), 4000);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExecute = async () => {
    if (!agent) return;
    setIsRunning(true);
    try {
      const run = await onRunAgent(agent.id, inputQuery);
      if (run) {
        setActiveRun(run);
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-300">{t.activeAgent}</div>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="mt-0.5 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.active_version || 'Draft Only'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveNotification && (
            <span className="text-xs text-emerald-400 font-mono animate-fade-in flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saveNotification}
            </span>
          )}
          <button
            onClick={handleSaveDraft}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            {t.btnSaveDraft}
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition disabled:opacity-60"
          >
            <Lock className="w-3.5 h-3.5" />
            {isPublishing ? t.btnFreezing : t.btnPublishRelease}
          </button>
        </div>
      </div>

      {/* Main Grid: Editor on Left, Playground on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Draft Configuration */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white">{t.activeAgent}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                {t.draftStatus}
              </span>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.systemPromptLabel}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                placeholder="Define role, constraints, tool invocation strategy..."
              />
            </div>

            {/* Model & Budget Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.modelProviderLabel}</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.is_fake ? 'Fake' : 'Live'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.maxStepsLabel}</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">{t.budgetLimitLabel}</label>
                <input
                  type="number"
                  step="0.1"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Tool Whitelist Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-300">
                  {t.toolWhitelistLabel}
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {whitelist.length} of {tools.length} {t.activeToolsCount}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tools.map((tItem) => {
                  const isChecked = whitelist.includes(tItem.id);
                  const isHighRisk = tItem.risk === 'HIGH' || tItem.risk === 'CRITICAL';
                  return (
                    <div
                      key={tItem.id}
                      onClick={() => toggleToolWhitelist(tItem.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                        isChecked
                          ? 'bg-indigo-950/40 border-indigo-600/60 text-white'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span className="font-medium text-slate-200 truncate">{tItem.name}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                          isHighRisk
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tItem.risk}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Immutable Release History */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <History className="w-4 h-4 text-indigo-400" />
                <span>{t.releaseHistoryTitle} ({agent?.published_versions?.length || 0})</span>
              </div>
              <span className="text-[10px] text-slate-400">{t.releaseHistorySub}</span>
            </div>

            <div className="space-y-2">
              {agent?.published_versions?.map((v) => (
                <div
                  key={v.version}
                  className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-400 font-mono">{v.version}</span>
                      <span className="text-[10px] text-slate-400">by {v.published_by}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Hash: {v.snapshot.snapshot_hash}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/50 border border-emerald-900 px-1.5 py-0.5 rounded">
                      {t.lockedBadge}
                    </span>
                  </div>
                </div>
              ))}
              {(!agent?.published_versions || agent.published_versions.length === 0) && (
                <div className="text-xs text-slate-500 italic p-2">
                  {t.noReleases}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Execution Playground & Live Trace */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">{t.playgroundTitle}</h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                {t.sandboxedBadge}
              </span>
            </div>

            {/* Input Query */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {t.testPromptLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="Ask agent to perform a task..."
                />
                <button
                  onClick={handleExecute}
                  disabled={isRunning || !agent?.published_versions?.length}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isRunning ? '...' : t.btnRun}
                </button>
              </div>
              {!agent?.published_versions?.length && (
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {t.publishRequiredMsg}
                </p>
              )}
            </div>

            {/* Live Run Result Box */}
            {activeRun && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="text-xs font-semibold text-slate-200">
                    {t.runOutputTitle}: <span className="font-mono text-indigo-400">{activeRun.id}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      activeRun.state === 'SUCCEEDED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : activeRun.state === 'WAITING_APPROVAL'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {activeRun.state}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div>Trace ID: <span className="text-slate-200">{activeRun.trace_id}</span></div>
                  <div>Tokens: <span className="text-cyan-400">{activeRun.total_tokens}</span></div>
                  <div>Cost: <span className="text-emerald-400">${activeRun.total_cost_usd?.toFixed(6)}</span></div>
                  <div>Steps: <span className="text-slate-200">{activeRun.steps?.length}</span></div>
                </div>

                {/* Steps Details */}
                <div className="space-y-2 mt-2">
                  <div className="text-[11px] font-semibold text-slate-300">{t.executionSteps}</div>
                  {activeRun.steps?.map((st, i) => (
                    <div
                      key={st.step_id || i}
                      className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                            {i + 1}
                          </span>
                          {st.step_name}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-400">{st.node_type}</span>
                      </div>

                      {st.token_usage && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Usage: {st.token_usage.total_tokens} tokens (~${st.token_usage.estimated_cost_usd.toFixed(6)})
                        </div>
                      )}

                      {st.output && (
                        <pre className="text-[10px] font-mono bg-slate-950 p-2 rounded text-slate-300 overflow-x-auto max-h-24">
                          {typeof st.output === 'string' ? st.output : JSON.stringify(st.output, null, 2)}
                        </pre>
                      )}

                      {st.policy_decision && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Policy: <span className="text-emerald-400 font-semibold">{st.policy_decision.decision}</span> ({st.policy_decision.reason})
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Final summary */}
                {activeRun.final_output && (
                  <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300">
                    <span className="font-semibold">{t.finalOutputLabel}: </span>
                    {activeRun.final_output.summary || JSON.stringify(activeRun.final_output)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
