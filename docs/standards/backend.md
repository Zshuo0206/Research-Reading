# Backend Standard

- 所有外部输入先经过 Schema 校验；业务层不得依赖未校验的字典或字符串。
- Handler/Controller 只负责协议适配，领域逻辑不直接依赖 HTTP。
- 每个请求带 `request_id`；异步任务额外带 `task_id`，Agent 执行额外带 `agent_run_id`。
- API 错误使用统一错误模型，不返回堆栈、密钥或内部路径。
- 外部服务必须通过适配层和可替换接口访问；禁止业务模块直接绑定 SDK。
- 写操作定义幂等键或明确说明不可幂等；重试只用于安全重试的错误。
- UTC 时间、稳定 ID、Schema 版本和审计事件必须在边界处确定。
