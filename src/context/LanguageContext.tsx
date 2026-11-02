import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'zh' | 'en';

export const translations = {
  zh: {
    // Header
    platformTitle: 'AI AGENT STUDIO',
    platformSubtitle: '零信任智能体与工作流控制面',
    statusHealthy: '运行正常',
    policyVersion: '策略 v1.4.0',
    tenantLabel: '当前租户',
    switchPrincipalTitle: '切换执行主体 (RBAC 权限测试)',
    switchPrincipalDesc: '实时测试不同企业角色的策略决策与审批权限',
    roleLabel: '角色',
    grantsLabel: '权限清单',

    // Nav Tabs
    tabOverview: '总览看板',
    tabAgentStudio: '智能体编排',
    tabWorkflowDAG: '工作流 DAG',
    tabGovernance: '治理与审批',
    tabOrgMembers: '组织与权限',
    tabIntegrationHub: '插件中心 & 连接器',
    tabAuditTrail: '审计追踪',
    tabMatrix: 'ADR 与验证矩阵',

    // Organization & Members
    orgTitle: '企业组织架构、成员管理与 RBAC 授权',
    orgSubtitle: '基于对象级默认拒绝策略的租户隔离、角色绑定与配额治理。开发态身份在生产配置下强制阻断。',
    btnInviteMember: '邀请新成员',
    btnRevokeRole: '撤销授权',
    memberStatusActive: '正常生效',
    memberStatusRevoked: '权限已撤销',
    quotaBudget: '月度配额预算',
    quotaConcurrency: '最大并发运行限制',
    secOidcTitle: 'OIDC 生产安全守卫验证 (Production Guard)',
    secOidcDesc: '已验证：开发态本地身份适配器（LOCAL_DEV_IDENTITY）在生产环境（NODE_ENV=production）下将强制拒绝启动并阻断一切认证。',

    // Dashboard
    engineReady: '执行引擎就绪',
    traceContext: 'Trace ID 上下文: 严格 UTC',
    dashboardTitle: 'AI Agent Studio 控制面',
    dashboardDesc:
      '面向企业自治智能体与工作流 DAG 的零信任管控中枢。采用确定性 Fake Providers (FakeModel, FakeTool, FakeMCPServer) 进行仿真隔离，杜绝外部账单与越权写操作风险。',
    btnSync: '同步状态',
    btnLaunchRun: '触发智能体执行',
    btnRunning: '执行中...',

    metricTotalRuns: '总执行次数',
    metricSuccessRate: '成功率',
    metricBacklog: '待办审批队列',
    metricPendingReview: '需人工安全审核',
    metricTokens: 'Token 消耗总量',
    metricEstCost: '预估费用',
    metricLatency: 'P95 引擎延迟',
    metricWalActive: '内存 CAS 预写日志运行中',

    invariantsTitle: '不可违背的工程不变量',
    invariantsEnforced: '5/5 全部强制执行',
    recentRunsTitle: '最近执行流',
    viewAll: '查看全部',
    btnReviewBacklog: '审查待办审批',

    // Invariants list
    invZeroTrustTitle: '零信任数据边界',
    invZeroTrustDesc: '所有 LLM 输出、检索文本和工具返回值均视为不可信数据；代码策略严格判定。',
    invImmutableTitle: '不可变版本快照',
    invImmutableDesc: 'Draft 可编辑；Published 为带有 SHA-256 哈希的不可变快照，锁定版本与策略。',
    invIntersectionTitle: '四方权限交集公式',
    invIntersectionDesc: '有效权限 = 主体权限 ∩ Agent 白名单 ∩ 工具权限 ∩ 活跃策略。严防自动提权。',
    invPlanHashTitle: '计划哈希绑定审批',
    invPlanHashDesc: '高危写操作强制绑定参数 SHA-256 哈希，任何参数篡改立即导致审批作废。',
    invZeroLeaksTitle: '零凭据泄露保障',
    invZeroLeaksDesc: '凭据只存引用，日志、Trace、Prompt 和审计事件均通过递归脱敏器过滤。',

    // Agent Studio
    activeAgent: '当前自治智能体',
    draftStatus: '可编辑草稿',
    btnSaveDraft: '保存草稿',
    btnPublishRelease: '发布不可变版本',
    btnFreezing: '生成快照中...',
    savedNotice: '草稿保存成功',
    publishedNotice: '已生成不可变快照与版本哈希！',

    systemPromptLabel: '系统提示词与推理引导 (System Prompt)',
    modelProviderLabel: '模型供应商',
    maxStepsLabel: '最大执行步数',
    budgetLimitLabel: '单次预算上限 ($)',
    toolWhitelistLabel: '工具调用白名单 (仅白名单内工具允许被调用)',
    activeToolsCount: '项已激活',

    releaseHistoryTitle: '不可变版本发布记录',
    releaseHistorySub: '固定快照不变量',
    noReleases: '暂无已发布的不可变版本。点击“发布不可变版本”冻结配置。',
    lockedBadge: '已锁定快照',

    playgroundTitle: '实时执行沙箱 (Playground)',
    sandboxedBadge: '沙箱隔离',
    testPromptLabel: '测试任务意图 / 用户输入',
    btnRun: '运行',
    publishRequiredMsg: '执行前必须先发布不可变版本 (版本固定不变量要求)。',
    runOutputTitle: '执行结果与分步 Trace',
    executionSteps: '执行步骤流',
    stepPlan: '规划步骤',
    stepTool: '工具执行',
    finalOutputLabel: '最终产出结果',

    // Workflow DAG
    wfTitle: '工作流 DAG 编排',
    btnValidateDAG: '校验 Kahn DAG 拓扑',
    btnPublishWf: '发布工作流快照',
    wfPipelineTitle: '可视化 DAG 执行流水线',
    wfPipelineSub: '确定性节点推进、拓扑依赖求解与人工审批门禁',
    nodesCount: '个节点',
    edgesCount: '条依赖边',
    dagDiagnosticsTitle: 'Kahn DAG 拓扑校验诊断结果',
    dagValidBadge: 'DAG 拓扑合法 - 无环依赖',
    dagInvalidBadge: '检测到环或悬挂依赖',
    dagValidDesc: '图结构满足有向无环图 (DAG) 约束。无递归死循环、无悬挂引用边、具备明确单一入口。',
    topologicalLayers: '拓扑执行分层 (Execution Layers):',

    // Governance & Approvals
    govTitle: '治理、合规与高危操作审批门禁',
    govSubtitle: '高危操作 (HIGH / CRITICAL) 在产生真实副作用前必须暂停。审批强绑定入参计划哈希。',
    govGateActive: 'SecOps 安全拦截生效中',
    btnRefreshQueue: '刷新审批队列',
    rbacNotice: '当前主体权限受限',
    rbacNoticeDesc: '当前执行者为 {actor}（角色: {role}），缺少 APPROVE_HIGH_RISK 授权。请在右上角切换至 Marcus Vance 或 Elena Rostova 进行合规授权。',
    pendingQueueTitle: '待审核审批队列',
    targetArgsLabel: '目标调用参数 (Arguments):',
    boundHashLabel: '绑定的 SHA-256 计划哈希 (Plan Hash):',
    hashExplainer: '任何针对命名空间、副本数或指令的微小变动均会更改此哈希，导致执行校验失败。',
    btnReject: '拒绝并阻断运行',
    btnApprove: '批准并执行变更',
    tamperTitle: '交互式参数篡改拦截模拟 (Anti-Tampering Sandbox)',
    tamperDesc: '修改下方目标参数字段，观察加密计划哈希如何即时重算。若审批后参数被篡改，哈希比对失配，系统拒绝执行。',
    fieldCluster: '目标集群命名空间',
    fieldReplicas: '请求副本数 (尝试将 4 修改为 99)',
    recalculatedHash: '重算后的计划哈希 (Recalculated Plan Hash):',

    // Integration Hub
    hubTitle: '集成中心、连接器与 MCP 沙箱',
    hubSubtitle: '原生插件与模型上下文协议 (MCP) 受控执行边界。SSRF 防御、速率限制与紧急安全熔断。',
    registeredToolsTitle: '已注册工具与 MCP 暴露端点',
    toolTestBenchTitle: '工具沙箱运行测试台',
    targetPerms: '所需权限',
    jsonArgsLabel: 'JSON 调试参数 (Input Payload)',
    btnRunToolTest: '在隔离沙箱中执行测试',
    disabledNotice: '此工具已被平台管理员紧急禁用。任何调用均将被策略引擎拒绝 (DENY)。',
    toolOutputTitle: '执行结果与策略决策:',

    // Integration Hub & Plugins Tabs
    tabPluginsCatalog: '插件概览与配置',
    tabGoogleMaps: 'Google 地图地理计算',
    tabWeather: '全球气象与 AQI',
    tabDomesticApps: '国内企业协同 (飞书/钉钉/企微)',
    tabMCPSandbox: '原生工具 & MCP 沙箱',

    // Google Maps Platform
    mapsTitle: 'Google Maps Platform 空间地理服务',
    mapsSubtitle: '实时高精地图交互、位置地理编码、POI 检索与路径规划',
    mapsSearchPlaceholder: '输入城市或地标 (例如: Tokyo, New York, San Francisco, Beijing)...',
    mapsCoordinates: '当前中心坐标',
    mapsDemoKeyActive: 'Google Maps Demo 密钥生效中',
    mapsQuotaWarning: '提示: Google Maps Demo 密钥具有每日配额。如遇配额用尽，请在 Google Cloud Console 中绑定独立项目。',
    mapsLocBeijing: '北京',
    mapsLocShanghai: '上海',
    mapsLocTokyo: '东京',
    mapsLocNewYork: '纽约',
    mapsLocSanFrancisco: '旧金山',
    mapsLocLondon: '伦敦',

    // Weather
    weatherTitle: '全球气象感知与智能分析',
    weatherSubtitle: '实时温度、风力、湿度、空气质量指数 (AQI) 及未来 5 天趋势',
    weatherSearchPlaceholder: '搜索城市 (如: Beijing, Shanghai, Tokyo, New York, London)...',
    weatherCurrentTemp: '当前气温',
    weatherCondition: '气象状况',
    weatherHumidity: '相对湿度',
    weatherWind: '风力风向',
    weatherAqi: '空气质量 AQI',
    weatherForecast5Day: '未来 5 天气象预测',
    weatherAgentJsonPreview: '智能体工具调用返回载荷 (Agent Invocation Payload)',

    // Domestic Apps
    domesticTitle: '国内企业级应用连接器',
    domesticSubtitle: '飞书 (Feishu/Lark)、钉钉 (DingTalk)、企业微信 (WeCom) 群机器人与消息调度',
    domesticPlatformFeishu: '飞书 (Feishu / Lark)',
    domesticPlatformDingtalk: '钉钉 (DingTalk)',
    domesticPlatformWecom: '企业微信 (WeCom)',
    domesticPlatformAmap: '高德地图 (Amap)',
    domesticWebhookUrl: 'Webhook 机器人地址',
    domesticSecret: '安全签名密钥 (Secret)',
    domesticMsgType: '消息类型',
    domesticMsgTitle: '消息标题',
    domesticMsgContent: '消息正文 (支持 Markdown / 富文本)',
    btnSendDispatch: '发送测试消息并验签',
    domesticDispatchResult: '推送响应与脱敏验签日志',
    pluginActive: '已启用',
    pluginDisabled: '已禁用',
    btnTogglePlugin: '切换插件状态',

    // Audit Trail
    auditTitle: '安全合规与运行审计轨迹',
    auditSubtitle: '全流程不可篡改的只读日志。关联 Trace ID，深度执行递归脱敏，杜绝密码凭据留存。',
    searchPlaceholder: '搜索 Trace ID、操作人、目标资源...',
    filterEventType: '事件类型:',
    colTimeTrace: '时间戳 / Trace ID',
    colActor: '操作主体与角色',
    colType: '事件类别',
    colResource: '目标资源',
    colSummary: '操作概要',
    colPayload: '脱敏载荷',
    btnViewRedacted: '查看脱敏明细',
    modalTitle: '审计事件脱敏载荷',
    btnClose: '关闭',

    // ADR & Matrix
    docsTitle: 'Vibe Coding 规范、验证矩阵与 ADR',
    docsSubtitle: '严格遵循《AI Agent Studio 开发文档与系统架构设计 V1.0》与《完整 Vibe Coding 执行手册 V2.0》。',
    btnTabMatrix: 'DoD 验证矩阵',
    btnTabADR: 'ADR-0001 决策记录',
    btnTabThreat: 'STRIDE 威胁模型',
    dodTitle: '交付验收检查清单 (Definition of Done)',
    dodEvidence: '实测证据:',

    // Footer
    footerText: 'AI AGENT STUDIO V2.0 • 严格遵循 docs/vibe-coding.md (P0-P8 执行路线) • 零外部副作用模式',
  },

  en: {
    // Header
    platformTitle: 'AI AGENT STUDIO',
    platformSubtitle: 'Zero-Trust Agent & Workflow Control Plane',
    statusHealthy: 'HEALTHY',
    policyVersion: 'Policy v1.4.0',
    tenantLabel: 'Tenant',
    switchPrincipalTitle: 'Switch Principal (RBAC Authorization Test)',
    switchPrincipalDesc: 'Test policy decisions and approval rights across enterprise roles',
    roleLabel: 'Role',
    grantsLabel: 'Grants',

    // Nav Tabs
    tabOverview: 'Overview',
    tabAgentStudio: 'Agent Studio',
    tabWorkflowDAG: 'Workflow DAG',
    tabGovernance: 'Governance & Approvals',
    tabOrgMembers: 'Org & Members',
    tabIntegrationHub: 'Plugins & Connectors',
    tabAuditTrail: 'Audit Trail',
    tabMatrix: 'ADR & Verification',

    // Organization & Members
    orgTitle: 'Organization Architecture, Members & RBAC',
    orgSubtitle: 'Default-deny object authorization, role bindings, grants, and tenant quota governance. Local dev identity blocked in production.',
    btnInviteMember: 'Invite Member',
    btnRevokeRole: 'Revoke Role',
    memberStatusActive: 'ACTIVE',
    memberStatusRevoked: 'REVOKED',
    quotaBudget: 'Monthly Budget Quota',
    quotaConcurrency: 'Max Concurrency Limit',
    secOidcTitle: 'OIDC Production Security Guard',
    secOidcDesc: 'Verified: Local dev identity adapter is strictly forbidden under production configuration (NODE_ENV=production).',

    // Dashboard
    engineReady: 'Execution Engine Ready',
    traceContext: 'Trace ID Context: Strict UTC',
    dashboardTitle: 'AI Agent Studio Control Plane',
    dashboardDesc:
      'Governed orchestrator for autonomous agents and workflow DAGs. Configured with deterministic Fake Providers (FakeModel, FakeTool, FakeMCPServer) ensuring zero external billing risks during development.',
    btnSync: 'Sync',
    btnLaunchRun: 'Launch Agent Run',
    btnRunning: 'Executing Run...',

    metricTotalRuns: 'Total Executions',
    metricSuccessRate: 'Success Rate',
    metricBacklog: 'Approval Backlog',
    metricPendingReview: 'Pending Human Review',
    metricTokens: 'Tokens Consumed',
    metricEstCost: 'Est. Cost',
    metricLatency: 'P95 Engine Latency',
    metricWalActive: 'In-Memory CAS WAL Active',

    invariantsTitle: 'Non-Violable Architectural Invariants',
    invariantsEnforced: '5/5 ENFORCED',
    recentRunsTitle: 'Recent Execution Runs',
    viewAll: 'View all',
    btnReviewBacklog: 'Review Approval Backlog',

    // Invariants list
    invZeroTrustTitle: 'Zero-Trust Data Boundary',
    invZeroTrustDesc: 'All LLM outputs, retrieved text, and tool responses treated as untrusted; code policy strictly governs.',
    invImmutableTitle: 'Immutable Release Snapshots',
    invImmutableDesc: 'Draft is mutable; Published is immutable. Runs fix Agent, tool, model, and policy versions with SHA-256 hash.',
    invIntersectionTitle: 'Four-Way Permission Intersection',
    invIntersectionDesc: 'Tool grants = Principal Grants ∩ Agent Whitelist ∩ Tool Permissions ∩ Active Policy. No automatic escalation.',
    invPlanHashTitle: 'Plan-Hash Bound Approvals',
    invPlanHashDesc: 'High-risk operations require SHA-256 plan hash binding. Parameter alterations instantly invalidate approval.',
    invZeroLeaksTitle: 'Zero Secret Leaks',
    invZeroLeaksDesc: 'Credentials never stored in plain text. Logs, traces, prompts, and audit events pass through deep sanitizer.',

    // Agent Studio
    activeAgent: 'Active Autonomous Agent',
    draftStatus: 'EDITABLE DRAFT',
    btnSaveDraft: 'Save Draft',
    btnPublishRelease: 'Publish Release',
    btnFreezing: 'Freezing Snapshot...',
    savedNotice: 'Draft saved successfully',
    publishedNotice: 'Immutable version published with snapshot hash!',

    systemPromptLabel: 'System Instructions & Reasoning Guidance',
    modelProviderLabel: 'Model Provider',
    maxStepsLabel: 'Max Plan Steps',
    budgetLimitLabel: 'Budget Limit ($)',
    toolWhitelistLabel: 'Tool Whitelist (Only whitelisted tools can be called)',
    activeToolsCount: 'active',

    releaseHistoryTitle: 'Immutable Version Releases',
    releaseHistorySub: 'Fixed Snapshot Invariant',
    noReleases: 'No releases published yet. Click "Publish Release" to freeze this configuration into an immutable snapshot.',
    lockedBadge: 'LOCKED',

    playgroundTitle: 'Execution Playground',
    sandboxedBadge: 'SANDBOXED',
    testPromptLabel: 'Test User Prompt / Task Intent',
    btnRun: 'Run',
    publishRequiredMsg: 'Agent must be published before execution (immutable release requirement).',
    runOutputTitle: 'Run Output & Step Trace',
    executionSteps: 'Execution Steps:',
    stepPlan: 'Formulate Execution Plan',
    stepTool: 'Tool Execution',
    finalOutputLabel: 'Final Output',

    // Workflow DAG
    wfTitle: 'Workflow DAG Definition',
    btnValidateDAG: 'Validate Kahn DAG',
    btnPublishWf: 'Publish Snapshot',
    wfPipelineTitle: 'Visual DAG Execution Pipeline',
    wfPipelineSub: 'Deterministic node progression, topological dependency resolution & approval gates',
    nodesCount: 'Nodes',
    edgesCount: 'Edges',
    dagDiagnosticsTitle: 'Kahn DAG Validation Diagnostics:',
    dagValidBadge: 'DAG VALID - NO CYCLES',
    dagInvalidBadge: 'CYCLE DETECTED / INVALID',
    dagValidDesc: 'Graph satisfies Directed Acyclic Graph invariants. No recursive cycles, dangling edge references, or orphan entry paths.',
    topologicalLayers: 'Topological Execution Layers:',

    // Governance & Approvals
    govTitle: 'Governance & High-Risk Gatekeeper',
    govSubtitle: 'Dangerous tool executions (HIGH / CRITICAL) are intercepted prior to side-effect execution. Approvals bind to cryptographic SHA plan hash of parameters.',
    govGateActive: 'SecOps Gate Active',
    btnRefreshQueue: 'Refresh Queue',
    rbacNotice: 'Principal Permission Notice',
    rbacNoticeDesc: 'Current actor {actor} has role {role} and lacks APPROVE_HIGH_RISK authority. Switch to Marcus Vance or Elena Rostova via the top-right profile selector to authorize actions.',
    pendingQueueTitle: 'Pending Approval Queue',
    targetArgsLabel: 'Target Parameter Arguments:',
    boundHashLabel: 'Bound Plan Hash (SHA-256):',
    hashExplainer: 'Any change in replicas, cluster name, or payload will alter this hash and cause execution failure.',
    btnReject: 'Reject & Block Run',
    btnApprove: 'Authorize & Execute',
    tamperTitle: 'Interactive Parameter Tampering Simulation',
    tamperDesc: 'Modify parameter fields below to observe how the cryptographic Plan Hash recalculates in real-time. If parameters are tampered post-approval, the hash check fails and halts execution.',
    fieldCluster: 'Target Cluster Namespace',
    fieldReplicas: 'Requested Replicas (try changing from 4 to 99)',
    recalculatedHash: 'Recalculated Plan Hash:',

    // Integration Hub
    hubTitle: 'Integration Hub & Tool Sandbox',
    hubSubtitle: 'Controlled execution boundary for native plugins and Model Context Protocol (MCP) servers. SSRF controls, rate limits, and emergency kill switches.',
    registeredToolsTitle: 'Registered Tools & MCP Endpoints',
    toolTestBenchTitle: 'Tool Sandbox Test Bench',
    targetPerms: 'Target Permissions',
    jsonArgsLabel: 'JSON Arguments (Input Payload)',
    btnRunToolTest: 'Run Tool Test in Sandbox',
    disabledNotice: 'Tool is currently emergency-disabled by PLATFORM_ADMIN. All calls will be rejected with DENY.',
    toolOutputTitle: 'Execution Output & Decision:',

    // Integration Hub & Plugins Tabs
    tabPluginsCatalog: 'Plugin Catalog & Config',
    tabGoogleMaps: 'Google Maps Platform',
    tabWeather: 'Global Weather & AQI',
    tabDomesticApps: 'Domestic Apps (Feishu/DingTalk/WeCom)',
    tabMCPSandbox: 'Native Tools & MCP Sandbox',

    // Google Maps Platform
    mapsTitle: 'Google Maps Platform Geospatial Service',
    mapsSubtitle: 'Interactive map rendering, geocoding, POI discovery, and routing',
    mapsSearchPlaceholder: 'Search city or landmark (e.g. Tokyo, New York, San Francisco, Beijing)...',
    mapsCoordinates: 'Center Coordinates',
    mapsDemoKeyActive: 'Google Maps Demo Key Active',
    mapsQuotaWarning: 'Notice: Google Maps Demo key is subject to daily quota limits. For production usage, configure your dedicated GCP project.',
    mapsLocBeijing: 'Beijing',
    mapsLocShanghai: 'Shanghai',
    mapsLocTokyo: 'Tokyo',
    mapsLocNewYork: 'New York',
    mapsLocSanFrancisco: 'San Francisco',
    mapsLocLondon: 'London',

    // Weather
    weatherTitle: 'Global Weather Intelligence',
    weatherSubtitle: 'Real-time temperature, wind, humidity, AQI, and 5-day predictive forecast',
    weatherSearchPlaceholder: 'Search city (e.g. Beijing, Shanghai, Tokyo, New York, London)...',
    weatherCurrentTemp: 'Current Temperature',
    weatherCondition: 'Weather Condition',
    weatherHumidity: 'Relative Humidity',
    weatherWind: 'Wind Speed & Direction',
    weatherAqi: 'Air Quality Index',
    weatherForecast5Day: '5-Day Weather Forecast',
    weatherAgentJsonPreview: 'Agent Tool Invocation Payload',

    // Domestic Apps
    domesticTitle: 'Domestic Enterprise App Connectors',
    domesticSubtitle: 'Feishu / Lark, DingTalk, and WeCom webhook bots and notification dispatch',
    domesticPlatformFeishu: 'Feishu / Lark',
    domesticPlatformDingtalk: 'DingTalk',
    domesticPlatformWecom: 'WeCom',
    domesticPlatformAmap: 'Amap (Gaode)',
    domesticWebhookUrl: 'Webhook Bot URL',
    domesticSecret: 'Security Signature Secret',
    domesticMsgType: 'Message Type',
    domesticMsgTitle: 'Message Title',
    domesticMsgContent: 'Message Body (Markdown / Rich-text)',
    btnSendDispatch: 'Dispatch Test Message & Sign',
    domesticDispatchResult: 'Dispatch Response & Signature Audit Log',
    pluginActive: 'ACTIVE',
    pluginDisabled: 'DISABLED',
    btnTogglePlugin: 'Toggle Plugin Status',

    // Audit Trail
    auditTitle: 'Security & Compliance Audit Trail',
    auditSubtitle: 'Append-only record of all state transitions, policy decisions, and approval authorizations. Zero secret retention invariant enforced on all fields.',
    searchPlaceholder: 'Search by Trace ID, actor, resource...',
    filterEventType: 'Event Type:',
    colTimeTrace: 'Timestamp / Trace ID',
    colActor: 'Actor & Role',
    colType: 'Event Type',
    colResource: 'Target Resource',
    colSummary: 'Summary',
    colPayload: 'Payload',
    btnViewRedacted: 'View Redacted',
    modalTitle: 'Audit Event Sanitized Payload',
    btnClose: 'Close',

    // ADR & Matrix
    docsTitle: 'Vibe Coding Standards, Verification Matrix & ADR',
    docsSubtitle: 'Strictly aligned with Architecture Baseline V1.0 & Vibe Coding Execution Manual V2.0.',
    btnTabMatrix: 'DoD Matrix',
    btnTabADR: 'ADR-0001',
    btnTabThreat: 'STRIDE Threat Model',
    dodTitle: 'Definition of Done (DoD) Checklist',
    dodEvidence: 'Verified Evidence:',

    // Footer
    footerText: 'AI AGENT STUDIO V2.0 • Strictly Aligned with docs/vibe-coding.md (P0-P8 Roadmap) • Zero External Side-Effects Mode',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['zh'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('agent_studio_lang');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch (_) {}
    return 'zh'; // Default to Chinese as user requested in Chinese
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('agent_studio_lang', lang);
    } catch (_) {}
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
