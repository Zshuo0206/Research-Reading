# Research Reading Workbench

这是一个问题驱动型科研文献阅读与研究资产管理平台的工程仓库。

当前处于 **Wave 1 V1.0 Release Gate**：真实文本 PDF 导入、快速问答、`guided-learning.v1` 契约、Guided Learning API/SQLite runtime、Worker、Web Workbench、真实 BYOK 适配和 Evidence source verification 已进入 `main`。自动化发布 Gate 已通过，但真实外部 BYOK、浏览器人工验收、Evidence 人工抽查和产品负责人批准尚未完成；当前状态为 `BLOCKED_BY_MISSING_USER_CREDENTIALS`，不得发布。

## 快速入口

- Agent 规则：`AGENTS.md`
- 当前状态：`docs/CURRENT_STATE.md`
- 治理制度：`docs/governance/`
- 任务模板：`docs/templates/`
- 质量门槛：`docs/quality/`
- 会话恢复：`docs/runbooks/session-recovery.md`
- Wave 1 本地运行：`docs/operations/wave1-local-runbook.md`
- Wave 1 验收报告：`docs/acceptance/wave1-guided-learning-acceptance.md`
- V1.0 Release Gate：`docs/acceptance/v1-release-gate.md`
- V1.0 Release Notes（准备稿）：`docs/releases/v1.0.0-release-notes.md`

## 命令

```text
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run security
npm run ci
npm run api
```

上述命令使用仓库当前 Wave 1 工具链；Node 24 和 workspace 依赖由 package.json/package-lock.json 锁定，完整产品能力仍按 `docs/CURRENT_STATE.md` 逐项进入。
