# T-W1-011 契约版本决策：guided-learning.v1

日期：2026-07-15
任务：T-W1-011 — 细化引导式学习公共契约与状态机

## 决策

选择新增 `guided-learning.v1`，并保留现有 `wave1.v1` 及其下的快速问答契约原样可用。

新 Schema 位于 `packages/contracts/wave1/guided-learning.v1.schema.json`，生成类型由仓库现有 `contract-generate.mjs` 生成。引导式学习消息使用独立的 `SESSION` 和 `COMMAND` 分支；快速问答继续使用 `api.v1`、`question-plan.v1`、`answer.v1`、`evidence.v1` 和 `model-gateway.v1`。

## 方案比较

| 维度 | 扩展 `wave1.v1` | 新增 `guided-learning.v1` |
| --- | --- | --- |
| 快速问答读取兼容性 | 需要所有客户端理解新的模式、状态和可选字段 | 旧客户端继续读取原 Schema，不需要识别新模式 |
| Schema/生成类型风险 | 修改现有 union、生成类型和 fixture，容易产生隐性破坏 | 新增独立生成文件，既有生成类型保持稳定 |
| 状态分支清晰度 | 快速问答确认状态与逐题学习状态混在同一版本 | `GUIDED_LEARNING`、路线和逐题状态独立表达 |
| 后续 API/Worker/Web 成本 | 需要在所有旧路径加入模式分支 | 新 owner 只实现新版本，快速问答路径保持稳定 |
| 回滚能力 | 需要回滚共享 Schema 及可能已发送的扩展字段 | 删除或停用新版本即可，`wave1.v1` 不受影响 |
| fixture/drift 维护 | 一个版本同时承载两套语义 | 新 fixture 和生成类型独立，漂移范围可定位 |
| 服务端状态边界 | 客户端更容易提交字段造成状态混用 | COMMAND 不包含 route、state、feedback 或 Evidence 验证状态 |

因此否决在 `wave1.v1` 中兼容扩展的方案。新增版本的成本是多一个 Schema 和版本协商入口，但这是隔离状态语义、保护现有快速问答的最小代价。

## 兼容性保证

- 现有 `wave1.v1` Schema、快速问答 Schema、生成类型和 fixture 未改变。
- `CONTRACT_VERSIONS` 保留原有快速问答版本集合；`SUPPORTED_CONTRACT_VERSIONS` 额外声明 `guided-learning.v1`。
- 快速问答客户端不得把 `guided-learning.v1` 当作 `api.v1` 或 `question-plan.v1` 读取；后续 API 必须按 `schema_version` 选择解析器。
- Evidence 复用现有 `evidence.v1` 的 `document_version_id`、页码、canonical page hash、profile、code-point 区间、quote 和服务端验证状态字段。
- 引导式学习只保留当前最新版用户回答，不新增快速问答的正式研究资产确认语义或回答版本历史。

## 迁移与回滚

本任务不修改数据库，不执行自动迁移。后续 API/Worker 实现必须显式创建或读取 `guided-learning.v1` 会话；已有快速问答记录不迁移、不改写。若新版本需要持久化字段，必须由后续 workflow owner 单独提交数据库设计和迁移审查。

回滚时停用 `guided-learning.v1` 的协商入口并撤回其 Schema、生成类型、fixtures 和契约测试；保留 `wave1.v1` 及既有快速问答实现。由于本版本不改变既有 Schema 或数据库，回滚不需要数据反向迁移。

## 后续 owner 约束

### API owner

- 创建会话后固定 `mode=GUIDED_LEARNING`，不能通过写请求切换为快速问答。
- 必须按状态机检查当前状态、当前题号、方向 ID 和幂等键；不能信任客户端提交的 state、route、stage、feedback、summary 或 verification 状态。
- `SUBMIT_ANSWER` 与 `SKIP_QUESTION` 只能在等待当前题回答时择一成功；`CONFIRM_QUESTION` 只能在服务端生成点评、参考答案和验证 Evidence 后执行；下一题只能由用户在当前题确认或跳过后主动推进。
- 路线确认后结构不可改写；`ANALYZE` 和 `TRANSFER` 在 V1.0 保持锁定。

### Worker owner

- 模型输出只能生成允许的点评、参考答案候选和 context/evidence 引用；最终 Evidence 坐标、quote、hash 和 verification status 由服务端物化。
- 失败重试必须复用任务幂等键和同一领域对象标识，不得生成相互冲突的方向、路线、问题或回答。
- 不向模型或任务 payload 写入 API Key、内部绝对路径、原始 PDF 二进制、完整审计日志或不必要全文。

