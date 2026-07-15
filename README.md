# Research Reading Workbench

这是一个问题驱动型科研文献阅读与研究资产管理平台的工程仓库。

当前处于 **Wave 1**：基础运行时、快速问答最小闭环、真实文本 PDF 导入和 `guided-learning.v1` 公共契约已经进入 `main`；`guided-learning.v1` runtime 尚未进入 `main`。API/SQLite runtime 已由主控作为独立任务 T-W1-013 授权并在隔离 worktree 中推进，当前尚未集成；Worker、Web、端到端验收和 BYOK 产品验收仍未实现。

## 快速入口

- Agent 规则：`AGENTS.md`
- 当前状态：`docs/CURRENT_STATE.md`
- 治理制度：`docs/governance/`
- 任务模板：`docs/templates/`
- 质量门槛：`docs/quality/`
- 会话恢复：`docs/runbooks/session-recovery.md`

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
