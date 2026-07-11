# Observability Standard

每个请求/任务日志至少关联：

- `request_id`
- `task_id`（如适用）
- `agent_run_id`（如适用）
- `project_id`（如适用）
- service、event、status、duration_ms

日志使用结构化字段，不拼接未经脱敏的用户输入。指标至少覆盖请求量、错误率、延迟、任务队列长度、重试次数、外部服务耗时和模型成本。Trace/context 只传播 ID，不传播敏感正文。
