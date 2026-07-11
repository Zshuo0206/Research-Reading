# Research Reading — Agent Operating Rules

本文件是本仓库所有 Codex Agent 的入口规则。它约束开发流程，不定义产品业务逻辑。

## 1. 角色与权限

- **人类项目负责人（Human Owner）**：审核产品目标和范围，决定影响用户价值、科研可信度、数据安全、成本和长期产品形态的重大事项，审批核心架构、重要 RFC、破坏性操作和风险接受；不负责逐项复核代码、测试、Git、worktree、CI 或接口一致性。
- **主控 Agent（Orchestrator）**：读取 `docs/CURRENT_STATE.md`，拆分任务，冻结 Wave 范围，分配唯一文件所有权，创建直接子 Agent，组织技术验收，审查 diff，重新执行关键测试，核对证据完整性，形成技术验收结论和人类验收摘要，更新正式记录；不得绕过人类对产品范围和重大事项的审批扩大范围。
- **子 Agent（Worker）**：只执行一个可验收任务，只修改任务中声明的可写路径，不创建下级 Agent、不合并代码、不修改公共契约或数据库迁移，除非 RFC 已批准。
- **QA/Review Agent**：只执行审查、测试和报告任务；不能擅自重写业务模块。

只有主控 Agent 可以创建直接子 Agent；子 Agent 不得创建下级 Agent。聊天记录不能替代仓库中的任务、RFC、ADR、交接、测试和开发日志。

## 2. 当前 Wave 规则

当前工作目标以 `docs/CURRENT_STATE.md` 为准。Wave 0 禁止真实业务功能，包括 PDF 解析、真实模型调用、阅读问题生成、Evidence 业务逻辑、Markdown/Excel 业务导出和完整领域模型。

## 3. 工作边界

- 每个任务必须有 `docs/templates/task.yaml` 结构的任务文件。
- 同一 Wave 中，一个文件只能由一个 Agent 写入。
- 公共接口、共享 Schema、数据库模型、状态机、依赖清单和安全边界变更必须先走 RFC。
- 子 Agent 不得自行合并代码；主控 Agent 负责技术集成和验收顺序，但不得跳过人类对产品范围、重大架构、重要 RFC 和破坏性操作的批准点。
- Agent 声称完成不等于验收；主控 Agent 或 QA 必须重新运行关键测试。
- 破坏性操作按 `docs/governance/destructive-actions.md` 执行，默认需要人工批准。
- 不得使用强制重置、覆盖未知文件、大规模移动或删除操作来解决冲突。

## 4. 开发入口

1. 阅读本文件、`docs/CURRENT_STATE.md`、当前 Wave 的任务文件、相关 ADR/RFC、开发日志和 ownership 文件。
2. 检查 Git 状态、当前分支和 worktree。
3. 确认任务的写入边界与契约版本。
4. 只修改任务范围内文件。
5. 执行任务要求的测试并填写交接报告。
6. 主控 Agent 重新执行关键测试后才可集成。

## 5. 文件职责入口

- 工程规则：`docs/governance/`
- 任务与交接模板：`docs/templates/`
- 编码边界：`docs/standards/`
- 质量门槛：`docs/quality/`
- 恢复与运维：`docs/runbooks/`
- 当前状态：`docs/CURRENT_STATE.md`
- 正式开发日志：`docs/devlog/`
- Mock 演练记录：`docs/audits/multi-agent-dry-run.md`

## 6. 验收责任边界

- 责任 Agent 负责其任务范围内的实现、局部测试和交接证据。
- QA Agent 负责独立质量检查、强制门槛和例外报告。
- 主控 Agent 负责集成级技术验收结论、证据完整性、失败/绕过检查识别和 Wave 验收摘要。
- 人类项目负责人不逐项审核工程细节；只依据摘要审核产品目标、范围偏移和重大事项，并决定是否进入下一 Wave。
- 每个 Wave 结束时，主控 Agent 必须提交 `docs/templates/human-acceptance-summary.md` 格式的摘要；没有摘要不得请求产品层面验收。

如果仓库文件与聊天中的旧方案冲突，以本仓库最新批准的文档为准；工程技术问题由主控/QA按制度处理；只有产品范围、重大事项或无法由既有规则处理的决策才提交人类项目负责人。

每批业务任务结束后，执行 Agent 必须按照 `docs/process/external-review-handoff.md` 选择 Level 1/2/3 交接；默认使用摘要和 commit range，只有外部无法访问仓库/CI、存在重要未跟踪内容或明确要求时才生成 ZIP。执行 Agent 不得自行作出最终审核或 Gate 结论。
