# Wave 1 Product Scope Summary

状态：`PRODUCT_SCOPE_APPROVED_TECHNICAL_PLAN_PENDING_FREEZE`
当前动作：产品范围已获人类项目负责人正式批准；允许技术方案、契约和任务规划，暂不开始真实业务编码。

## 产品目标

验证个人研究者使用单用户 Web 工作台进行“方法学习”时，是否能通过问题驱动和证据回溯获得比普通 PDF 摘要更有帮助的阅读体验。

## 纳入范围

- 创建一个研究项目。
- 导入一篇真实、可直接提取文本的 PDF。
- 选择“方法学习”。
- 生成结构化问题计划。
- 用户确认、修改或拒绝问题。
- 对至少一个确认问题生成回答。
- 展示原文证据片段及页码或稳定文本位置。
- 用户确认、修改或拒绝回答。
- 支持外部模型 `ModelGateway` 和 Mock 实现。
- 使用少量固定论文进行稳定评测。

## 排除范围

- 写作支持、课题决策、实验设计。
- 扫描 PDF、OCR、复杂表格和公式理解。
- 高级 Evidence 检索、多篇综合。
- 正式研究资产库、Markdown/Excel 导出。
- 协作、插件、本地部署、私有部署和本地模型。

## 产品验收标准

1. 最小闭环可以完整走通。
2. 回答区分论文事实、作者主张和 Agent 推断。
3. 回答可追溯到论文版本、页码/稳定文本位置和原文片段。
4. 未确认回答不进入正式资产。
5. Mock 与外部模型遵守同一输出契约。
6. 主要指标为问题可用率、带证据回答的用户接受率。

## 已决定事项

- 目标用户：个人研究者。
- 产品形态：单用户 Web 工作台。
- 首期模式：方法学习。
- 输入：一篇真实可提取文本 PDF。
- 模型：外部 ModelGateway + Mock。
- 核心价值验证：问题驱动、证据回溯、用户确认。

## 技术方案状态

- 技术栈、PDF 提取、ModelGateway、成本/隐私控制、Schema、评测集、CI 和 QA 执行方式已形成提案，见 [`wave1-technical-plan.md`](D:/Research%20Reading/docs/architecture/wave1-technical-plan.md)。
- 契约基线见 [`RFC-W1-001`](D:/Research%20Reading/docs/rfcs/RFC-W1-001-technical-foundation-and-contract-baseline.md)，当前为 `PROPOSED`，尚未冻结。
- 开发任务已拆分为 `docs/tasks/backlog/T-W1-*.yaml`，全部保持 `DRAFT`，不代表编码授权。
- Wave 1 验收使用可替换 Gateway 契约和确定性 Mock，并包含统一 OpenAI-compatible BYOK 适配器；真实外部调用只作为本地人工验收，不进入普通 CI。

## 本轮人工批准

- 已批准真实可提取文本 PDF、外部 ModelGateway + Mock、最小闭环、主要指标和排除范围。
- 已接受外部模型必须告知/同意、最小化发送、预算控制、脱敏和可关闭。
- 平台不提供共享密钥；API Key 只来自环境变量或当前运行会话内存，不写 Git、SQLite、日志、审计、导出或 fixture；浏览器不得直连供应商。

## 当前结论

产品范围正式通过；技术方案已提出并等待冻结检查。当前不授权真实业务编码，完成技术启动摘要后申请 Wave 1 编码启动。
