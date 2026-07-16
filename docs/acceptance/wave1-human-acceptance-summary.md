# Human Acceptance Summary — Wave 1

- Wave: Wave 1 Guided Learning
- 日期（UTC）：2026-07-16
- 主控 Agent：Codex
- QA Agent：qa-evaluation-agent（本次独立验收由当前 Agent 执行）
- 相关技术验收记录：[Wave 1 Guided Learning 验收报告](./wave1-guided-learning-acceptance.md)
- 产品目标记录：V1.0 引导式学习最小闭环；范围仍限于文本型 PDF、UNDERSTAND 阶段和本地单用户。

## 1. 内部技术验收结论

- 结论：`有条件通过`
- 主控技术验收结论：Mock 真实 PDF 全链路、空库 migration、恢复、Evidence、失败/RETRY、EDIT_ANSWER、快速问答回归、Web E2E 和本地安全边界均通过；发现的 BYOK 错误分类问题已最小修复并复验通过。
- QA 独立检查结论：自动验收通过；真实 BYOK 人工验收因缺少用户凭据未执行。
- 责任 Agent 交接状态：验收报告、运行手册、任务文件和状态日志已准备；验收分支尚未合并 main。
- 证据链接：`docs/acceptance/wave1-guided-learning-acceptance.md`、`docs/operations/wave1-local-runbook.md`

## 2. 强制检查与例外

- 已执行的强制检查：planning、check all、build、lint、typecheck、runtime integration 26/26、`npm test` 24/24、contract、Playwright 3/3、smoke、offline security scan、security probe、BYOK/Mock 17/17、`git diff --check`。
- 失败的强制检查：无；一次 BYOK 定向检查发现真实错误并已修复后通过。
- 被绕过的强制检查：无。
- 批准的例外及批准记录：未执行 online `npm audit`；本轮不运行全仓 format，避免既有 Windows CRLF 假差异。
- 未执行检查及原因：真实 BYOK 人工验收，缺少用户提供的安全凭据。

## 3. 产品目标与范围

- 是否符合当前产品目标：`有条件`
- 是否发生产品范围扩张或方向偏移：`否`
- 说明：Mock 侧完成 V1.0 UNDERSTAND 最小闭环；不宣称真实模型、ANALYZE、TRANSFER、OCR、远程部署或完整产品 Gate 已完成。

## 4. 重大风险与例外项

- 用户价值风险：真实 BYOK 和人工产品体验尚未验证。
- 科研可信度风险：自动 Evidence 回查通过；真实模型输出的 Evidence 稳定性仍需人工验证。
- 数据安全/隐私风险：secret 不落 SQLite/日志，loopback/CORS 检查通过；真实凭据操作仍需遵循运行手册。
- 成本风险：未执行真实外部模型调用，成本风险未被实际验证。
- 长期产品形态风险：第二、第三阶段和完整产品范围保持锁定。
- 其他例外：全仓 Windows CRLF format 基线仍未治理。

## 5. 需要人类项目负责人决定的事项

- 是否接受 `ACCEPTED_WITH_KNOWN_LIMITATIONS` 并允许集成验收分支。
- 何时提供真实 BYOK 凭据执行人工连接和最小生成/Evidence 验收。

## 6. 主控推荐

- 推荐：`有条件通过`
- 推荐理由：所有可自动执行的 Wave 1 技术门槛和 Mock 业务闭环均通过，且未发现阻断缺陷；唯一未完成项是缺少用户凭据导致的真实 BYOK 人工验收。
- 若有条件通过，进入下一 Wave 前必须满足：完成人类项目负责人决定；若产品要求真实模型发布，则完成真实 BYOK 最小闭环并确认 Evidence。

## 7. 人类决定

- 决定：`待决定`
- 决定人：
- 决定日期（UTC）：
- 备注：
