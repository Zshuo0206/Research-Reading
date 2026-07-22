# Current State

最后更新：2026-07-22（Asia/Shanghai）
状态：`V1_STABILIZATION_EXTERNAL_REVIEW_PENDING`

## T-W1-019 稳定化分支

`fix/v1-stabilization` 基于已核验的 `5473ca01434093a1ba6dba49b7e9bb249b063bba`，第一轮完成 PDF Evidence 导航可观察性、Web E2E 状态推进真实性、Mock Evidence 语义、API 错误 envelope、BYOK 默认边界、Worker 韧性、真实本地 HTTP smoke 和 Windows 运维脚本实现。第二轮定向修复进一步加入每次运行独立 stop control file、当前 Job 完成后退出、固定 4310/4173 端口、真实 Worker ready JSON 解析、Guided Learning 安全错误分类，以及仅由 resolved claims 构建 reference answer。没有公共 Schema、Storage、migration、状态机或 Evidence exact-match gate 变更。

第二轮已通过：完整 integration 18 files/101 tests、runtime integration 6 files/27 tests、Playwright 3/3、真实 HTTP + Worker runtime handlers + SQLite + PDF `test:v1-smoke` 1/1、定向 Worker loop 13/13、Guided Learning HTTP 3/3、Evidence Worker 3/3、BYOK 8/8、PowerShell 静态 5/5，以及 lint、typecheck、build、contract、platform smoke 和离线 security scan。`npm test` 的 29 个既有 contract/platform tests 通过，但新增 Windows managed process smoke 因外部 `127.0.0.1:4310` 监听者而失败；start 脚本已实测在创建状态或进程前安全拒绝。当前在线 `npm audit` 同时报告 transitive `fast-uri` 1 个 high 漏洞；本轮写入边界不含依赖清单，未运行自动修复。因此不能把第二轮完整矩阵写为全部通过。

`npm run format` 仍被基线已有的 6 个未格式化文件阻断，其中包含冻结的 contracts/storage；T-W1-019 修改文件已单独通过 Biome。本任务不借格式化扩大公共契约写入范围。

真实 Chrome/Edge 内置 PDF viewer 跳页与真实外部模型 BYOK 没有在自动化中执行，继续列为人工复验项。以上不构成最终 review、Release Gate、tag 或下一批授权；按 Level 3 交接给独立 reviewer。

产品需求基线：V1.0 产品定义已归档至
`docs/product/versions/科研文献引导式学习平台_V1.0产品定义.md`，开发需求见
`docs/product/v1.0-development-requirements.md`。
RFC-W1-002 仍为 `PROPOSED`；契约版本与状态机部分已通过独立决策记录落地。
`guided-learning.v1` runtime、T-W1-013 API/SQLite runtime、T-W1-014 Worker 生成、T-W1-015 Web Workbench、T-W1-016 验收修复和 T-W1-017 Real BYOK/Evidence Grounding 已集成 main。T-W1-018 的 Worker、PDF、DeepSeek JSON 和 RETRY pointer 阻断均已修复并完成人工复验；当前 V1.0 阻断是 Evidence grounding/resolution，产品负责人批准仍待完成。

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
- 真实 PDF + 引导式学习端到端闭环已由 Mock 自动化覆盖；真实 BYOK 人工验收已完成方向、问题、feedback、RETRY、EDIT_ANSWER 和页面恢复，Evidence grounding 当前仍被全部 claims 降级为 INSUFFICIENT_EVIDENCE 阻塞。

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
- T-W1-015：`REVIEW`，已进入 main；包含 Guided Learning Web 入口、目标/PDF/Session 创建、轮询恢复、方向选择、逐题反馈、Evidence、重试和阶段总结；本轮真实 PDF、BYOK Guided Learning、重试、编辑答案和 URL 恢复人工验收已完成，Evidence grounding 仍为当前发布阻断。
- T-W1-016：`INTEGRATED`，Mock 技术验收通过，发布状态为 `RELEASE_CANDIDATE_WITH_OPEN_BLOCKERS`；真实 BYOK 已完成人工验收，当前发布阻断转为 Evidence grounding。
- T-W1-017：`INTEGRATED`，真实 BYOK Guided Generation、provider config migration、Worker 环境 secret、四类专用输入/输出约束、source-only Evidence verification、PDF content endpoint、刷新恢复和页码定位已进入 main；真实方向、问题、feedback、RETRY 和 EDIT_ANSWER 已人工通过，Evidence grounding 仍待诊断和修复。
- T-W1-018：`IMPLEMENTING`，Worker 轮询、PDF 32 MiB 路由级 bodyLimit、结构化 413、DeepSeek V4 JSON 输出和 RETRY feedback pointer 阻断均已修复并完成人工复验。当前第五阻断是 Evidence grounding/resolution：真实 feedback 成功，但当前题目的 11 个 claims 均为 `INSUFFICIENT_EVIDENCE`、Evidence 数量为 0，confirm gate 正确阻止推进；具体降级根因尚未确定，下一步需要 per-claim 安全 resolution reason diagnostics。不扩大产品范围、不创建 tag。
- T-W1-019：`REVIEW`，稳定化实现与第二轮五项定向修复保留在本地 `fix/v1-stabilization`，等待外部代码审查；Windows managed process smoke 和在线依赖审计仍有上述外部阻塞，不据此宣布 Release Gate 通过。
- T-W1-005：保持 `DRAFT`；扩展后的双模式完整范围尚未进入 main；快速问答子集和 Guided Learning API/SQLite runtime 已存在，其余 Web 和完整产品验收仍待实施。
- T-W1-006：保持 `DRAFT`；最小快速问答 Web 和 T-W1-015 Guided Learning Web 已存在，但其完整任务范围仍待实施。
- 不据此改变其他任务或 Gate 的状态。

