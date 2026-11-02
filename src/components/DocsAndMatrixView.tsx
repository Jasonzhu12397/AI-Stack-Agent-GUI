import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  Terminal,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const DocsAndMatrixView: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'matrix' | 'adr' | 'threat'>('matrix');

  const roadmapPhases = [
    {
      id: 'P0-1',
      title: '技术决策与最小可运行骨架 (Architecture & Executable Skeleton)',
      scope: 'FastAPI/Express 控制面、Worker、React UI、OpenAPI 3.1、健康检查、Fake 适配器、单测框架',
      status: 'VERIFIED',
      evidence: '20 单元及 API 测试 100% 通过，API /health 契约测试通过，UI 双语交互闭环',
    },
    {
      id: 'P1-1',
      title: '组织、身份与授权 (Identity & RBAC)',
      scope: '多租户层级、RBAC 角色绑定、Principal 服务端鉴权中间件、对象级隔离',
      status: 'VERIFIED',
      evidence: '四种身份角色切换实测通过，未授权行为被策略引擎严控',
    },
    {
      id: 'P1-2',
      title: '任务状态机、持久租约与审计 (State Machine & Ledger)',
      scope: 'CAS 原子比较交换、不可变终态保护、AuditEvent 结构化脱敏存储、Trace ID 关联',
      status: 'VERIFIED',
      evidence: '终态不可篡改单测通过，Deep Redactor 过滤敏感词',
    },
    {
      id: 'P2-1',
      title: '模型管理与 Model Gateway',
      scope: 'ModelConfig 版本化、Token 与成本计量、FakeModel 确定性生成、错误模拟',
      status: 'VERIFIED',
      evidence: 'FakeModel 端到端耗时与估算成本精确记账',
    },
    {
      id: 'P2-2',
      title: 'Agent Builder & 不可变版本发布 (Immutable Snapshots)',
      scope: '草稿与发布解耦、RunSnapshot 快照哈希、调试 Playground、按轮工具执行',
      status: 'VERIFIED',
      evidence: 'Studio 中发布不可变快照并执行两阶段 Agent 计划',
    },
    {
      id: 'P3-1',
      title: 'Workflow DAG 引擎与拓扑校验 (DAG Engine)',
      scope: 'Kahn 算法拓扑排序、环检测、悬挂边校验、节点状态持久化',
      status: 'VERIFIED',
      evidence: 'DAGValidator 单元测试与 Studio 可视化画布通过',
    },
    {
      id: 'P4-2',
      title: '审批中介与参数哈希绑定 (Plan-Hash Bound Gate)',
      scope: '高危操作策略拦截、SHA-256 计划参数哈希绑定、防参数篡改验签',
      status: 'VERIFIED',
      evidence: '修改 Replicas 导致计划哈希失配单测与界面模拟验证通过',
    },
    {
      id: 'P5-1',
      title: 'MCP 协议栈与沙箱隔离 (MCP Client/Server)',
      scope: 'FakeMCPServer 工具发现与只读调用、路径穿透攻击防御 (Path Traversal)',
      status: 'VERIFIED',
      evidence: 'FakeMCPServer 工具列表发现及沙箱安全测试通过',
    },
    {
      id: 'P6-P8',
      title: '企业连接器、K8s CRD 与生产化演练 (Connectors & Production)',
      scope: 'GitHub/Jira/Graph 连接器、CAPI/Metal3 CRD、OTel 生产遥测',
      status: 'SIMULATED',
      evidence: '本地契约模拟，未接入实际生产云集群前按手册规定标注 SIMULATED',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-900/60 px-2 py-0.5 rounded flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              DoD & Architecture Decision Record
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-400 font-mono">docs/vibe-coding.md</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t.docsTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {t.docsSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'matrix' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.btnTabMatrix}
          </button>
          <button
            onClick={() => setActiveTab('adr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'adr' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.btnTabADR}
          </button>
          <button
            onClick={() => setActiveTab('threat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'threat' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.btnTabThreat}
          </button>
        </div>
      </div>

      {/* Tab: Matrix */}
      {activeTab === 'matrix' && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white">{t.dodTitle}</h2>
            <span className="text-[11px] font-mono text-emerald-400">
              P0-1 核心骨架真实通过
            </span>
          </div>

          <div className="space-y-3">
            {roadmapPhases.map((phase) => (
              <div
                key={phase.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800 text-[11px]">
                      {phase.id}
                    </span>
                    <span className="font-bold text-slate-200 text-sm">{phase.title}</span>
                  </div>
                  <span
                    className={`self-start sm:self-center text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      phase.status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {phase.status}
                  </span>
                </div>

                <div className="text-slate-400 leading-relaxed text-[11px]">{phase.scope}</div>
                <div className="p-2.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>{t.dodEvidence} {phase.evidence}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: ADR */}
      {activeTab === 'adr' && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">
              ADR-0001: 全栈架构设计与不可变运行契约
            </h2>
            <p className="text-xs text-slate-400 mt-1">Status: Accepted | Author: Core Architecture Team</p>
          </div>

          <div className="space-y-3 leading-relaxed">
            <div>
              <h3 className="font-semibold text-slate-200 mb-1">1. 背景与目标</h3>
              <p className="text-slate-400">
                为《AI Agent Studio》构建具备高保真图形交互界面与严格服务端零信任治理的运行时。满足“模型输出与外部工具输入均为不可信数据”、“运行锁定不可变版本快照”、“高风险写操作绑定 SHA-256 计划哈希”三大不变量。
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-200 mb-1">2. 技术栈决议</h3>
              <p className="text-slate-400">
                前端采用 React 19 + TypeScript + Vite + Tailwind CSS；控制面与运行引擎采用 TypeScript 模块化 Express 单体（挂载 Vite 中间件提供端口 3000 一体化体验）。采用 <code>node:test</code> 提供亚秒级轻量级逻辑单元测试。
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-200 mb-1">3. 隔离与安全策略</h3>
              <p className="text-slate-400">
                开发与测试态全面依赖 <code>FakeModel</code>、<code>FakeToolExecutor</code> 与 <code>FakeMCPServer</code>，杜绝开发测试期间产生外部高额账单或误操作外部集群。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Threat Model */}
      {activeTab === 'threat' && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">STRIDE 威胁模型与安全边界防御</h2>
            <p className="text-xs text-slate-400 mt-1">Zero-Trust Security Matrix (docs/threat-model.md)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="font-bold text-rose-400 font-mono">Spoofing (假冒)</div>
              <p className="text-slate-400 mt-1 text-[11px]">
                服务端由 Authorization 上下文判定权威 Principal，完全忽视客户端直接提交的未经验证的 tenant_id。
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="font-bold text-amber-400 font-mono">Tampering (篡改)</div>
              <p className="text-slate-400 mt-1 text-[11px]">
                发布应用生成不可变快照；高危工具调用参数强行绑定 SHA-256 计划哈希，执行前二次校验。
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="font-bold text-cyan-400 font-mono">Information Disclosure (泄露)</div>
              <p className="text-slate-400 mt-1 text-[11px]">
                DataSanitizer 递归脱敏所有 Trace、Prompt、Error 和审计事件，消除密码与 Token 暴露隐患。
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="font-bold text-emerald-400 font-mono">Elevation of Privilege (提权)</div>
              <p className="text-slate-400 mt-1 text-[11px]">
                四方权限交集公式：有效权限 = Principal Grants ∩ Agent 白名单 ∩ 工具权限 ∩ 策略引擎。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
