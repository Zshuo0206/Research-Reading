# Dry-run Failure and Recovery

## 注入的失败

演练中将 T-DRY-B 的“测试无法执行”视为受控失败：该任务只有文档交付物，没有可运行 UI 测试，因此 Agent 不能把“未执行测试”声称为通过。按 `docs/runbooks/failed-agent-recovery.md`，任务应保持 `PARTIAL`/`BLOCKED`，并把限制交给主控。

## 恢复步骤

1. 主控保留 Agent 的交接报告，不创建重复任务。
2. 主控检查 worktree 状态和唯一文件 ownership。
3. 主控确认失败不涉及代码、契约或安全边界。
4. 主控将该限制记录为“按 Wave 0 范围不适用”，并重新执行仓库级结构检查。
5. 主控只有在关键检查通过后，才将任务作为文档演练交付物集成。

## 结果

本次没有使用强制 reset、覆盖文件或删除未知内容。失败被转化为明确限制，恢复后由主控复跑 `node scripts/check.mjs all`，并在总演练报告中记录。
