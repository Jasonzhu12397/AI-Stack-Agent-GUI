# ADR 0001: 技术栈选型、执行契约与可运行架构骨架

## 状态
已接受 (Accepted) - 2026-11-01

## 背景与目标
需要为《AI Agent Studio》搭建一个真实可运行、可测试、可审计的初始工程骨架。平台要求具备清晰的模块边界：
- 控制面 API (Control Plane API)
- Agent & Workflow 执行 Worker (Task Engine & Worker)
- 前端 Web Studio 编排与管控界面 (Builder, Runs, Governance, Trace)
- 模拟 Provider (FakeModel, FakeTool, FakeMCPServer)，隔绝未授权外部依赖
- 不可变发布、租户隔离、审计追踪与执行安全状态机

## 备选方案及权衡
1. **方案 A：纯 Python FastAPI + Celery/ARQ + React 前端**
   - 优点：与 Python 数据科学生态契合。
   - 缺点：在容器与单进程集成开发环境中，多进程协同、热装配及前后端即时联调需要额外复杂的多层代理与外部进程调度，单容器轻量体验较重。
2. **方案 B：Node.js / TypeScript 全栈 (Express + Vite + TSX) + 模块化契约单体架构**
   - 优点：
     - 完全统一的 TypeScript 强类型体系（共享 OpenAPI JSON Schema、DTO 与领域模型契约）。
     - 支持作为 Vite 中间件（在端口 3000 单一端口无缝提供完整 REST API `/api/v1` 和前端 UI），同时模块化解耦 Control Plane、Worker Engine 与 Plugin Sandbox。
     - 支持使用 `node:test` 进行毫秒级、免外部依赖的高速逻辑单元测试。
     - 具备开箱即用的高并发与流式通信优势，未来无缝对接分布式部署。
3. **方案 C：混合微服务 (Docker Compose)**
   - 缺点：违反手册“先模块化单体控制面 + 独立 Worker，不以过早微服务化替代模块边界”的不变量。

## 选择及理由
选择 **方案 B**，采用具备明确包边界的 TypeScript 模块化工程架构：
- 严格遵循 `/api/v1` OpenAPI 3.1 规范与 JSON Schema 契约；
- 后端提供完整的 `Principal` 鉴权中间件、`RunStateMachine` 原子租约与心跳、`AuditEvent` 审计日志，以及 `FakeModel` / `FakeTool` / `FakeMCPServer`；
- 前端通过 React 19 + Tailwind CSS 构建高保真 Studio，集成系统概览、Agent 编排与调试、工作流 DAG 画布、审批队列、工具连接与审计流；
- 预留标准 Dockerfile 与 docker-compose.yml 供生产容器化部署。

## 安全/数据保留/成本影响
- **数据存储**：默认权威持久存储与状态锁采用 ACID 事务存储驱动，配合内存/文件 WAL 支持本地无门槛启动与幂等写入；
- **凭据管理**：零明文 Secret 存储，只存短期引用；
- **成本**：开发态全部默认接入 FakeModel 和 FakeTool，零公网 API 调用费用。

## 验证环境与实测证据
- Node.js v22+
- TypeScript 5.8+ / ES2022
- `node:test` 单元测试通过
- `http://localhost:3000/api/v1/health` 健康检查契约验证通过

## 回滚方案与负责人
- 回滚策略：代码均经由 Git 分支管理，状态存储具备模式迁移版本控制；
- 负责人：AI Agent Studio 核心架构组

## 尚未验证的外部依赖
- 生产环境 OIDC 真实 IdP 对接（目前使用受控 Local Identity Adapter）
- 生产 Kubernetes 集群实际 CRD 适配（目前使用 Fake 模拟器）
- 生产 MCP 远程网络连接（目前使用本地内存受控 FakeMCPServer）
