# T-W1-018 V1.0 Release Gate

## 基本信息

- 验收日期：2026-07-17（Asia/Shanghai）
- 分支：`chore/v1-release-gate`
- worktree：`D:\Research-Reading-Worktrees\v1-release-gate`
- 验收基线：`54043fb28cb082eb871773732bafce0f031fc562`
- 操作系统：Windows PowerShell
- Node/npm：Node `v24.16.0`，npm `11.13.0`
- 任务状态：`IMPLEMENTING`

## 自动发布 Gate

本次人工验收首先发现正式 `npm run worker` 入口只打印 `worker_platform_shell_ready` 后退出，未消费 SQLite Job 队列；这是 V1.0 发布阻断。已在本分支加入持久轮询与 graceful shutdown 修复，并重新执行以下自动化 Gate。

| 检查 | 结果 |
|---|---|
| migration 001–006 / schema version 6 | 通过；全新 SQLite 测试覆盖，provider config 表存在 |
| Wave 1 planning | 通过；当前 19 tasks（阶段 A 合并前 main 为 18，新增 T-W1-018 后为 19），无依赖环、无 ownership overlap |
| `node scripts/check.mjs all` | 通过 |
| `npm run lint` | 通过；75 files |
| `npm run typecheck` | 通过 |
| `npm run test:runtime-integration` | 通过；26/26 |
| BYOK/Evidence 定向 | 通过；13/13 |
| `npm test` | 通过；24/24 |
| `npm run contract` | 通过；contract generate/check 无 drift |
| `npm run build` | 通过 |
| `npm run e2e:smoke` | 通过；Playwright 3/3 |
| `npm run smoke` | 通过；loopback API/Worker/Web |
| security scan | 通过；`--skip-audit` |
| `git diff --check` | 通过 |
| Worker loop 定向测试 | 通过；9/9 |

PDF fixture SHA-256 保持：

```text
99e07b4ba995b7c90bd84628a5db55b71a4faa1f06d3714a5942741cd39a55f8
```

自动化证据覆盖真实 PDF Mock 闭环、快速问答回归、Session 刷新/重启恢复、RETRY、EDIT_ANSWER、PDF content endpoint、Evidence 页码定位、provider config 白名单和 secret 边界。Worker loop 定向测试覆盖顺序 `runOnce`、idle wait、stop 边界、当前 Job 完成、单次 close、smoke 和真实 SQLite Job 消费。fake provider 只证明适配器与 Worker 链路，不等价于真实外部 BYOK。

Worker CLI 检查：构建后的正式 Worker ready 后保持运行，smoke 子进程立即以 code 0 退出；用户终端 Ctrl+C graceful shutdown 已人工通过，输出一次 stopped 并正常退出。等价的 AbortSignal graceful-stop、当前 Job 等待和单次 close 仍由 Worker loop 9/9 覆盖。

## 真实 PDF 上传阻断与修复

人工验收使用了 8.34 MiB（8,745,861 bytes）的真实文本 PDF。浏览器上传时出现 `ERR_CONNECTION_ABORTED`，但 `/health` 仍正常；根因为 PDF 上传请求在 Fastify 默认 1 MiB bodyLimit 的内容解析阶段被拒绝。这属于 V1.0 发布阻断。

本分支已将 `POST /api/v1/projects/:projectId/documents` 改为路由级 32 MiB 上限（`PDF_UPLOAD_MAX_BYTES = 32 * 1024 * 1024`），没有扩大普通 JSON 路由的全局限制。超过上限返回带 CORS 的 api.v1 `413/PDF_TOO_LARGE` JSON envelope；Web API client 将其显示为可读业务错误，允许用户重新选择较小文件。动态 2 MiB 和约 9 MiB 测试、超限 413/无持久化对象测试及前端错误测试已通过；本轮完整自动 Gate、live API 验证和 `git diff --check` 均通过。

真实 8.34 MiB PDF（8,745,861 bytes）的浏览器重新上传已由用户人工复验通过（PASS）。

## 第三个真实 BYOK 阻断：DeepSeek Guided Feedback JSON

真实验收使用 DeepSeek OpenAI-compatible API（`CUSTOM_OPENAI_COMPATIBLE`、`https://api.deepseek.com`、`deepseek-v4-pro`）。连接测试、学习方向生成和 6 个问题生成成功；第一题提交后 `GENERATE_FEEDBACK` 连续两次失败，页面停留在 `RETRYABLE_FAILURE`，错误为 `The model provider message content was not valid JSON.`，第一次失败 revision 7，手动重试后 revision 9。这是 V1.0 发布阻断。

