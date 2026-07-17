# Current State

最后更新：2026-07-17（Asia/Shanghai）
状态：`WAVE_1_RELEASE_GATE_RETRY_POINTER_REPAIR_IMPLEMENTING`

产品需求基线：V1.0 产品定义已归档至
`docs/product/versions/科研文献引导式学习平台_V1.0产品定义.md`，开发需求见
`docs/product/v1.0-development-requirements.md`。
RFC-W1-002 仍为 `PROPOSED`；契约版本与状态机部分已通过独立决策记录落地。
`guided-learning.v1` runtime、T-W1-013 API/SQLite runtime、T-W1-014 Worker 生成、T-W1-015 Web Workbench、T-W1-016 验收修复和 T-W1-017 Real BYOK/Evidence Grounding 已集成 main。T-W1-018 人工验收发现正式 Worker 未轮询队列；本分支已修复并重新验证，V1.0 仍被真实 BYOK 凭据、外部连接、浏览器人工验收、Evidence 人工抽查和产品负责人批准阻塞。

## main 当前基线

- `main`、`origin/main` 当前发布 Gate 基线为 `54043fb28cb082eb871773732bafce0f031fc562`，已包含 T-W1-017 merge commit。
- PR #2、PR #3、PR #4 已合并；PR #4 合并了 `guided-learning.v1` 契约实现。
- T-W1-011 已集成；T-W1-013 API/SQLite runtime 和 T-W1-014 Worker 生成已进入 main。

## 当前 Wave

Wave 1 已进入基础运行时和公共契约集成阶段。快速问答模式继续保留，
`guided-learning.v1`、T-W1-013 API/SQLite runtime 和 T-W1-014 Worker 已进入 main。

## 已实现能力

当前 main 中已有：

- SQLite、SQL migration、storage repository 和 Job runtime；
- 内容寻址的真实文本型 PDF 上传、按页提取、canonical page text、页面 SHA-256、extraction profile 和 Evidence 坐标基础；
- 确定性的无网络 `MockModelGateway`；
- OpenAI-compatible BYOK adapter、provider preset、连接测试和会话内存 secret；
- 快速问答 Workflow API/HTTP、问题计划和回答生成 Worker handler、revision/review/verification 与 Evidence 物化路径；
- 最小快速问答 Web 工作台和 loopback 平台入口；
- `guided-learning.v1` Schema、生成类型、Session/Command 分支、状态机、幂等 fingerprint、failure resume、Evidence 确认门、跨字段一致性校验、fixtures 和正负契约测试。

## 当前 main 新增的 Worker 能力

`guided-learning.v1` 当前已经形成可测试的公共契约、状态机和已集成的 API/SQLite runtime。
main 已包含 API/SQLite runtime 和 T-W1-014 Worker：

- 引导式学习 API Session/Command 持久化和 HTTP runtime；
- 引导式学习专用数据库表、字段和 migration；
- 候选方向、路线、逐题问题、点评、参考答案和阶段总结的 Worker 生成；
- T-W1-015 Guided Learning Web 交互已合并 main。
- 真实 PDF + 引导式学习端到端闭环已由 Mock 自动化覆盖；T-W1-017 另有默认 Worker BYOK gateway 的 fake HTTP 集成覆盖，真实 BYOK 人工验收尚未执行。

## 已冻结的边界与 Gate

- 快速问答与引导式学习是两个模式；后续实现必须按 `schema_version`/模式分流，不能混用状态语义。
- 客户端不能推进服务端 `state`、`route`、`feedback`、`summary`、`failure` 或 Evidence `verification_status`。
- `ANALYZE` 和 `TRANSFER` 在 V1.0 继续锁定。
- 只允许本地 `127.0.0.1` 部署；不开放远程监听、共享密钥、OCR、扫描 PDF、复杂表格/公式理解、多篇综合、资产库、导出或协作。
- T-W1-011 契约任务已通过实际审查、PR checks 并合并；这不等于整个 Wave 1 Gate 或引导式学习 runtime 已进入 main。
- T-W1-013 和 T-W1-014 已进入当前 main 基线；这不等于整个 Wave 1 Gate 或完整产品完成。
- 技术方案文档保留 Gate A `REPAIR_REVIEW_PENDING`、Gate B `GRANTED（仅已批准的第一批）` 和 Gate C `LOCKED` 的治理边界；本次同步不擅自扩大 Gate。
- RFC-W1-002 整体仍为 `PROPOSED`；契约部分以 `docs/contracts/guided-learning-contract-version-decision.md` 的独立技术决定为准。

