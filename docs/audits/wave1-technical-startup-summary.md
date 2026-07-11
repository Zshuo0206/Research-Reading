# Wave 1 Technical Startup Summary

- 日期：2026-07-11（Asia/Shanghai）
- 第一批状态：`T-W1-001 REVIEW; T-W1-002 REVIEW; T-W1-007 PARTIAL`
- 产品范围状态：`PRODUCT_SCOPE_APPROVED`
- Gate A 技术方案冻结：`REPAIR_REVIEW_PENDING`
- Gate B 编码授权：`GRANTED`（仅限本提示词规定的第一批）
- Gate C 业务任务解锁：`LOCKED`
- 主控 Agent：Orchestrator
- 独立 QA owner：`qa-evaluation-agent`
- RFC：`RFC-W1-001`，状态 `REPAIR_PENDING_REVIEW`

## 1. 整改结论

Wave 1 产品范围保持不变，启动材料已按本次整改决定同步。第一批修复已完成，T-W1-001/T-W1-002 等待独立复核，T-W1-007 保持 PARTIAL；本分支未调用外部模型。

技术材料现在将三个 Gate 分开：Gate A 只冻结方案和契约，不要求实现；Gate B 由人类项目负责人单独授权编码；Gate C 由主控逐任务解锁。当前三个 Gate 均未自动推进。

## 2. 技术基线

- Node 24作为更新的LTS目标基线；Node 22仍处于LTS支持期，Node 22 只作为 Wave 0 迁移前基线。
- Wave 1 仅支持本地部署：API/Web 监听 `127.0.0.1`，不开放远程监听；认证主体定义为本地操作员，不使用没有认证主体的“项目级授权”表述。
- SQLite 使用 WAL、5 秒 busy timeout、原子 Job claim、60 秒 lease、20 秒续租、崩溃恢复、checkpoint 和 online backup。
- PDF 限制：50 MiB、300 页、10,000,000 Unicode code points、30 秒提取超时、256 MiB 单文档 Worker 内存预算；加密/损坏文件拒绝，临时文件 finally + sweeper 清理。
- `canonical_page_text`、Unicode code point offset、`[start,end)`、精确 quote、UTF-8 SHA-256 和 `pdfjs-text-v1` profile 已定义。
- ModelGateway 只允许模型返回服务端生成的 `context_span_id`/候选引用；最终 EvidenceSpan 由服务端物化和验证。
- `question-plan.v1` 增加 `document_language`、`retrieval_queries`、`retrieval_terms`，支持中文问题与英文论文的词法检索。

## 3. 外部模型范围决定

Wave 1 同时包含 `ModelGateway.v1`、确定性 Mock 和统一 OpenAI-compatible BYOK 适配器。适配器必须支持 OpenAI、Gemini、Groq、OpenRouter 预设，以及自定义 HTTPS `base_url` 和模型名称；连接测试和运行时 BYOK secret 边界属于适配器任务。

Mock 用于 CI、自动测试、无网络开发、确定性失败和前端/状态机开发；真实适配器用于用户实际使用和本地人工验收，验证结构化输出与证据引用。真实外部调用不进入普通 CI，也不提供平台共享密钥。API Key 不写入 Git、SQLite、日志、审计、导出或 fixture；只允许环境变量或当前应用运行会话内存，浏览器不得直连供应商。

## 4. 任务拆分和并行关系

| 任务 | 内容 | 依赖 | 可并行性 |
|---|---|---|---|
| T-W1-001 | 公共契约、revision/status、Job 迁移、canonical text 和 Gateway 引用 | 无 | Gate A 起点 |
| T-W1-002 | Node 24、依赖、本地部署边界和真实 CI | 001 | 001 通过 Gate A 后 |
| T-W1-003A | SQLite/WAL、文件对象和 Job runtime | 001、002 | 可与 003B、004、006A、007 的准备并行 |
| T-W1-003B | PDF 资源限制、提取 profile、canonical text 和 Evidence | 001、002 | 可与 003A、004、006A、007 的准备并行 |
| T-W1-004A | ModelGateway 接口、Mock、Schema、context span 和输出验证 | 001、002 | 不等待真实 PDF 或 provider |
| T-W1-004B | OpenAI-compatible BYOK 适配器、预设、连接测试和密钥边界 | 001、002 | 依赖契约；真实调用仅人工验收 |
| T-W1-006A | 基于契约的 Web 骨架和 PR smoke harness | 001、002 | 可早于 API，与 003A/003B/004A/004B/007 并行 |
| T-W1-007 | 固定评测资料、许可 manifest、人工参考和独立 QA 计划 | 001 | 资料准备可最早并行，执行报告后补 |
| T-W1-005 | 项目和问题—回答工作流 API | 001、003A、003B、004A、004B | 集成主干 |
| T-W1-006 | Web 闭环集成 | 001、005、006A | 依赖 API |
| T-W1-008 | Gate 后集成、确定性 CI、PR smoke、恢复和验收 | 001、002、003A、003B、004A、004B、005、006A、006、007 | 最终串行 |

推荐集成顺序：`001 → 002 → (003A ∥ 003B ∥ 004A ∥ 004B ∥ 006A ∥ 007) → 005 → 006 → 008`。T-W1-003 已拆分，避免把存储、Job、PDF 和 Evidence 强行绑定为一个大任务。

## 5. QA 与指标边界

独立 QA owner 固定为 `qa-evaluation-agent`，只写评测/QA 路径，不修改实现模块。QA 独立复核契约、迁移、资源限制、失败恢复、Playwright smoke、固定评测和证据；主控复跑关键命令并核对 ownership。

确定性 CI 合并门槛：format、lint、typecheck、unit、contract、migration、build、PR Playwright smoke、secret/dependency/license scan。PR smoke 覆盖 loopback、创建项目、许可 PDF fixture、方法学习、Mock 问题、确认问题、带证据回答和确认回答。

问题可用率、带证据回答的用户接受率、修改率和拒绝原因是产品观察指标，通过固定评测和人工审阅报告观察，不作为确定性 CI 阻断条件。

## 6. 已执行与尚未执行的检查

- Node `v24.16.0`、`npm ci`、format、lint、typecheck、Vitest、Ajv contract、build、secret scan、npm audit、license check、规划一致性和 `git diff --check` 已执行并通过。
- 未执行 PDF、数据库、Mock Gateway 运行时、BYOK HTTP、工作流 API、Web 或 E2E 业务测试；这些属于后续任务。
- 未调用真实外部模型；真实 BYOK 调用保留为人工验收项，不进入普通 CI。
- 第一批不创建 PDF、SQLite、Mock Gateway 或 BYOK HTTP 运行实现。
- 本次人类决定记录了第一批范围与 Gate B `GRANTED`；整改后 Gate A 为 `REPAIR_REVIEW_PENDING`，Gate C 为 `LOCKED`，其余任务保持 `DRAFT/LOCKED`。

这些不是已通过项，而是本次明确保持范围边界后的未执行项；不得因为第一批完成而自动推进。

## 7. 启动状态

第一批整改已完成待独立复核，T-W1-007 因无可再分发论文 PDF 为 `PARTIAL`。当前停止，不自动进入 SQLite、PDF、Gateway 运行实现或 Web 业务开发。