### Web owner

- 只提交 `COMMAND` 中定义的用户动作和业务输入，不提交服务端状态字段。
- 不显示或开放第二、第三阶段的可执行入口；loading、失败、重试和重复提交状态由服务端结果驱动。
- 保留快速问答入口和其原有 Schema 处理，不把两种模式的状态或确认语义混用。

## 服务端专属状态

以下字段和推进只能由服务端产生或推进：`state`、`state_version`、`session_revision`、候选方向生成结果、`selected_direction_id` 的锁定结果、`route` 及其 `locked`/stage status、问题 status/confirmation status、feedback、reference_answer、Evidence 及其 `verification_status`、stage summary、failure 和 `SESSION_COMPLETED`。客户端只能提交定义过的命令 payload；不能通过额外字段或重放请求绕过这些约束。

## T-W1-011 修复后的状态机

V1 的可观察状态为：

`CREATED` → `AWAITING_DIRECTION_SELECTION` → `ROUTE_LOCKED` →
`QUESTIONS_GENERATING` → `AWAITING_ANSWER` → `ANSWER_SUBMITTED` →
`FEEDBACK_READY` → `QUESTION_COMPLETED` → `SUMMARY_GENERATING` →
`STAGE_COMPLETED` → `SESSION_COMPLETED`。

`AWAITING_ANSWER` 可以由 `SKIP_QUESTION` 直接进入
`QUESTION_COMPLETED`；`FEEDBACK_READY` 和 `QUESTION_COMPLETED` 可以通过
`EDIT_ANSWER` 回到 `ANSWER_SUBMITTED`。`ADVANCE_QUESTION` 在有后续题时回到
`AWAITING_ANSWER`，在最后一题后进入 `SUMMARY_GENERATING`。服务端的
`QUESTIONS_READY`、`SUMMARY_READY` 和 `COMPLETE_SESSION` 分别推进生成和完成阶段。

`RETRYABLE_FAILURE` 是带恢复上下文的非终态，`FAILED` 与
`SESSION_COMPLETED` 是终态。状态机不再把 `DIRECTIONS_READY` 当作 Session
状态；它只作为服务端事件，将 `CREATED` 推进到
`AWAITING_DIRECTION_SELECTION`。同样，生成中状态不会要求尚未生成的
questions 或 summary；生成完成后的稳定状态才要求相应结果。

| 状态 | 必需的状态数据 |
| --- | --- |
| `CREATED` | 空的 `candidate_directions`，没有方向、路线或问题 |
| `AWAITING_DIRECTION_SELECTION` | 2–3 个候选方向，没有锁定路线 |
| `ROUTE_LOCKED` | `selected_direction_id`、规范路线、`current_stage_id=UNDERSTAND` |
| `QUESTIONS_GENERATING` | 锁定方向和路线，不携带未生成的问题 |
| `AWAITING_ANSWER` | questions、当前题指针，恰好一题 `ACTIVE` |
| `ANSWER_SUBMITTED` | 当前题为 `ANSWERED` |
| `FEEDBACK_READY` | 当前题的回答、点评、参考答案和 Evidence |
| `QUESTION_COMPLETED` | 当前题为 `CONFIRMED` 或 `SKIPPED` |
| `SUMMARY_GENERATING` | 全部 questions，尚未携带 summary |
| `STAGE_COMPLETED` / `SESSION_COMPLETED` | 全部 questions 已解决且有一致的 `stage_summary` |
| `RETRYABLE_FAILURE` / `FAILED` | failure 与其合法恢复上下文 |

## 失败恢复和幂等

`failure` 记录 `failed_operation` 和 `resume_state`。允许的对应关系为：

- `GENERATE_DIRECTIONS` → `CREATED`；
- `GENERATE_QUESTIONS` → `ROUTE_LOCKED` 或 `QUESTIONS_GENERATING`；
- `GENERATE_FEEDBACK` → `ANSWER_SUBMITTED`；
- `GENERATE_STAGE_SUMMARY` → `QUESTION_COMPLETED` 或 `SUMMARY_GENERATING`。

服务端必须在产生失败时记录当前恢复状态；`RETRY` 只接受服务端 failure
上下文并返回该上下文的 `resume_state`。客户端的空 retry payload 不能携带
`resume_state`，`FAILED` 不能重试，操作和恢复状态不匹配时拒绝。

