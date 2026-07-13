# Current State

最后更新：2026-07-13（Asia/Shanghai）
状态：`WAVE_1_FIRST_ROUND_INTEGRATED_PENDING_ACCEPTANCE`

Wave 1 状态：`第一轮最小运行闭环已集成，等待技术/产品验收；下一轮未启动`
Gate A 技术方案冻结：`INTEGRATION_REVIEW_PENDING`
Gate B 编码授权：`GRANTED（仅已下发的第一轮任务）`
Gate C 下一轮业务任务：`NOT_STARTED`

## 当前 Wave

Wave 1：在已批准的个人单用户 Web 工作台中实现“方法学习”问题—证据回答—用户确认闭环；第一轮已集成 SQLite/Job、文本型 PDF 提取和确定性 MockModelGateway。

## 当前目标

完成第一轮最小可运行基础并保留下一轮入口；当前不自动开始 BYOK、问题/回答工作流或 Web 业务页面开发。

## 已冻结范围

- 产品范围与本批次技术方向已获人类项目负责人批准；第一轮已解锁并集成 SQLite/Job、文本型 PDF 上传与提取、ContextSpan 校验、MockModelGateway。
- 核心闭环为：创建项目 → 导入一篇真实可提取文本 PDF → 选择方法学习 → 生成结构化问题计划 → 用户确认/修改/拒绝问题 → 对至少一个确认问题生成回答 → 展示证据片段及页码或稳定文本位置 → 用户确认/修改/拒绝回答。
- 回答必须区分 `PAPER_FACT`、`AUTHOR_CLAIM`、`AGENT_INFERENCE`；未经确认的内容不得视为正式研究资产。
- 真实 BYOK 调用、问题生成/修改/确认/拒绝、回答生成与 Evidence 物化/确认、Web 端到端页面和导出仍属于下一轮；本轮未实现。
- Wave 1 仅允许本地 `127.0.0.1` 部署；没有远程认证主体，不开放远程监听。
- Agent 只能一层树；子 Agent 不创建下级 Agent。

## 已冻结规则/契约

- `AGENTS.md`
- `docs/governance/`
- `docs/templates/`
- `docs/standards/`
- `docs/quality/`
- `docs/runbooks/`
- `packages/contracts/wave1/` 的 `wave1.v1` Schema、TypeScript 类型和契约测试
- 统一真实 npm 命令入口、Node 24 CI、secret/audit/license 检查

## 已建立的 Wave 1 规划材料

- `docs/architecture/wave1-technical-plan.md`（技术提案）
- `docs/rfcs/RFC-W1-001-technical-foundation-and-contract-baseline.md`（REPAIR_PENDING_REVIEW）
- `docs/integration/ownership-map.yaml` 的 Wave 1 ownership
- `docs/audits/wave1-technical-startup-summary.md`（Gate A 待复审）

## 任务状态

- Wave 0 文档与骨架：完成，主控复核通过
- 多 Agent dry-run：已演练并集成，见 `docs/audits/multi-agent-dry-run.md`
- 主控复跑：`node scripts/check.mjs all` 通过
- dry-run 分支：已集成，临时 worktree 已清理；分支保留用于审计追踪
- Wave 0：人工验收通过
- Wave 1：第一轮已集成待验收；T-W1-001/T-W1-002 为 REVIEW，T-W1-007 为 PARTIAL；仓库任务文件中的 T-W1-003A、T-W1-003B、T-W1-004A 已更新为 `INTEGRATED`。本轮下发编号映射为：T-W1-004A→仓库 T-W1-003B（PDF），T-W1-006A→仓库 T-W1-004A（MockModelGateway）；不重命名历史任务文件。
- 人工验收责任边界：已修正；技术验收由责任 Agent、QA Agent 和主控 Agent 完成，人类负责人依据摘要进行产品层面验收
- 当前 Wave 0 验收摘要：`docs/audits/wave0-human-acceptance-summary.md`
- Wave 1 技术启动摘要：`docs/audits/wave1-technical-startup-summary.md`

## 阻塞与未解决问题

- 第一轮只覆盖最小本地能力：持久化/Job、内容寻址 PDF 上传与文本提取、canonical page text/page hash/extraction profile、ContextSpan 坐标校验，以及无网络的确定性 MockModelGateway；完整工作流 API 和 Web 尚未接入。
- 真实 BYOK 外部调用、问题/回答状态机、Evidence 物化和 Web 页面是下一轮范围；真实密钥不进入 CI，平台不提供共享密钥。
- `npm run ci` 当前受 Windows CRLF checkout 的 format 门禁影响；`npm run contract` 的 generated type byte-drift 检查也受同一换行差异影响，未进行全仓库换行处理。Docker CLI 不可用，因此 `docker compose config` 未能在本机执行。

## 当前测试状态

- Wave 0 静态骨架检查：通过
- 占位健康检查：通过
- 第一轮任务相关集成测试：7 个文件、32 个测试通过；默认测试：8 个文件、44 个测试通过；SQLite 重连、Job 成功/失败、文本型 PDF 提取/失败、ContextSpan 校验、Mock 三种操作/Schema/insufficient evidence 均有覆盖。
- `npm ci`、`npm run lint`、`npm run typecheck`、`npm run build`、`npm run smoke`、`npm run e2e:smoke`、`npm run security`、`node scripts/check.mjs all` 和 `git diff --check`：已通过；`npm run contract` 的各项子检查已通过，但总命令仍被 CRLF 生成文件字节比较阻塞。
- `npm run ci`：未通过，首个失败为 Windows CRLF checkout 导致的 format 门禁；没有为此执行全仓库换行处理。`docker compose config`：未执行成功，原因是本机无 Docker CLI。

## 下一步（不自动执行）

Wave 1 产品范围与技术启动材料见 `docs/product/wave1-scope-and-decisions.md`、`docs/product/wave1-product-scope-summary.md`、`docs/architecture/wave1-technical-plan.md` 和 `docs/audits/wave1-technical-startup-summary.md`。第一轮已集成；不自动进入下一轮。下一轮目标为：创建项目 → 上传文本型 PDF → 生成问题 → 用户确认问题 → 生成回答 → 展示 Evidence → 用户确认回答 → Web 页面完成闭环。

人工项目负责人已通过 Wave 0，并批准 Wave 1 技术方向、BYOK 范围及第一轮编码授权。主控完成文档同步后停止，不自动创建下一轮分支或 worktree。

## 恢复检查

新会话恢复时必须阅读本文件、`AGENTS.md`、最新 devlog、ownership map 和活动任务；不得依赖历史聊天。下一轮建议：`T-W1-006B`（BYOK）与同一 workflow owner 负责的 `T-W1-005A/005B` 可并行准备；先完成问题确认，再完成回答/Evidence 确认，最后实现 `T-W1-008` Web 闭环。下一轮尚未启动。
