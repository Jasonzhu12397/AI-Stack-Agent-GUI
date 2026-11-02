# AI Agent Studio (Vibe Coding V2.0)

> Enterprise AI Agent & Workflow Orchestration Studio with Zero-Trust Execution, Governance Gates, Tool Sandboxing, and Immutable Releases.

Strictly adheres to **`docs/vibe-coding.md`** and **`docs/architecture-baseline.md`**.

---

## 1. 快速启动与干净环境运行 (Clean Environment Startup)

### 依赖环境
- Node.js >= 22.0.0
- npm >= 10.0.0

### 安装与启动
```bash
# 1. 安装依赖
npm install

# 2. 运行自动化单元测试与 API 契约测试 (100% 通过)
npm test

# 3. 启动全栈控制面与 Web Studio (端口 3000)
npm run dev
```

启动后：
- **Web Studio 控制台**: `http://localhost:3000`
- **健康检查 (Health Check)**: `http://localhost:3000/api/v1/health`
- **OpenAPI 3.1 契约规范**: `http://localhost:3000/api/v1/openapi.json`

---

## 2. 核心架构与工程不变量 (Architectural Invariants)

1. **不可信数据边界 (Zero-Trust Data)**: 模型输出、检索文本、Skill 指令、MCP 描述和插件返回值都是不可信数据；权限由代码策略决定。
2. **四方权限交集 (Four-Way Permission Intersection)**:
   $$\text{Effective Grants} = \text{Principal Grants} \cap \text{Agent Whitelist} \cap \text{Connector Grants} \cap \text{Active Policy}$$
3. **不可变发布快照 (Immutable Snapshots)**: Draft 可自由编辑；Published 生成带有 SHA 哈希的不可变快照（RunSnapshot）；Run 固定 Agent、工具、模型和策略版本。
4. **两阶段审批哈希绑定 (Plan-Hash Bound Approvals)**: 高危写操作（HIGH/CRITICAL）拦截后生成计划参数哈希，参数篡改将使旧审批立即失效。
5. **零凭据泄露 (Zero Secret Leaks)**: 所有日志、Trace、Prompt 和审计事件均通过递归 `DataSanitizer` 脱敏。

---

## 3. 测试与验证执行命令

```bash
# 执行全部领域逻辑单测与 API 契约测试
npm test

# 分项单测
npx tsx --test src/domain/stateMachine.test.ts  # 状态机与不可变终态
npx tsx --test src/domain/policyEngine.test.ts  # 策略引擎与防篡改
npx tsx --test src/domain/dagValidator.test.ts  # Kahn 算法 DAG 拓扑验证
npx tsx --test src/domain/fakeProviders.test.ts # FakeModel & FakeTool & FakeMCP
npx tsx --test src/domain/sanitizer.test.ts     # 数据脱敏器
npx tsx --test src/server/api.test.ts          # OpenAPI & API 契约
```

---

## 4. 目录结构与规范

```
ai-agent-studio/
├── docs/
│   ├── vibe-coding.md           # 完整 Vibe Coding 执行手册 V2.0
│   ├── architecture-baseline.md # 架构设计需求基线 V1.0
│   ├── verification-matrix.md   # P0-P8 阶段验收与证据矩阵
│   ├── threat-model.md          # STRIDE 威胁建模与安全边界
│   └── adr/
│       └── 0001-technology-stack-and-executable-skeleton.md
├── src/
│   ├── contracts/               # Principal, ToolDefinition, RunSnapshot, RunState
│   ├── domain/                  # 纯逻辑: 状态机, 策略引擎, DAG校验, 脱敏器, Fake适配器
│   ├── server/                  # 内存事务WAL存储, /api/v1 Express 路由
│   ├── components/              # Web Studio 模块化 React 组件
│   ├── App.tsx                  # 主入口
│   └── main.tsx
├── server.ts                    # 生产/开发全栈服务端 (端口 3000)
└── package.json
```
