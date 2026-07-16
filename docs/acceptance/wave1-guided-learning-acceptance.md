# Wave 1 Guided Learning 验收报告

- 验收日期：2026-07-16（Asia/Shanghai）
- 验收分支：`chore/w1-acceptance-release`
- 验收 worktree：`D:\Research-Reading-Worktrees\w1-acceptance-release`
- 验收基线 SHA：`b8e60fc2cd2f0942243b01ae59cce2d962ef56ee`
- Mock 技术验收：`PASS`
- 状态：`RELEASE_CANDIDATE_WITH_OPEN_BLOCKERS`
- Wave 1 发布判定：`BLOCKED`

## 环境

- Windows PowerShell
- Node.js `v24.16.0`
- npm `11.13.0`
- 数据库：全新临时 SQLite，未复用开发数据库
- PDF fixture：`tests/fixtures/pdf/synthetic-text.pdf`
- PDF SHA-256：`99e07b4ba995b7c90bd84628a5db55b71a4faa1f06d3714a5942741cd39a55f8`
- fixture manifest：CC0-1.0 synthetic，manifest、source 和 hash 一致

## 自动化验收

| 项目 | 结果 |
|---|---|
| `node scripts/check-wave1-planning.mjs` | 通过；16 个任务，无依赖环、无 ownership overlap |
| `node scripts/check.mjs all` | 通过 |
| `npm run build:backend-packages` | 通过 |
| `npm run lint` | 通过；73 files |
| `npm run typecheck` | 通过 |
| `npm run test:runtime-integration` | 通过；6 files / 26 tests |
| `npm test` | 通过；3 files / 24 tests |
| `npm run contract` | 通过；10 个 generated types 无 drift |
| `npm run build` | 通过 |
| `npm run e2e:smoke` | 通过；3/3，含快速问答和 Guided Learning |
| `npm run smoke` | 通过；API、Worker、Web shell |
| `node scripts/security-scan.mjs --skip-audit` | 通过；263 files enumerated、242 text files scanned |
| Guided Learning API client/轮询 | 通过；5/5 |
| Guided Learning runtime + Worker | 通过；12/12 |
| BYOK、session secret、Mock gateway | 通过；3 files / 17 tests |
| `git diff --check` | 通过 |

## 全新数据库和迁移

全新 SQLite 目录 `D:\Research-Reading-Acceptance\wave1` 验收通过：

- migration 顺序 `1,2,3,4,5`，最终 schema version 为 `5`；重复打开保持 `1,2,3,4,5`。
- `journal_mode=wal`、`foreign_keys=1`。
- 既有 `DOCUMENT_IMPORT`、`QUESTION_PLAN`、`ANSWER_GENERATION` 和四类 Guided Learning Job kind 均保留。
- Guided Learning tables、session/command/failure indexes、Evidence 复合主键和 `(session_id, question_id)` 外键存在；外键删除规则为 cascade。
- API runtime 与 Worker runtime 同时打开同一 SQLite 数据库成功。
- 验收数据库、content root 和日志未提交 Git。

## Mock Guided Learning、恢复和边界

- Worker 测试覆盖真实 synthetic PDF 的 Session → Job → Worker → Evidence → Summary、四类 handler、幂等和失败恢复。
- Playwright 通过 Mock-shaped Web 闭环，包含方向、逐题回答、失败/RETRY、Evidence、阶段总结和 URL Session 刷新恢复。
- API/Worker 进程使用同一持久数据库分别启动、关闭并再次启动成功；Session 和 QUEUED Direction Job 关闭后可恢复。
- runtime 测试覆盖 `EDIT_ANSWER` 清理旧 feedback/reference answer/Evidence 并重新入队 feedback Job。
- runtime 测试覆盖 Evidence document version、页码、code-point 坐标、quote、page hash、profile、verification、claim refs 和 insufficient-evidence 边界。
- CORS：`127.0.0.1:4173`、`localhost:4173` 允许；远程 origin 无 allow-origin；无 Origin 的 `/health` 正常。
- 快速问答 Playwright 和 API/runtime 回归通过，入口未被 Guided Learning 破坏。

## BYOK 与人工验收

BYOK 自动安全检查已通过 17/17，确认 session key 不进入 API 结果或 SQLite，错误分类和 provider HTTP 映射正常。

真实 BYOK 人工验收状态：`BLOCKED_BY_MISSING_USER_CREDENTIALS`。当前环境没有用户提供的 provider、endpoint、model 和 API key；未读取、索取或伪造凭据，未将 Mock 结果写成真实 BYOK 结果。缺少凭据不是唯一发布阻塞项：当前 Guided Learning Job 仍固定使用 `{ provider: "MOCK", fixture_id: "guided-learning-v1" }`，API 与 Worker 没有统一的真实 Worker secret 路径，方向/问题/点评/总结仍是固定模板，Evidence 只有结构校验而没有语义 grounding，PDF object URL 刷新后消失且 Evidence 没有页码跳转。需要人工验收时，按 [本地运行手册](../operations/wave1-local-runbook.md) 由操作员安全提供凭据。

## 验收结论边界

- migration、Mock 全链路、刷新/重启恢复、失败/RETRY、EDIT_ANSWER、Evidence 结构、BYOK 错误分类修复和自动化门禁均保留并通过。
- 上述结果的适用范围是 `MOCK_TECHNICAL_ACCEPTANCE_ONLY`，不能推导出真实模型生成或 V1.0 发布通过。
- 五项发布阻塞项为：真实 provider 生成路径、API/Worker 共享 secret、模型驱动内容、语义 Evidence grounding、PDF 刷新恢复与页码跳转。
- 需要 T-W1-017 完成并由人类项目负责人在真实 BYOK 最小闭环后作最终产品决定。

## 修复记录

验收发现的高严重度问题为跨 workspace `RuntimeSecretError` 类实例导致清除 Session Key 后错误被分类为 `UNKNOWN`。已在 `packages/model-gateway/src/openai-compatible.ts` 做最小结构化错误识别修复，提交为 `5443766`，修复后完整验证集合重新通过。

## 已知限制和发布条件

- 未执行 online `npm audit`；本轮只执行离线 security scan，原因是验收不依赖外部 Registry，且仓库既有 Windows CRLF 问题不应通过批量格式化掩盖。
- 未完成人工真实 BYOK 和人类项目负责人最终产品验收；这不阻塞 Mock Wave 1 技术发布判定，但必须在对外宣称真实模型能力前完成。
- `ANALYZE`、`TRANSFER`、OCR、扫描 PDF、复杂视觉理解、远程部署和完整产品 Gate 仍未开放。
- 未运行全仓 `npm run format`，避免既有 CRLF 假差异；contract 和 `git diff --check` 已单独通过。

Mock 技术验收通过，但由于上述五项阻塞项，Wave 1 只能标记为 `RELEASE_CANDIDATE_WITH_OPEN_BLOCKERS`，V1.0 发布为 `BLOCKED`。在 T-W1-017 完成真实 BYOK/模型驱动生成、Evidence grounding、统一 Worker secret 和 PDF 恢复/页码跳转，并完成真实 BYOK 人工验收前，不得标记为正式 `ACCEPTED`。

## 后续建议

1. 集成本报告作为 Mock 技术验收证据，但保持 V1.0 发布阻塞。
2. 实施 T-W1-017，完成真实 BYOK、模型驱动生成、Evidence grounding 和 PDF 恢复/页码跳转。
3. 提供真实 BYOK 凭据后执行本地人工连接和最小生成/Evidence 验收，再由主控 Agent 按治理流程请求产品决定。