## 当前测试状态

- PR #2、PR #3、PR #4 的合并结果已在 main；PR #4 GitHub checks 全部通过。
- T-W1-011 最终契约门禁：`npm run contract:generate`、`npm run contract:check`、`npm run contract` 通过；guided-learning 定向 Vitest 13/13；`npm test` 24/24；lint、typecheck、build、security 通过，security 报告 0 vulnerabilities；`git diff --check` 通过。
- T-W1-014 集成验证：Guided Learning runtime + Worker 定向测试 11/11，runtime integration 25/25，`npm test` 24/24，planning、lint、typecheck、contract、build、security scan 和 `git diff --check` 通过；未执行 online `npm audit`。
- T-W1-015 合并验证（此前自动化记录）：Web API client/轮询 5/5，Guided Learning runtime + Worker 12/12，Playwright Web smoke 3/3（含快速问答回归和 Guided Learning Mock-shaped 流程），runtime integration 26/26，真实 `synthetic-text.pdf` 后端 Mock 闭环保持通过；后续真实 BYOK 人工验收已完成。
- T-W1-016 验收分支验证：全新 SQLite migration 1–5、schema version 5、API/Worker 同库和重启恢复通过；BYOK/Mock 定向 17/17；完整 planning、check、lint、typecheck、runtime integration 26/26、`npm test` 24/24、contract、build、Playwright 3/3、smoke、security scan 和 `git diff --check` 通过。这些证据仅证明 Mock 技术验收，不证明真实模型生成或 V1.0 发布。
- T-W1-017 review repair 定向覆盖：默认 Worker BYOK gateway fake HTTP 四 operation、operation-specific input/output、完整 history、source-only Evidence verification、非蕴含 claim、重复 Evidence 去重、Unicode/code-point offset 和无效输出 fail-closed；Playwright 3/3 仍仅覆盖 BYOK 控件与 Mock UI，真实 BYOK 人工验收另行完成。
- T-W1-017 merge 后 Release Gate 复核：planning 18 tasks、runtime integration 26/26、BYOK/Evidence 13/13、`npm test` 24/24、Playwright 3/3、lint、typecheck、contract、build、smoke、security 和 `git diff --check` 全部通过；PDF fixture SHA-256 保持 `99e07b4ba995b7c90bd84628a5db55b71a4faa1f06d3714a5942741cd39a55f8`。
- T-W1-018 Worker 修复复核：正式入口现在持续调用 `JobRuntime.runOnce()`，无 Job 时默认等待 250ms；stop 后等待当前 Job、单次 close、一次 stopped 输出；定向 Worker loop 9/9 和真实 SQLite Job 消费通过。人工发现的原始阻断已修复。
- T-W1-018 DeepSeek JSON repair：仅 DeepSeek custom base URL 发送 `thinking: { type: "disabled" }`，保留 JSON Output；安全诊断记录 finish reason、content/reasoning 长度和 schema 错误，不记录原文或 secret。定向测试通过，后续真实 DeepSeek feedback 复验已通过。
- T-W1-018 RETRY pointer repair：真实 Session `learning_95664836-e2bb-4c74-9e07-496448c0e3e1` 从 FAILED/revision 11 恢复为 RETRYABLE_FAILURE/revision 12；反馈 Job 指针校验、真实 RETRY、EDIT_ANSWER 和页面恢复均已通过。
- T-W1-018 Evidence grounding blocker：真实安全 Worker 诊断两次 feedback 均 HTTP 200/stop/非空 content/reasoning 长度 0；当前题目 11 个 claims 全为 INSUFFICIENT_EVIDENCE，Evidence projection 为 0，confirm gate 禁止推进。具体 resolveClaim 降级原因尚未确定；需要 per-claim 安全 resolution reason diagnostics。上述摘要只记录状态和计数，不记录答案、claim text、quote 或 secret。
- T-W1-019 第二轮定向验证：Worker service/stop watcher 13/13，Guided Learning HTTP 3/3，Evidence Worker 3/3，BYOK 8/8，PowerShell 静态 5/5，runtime integration 27/27，完整 integration 101/101，`test:v1-smoke` 1/1，Playwright 3/3；lint、typecheck、build、contract 和 platform smoke 通过。离线 security scan 枚举 293 files、扫描 268 text files 并通过。
- Windows managed process smoke 未完成：固定端口 `127.0.0.1:4310` 被仓库外进程占用；`npm test` 因该 1 项失败（其余 29/29 通过）。直接执行 start 已验证返回非零、未创建 `tmp/v1-local/state.json`、未启动或终止任何托管/外部进程。
- 在线依赖门禁未通过：`npm run security` 和 `npm audit --omit=dev` 均报告 transitive `fast-uri` 1 个 high 漏洞；依赖清单不在本轮批准写入边界，未执行 `npm audit fix`。
- 本地完整 `npm run ci` 仍在首步 `format` 受既有 Windows CRLF checkout 问题阻断；本次不批量改写全仓换行。
- `contract:check` 本身已通过；不能把本地 CI 的 CRLF 阻断写成契约 drift 失败。
- T-W1-011 分支未实际运行 smoke；本次文档同步不补写未执行结果，且本轮未修改 runtime。

