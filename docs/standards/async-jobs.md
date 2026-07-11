# Async Job Standard

- 任务状态至少包括 `QUEUED、RUNNING、SUCCEEDED、FAILED、CANCEL_REQUESTED、CANCELLED`。
- 每个任务有唯一 `task_id`、创建时间、开始/结束时间、attempt 和 `agent_run_id`。
- 任务处理器必须幂等；重复投递不能重复产生不可逆副作用。
- 超时、重试次数、退避和死信策略必须配置化并记录。
- 取消是协作式：处理器定期检查取消标记；无法立即停止时报告 `CANCEL_REQUESTED`。
- 外部服务故障不得无限重试；超过上限进入 `FAILED` 并提供恢复动作。
- 任务输出先写临时状态，完成校验后再发布，避免半成品被消费者读取。
