# AI Agent Studio 威胁建模与安全架构规范 (Threat Model)

## 1. 资产与信任边界
1. **信任边界 A（客户端 / 浏览器 -> 控制面 API）**
   - 风险：请求伪造、伪造 `tenant_id`、Token 窃取、越权访问他人物品。
   - 防御：服务端统一通过 `Authorization` 校验生成只读 `Principal`，所有 SQL/存储查询强制带入 `tenant_id` 与 `project_id` 过滤。
2. **信任边界 B（控制面 -> 模型网关 & 外部模型）**
   - 风险：Prompt 注入、越狱、虚假工具指令。
   - 防御：模型输出视为不可信输入；强制经由代码层 JSON Schema 校验；工具调用必须由平台代码在鉴权策略通过后触发。
3. **信任边界 C（Worker -> 工具/插件/MCP 执行环境）**
   - 风险：SSRF、私网穿透、元数据服务探测 (169.254.169.254)、凭据泄露。
   - 防御：网络出口限制、黑名单与白名单校验、无集群凭据挂载、凭据仅在调用时兑换只读/受限临时令牌。
4. **信任边界 D（审批系统 -> 生产执行）**
   - 风险：批准后参数被篡改（Time-of-Check to Time-of-Use 竞争）。
   - 防御：审批单严格与目标参数的 SHA-256 计划哈希绑定，执行前二次校验哈希与权限有效性。

## 2. STRIDE 矩阵分析
- **Spoofing (假冒)**: 强制校验 Principal，严禁信任客户端传入身份标识。
- **Tampering (篡改)**: Published 版本不可变；数据库采用悲观锁与事务版本号。
- **Repudiation (抵赖)**: 关键操作全部记录进不可篡改的 `AuditEvent`，具备统一 `trace_id`。
- **Information Disclosure (信息泄露)**: 日志、Trace、审计与报错信息强制经过脱敏器（Redactor），绝不暴露明文 Secret。
- **Denial of Service (拒绝服务)**: 单 Run 设定最大步数（Max Steps）、执行超时（Timeout）、循环保护与租户配额限制。
- **Elevation of Privilege (特权提升)**: 工具执行权限采用四方交集：
  $$\text{Effective Permissions} = \text{Principal Grants} \cap \text{Agent Whitelist} \cap \text{Connector Grants} \cap \text{Active Policy}$$
