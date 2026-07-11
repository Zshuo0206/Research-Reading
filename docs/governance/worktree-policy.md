# Worktree Policy

## 基本规则

- `main` 只用于集成，必须保持可验证。
- 每个并行任务使用独立分支和独立 worktree。
- worktree 名称格式：`../rr-wt-T-<id>`；分支格式：`task/T-<id>-<slug>`。
- 主控 Agent 在启动 Wave 前生成 `docs/integration/ownership-map.yaml`。
- 一个文件不能同时出现在两个 Agent 的 `writable_paths` 中。
- 子 Agent 完成后由主控 Agent 按 runbook 清理 worktree；清理前必须确认无未交付修改。

## 禁止

- 在共享未提交工作区中并行写入。
- 使用强制 reset/checkout 覆盖其他 Agent 内容。
- 未经人工批准删除包含未知修改的 worktree。
- 在任务完成前把临时 worktree 当作正式分支。
