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
