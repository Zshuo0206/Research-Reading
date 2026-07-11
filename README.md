# Research Reading Workbench

这是一个问题驱动型科研文献阅读与研究资产管理平台的工程仓库。

当前处于 **Wave 0**：只验证工程治理、Agent 协作、可恢复流程和最小可运行骨架，不包含真实产品业务。

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

Wave 0 命令使用 Node 内置能力，不需要安装第三方依赖。生产技术栈和真实依赖将在后续 ADR 中冻结。
