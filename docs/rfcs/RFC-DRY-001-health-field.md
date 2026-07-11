# RFC-DRY-001: Add a Field to the Wave 0 Health Response

- RFC ID: `RFC-DRY-001`
- Status: `REJECTED_FOR_WAVE_0_SCOPE`
- Author/Agent: Mock contract Agent A / 主控 Agent
- Date (UTC): 2026-07-11
- Related Task/Wave: T-DRY-A / Wave 0

## Problem

演练假设有人希望向 `GET /health` 增加一个公共响应字段。该变化会影响共享 Schema、探针、测试和消费者。

## Proposed change

假设新增一个描述 API 构建信息的可选字段。字段名称、类型和语义不在本 RFC 中批准，因为该变化没有真实 Wave 0 需求。

## Alternatives considered

- 不改公共接口，保持 Wave 0 占位契约最小化。
- 在后续 API 契约冻结后重新提交正式 RFC。

## Affected contracts and consumers

共享健康 Schema、API 实现、Smoke Test、Docker healthcheck、CI gate、监控/探针和未来生成的客户端类型。

## Migration and compatibility

如未来获批，应先更新 Schema 和契约测试，再更新实现与消费者；验证旧消费者对未知字段的行为，并提供回滚路径。

## Security and privacy impact

构建信息不得泄露 secrets、内部路径或部署凭据；字段输出需经过安全审查。

## Tests and acceptance

必须覆盖 Schema、健康端点、严格消费者、Docker healthcheck 和 CI。当前 RFC 被拒绝，因此不执行实现测试。

## Rollback plan

不产生代码变更；若未来批准，使用反向提交恢复原响应和 Schema，并重新运行关键 Smoke Test。

## Decision

- Human owner: 待后续真实需求指定
- Decision date: 2026-07-11
- Notes: 本次用于验证“发现公共契约变化后必须停下来走 RFC”。Wave 0 不实现该字段。
