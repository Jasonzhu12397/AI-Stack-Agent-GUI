# AI Agent Studio 验证与契约矩阵 (Verification Matrix)

更新时间: 2026-11-01 (P0-1 阶段)

| 阶段 / 能力项 | 目标规范 | 验证级别 | 验证方式 / 证据 | 状态 | 遗留风险 & 待验证项 |
|---|---|---|---|---|---|
| **P0-1: 基础骨架** | FastAPI/Express 控制面, OpenAPI 契约, 健康检查 | 真实本地执行 | `/api/v1/health` 契约测试通过, `node:test` 100% 通过 | **已完成** | 生产 Docker 容器镜像安全扫描待 CI 接入 |
| **P0-1: Fake 适配器** | FakeModel, FakeTool, FakeMCPServer | 真实本地执行 | 单元测试模拟调用与拒绝行为全部通过 | **已完成** | 真实外部模型需在 P2 配置后实测 |
| **P1-1: 组织身份授权** | RBAC, 租户隔离, Principal 中间件, 角色撤销, 配额治理 | 真实本地执行 + 浏览器交互 | 7项安全测试全过; UI 邀请/撤销/配额/OIDC 生产安全守卫验证闭环 | **已完成** | 生产真实 OIDC IdP 单点登录待对接 |
| **P1-2: 任务与状态机** | PENDING->PLANNING->QUEUED->RUNNING->SUCCEEDED/FAILED | 真实本地执行 | 状态流转原子 CAS 与心跳租约机制测试 | **已完成** | 极限分布式锁与跨节点秒级对账 |
| **P2-1: 模型网关** | 供应商管理, Token 计量, 降级重试 | 模拟验证 | FakeModel 回应, 费用不可篡改 | **已完成** | 真实 OpenAI / Gemini API 价格变动对齐 |
| **P2-2: Agent 编排** | 草稿编辑, 不可变快照发布, 调试运行 | 真实本地执行 | Studio UI + API 运行回放闭环 | **已完成** | 超长 Prompt 截断策略 |
| **P3-1: Workflow 引擎** | DAG 验证, 节点拓扑排序, 分支与条件流转 | 真实本地执行 | DAG 校验算法与运行时拓扑测试 | **已完成** | 分布式补偿 Saga 模式深度测试 |
| **P4-1: 插件沙箱** | Manifest 校验, 权限交集计算, 隔离执行 | 模拟验证 | FakeTool 权限过滤测试通过 | **已完成** | gRPC/Wasm 沙箱进程隔离 |
| **P4-2: 审批与凭据** | 计划哈希绑定, 审批队列, 凭据脱敏 | 真实本地执行 | 篡改计划导致审批失效测试 | **已完成** | 双人审批多通道即时推送 |
| **P5-1: MCP 协议栈** | Client 协议交互, 工具发现, 描述隔离 | 模拟验证 | 本地受控 FakeMCPServer 交互 | **已完成** | 真实远程 SSE / Stdio 传输性能 |
| **P5-2: Skills 机制** | Skill 挂载, 脚本沙箱, 工具映射 | 模拟验证 | Skill 目录检索与 Agent 绑定 | **已完成** | 动态代码审查 AST 解析器深度 |
| **P5-3: RAG 向量与记忆** | ACL 过滤, 切分, 检索与引用溯源 | 模拟验证 | 授权隔离检索测试 | **已完成** | 生产百万级向量索引 HNSW 压测 |
| **P6-1: 企业连接器** | GitHub/Jira/Confluence/Graph 只读 | 契约模拟 | 契约 Schema 与只读 Mock 测试 | **未验证生产** | 真实 OAuth Scopes 申请与授权 |
| **P7-1: 基础设施 CRD** | K8s/CAPI/Metal3/Ironic 声明式编排 | 契约模拟 | Conditions 观察闭环 Mock | **未验证生产** | 需专用隔离硬件测试集群 |
| **P8-1: 可观测与运维** | OTel Trace, 审计导出, 告警指标 | 真实本地执行 | Trace ID 贯穿与审计日志持久化 | **已完成** | 生产 Prometheus/Grafana 报警规则联调 |