调查确认原请求保留了 `response_format: { type: "json_object" }` 和 `max_tokens: 2000`，但没有发送 DeepSeek V4 所需的显式非思考配置，也没有为每个 operation 提供完整 JSON 示例或检查 `finish_reason`/空 content。DeepSeek 官方文档说明 thinking 默认开启、JSON Output 要求提示中出现 JSON 并提供示例，且 `finish_reason=length` 可能截断 content、content 也可能为空。因此代码层根因为 DeepSeek V4 thinking/JSON Output 兼容边界未被显式处理；旧 Worker 没有安全诊断字段，无法从历史日志确定两次失败究竟是截断、空 content 还是 malformed JSON。

修复为：仅当 provider 为 `CUSTOM_OPENAI_COMPATIBLE` 且 base URL hostname 为 `api.deepseek.com` 时，对结构化 operation 增加 `thinking: { type: "disabled" }`；保留 `response_format`；四类 Guided Learning prompt 增加完整 JSON 示例并禁止 Markdown/code fence/额外文本；解析前安全记录 HTTP status、finish reason、content null/长度、reasoning 长度、provider、model、operation；对截断、空/NULL content、provider schema invalid 和 malformed JSON 返回可诊断但不泄露原文的错误。其他 OpenAI-compatible provider 不接收 DeepSeek 专有字段，`max_tokens=2000` 继续作为有限上限，`finish_reason=length` fail closed，不伪造成功。

定向网关与 Guided Learning 测试通过 17/17。`npm run ci` 已执行，但首步 `format` 仍因仓库既有 17 个格式差异失败；未执行全仓格式化。其余 CI 门禁已独立通过：lint、typecheck、runtime integration 26/26、`npm test` 24/24、contract、build、smoke、e2e smoke 3/3、security 和 `git diff --check`。此前记录中的“真实浏览器重试仍待用户人工复验”已由后续真实验收完成；DeepSeek JSON repair 和反馈指针修复均已通过真实复验。

## 第四个真实发布阻断：RETRY 丢失反馈题目指针

真实验收 Session `learning_95664836-e2bb-4c74-9e07-496448c0e3e1` 在第一题反馈失败后处于 `FAILED`、revision 11；页面错误为 `Feedback question pointer changed`。这是 V1.0 发布阻断。根因是 `SUBMIT_ANSWER`/`EDIT_ANSWER` 创建反馈 Job 时传入了当前题目，但 RETRY 分支没有传入题目，导致 Job 缺少 `question_id`/`question_order`；Worker 在模型调用完成后的检查才发现指针缺失，且该错误被归类为不可重试失败。

修复为按明确 Job kind 决定题目指针边界：反馈生成 Job 在 API 创建时必须包含合法的当前题目 id/order，方向、问题和阶段总结 Job 不携带题目指针；Worker parsePayload 和反馈入口在模型调用前 fail closed 校验指针。回归测试覆盖 SUBMIT_ANSWER、EDIT_ANSWER、反馈 RETRY、三类非反馈 RETRY、缺失指针不调用 ModelGateway、完整失败恢复/成功和幂等重放。

为恢复既有验收数据，新增 `scripts/repair-wave1-manual-session.mjs`。脚本只允许固定的 `D:\Research-Reading-Acceptance\wave1-manual\run.sqlite` 和上述 Session，严格校验 FAILED/revision 11/UNDERSTAND/第一题已有答案及指定 failure 字段后，在一个 SQLite transaction 中将 Session 恢复为 `RETRYABLE_FAILURE`、revision 12，并把同一 active failure 改为 retryable。脚本不修改项目、PDF、答案、问题、证据或 provider config，不伪造反馈，重复执行安全退出且不产生二次修改。恢复前后只输出非敏感摘要。

自动化修复后，用户已刷新页面并直接 RETRY；原 Session 从 FAILED/revision 11 恢复至 RETRYABLE_FAILURE/revision 12 后，真实反馈、EDIT_ANSWER 重新生成和 guidedSession URL 恢复均通过。该复验不要求重新创建项目、上传 PDF、选方向或回答问题。

本轮修复复核结果：题目指针定向测试 5 个文件 32/32，通过；planning 19 tasks、`check.mjs all`、lint、typecheck、runtime integration 26/26、`npm test` 24/24、contract、build、e2e smoke 3/3、smoke、安全扫描和 `git diff --check` 均通过。恢复脚本首次执行完成事务恢复，第二次执行报告 `already_repaired` 且无二次修改。

## 第五个真实发布阻断：Evidence grounding 全部降级为 INSUFFICIENT_EVIDENCE

