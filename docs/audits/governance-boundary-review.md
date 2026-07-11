# Governance Boundary Review

日期：2026-07-11

## 审查结论

已将“技术验收”和“产品层面人工验收”分离：

- 责任 Agent：局部实现、局部测试和交接证据。
- QA Agent：独立技术质量检查、强制门槛和例外报告。
- 主控 Agent：集成级技术验收、证据完整性、失败/绕过识别和 Wave 摘要。
- 人类项目负责人：产品目标、范围、重大风险和重要决策；不逐项验证工程细节。

## 冲突检查

- `AGENTS.md`、工程宪章、Agent 权限和任务生命周期使用同一责任划分。
- Definition of Done 与 CI gates 要求主控/QA完成技术复核，并将人类验收限定为摘要决策。
- RFC/ADR 规则保留人类对核心架构、重要 RFC 和破坏性操作的审批，同时不要求人类逐项审核普通工程变更。
- CURRENT_STATE、devlog 和 Wave 0 摘要均声明本次不重新执行 Wave 0、不进入 Wave 1。
- 未发现要求人类负责人亲自运行代码、测试、Git、worktree、CI 或接口一致性检查的有效规则。

## 证据完整性

统一摘要模板为 `docs/templates/human-acceptance-summary.md`；当前 Wave 0 填写版为 `docs/audits/wave0-human-acceptance-summary.md`。
