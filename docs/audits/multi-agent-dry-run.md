# Multi-Agent Dry Run — Wave 0

日期：2026-07-11  
目标：演练 Codex 主控 Agent、两个独立子 Agent、worktree 隔离、ownership、RFC、失败恢复、集成和清理。

## 1. 主控生成任务

主控创建了两个无真实业务意义的任务：

| Task | Agent | 唯一可写文件 | 状态 |
|---|---|---|---|
| T-DRY-A | Mock contract Agent | `docs/audits/dry-run-contract.md` | COMPLETE |
| T-DRY-B | Mock UI Agent | `docs/audits/dry-run-ui.md` | COMPLETE |

任务定义位于 `docs/tasks/backlog/`，ownership 位于 `docs/integration/ownership-map.yaml`。

## 2. 分支和 worktree

主控基线提交：`bab0fed chore: establish wave 0 governance and skeleton`

| Worktree | Branch | Base | 写入结果 |
|---|---|---|---|
| `worktrees/T-DRY-A` | `task/T-DRY-A-contract-note` | `bab0fed` | 只新增 `dry-run-contract.md` |
| `worktrees/T-DRY-B` | `task/T-DRY-B-ui-note` | `bab0fed` | 只新增 `dry-run-ui.md` |

主控使用 `git worktree list --porcelain` 和各 worktree `git status --short` 核对隔离；两个 worktree 均无越界修改。

## 3. 子 Agent 交接

两个 Agent 均返回了交接所需字段：状态、实现内容、修改文件、接口假设、测试结果、限制、风险、后续工作、RFC 需求和合并顺序。T-DRY-A 明确公共接口变更必须 RFC；T-DRY-B 明确文档任务无 UI 测试，不能把未执行测试声称为通过。

## 4. 主控复跑测试

主控重新检查了：

- 两个目标文件存在；
- 两个 worktree 的分支和路径正确；
- 各 worktree 只有声明的单一未提交文件；
- 目标文件内容未修改共享契约或前端代码；
- 主仓库 Wave 0 结构和健康端点检查通过：`node scripts/check.mjs all`。

## 5. 公共接口变更演练

T-DRY-A 提出了假设的 `/health` 字段变更。主控没有直接修改 `packages/contracts`，而是创建 `docs/rfcs/RFC-DRY-001-health-field.md`。由于该变化不属于 Wave 0 必要范围，RFC 标记为 `REJECTED_FOR_WAVE_0_SCOPE`，没有代码变更。

## 6. 失败任务与恢复

T-DRY-B 报告“文档任务没有可执行 UI 测试”。主控按失败 Agent runbook 将其作为明确限制处理，未重复创建任务、未修改边界外文件、未强制 reset；恢复检查通过后才继续集成。

## 7. 集成顺序

1. 先审核 ownership 和 Agent 交接。
2. 先处理 RFC（拒绝，不产生实现变更）。
3. 集成 T-DRY-A 与 T-DRY-B 的审计文档。
4. 主控重新运行 Wave 0 关键检查。
5. 更新任务状态、devlog、CURRENT_STATE。
6. 确认无未交付修改后清理 worktree。

## 8. 演练结论

- 单层 Agent 结构可执行。
- 两个任务没有共享写文件，未发生真实文件冲突。
- 公共契约变化有唯一 RFC 入口。
- 未执行测试被记录为限制，而非伪造通过。
- 新会话可以只依赖仓库文档恢复状态。
- 真实产品业务仍未实现，符合 Wave 0 范围。

## 9. 遗留问题

- 当前环境未安装第三方格式化、lint、类型和安全扫描工具；Wave 0 只运行无依赖结构门槛，完整工具链需 Wave 1 冻结技术栈后接入。
- 本次没有真实冲突，因为 ownership 设计成功隔离；冲突恢复流程以 runbook 和受控失败记录验证。
