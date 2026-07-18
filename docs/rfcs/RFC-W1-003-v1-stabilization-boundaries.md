# RFC — V1.0 稳定化错误与 BYOK 边界

- RFC ID: `RFC-W1-003`
- Status: `APPROVED`
- Author/Agent: primary-agent
- Date (UTC): 2026-07-18
- Related Task/Wave: T-W1-019 / Wave 1
- Technical reviewer(s): pending independent review
- Human decision required: `YES`

## Problem

V1 API 的错误响应存在多种形状，全局 handler 可能直接发送内部 Error；浏览器 session-key 路由与当前“环境变量 secret、浏览器不接触 key”的 V1 安全模型并存。Worker readiness 与本地运维也缺少稳定、可验证的边界。

## Proposed change

1. 在不修改 `api.v1` Schema 的前提下，所有 JSON 错误统一为现有 api.v1 envelope，内部异常映射为稳定 code/message/details。
2. 浏览器 session-key 路由默认关闭，仅在 `ENABLE_BROWSER_SESSION_KEY=1` 时兼容启用；环境变量 `WORKFLOW_BYOK_API_KEY` 保持 V1 默认。
3. 不在 URL、SQLite、Job、Session、日志或响应中持久化/回显 secret。
4. Worker 只有在 SQLite、content root、handlers 和 loop 初始化完成后输出 ready；循环瞬时异常隔离并有界退避。
5. 真实本地 smoke 仅使用 Mock provider、临时 SQLite/content root/端口和仓库许可 PDF fixture。

## Alternatives considered

- 删除 session-key 路由：边界最清晰，但会破坏已有开发兼容测试；本批次采用默认关闭的显式开关。
- 修改公共 error Schema：会扩大契约和生成文件变更；现有 api.v1 envelope 已足够，不采用。
- 引入 PDF.js：改动和依赖体积过大；先用 iframe key、可观察状态和新标签页降级。

## Affected contracts and consumers

- 不修改 `packages/contracts/**`、数据库 migration 或 `guided-learning.v1` 状态机。
- API 客户端继续读取 `schema_version=request_id/error` envelope。
- 仅改变错误路径、浏览器 session-key 默认可用性、Worker 日志事件和运维脚本。

## Migration and compatibility

无数据库迁移。需要旧 session-key 开发行为时，操作员必须显式设置 `ENABLE_BROWSER_SESSION_KEY=1`；默认安装更安全。回滚可恢复旧路由注册和旧 error handler，不涉及数据回滚。

## Security and privacy impact

默认浏览器无法注册 secret；错误不暴露 stack、路径、SQL、密钥或内部异常文本。结构化日志只记录稳定分类、request ID 和脱敏布尔状态。自动化不得访问真实 acceptance 数据或外部模型。

## Tests and acceptance

覆盖 session-key 默认关闭/显式开启、主要 API 错误 envelope、PDF content 400/404/500、Worker readiness/退避/abort、secret 泄露负例和真实本地 Mock smoke。技术验收由主控重新运行全矩阵；独立 reviewer 以 commit range 与命令证据复核。

## Rollback plan

按 T-W1-019 逻辑提交 revert；无 migration、Schema 或数据清理。

## Decision

- Technical decision owner: primary-agent（实施与证据，最终审核待独立 reviewer）
- Human project owner (only if required): approved by explicit V1 stabilization instruction
- Decision date (UTC): 2026-07-18
- Notes: 批准仅限本 RFC 的 V1 本地单用户安全和错误边界，不授权远程部署、认证、多用户或 Evidence gate 放宽。