## 任务状态

- T-W1-010：`INTEGRATED`，V1.0 产品定义归档和开发需求基线已进入 main。
- T-W1-011：`INTEGRATED`，`guided-learning.v1` 公共契约、状态机、生成类型、fixtures 和测试已进入 main。
- T-W1-012：`DONE`，本次文档与正式状态同步任务。
- T-W1-013：`INTEGRATED`，Guided Learning API/SQLite runtime 已进入 main。
- T-W1-014：`REVIEW`，已完成并进入 main；包含四类 Worker Job、原子入队、真实 PDF Mock 闭环和失败重试，仍待后续审查收口。
- T-W1-015：`REVIEW`，已进入 main；包含 Guided Learning Web 入口、目标/PDF/Session 创建、轮询恢复、方向选择、逐题反馈、Evidence、重试和阶段总结，仍待真实 PDF 完整 E2E、BYOK 和产品验收。
- T-W1-016：`INTEGRATED`，Mock 技术验收通过，发布状态为 `RELEASE_CANDIDATE_WITH_OPEN_BLOCKERS`；真实 BYOK 人工验收仍是发布门槛。
- T-W1-017：`INTEGRATED`，真实 BYOK Guided Generation、provider config migration、Worker 环境 secret、四类专用输入/输出约束、source-only Evidence verification、PDF content endpoint、刷新恢复和页码定位已进入 main；真实外部 BYOK 人工验收因缺少用户凭据保持阻塞。
- T-W1-018：`IMPLEMENTING`，已修复 Worker 轮询、PDF 32 MiB 路由级 bodyLimit、结构化 413 和 DeepSeek V4 JSON 输出兼容性。第四个真实阻断确认 RETRY 反馈 Job 丢失当前题目指针，使 Worker 在模型调用后报告 `Feedback question pointer changed` 并将 Session 置为永久 FAILED；本轮修复 API/Worker 的 operation-specific question pointer 校验，新增回归测试和固定数据库/Session allowlist 的一次性恢复脚本。真实验收 Session 恢复前 FAILED/revision 11，恢复后 RETRYABLE_FAILURE/revision 12；真实浏览器直接刷新并点击 RETRY 仍待用户执行。真实 BYOK、浏览器人工验收、Evidence 人工抽查和产品负责人批准仍待完成。
- T-W1-005：保持 `DRAFT`；扩展后的双模式完整范围尚未进入 main；快速问答子集和 Guided Learning API/SQLite runtime 已存在，其余 Web 和完整产品验收仍待实施。
- T-W1-006：保持 `DRAFT`；最小快速问答 Web 和 T-W1-015 Guided Learning Web 已存在，但其完整任务范围仍待实施。
- 不据此改变其他任务或 Gate 的状态。

## 当前测试状态

