# RFC-W1-002：V1.0 引导式学习产品与开发基线对齐

状态：`PROPOSED`  
提出原因：将已确认的 V1.0 产品定义转化为可执行的 Wave 1 契约、状态机、API、Web 和评测要求。  
关联产品文档：[`docs/product/versions/科研文献引导式学习平台_V1.0产品定义.md`](../product/versions/科研文献引导式学习平台_V1.0产品定义.md)  
关联开发需求：[`docs/product/v1.0-development-requirements.md`](../product/v1.0-development-requirements.md)

## 1. 背景

Wave 1 第一轮已集成持久化/Job、文本型 PDF 提取、canonical page text、Evidence 坐标校验和确定性 MockModelGateway。现有后续任务主要描述“问题计划确认 → 回答确认”的快速路径，尚未完整表达 V1.0 的引导式学习体验。

本 RFC 只提出需求对齐和契约演进方案，不批准产品范围以外的功能，不授权下一轮编码。

## 2. 需要解决的差异

| 现有基线 | V1.0 要求 | 处理方向 |
| --- | --- | --- |
| 方法学习被表达为单一工作流 | 保留快速问答，并增加引导式学习核心路径 | `mode` 分支，服务端强制边界 |
| 没有学习目标和候选方向 | 目标输入、2–3 个方向、用户选择 | 增加会话上下文对象和生成任务 |
| 默认先确认完整问题计划 | 引导式学习一次生成后逐题展示，不要求预览整表 | 快速问答保留确认；引导式学习隐藏未到达题目 |
| 没有学习路线和阶段总结 | 固定三阶段，仅第一阶段开放；完成后生成简短总结 | 增加 route/stage/summary 契约 |
| 回答闭环偏向研究资产确认 | 学习修正只保留当前最新版回答 | 与快速问答的正式确认状态隔离，仍保留证据验证 |

## 3. 候选契约调整

契约 owner 在批准后决定是兼容扩展 `wave1.v1` 还是建立新版本；以下只是待审字段，不是冻结 Schema：

- `LearningSession`: `mode`、`document_version_id`、`learning_goal`、`candidate_directions`、`selected_direction`、`route`、`current_stage`。
- `GuidedQuestion`: `order`、`stage`、`prompt`、`status`（待处理/已作答/已跳过）。
- `GuidedAnswerReview`: 用户回答、跳过标记、点评、遗漏、参考答案、Evidence、可继续修正标志。
- `StageSummary`: 阶段名称、学习内容摘要、用户整体回答情况。

现有 EvidenceSpan、断言类型、ContextSpan 服务端物化和 hash/坐标校验规则不改变。模型输出仍不能直接写最终 offset。

## 4. 状态机原则

- 快速问答：问题计划 `DRAFT → CONFIRMED/REJECTED`；回答需通过证据验证并由用户确认后才是正式研究资产。
- 引导式学习：会话先完成目标和方向选择，再进入 `UNDERSTAND`；问题按顺序可 `UNSEEN → ACTIVE → ANSWERED/SKIPPED → REVIEWED`，用户点击后进入下一题；全部完成后进入 `COMPLETED` 并生成总结。
- `ANALYZE`、`TRANSFER` 在 V1.0 只展示锁定态，不能通过客户端请求进入。
- 点评和参考答案可见后，用户编辑只替换当前最新版回答；不得以此隐式产生完整版本历史或评分。

## 5. 安全、隐私和兼容性

- 论文内容发送外部模型前必须有本地操作员明确同意；默认 Mock 路径不联网。
- 不向模型发送原始 PDF 二进制、内部路径、密钥、审计日志或不必要的身份信息。
- 不能通过 URL、客户端字段或重放请求伪造模式、阶段、证据验证或确认状态；写操作必须幂等。
- 旧快速问答 API/数据不能因引导式学习扩展而失去读取能力；若无法兼容，必须提供迁移说明和回滚方案。

## 6. 实施与审查条件

批准后才可按以下顺序细化任务：

1. 契约 owner 给出字段、Schema、错误和状态转换的兼容方案及负例测试。
2. 工作流 owner 更新 API 和 SQLite 迁移设计；如需数据库迁移，另行审查破坏性风险。
3. 前端 owner 按已冻结契约实现 PDF/交互左右分栏和完整状态。
4. QA owner 增加固定论文、Mock fixture、浏览器闭环和范围外不可进入测试。
5. 主控复核 diff、ownership、门槛和交接证据；Gate C 仍需单独解锁。

## 7. 待决事项

- `wave1.v1` 兼容扩展还是新建 `guided-learning.v1`；
- 学习会话与快速问答项目实体的最小持久化字段；
- 点评是否使用 Mock 固定模板、BYOK 生成，或两者均支持；
- 阶段总结的证据要求和长度上限。

以上事项在技术审查前不作为实现假设。
