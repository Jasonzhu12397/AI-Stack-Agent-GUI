import React, { useState } from 'react';
import { AuditEvent } from '../contracts/types';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Terminal,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface AuditViewProps {
  audits: AuditEvent[];
}

export const AuditView: React.FC<AuditViewProps> = ({ audits }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [inspectedEvent, setInspectedEvent] = useState<AuditEvent | null>(null);

  const filteredAudits = audits.filter((ev) => {
    const matchesSearch =
      ev.trace_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.target_resource.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedEventType === 'ALL' || ev.event_type === selectedEventType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              {t.invZeroLeaksTitle}
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-400 font-mono">Trace ID Correlated</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t.auditTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {t.auditSubtitle}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-mono">{t.filterEventType}</span>
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Event Types</option>
            <option value="RUN_CREATED">RUN_CREATED</option>
            <option value="POLICY_EVALUATION">POLICY_EVALUATION</option>
            <option value="APPROVAL_DECIDED">APPROVAL_DECIDED</option>
            <option value="AGENT_PUBLISHED">AGENT_PUBLISHED</option>
            <option value="EMERGENCY_TOOL_DISABLE">EMERGENCY_TOOL_DISABLE</option>
            <option value="CONFIG_UPDATED">CONFIG_UPDATED</option>
          </select>
        </div>
      </div>

      {/* Audits Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">{t.colTimeTrace}</th>
                <th className="px-4 py-3">{t.colActor}</th>
                <th className="px-4 py-3">{t.colType}</th>
                <th className="px-4 py-3">{t.colResource}</th>
                <th className="px-4 py-3">{t.colSummary}</th>
                <th className="px-4 py-3">{t.colPayload}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
              {filteredAudits.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3">
                    <div className="text-slate-400 font-sans text-xs">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-indigo-400 text-[10px] mt-0.5">{ev.trace_id}</div>
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <div className="font-semibold text-slate-200">{ev.actor_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{ev.actor_role}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 text-[10px]">
                      {ev.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{ev.target_resource}</td>
                  <td className="px-4 py-3 font-sans text-slate-300 max-w-xs truncate">{ev.summary}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setInspectedEvent(ev)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition"
                    >
                      {t.btnViewRedacted}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Redacted Payload Modal */}
      {inspectedEvent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{t.modalTitle}</h3>
                <p className="text-[11px] font-mono text-indigo-400">{inspectedEvent.trace_id}</p>
              </div>
              <button
                onClick={() => setInspectedEvent(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                {t.btnClose}
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-slate-400">
                Action: <span className="text-slate-200">{inspectedEvent.summary}</span>
              </div>
              <div className="text-slate-400">Sanitized Ingestion Payload (No Secret Leaks):</div>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono overflow-x-auto max-h-60">
                {JSON.stringify(inspectedEvent.payload_redacted, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