`GuidedLearningIdempotencyRecord` 至少包含
`idempotency_key`、`session_id`、`event`、`request_fingerprint`、
`from_state`、`to_state`、`actor` 和 `result_revision`。fingerprint 覆盖
`schema_version`、`session_id`、command/event 和规范化后的完整 payload；
`command_id`、`request_id` 不是业务等价依据。同一 key 只有在 session、事件和
fingerprint 全部相同时才返回原结果；任一不同都返回
`IDEMPOTENCY_KEY_REUSED`。

## Schema 与一致性验证边界

`guided-learning.v1.schema.json` 负责消息形状、服务端/客户端字段边界、状态所需字段、
失败映射和 canonical route 的结构约束。`validateGuidedLearningSessionConsistency`
负责 Schema 难以表达的聚合约束：方向 ID 引用和唯一性、question ID/order 的连续性、
当前题与 ACTIVE 状态、题目字段组合、summary 与题目状态的对应关系、完成条件、失败
分类和恢复映射。稳定错误码由
`GUIDED_LEARNING_CONSISTENCY_ERROR_CODES` 导出。API/Worker/Web 后续处理必须按顺序
执行 Schema validation、consistency validation、state transition validation 和
idempotency validation。

## 版本类型

`ContractVersion` 继续表示旧快速问答版本集合，以保持既有消费者的兼容语义。
`SupportedContractVersion` 才表示当前所有支持的版本，并包含
`guided-learning.v1`；两者的区别由 `SUPPORTED_CONTRACT_VERSIONS` 明确表达。

## T-W1-011 审查修复约束

### Evidence 确认门

`FEEDBACK_READY` 和 `CONFIRMED` 都必须能够独立通过 Evidence 一致性校验。
每个 Evidence ID 在会话内唯一，Evidence 的 `document_version_id` 必须与会话
文档一致；被 `PAPER_FACT`、`AUTHOR_CLAIM` 或 `AGENT_INFERENCE` 引用的 Evidence
必须存在且为 `VERIFIED`，引用不能重复。`INSUFFICIENT` claim 不得带 Evidence
引用。缺少引用、文档不匹配、未验证或重复引用分别使用稳定的一致性错误码，不能
把未验证 Evidence 当作可确认结果。

`CONFIRM_QUESTION` 的 Evidence 就绪性是服务端上下文，不属于客户端
`COMMAND` payload。缺少上下文拒绝为 `EVIDENCE_CONFIRMATION_CONTEXT_REQUIRED`，
显式未就绪拒绝为 `EVIDENCE_NOT_READY`，只有服务端明确传入就绪结果时才允许推进。

### 失败恢复形状

`RETRYABLE_FAILURE` 和 `FAILED` 的 `failure.resume_state` 必须与会话快照的可恢复
形状一致。`CREATED` 不得残留方向、路线、题目或摘要；`ROUTE_LOCKED` 和
`QUESTIONS_GENERATING` 不得残留题目；`ANSWER_SUBMITTED` 必须指向一题带用户回答的
`ANSWERED` 题，且不得残留点评、参考答案、Evidence 或跳过原因；
`QUESTION_COMPLETED` 必须指向 `CONFIRMED` 或 `SKIPPED` 题；
`SUMMARY_GENERATING` 必须包含全部已解决题目，且不得包含当前题指针或摘要。
缺字段、禁用字段和整体形状分别使用稳定错误码。`RETRY` 只接受服务端完成形状
校验的上下文；客户端 retry payload 固定为空对象。

### Summary 与路线阶段状态

进入 `SUMMARY_GENERATING` 前，所有题目必须已 `CONFIRMED` 或 `SKIPPED`，且当前题
指针和 `stage_summary` 都为空。处理中的状态及其失败恢复状态要求规范路线的
`UNDERSTAND` 阶段为 `OPEN`；只有 `STAGE_COMPLETED` 和 `SESSION_COMPLETED` 允许
该阶段为 `COMPLETED`。状态与路线阶段不一致时返回 `ROUTE_STAGE_STATUS_MISMATCH`。

### 服务端校验调用顺序

服务端适配器必须按以下顺序处理请求：

1. 校验 `guided-learning.v1` JSON Schema，拒绝客户端额外字段。
2. 校验会话一致性，包括 Evidence、失败恢复形状和 summary/route 联动。
3. 对 `CONFIRM_QUESTION` 计算并传入服务端 Evidence 就绪上下文。
4. 执行状态转移；`RETRY` 只能使用已校验的服务端恢复上下文。
5. 最后执行幂等键与 request fingerprint 校验并持久化新的 revision。
