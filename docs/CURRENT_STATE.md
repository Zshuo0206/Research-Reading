# Current State

最后更新：2026-07-15（Asia/Shanghai）
状态：`WAVE_1_GUIDED_LEARNING_CONTRACT_INTEGRATED_RUNTIME_PENDING`

产品需求基线：V1.0 产品定义已归档至
`docs/product/versions/科研文献引导式学习平台_V1.0产品定义.md`，开发需求见
`docs/product/v1.0-development-requirements.md`。
RFC-W1-002 仍为 `PROPOSED`；契约版本与状态机部分已通过独立决策记录落地。
`guided-learning.v1` runtime 尚未进入 main；API/SQLite runtime 已由主控作为独立任务
T-W1-013 授权并在隔离 worktree 中推进，当前尚未集成。后续 Worker、Web、E2E 和验收
任务仍需按依赖单独授权。

## main 当前基线

- `main`、`origin/main` 和当前合并基线为 `2efdcd3aafe42bdbf3ad44baa268b43f523e40f6`。
- PR #2、PR #3、PR #4 已合并；PR #4 合并了 `guided-learning.v1` 契约实现。
- T-W1-011 功能分支和临时 worktree 已清理；T-W1-013 是另一个独立的未集成开发环境，其代码不计入 main 当前能力。

## 当前 Wave

Wave 1 已进入基础运行时和公共契约集成阶段。快速问答模式继续保留，
`guided-learning.v1` 已进入 main，但其 runtime 尚未进入 main；T-W1-013 正在隔离环境中推进。

## 已实现能力

当前 main 中已有：

- SQLite、SQL migration、storage repository 和 Job runtime；
- 内容寻址的真实文本型 PDF 上传、按页提取、canonical page text、页面 SHA-256、extraction profile 和 Evidence 坐标基础；
- 确定性的无网络 `MockModelGateway`；
- OpenAI-compatible BYOK adapter、provider preset、连接测试和会话内存 secret；
- 快速问答 Workflow API/HTTP、问题计划和回答生成 Worker handler、revision/review/verification 与 Evidence 物化路径；
- 最小快速问答 Web 工作台和 loopback 平台入口；
- `guided-learning.v1` Schema、生成类型、Session/Command 分支、状态机、幂等 fingerprint、failure resume、Evidence 确认门、跨字段一致性校验、fixtures 和正负契约测试。

## 仅有契约/骨架、runtime 尚未进入 main

`guided-learning.v1` 当前已经形成可测试的公共契约和状态机；其 runtime 尚未进入 main。
API/SQLite 部分由独立任务 T-W1-013 推进，当前仍未集成。main 尚未包含：

- 引导式学习 API Session/Command 持久化和 HTTP runtime；
- 引导式学习专用数据库表、字段和 migration；
- 候选方向、路线、逐题问题、点评、参考答案和阶段总结的 Worker 生成；
- 引导式学习 Web 交互；
- 真实 PDF + 引导式学习端到端闭环验收。

## 已冻结的边界与 Gate

- 快速问答与引导式学习是两个模式；后续实现必须按 `schema_version`/模式分流，不能混用状态语义。
- 客户端不能推进服务端 `state`、`route`、`feedback`、`summary`、`failure` 或 Evidence `verification_status`。
- `ANALYZE` 和 `TRANSFER` 在 V1.0 继续锁定。
- 只允许本地 `127.0.0.1` 部署；不开放远程监听、共享密钥、OCR、扫描 PDF、复杂表格/公式理解、多篇综合、资产库、导出或协作。
- T-W1-011 契约任务已通过实际审查、PR checks 并合并；这不等于整个 Wave 1 Gate 或引导式学习 runtime 已进入 main。
- T-W1-013 已由主控确定并授权为独立开发任务，隔离分支基于 `2efdcd3` 推进，尚未集成；不把其分支代码计入 main 当前能力。
- 技术方案文档保留 Gate A `REPAIR_REVIEW_PENDING`、Gate B `GRANTED（仅已批准的第一批）` 和 Gate C `LOCKED` 的治理边界；本次同步不擅自扩大 Gate。
- RFC-W1-002 整体仍为 `PROPOSED`；契约部分以 `docs/contracts/guided-learning-contract-version-decision.md` 的独立技术决定为准。

## 任务状态

- T-W1-010：`INTEGRATED`，V1.0 产品定义归档和开发需求基线已进入 main。
- T-W1-011：`INTEGRATED`，`guided-learning.v1` 公共契约、状态机、生成类型、fixtures 和测试已进入 main。
- T-W1-012：`DONE`，本次文档与正式状态同步任务。
- T-W1-005：保持 `DRAFT`；扩展后的双模式完整范围尚未进入 main；快速问答子集已存在，guided-learning API/SQLite 部分正在独立任务中推进，其余 Worker 和完整流程仍待实施。
- T-W1-006：保持 `DRAFT`；最小快速问答 Web 已存在；引导式学习 Web 尚未实施。
- 不据此改变其他任务或 Gate 的状态。

## 当前测试状态

- PR #2、PR #3、PR #4 的合并结果已在 main；PR #4 GitHub checks 全部通过。
- T-W1-011 最终契约门禁：`npm run contract:generate`、`npm run contract:check`、`npm run contract` 通过；guided-learning 定向 Vitest 13/13；`npm test` 24/24；lint、typecheck、build、security 通过，security 报告 0 vulnerabilities；`git diff --check` 通过。
- 本地完整 `npm run ci` 仍在首步 `format` 受既有 Windows CRLF checkout 问题阻断；本次不批量改写全仓换行。
- `contract:check` 本身已通过；不能把本地 CI 的 CRLF 阻断写成契约 drift 失败。
- T-W1-011 分支未实际运行 smoke；本次文档同步不补写未执行结果，且本轮未修改 runtime。

## 尚未解决的问题

- guided-learning.v1 API/SQLite runtime 尚未进入 main；T-W1-013 已授权并在隔离环境推进，Worker 生成、Web 交互和真实 PDF 引导式学习端到端验收尚未实现。
- 全仓 Windows CRLF format 基线治理尚未解决。
- RFC-W1-002 仍需完整的产品/技术审批，不因契约决定记录而整体变为 `ACCEPTED`。

## 下一步（不自动执行）

按依赖顺序，下一步应是：

1. 跟踪独立任务 T-W1-013 的 API/SQLite runtime 实现，待其验证后再集成 main。
2. 实现方向、问题、点评、参考答案和阶段总结的 Worker 生成。
3. 实现目标输入、方向选择、路线、逐题学习和阶段总结 Web 交互。
4. 使用真实可提取文本 PDF 完成 Mock 端到端测试，再执行 BYOK 人工验收和完整产品验收。

不自动扩大 T-W1-005/T-W1-006 的范围；T-W1-013 保持独立隔离，不因本次文档同步而计入 main。

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
