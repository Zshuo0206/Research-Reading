# Task Lifecycle

任务状态：

`DRAFT → READY → ASSIGNED → IN_PROGRESS → REVIEW → ACCEPTED → INTEGRATED → DONE`

异常状态：`BLOCKED`、`PARTIAL`、`REJECTED`、`CANCELLED`。

## 状态规则

- `DRAFT`：目标或边界仍在整理，不能分配。
- `READY`：目标、依赖、契约版本、ownership、验收和回滚方案齐全。
- `ASSIGNED`：主控 Agent 已分配唯一 owner。
- `IN_PROGRESS`：Agent 只能修改任务声明的可写路径。
- `REVIEW`：责任 Agent 已交接，QA/责任 Agent完成局部技术检查，主控复核 diff、边界和证据。
- `ACCEPTED`：主控完成技术验收并记录证据，但尚未按依赖顺序集成；不等同于产品负责人批准。
- `INTEGRATED`：已进入目标分支并通过集成检查。
- `DONE`：日志、状态、交付物、风险和技术验收证据均已更新；若是 Wave 结束任务，还必须进入人类验收摘要。

任务不得从 `IN_PROGRESS` 直接跳到 `DONE`。公共契约、迁移或依赖变化必须先暂停任务并创建 RFC。

## Wave 验收

Wave 技术验收由责任 Agent、QA Agent 和主控 Agent完成。主控负责汇总强制检查、失败/绕过项、证据链接和技术结论。人类项目负责人只审核产品目标与范围、重大风险和需要其决定的事项，并从摘要中选择“通过、有条件通过或不通过”。
