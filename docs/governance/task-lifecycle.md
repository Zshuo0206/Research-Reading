# Task Lifecycle

任务状态：

`DRAFT → READY → ASSIGNED → IN_PROGRESS → REVIEW → ACCEPTED → INTEGRATED → DONE`

异常状态：`BLOCKED`、`PARTIAL`、`REJECTED`、`CANCELLED`。

## 状态规则

- `DRAFT`：目标或边界仍在整理，不能分配。
- `READY`：目标、依赖、契约版本、ownership、验收和回滚方案齐全。
- `ASSIGNED`：主控 Agent 已分配唯一 owner。
- `IN_PROGRESS`：Agent 只能修改任务声明的可写路径。
- `REVIEW`：Agent 已交接，主控/QA 复核 diff 和测试。
- `ACCEPTED`：验收通过，但尚未按依赖顺序集成。
- `INTEGRATED`：已进入目标分支并通过集成检查。
- `DONE`：日志、状态、交付物和风险均已更新。

任务不得从 `IN_PROGRESS` 直接跳到 `DONE`。公共契约、迁移或依赖变化必须先暂停任务并创建 RFC。