真实反馈请求已经成功完成，不能把当前现象误写成 DeepSeek 网络失败或 JSON 解析失败。两次 `GENERATE_GUIDED_FEEDBACK` 的安全 Worker 诊断均为 HTTP 200、`finish_reason=stop`、非空 content、`reasoning_content_length=0`；日志只记录 operation/provider/model、状态和长度，不记录模型响应原文、用户答案或论文内容。第一次 RETRY 和 EDIT_ANSWER 重新生成均返回成功。

但真实反馈页中所有 reference answer claims 均显示 `INSUFFICIENT_EVIDENCE`，Evidence 原文区域为空，没有 page number、quote、verification status 或定位按钮，“确认并进入下一题”被禁用；修改答案后再次生成仍复现。服务端的 confirm gate 正确阻止没有 `VERIFIED` Evidence 的问题推进，这是安全边界的正确表现，不应通过放宽 source verification 或模糊匹配绕过。

当前阻断是 `EVIDENCE_GROUNDING / EVIDENCE_RESOLUTION`，第五阻断的具体根因尚未确定。已知 `resolveClaim` 会在 claim 自身声明不足、context span 缺失/不存在、document version 不匹配、quote 缺失、quote 长度越界或 canonical page text 中非唯一精确匹配时降级；当前代码尚未记录具体降级原因。下一步应增加每个 claim 的安全 resolution reason 诊断，只记录分类、计数和必要的非敏感标识，不记录 claim text、quote、论文全文或 secret。

指定 SQLite 的只读摘要为：Session 当前 `FEEDBACK_READY`、revision 16、current question order 1、当前题目 status `FEEDBACK_READY`；Evidence projection 数量 0，当前 reference answer claims 数量 11，claim_type 均为 `INSUFFICIENT_EVIDENCE`。未修改数据库。

## 真实 BYOK 与浏览器状态

真实 BYOK 凭据已由安全环境提供并可用；本记录不打印、不保存或提交其值。真实人工验收结果：

```text
REAL_BYOK_CONNECTION = PASS
BROWSER_REAL_BYOK_DIRECTIONS = PASS
BROWSER_REAL_BYOK_QUESTIONS = PASS
BROWSER_REAL_BYOK_FEEDBACK = PASS
RETRY_POINTER_MANUAL_ACCEPTANCE = PASS
EDIT_ANSWER_REGENERATION = PASS
BROWSER_GUIDED_SESSION_RESTORE = PASS
```

真实验收已覆盖 Worker 正式入口持续运行及 Ctrl+C graceful shutdown、真实 PDF 上传、DeepSeek `/models` 连接、服务端连接测试、方向、路线锁定、6 个问题、第一题答案、feedback、RETRY、EDIT_ANSWER 和页面关闭后的 guidedSession URL 恢复。现有 Playwright 3/3 仍只描述为：

```text
BYOK controls + Mock Guided Learning UI flow
```

## Evidence、产品和安全人工 Gate

- Evidence 人工抽查：`BLOCKED_NO_VERIFIED_EVIDENCE`；当前没有 VERIFIED Evidence，无法执行有意义的语义人工抽查；服务端只保证 canonical source verification，不宣称语义蕴含证明。
- Evidence grounding：`BLOCKED`；confirm gate 正确阻止推进，等待安全 resolution diagnostics 和后续修复。
- Secret 检查：自动化通过；未发现 key 进入 SQLite、Job、Session、response、日志、URL、Git 工作区或发布材料。
- PDF 恢复/页码跳转：真实 PDF 上传已人工 PASS，当前 Evidence 缺失导致 Evidence 定位控件无法验收。
- 快速问答回归：自动化通过。
- 产品负责人批准：`PENDING`。

## 最终发布判定

```text
AUTOMATED_RELEASE_GATE = PASS
REAL_BYOK_CONNECTION = PASS
BROWSER_REAL_BYOK_DIRECTIONS = PASS
BROWSER_REAL_BYOK_QUESTIONS = PASS
BROWSER_REAL_BYOK_FEEDBACK = PASS
RETRY_POINTER_MANUAL_ACCEPTANCE = PASS
EDIT_ANSWER_REGENERATION = PASS
EVIDENCE_GROUNDING = BLOCKED
HUMAN_EVIDENCE_REVIEW = BLOCKED_NO_VERIFIED_EVIDENCE
SECURITY_SECRET_CHECK = PASS
PRODUCT_OWNER_APPROVAL = PENDING
V1_RELEASE_STATUS = BLOCKED_BY_EVIDENCE_GROUNDING
```

因此当前不能标记 `ACCEPTED` 或 `RELEASED`，不创建 `v1.0.0` tag，不创建 GitHub Release。下一步是增加安全的 per-claim Evidence resolution diagnostics、定位全部 claims 被降级的具体分类并完成 Evidence grounding 修复；修复后仍需 Evidence 人工抽查和产品负责人批准。