- PR #2、PR #3、PR #4 的合并结果已在 main；PR #4 GitHub checks 全部通过。
- T-W1-011 最终契约门禁：`npm run contract:generate`、`npm run contract:check`、`npm run contract` 通过；guided-learning 定向 Vitest 13/13；`npm test` 24/24；lint、typecheck、build、security 通过，security 报告 0 vulnerabilities；`git diff --check` 通过。
- T-W1-014 集成验证：Guided Learning runtime + Worker 定向测试 11/11，runtime integration 25/25，`npm test` 24/24，planning、lint、typecheck、contract、build、security scan 和 `git diff --check` 通过；未执行 online `npm audit`。
- T-W1-015 合并验证：Web API client/轮询 5/5，Guided Learning runtime + Worker 12/12，Playwright Web smoke 3/3（含快速问答回归和 Guided Learning Mock-shaped 流程），runtime integration 26/26，真实 `synthetic-text.pdf` 后端 Mock 闭环保持通过；BYOK 人工验收尚未执行。
- T-W1-016 验收分支验证：全新 SQLite migration 1–5、schema version 5、API/Worker 同库和重启恢复通过；BYOK/Mock 定向 17/17；完整 planning、check、lint、typecheck、runtime integration 26/26、`npm test` 24/24、contract、build、Playwright 3/3、smoke、security scan 和 `git diff --check` 通过。这些证据仅证明 Mock 技术验收，不证明真实模型生成或 V1.0 发布。
- T-W1-017 review repair 定向覆盖：默认 Worker BYOK gateway fake HTTP 四 operation、operation-specific input/output、完整 history、source-only Evidence verification、非蕴含 claim、重复 Evidence 去重、Unicode/code-point offset 和无效输出 fail-closed；Playwright 3/3 仅覆盖 BYOK 控件与 Mock UI，真实 BYOK 浏览器 E2E 标记 `BROWSER_REAL_BYOK_E2E_NOT_EXECUTED`。
- T-W1-017 merge 后 Release Gate 复核：planning 18 tasks、runtime integration 26/26、BYOK/Evidence 13/13、`npm test` 24/24、Playwright 3/3、lint、typecheck、contract、build、smoke、security 和 `git diff --check` 全部通过；PDF fixture SHA-256 保持 `99e07b4ba995b7c90bd84628a5db55b71a4faa1f06d3714a5942741cd39a55f8`。
- T-W1-018 Worker 修复复核：正式入口现在持续调用 `JobRuntime.runOnce()`，无 Job 时默认等待 250ms；stop 后等待当前 Job、单次 close、一次 stopped 输出；定向 Worker loop 9/9 和真实 SQLite Job 消费通过。人工发现的原始阻断已修复。
- T-W1-018 DeepSeek JSON repair：现有请求体问题已定位为 DeepSeek V4 默认 thinking 与结构化 JSON 输出边界未显式处理；仅 DeepSeek custom base URL 发送 `thinking: { type: "disabled" }`，保留 JSON Output，四类 prompt 提供完整示例；网关安全记录 finish reason、content/reasoning 长度和 schema 错误，不记录原文或 secret。定向 BYOK/Guided Learning 17/17 通过，真实浏览器重试待执行。
- T-W1-018 RETRY pointer repair：真实 Session `learning_95664836-e2bb-4c74-9e07-496448c0e3e1` 的第四阻断已由定向测试覆盖；反馈 Job 必须包含当前 `question_id`/`question_order`，非反馈 Job 不携带指针，Worker 在 ModelGateway 前拒绝缺失/不匹配指针。固定 allowlist 恢复脚本在事务中把该 Session 从 FAILED/revision 11 恢复为 RETRYABLE_FAILURE/revision 12，并支持幂等重复执行；未修改项目、PDF、答案、问题、证据或 provider config。真实浏览器 RETRY 仍待用户复验。
- 本轮第四阻断复核：题目指针定向 32/32、runtime integration 26/26、`npm test` 24/24、Playwright 3/3、planning/check、lint、typecheck、contract、build、smoke、security 和 `git diff --check` 通过；真实浏览器仍未执行。
- 本地完整 `npm run ci` 仍在首步 `format` 受既有 Windows CRLF checkout 问题阻断；本次不批量改写全仓换行。
- `contract:check` 本身已通过；不能把本地 CI 的 CRLF 阻断写成契约 drift 失败。
- T-W1-011 分支未实际运行 smoke；本次文档同步不补写未执行结果，且本轮未修改 runtime。

## 尚未解决的问题

- T-W1-015、T-W1-016 和 T-W1-017 已合并 main；T-W1-018 Release Gate 修复尚未合并 main；真实 BYOK 外部连接、浏览器人工体验、Evidence 人工抽查和产品负责人批准尚未完成。
- 全仓 Windows CRLF format 基线治理尚未解决。
- RFC-W1-002 仍需完整的产品/技术审批，不因契约决定记录而整体变为 `ACCEPTED`。

## 下一步（不自动执行）

按依赖顺序，下一步应是：

1. 提供安全配置的真实凭据并完成 BYOK 人工连接、最小四 operation 生成/Evidence 验收和浏览器体验验收。
2. 完成 Evidence 人工抽查并由人类项目负责人决定是否进入 `READY_FOR_V1_0_TAG`；不自动创建 tag。

不自动扩大 T-W1-005/T-W1-006 的范围；不因 T-W1-014 集成而宣称整个 Wave 1 完成。

## 恢复检查

恢复会话时必须读取：

- `AGENTS.md`；
- 本文件；
- `docs/devlog/INDEX.md` 和最新 `docs/devlog/2026-07-15.md`；
- `docs/contracts/guided-learning-contract-version-decision.md`；
- `docs/tasks/backlog/T-W1-005-reading-workflow-api.yaml`；
- `docs/tasks/backlog/T-W1-006-web-workbench.yaml`；
- `docs/tasks/backlog/T-W1-011-guided-learning-contract-refinement.yaml`；
- `docs/integration/ownership-map.yaml`。

恢复时以当前 main、实际代码、任务文件和最新日志为准，不依赖历史聊天，也不把契约集成误判为完整产品交付。
