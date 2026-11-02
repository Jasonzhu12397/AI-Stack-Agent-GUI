# AI Agent Studio：完整 Vibe Coding 执行手册 V2.0

来源：用户提供的《AI Agent Studio 开发文档与系统架构设计》V1.0（2026-10-29）。本手册把原设计转为可供编码 Agent 按轮执行的工程任务，覆盖完整产品范围；它不是已完成的代码，也不宣称厂商 API、目标 CRD 或生产授权已验证。

## 0. 怎么使用

1. 将本文保存为仓库的 docs/vibe-coding.md，另将原架构文档放在 docs/architecture-baseline.md。没有原文件时，以用户提供的原文为需求基线；冲突时先记录决策，不自行删减需求。
2. 给编码 Agent 发送“总控提示词”及当前阶段的一条任务卡。每轮先让 Agent 检查代码与环境，再交付一段可运行的垂直切片。不要一次性要求生成所有模块。
3. 阶段 P0—P8 覆盖原文的全部范围；其中 P1—P4 可构成 MVP，但 P5—P8 是完整产品要求，不能在最终交付时标注为完成除非实际实现并验收。
4. 使用下文默认技术栈仅为了让空仓库可以起步。已有仓库或团队标准优先；实际框架、SDK、CRD 版本必须写入 ADR 并验证。
5. 每轮输出可复核的文件、命令、测试结果和剩余风险；对无法访问的外部系统使用契约测试/模拟器，不伪造实测结论。

## 1. 全局默认技术方案与边界

- **后端**：Python 3.12 / FastAPI / Pydantic v2 / SQLAlchemy 2 或可运行 TypeScript/Express 控制面；异步任务初期使用数据库原子领取、租约和心跳，规模增长再评估专用工作流/队列产品。
- **前端**：React、TypeScript、Vite，组件库由实现阶段按现有仓库选定；画布可选成熟图编辑库，但序列化格式归平台所有。
- **存储**：PostgreSQL/关系型存储（配置、审批、运行、审计索引的权威存储）、S3 兼容对象存储（原件/附件）、可替换的向量存储接口（可先使用 pgvector）、Redis（缓存与限流，不作唯一持久任务源）。
- **本地**：Docker Compose + FakeModel/FakeTool/FakeMCP；生产：Kubernetes + Helm/Kustomize、外部 Secret Manager、OIDC。默认不访问真实生产系统。
- **部署形态**：先模块化单体控制面 + 独立 Agent/Workflow Worker + 隔离 Plugin Executor；保留独立服务接口，不以过早微服务化替代模块边界。
- **不可违背原则**：所有真实外部写操作都需要特定环境、凭据、权限和变更审批；编码 Agent 不得把“完成开发任务”解释为授权执行生产变更。

### 不可违反的工程不变量
1. 模型输出、检索文本、Skill 指令、MCP 描述和插件返回值都是不可信数据；任何权限由代码策略决定。
2. 工具调用按有效主体权限 ∩ Agent/Workflow 白名单 ∩ 连接器授权 ∩ 当前策略执行，且检查目标资源范围；连接成功不等于授权。
3. Draft 可编辑；Published 是不可变快照；Run 固定 Agent/Workflow、工具、模型、Skill、知识库的版本或明确的不可变引用。
4. 每个写请求有幂等键或显式不可重试标记；长任务状态持久化；取消不能虚构外部副作用已撤销。
5. 平台任务状态以数据库为准，外部资源状态以源系统为准；创建 K8s 对象成功不等于集群部署成功。
6. 凭据只保存引用，按需领取短期有效句柄；日志、Prompt、Trace、工具错误、审计摘要不得包含明文 Secret。
7. 全部对象均有租户边界；鉴权不得仅凭客户端上传的 tenant_id 或项目 ID。

## 2. 总控提示词
参考主文档并在每轮迭代遵循规则。

## 3. 仓库布局与契约先行
公共契约包含：Principal、ToolDefinition、ToolCall、PolicyDecision、ToolResult、RunSnapshot。
状态流转：
`PENDING -> PLANNING -> QUEUED -> RUNNING -> SUCCEEDED | FAILED`
`PLANNING | RUNNING -> WAITING_APPROVAL -> QUEUED | FAILED | CANCEL_REQUESTED`
`QUEUED | RUNNING | WAITING_APPROVAL -> CANCEL_REQUESTED -> CANCELLED | FAILED | PARTIALLY_SUCCEEDED`
`RUNNING -> COMPENSATING -> FAILED | PARTIALLY_SUCCEEDED`

## 4. 任务卡 P0 - P8
覆盖 P0-1 骨架搭建到 P8-1 生产化与运维交接。