## 尚未解决的问题

- T-W1-015、T-W1-016 和 T-W1-017 已合并 main；T-W1-018 Release Gate 修复尚未合并 main；真实 BYOK 外部连接、方向、问题、feedback、RETRY、EDIT_ANSWER、PDF 上传和页面恢复已完成人工验收，Evidence 人工抽查因没有 VERIFIED Evidence 阻塞，产品负责人批准尚未完成。
- 全仓 Windows CRLF format 基线治理尚未解决。
- 固定端口 4310 当前被仓库外进程监听，Windows start/check/stop 实机闭环需在端口由用户安全释放后重跑；不得由 Agent 终止该外部进程或切换动态端口。
- transitive `fast-uri` 当前有 1 个 high npm advisory；修复需要另行批准依赖清单变更并重新运行 security/audit。
- RFC-W1-002 仍需完整的产品/技术审批，不因契约决定记录而整体变为 `ACCEPTED`。

## 下一步（不自动执行）

按依赖顺序，下一步应是：

1. 用户安全释放固定端口 4310 后，在 Windows 重跑 `npm test` 和 start/check/stop 实机闭环，核验 Worker `CONTROL_FILE` 事件、停止顺序、状态清理、数据库/content/logs 保留及无托管进程遗留。
2. 另行批准依赖清单修复范围后处理 `fast-uri` advisory，并重跑 `npm run security` 与 `npm audit --omit=dev`；不得在本任务中越界自动修复。
3. 完成 Chrome/Edge PDF viewer、DeepSeek 四 operation 和 Claim/引用科研语义人工复验，再交独立 reviewer；不自动创建 tag。

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
