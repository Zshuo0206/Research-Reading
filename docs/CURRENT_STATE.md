# Current State

最后更新：2026-07-11（Asia/Shanghai）  
状态：`WAVE_0_ACCEPTED_HUMAN`

## 当前 Wave

Wave 0：工程治理、Agent 协作规则、最小工程骨架和多 Agent 流程演练。

## 当前目标

建立可执行、可恢复、可验证的 Codex 多 Agent 开发制度；不开发真实产品业务。

## 已冻结范围

- 只允许占位应用、健康检查、共享契约目录、测试与 CI 骨架。
- 禁止真实 PDF 解析、真实模型调用、阅读问题生成、Evidence 业务、Markdown/Excel 业务导出和完整领域模型。
- Agent 只能一层树；子 Agent 不创建下级 Agent。

## 已冻结规则/契约

- `AGENTS.md`
- `docs/governance/`（含本轮人工验收责任边界修正）
- `docs/templates/`
- `docs/standards/`
- `docs/quality/`
- `docs/runbooks/`
- `packages/contracts/` 的 Wave 0 占位 Schema
- 统一命令入口和 CI gate 脚本

## 任务状态

- Wave 0 文档与骨架：完成，主控复核通过
- 多 Agent dry-run：已演练并集成，见 `docs/audits/multi-agent-dry-run.md`
- 主控复跑：`node scripts/check.mjs all` 通过
- dry-run 分支：已集成，临时 worktree 已清理；分支保留用于审计追踪
- Wave 0：人工验收通过
- Wave 1：未开始，未创建真实业务实现任务，仅输出产品范围与决策议题供审核
- 人工验收责任边界：已修正；技术验收由责任 Agent、QA Agent 和主控 Agent完成，人类负责人依据摘要进行产品层面验收
- 当前 Wave 验收摘要：`docs/audits/wave0-human-acceptance-summary.md`

## 阻塞与未解决问题

- 生产技术栈（Python/FastAPI 或其他实现）尚未进入 Wave 0 必要范围，需 Wave 1 ADR 决定。
- 真实数据库、对象存储、队列和模型供应商尚未接入。
- 完整产品领域模型、证据存储格式和多租户策略待 Wave 1/后续 ADR。
- 当前环境运行时能力有限，CI 使用仓库内 Node 占位检查；真实依赖安装需单独批准。

## 当前测试状态

- Wave 0 静态骨架检查：通过
- 占位健康检查：通过
- 业务单元/集成/E2E/AI 评测：按范围未适用
- 安全/依赖扫描：基础规则已定义，完整扫描待 CI 环境验证

## 下一步（不自动执行）

Wave 1 产品范围与决策议题见 `docs/product/wave1-scope-and-decisions.md`。该文件仅供人类项目负责人审核，不是已批准的开发任务；在范围批准前不得创建真实业务实现任务。

人工项目负责人已依据验收摘要通过 Wave 0。当前仍保持暂停状态；在 Wave 1 产品范围和决策议题获得审核前，主控 Agent不得创建真实业务实现任务或开始 Wave 1 编码。

## 恢复检查

新会话恢复时必须阅读本文件、`AGENTS.md`、最新 devlog、ownership map 和活动任务；不得依赖历史聊天。
