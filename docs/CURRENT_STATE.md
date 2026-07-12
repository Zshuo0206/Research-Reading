# Current State

最后更新：2026-07-12（Asia/Shanghai）
状态：`WAVE_1_FIRST_BATCH_REPAIR_PENDING_REVIEW`

Wave 1 状态：`第一批整改完成，等待独立复核，后续业务实现保持锁定`
Gate A 技术方案冻结：`REPAIR_REVIEW_PENDING`
Gate B 编码授权：`GRANTED（仅本次第一批）`
Gate C 业务任务解锁：`LOCKED`

## 当前 Wave

Wave 1：在已批准的个人单用户 Web 工作台中实现“方法学习”问题—证据回答—用户确认闭环；当前仅完成契约、平台与评测基础。

## 当前目标

完成 Wave 1 技术栈、契约、评测与平台基础整改的复核准备；Gate C 仍锁定，暂不开始后续真实业务编码。

## 已冻结范围

- 产品范围与本批次技术方向已获人类项目负责人批准；当前只允许已解锁的契约、平台与评测基础，后续业务运行时仍锁定。
- 核心闭环为：创建项目 → 导入一篇真实可提取文本 PDF → 选择方法学习 → 生成结构化问题计划 → 用户确认/修改/拒绝问题 → 对至少一个确认问题生成回答 → 展示证据片段及页码或稳定文本位置 → 用户确认/修改/拒绝回答。
- 回答必须区分 `PAPER_FACT`、`AUTHOR_CLAIM`、`AGENT_INFERENCE`；未经确认的内容不得视为正式研究资产。
- 即使第一批 Gate B 已记录授权，未解锁的真实 PDF 解析、真实模型调用、阅读问题生成、Evidence 业务、Markdown/Excel 业务导出和完整领域模型仍禁止实现。
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
- Wave 1：第一批整改已完成待复核；T-W1-001/T-W1-002 为 REVIEW，T-W1-007 为 PARTIAL；后续任务继续 DRAFT/LOCKED
- 人工验收责任边界：已修正；技术验收由责任 Agent、QA Agent 和主控 Agent 完成，人类负责人依据摘要进行产品层面验收
- 当前 Wave 0 验收摘要：`docs/audits/wave0-human-acceptance-summary.md`
- Wave 1 技术启动摘要：`docs/audits/wave1-technical-startup-summary.md`

## 阻塞与未解决问题

- T-W1-007 为 PARTIAL：仓库没有加入未确认可再分发的论文 PDF；真实 PDF/模型评测及独立 QA sign-off 待后续依赖任务。
- 真实数据库、PDF 提取、对象存储、Mock/真实 Gateway 运行实现、工作流 API 和 Web 业务页面尚未接入，均保持后续 Gate C 锁定。
- 真实 BYOK 外部调用是后续人工验收项，不进入普通 CI；平台不提供共享密钥。

## 当前测试状态

- Wave 0 静态骨架检查：通过
- 占位健康检查：通过
- Wave 1 第一批最终整改验证：11 个 Vitest、9 个 Schema、生成漂移测试、TypeScript discriminator narrowing、平台 smoke、1 个 Playwright platform smoke、4 个 security 禁止文件探针、build 和 npm audit 已有实际结果；最终独立复核尚未完成
- Node 24 环境检查：`v24.16.0`；`npm ci`：通过；规划检查、依赖环和 ownership 可写路径重叠：通过
- 真实业务单元/集成/E2E/AI 评测：未执行，因属于后续任务或真实人工验收项
- `docker compose config` 实际退出码为 1：当前主机未安装/不可发现 Docker CLI，因此未执行 compose up/health/down；未将其伪造为通过。

## 下一步（不自动执行）

Wave 1 产品范围与技术启动材料见 `docs/product/wave1-scope-and-decisions.md`、`docs/product/wave1-product-scope-summary.md`、`docs/architecture/wave1-technical-plan.md` 和 `docs/audits/wave1-technical-startup-summary.md`。第一批审计见 `docs/audits/wave1-integration/first-batch-integration-summary.md`；不自动进入下一批。

人工项目负责人已通过 Wave 0，并在本提示词中正式批准 Wave 1 技术方向、BYOK 范围及第一批编码授权。主控完成第一批后停止，不自动进入 SQLite、PDF、Gateway 运行实现或 Web 业务开发。

## 恢复检查

新会话恢复时必须阅读本文件、`AGENTS.md`、最新 devlog、ownership map、第一批审计和活动任务；不得依赖历史聊天。当前建议后续解锁顺序：`T-W1-004A → T-W1-004B` 与 `T-W1-003A/003B/006A` 按依赖并行，之后才是 `T-W1-005 → T-W1-006 → T-W1-008`。
