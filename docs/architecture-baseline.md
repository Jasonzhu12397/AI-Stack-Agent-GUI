# AI Agent Studio 架构设计与需求基线 (Architecture Baseline) V1.0

## 1. 系统愿景与核心定位
AI Agent Studio 是面向企业级复杂环境的智能体与工作流开发、编排、运行、治理与评测平台。
平台核心设计理念：
- **零信任数据边界与最小特权**：所有输入（Prompt、检索结果、模型输出、工具返回、Skill指令）均为不可信数据。
- **可复现与不可变快照**：应用发布后生成固定版本的不可变快照（RunSnapshot），运行锁定模型版本、工具集、知识库和策略版本。
- **两阶段高风险操作与审计闭环**：危险写操作强制经过参数哈希绑定的审批流，严防越权与计划篡改。
- **企业多租户与组织隔离**：Tenant -> Project -> User -> RoleBinding 完备层级，服务端校验权威主体。
- **异构基础设施与外部连接**：支持标准插件 SDK、安全隔离 Plugin Executor、受控 MCP Client/Server、企业连接器及云原生基础设施编排。

## 2. 状态机与生命周期模型

### Run & StepRun 执行状态机
```
                  ┌───────────────┐
                  │    PENDING    │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │   PLANNING    │◀────────────────┐
                  └───────┬───────┘                 │
                          │                         │
                          ▼                         │
                  ┌───────────────┐                 │
                  │    QUEUED     │                 │
                  └───────┬───────┘                 │
                          │                         │
                          ▼                         │
                  ┌───────────────┐      (Approved) │
                  │    RUNNING    ├─────────────────┤
                  └───┬───────┬───┘                 │
                      │       │                     │
          (Require    │       │                     │
          Approval)   ▼       ▼ (Complete / Error)  │
            ┌─────────────────────┐                 │
            │  WAITING_APPROVAL   ├─────────────────┘
            └─────────┬───────────┘
                      │
                      ▼ (Rejected / Cancel)
            ┌─────────────────────┐
            │  CANCEL_REQUESTED   │
            └─────────┬───────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │ SUCCEEDED | FAILED | CANCELLED│
       │    | PARTIALLY_SUCCEEDED      │
       └───────────────────────────────┘
```

## 3. 核心对象模型
- **Tenant & Project & Principal**: 组织隔离与对象级 RBAC
- **AgentDefinition & AgentVersion**: 包含模型绑定、系统提示词、工具白名单、输出契约、记忆策略
- **WorkflowDefinition & WorkflowVersion**: DAG 图定义、节点输入输出映射、分支条件与依赖检查
- **ToolDefinition & Connection**: 模式Schema定义、权限范围、网络目标、风险等级（LOW/MEDIUM/HIGH/CRITICAL）
- **PolicyDecision**: ALLOW | DENY | REQUIRE_APPROVAL
- **ApprovalRecord**: 计划参数哈希绑定、审批人、有效期限、执行校验
- **AuditEvent**: 结构化操作日志、trace_id、敏感信息脱敏标记

## 4. 交付与验证路线
- P0: 骨架、OpenAPI、Fake Provider、健康检查与测试框架
- P1: 组织身份授权、任务状态机、租约与恢复机制、审计与存储
- P2: 模型网关、Agent 编排与不可变发布运行
- P3: Workflow 引擎、可视化画布、调度器与 Webhook
- P4: 插件隔离沙箱、审批流与凭据中介
- P5: MCP 协议栈、Skill 技能库、RAG 向量与记忆系统
- P6: 企业通用连接器（GitHub/Jira/Confluence/Office365等）
- P7: 云原生基础设施扩展、应用发布、评测与协同
- P8: 生产化观测与部署加固
