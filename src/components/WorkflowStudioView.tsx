import React, { useState } from 'react';
import { WorkflowDefinition, ToolDefinition, ModelConfig } from '../contracts/types';
import {
  GitBranch,
  Play,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Terminal,
  Activity,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface WorkflowStudioViewProps {
  workflows: WorkflowDefinition[];
  tools: ToolDefinition[];
  models: ModelConfig[];
  onValidateDAG: (wfId: string) => Promise<any>;
  onPublishWorkflow: (wfId: string) => Promise<void>;
  onTriggerRun: (inputQuery?: string) => void;
}

export const WorkflowStudioView: React.FC<WorkflowStudioViewProps> = ({
  workflows,
  tools,
  models,
  onValidateDAG,
  onPublishWorkflow,
  onTriggerRun,
}) => {
  const { t } = useLanguage();
  const [selectedWfId, setSelectedWfId] = useState<string>(workflows[0]?.id || '');
  const wf = workflows.find((w) => w.id === selectedWfId) || workflows[0];

  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');

  const handleValidate = async () => {
    if (!wf) return;
    setIsValidating(true);
    try {
      const res = await onValidateDAG(wf.id);
      setValidationResult(res);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePublish = async () => {
    if (!wf) return;
    try {
      await onPublishWorkflow(wf.id);
      setPublishStatus(t.publishedNotice);
      setTimeout(() => setPublishStatus(''), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'START':
        return <Play className="w-4 h-4 text-emerald-400" />;
      case 'LLM':
        return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'TOOL':
        return <Terminal className="w-4 h-4 text-indigo-400" />;
      case 'HUMAN_APPROVAL':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case 'CONDITION':
        return <GitBranch className="w-4 h-4 text-violet-400" />;
      case 'END':
        return <CheckCircle2 className="w-4 h-4 text-rose-400" />;
      default:
        return <Layers className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-400">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-300">{t.wfTitle}</div>
            <select
              value={selectedWfId}
              onChange={(e) => {
                setSelectedWfId(e.target.value);
                setValidationResult(null);
              }}
              className="mt-0.5 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.active_version || 'Draft'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {publishStatus && (
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {publishStatus}
            </span>
          )}
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            {isValidating ? '...' : t.btnValidateDAG}
          </button>
          <button
            onClick={handlePublish}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            {t.btnPublishWf}
          </button>
        </div>
      </div>

      {/* DAG Visual Canvas Representation */}
      <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{t.wfPipelineTitle}</h3>
            <p className="text-xs text-slate-400">
              {t.wfPipelineSub}
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {wf?.current_draft.nodes.length} {t.nodesCount} / {wf?.current_draft.edges.length} {t.edgesCount}
          </span>
        </div>

        {/* Node Pipeline View */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8 overflow-x-auto">
          {wf?.current_draft.nodes.map((node, index) => {
            const isLast = index === wf.current_draft.nodes.length - 1;
            return (
              <React.Fragment key={node.id}>
                {/* Node Box */}
                <div className="flex-shrink-0 w-52 p-4 rounded-xl bg-slate-900 border border-slate-700/80 shadow-lg hover:border-indigo-500 transition relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800">
                      {getNodeIcon(node.type)}
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 font-semibold">
                      {node.type}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-white tracking-tight">{node.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">ID: {node.id}</div>

                  {node.type === 'HUMAN_APPROVAL' && (
                    <div className="mt-2 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900/60 p-1.5 rounded flex items-center gap-1 font-mono">
                      <span>Gate: SHA Plan Hash</span>
                    </div>
                  )}

                  {node.type === 'TOOL' && (
                    <div className="mt-2 text-[10px] text-indigo-300 bg-indigo-950/40 border border-indigo-900/60 p-1.5 rounded flex items-center gap-1 font-mono">
                      <span>Tool: {node.config.tool_id || 'fake_calculator'}</span>
                    </div>
                  )}
                </div>

                {/* Connector Arrow */}
                {!isLast && (
                  <div className="flex-shrink-0 text-slate-600 rotate-90 md:rotate-0 my-2 md:my-0">
                    <ArrowRight className="w-5 h-5 text-indigo-400" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Validation Output Box */}
        {validationResult && (
          <div className="mt-6 p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">{t.dagDiagnosticsTitle}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  validationResult.is_valid
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {validationResult.is_valid ? t.dagValidBadge : t.dagInvalidBadge}
              </span>
            </div>

            {validationResult.is_valid ? (
              <div className="space-y-1 text-slate-300">
                <p className="text-[11px] text-emerald-400">
                  {t.dagValidDesc}
                </p>
                <div className="text-[11px] font-mono text-slate-400 mt-2">
                  {t.topologicalLayers}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {validationResult.execution_layers?.map((layer: string[], idx: number) => (
                      <span key={idx} className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                        Layer {idx + 1}: [{layer.join(', ')}]
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-rose-400 text-[11px]">
                {validationResult.errors?.map((err: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
