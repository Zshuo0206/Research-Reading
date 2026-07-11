# Session Recovery

新的主控 Agent 只需按以下顺序恢复：

1. 阅读 `AGENTS.md`。
2. 阅读 `docs/CURRENT_STATE.md` 和 `docs/devlog/INDEX.md` 最新条目。
3. 阅读当前 Wave 的 ownership map、active/backlog 任务。
4. 检查 `git status`、分支和 worktree。
5. 检查契约版本、未决 RFC/ADR、测试状态和阻塞。
6. 不从聊天推断隐含上下文；缺失信息先补成仓库记录或暂停。
7. 继续一个明确的 `IN_PROGRESS` 任务，或由主控重新分配，不重复已完成工作。

恢复结束后更新 CURRENT_STATE 的“恢复检查”字段。
