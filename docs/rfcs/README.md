# RFC Index

| RFC | 状态 | 主题 |
|---|---|---|
| RFC-DRY-001 | REJECTED_FOR_WAVE_0_SCOPE | 假设的健康端点字段变更 |
| RFC-W1-001 | REPAIR_PENDING_REVIEW | Wave 1 技术基础与契约基线；第一批整改后等待独立复核 |
| RFC-W1-003 | APPROVED | V1.0 稳定化错误、BYOK、Worker readiness 与本地 smoke 边界 |

所有真实公共契约、数据库模型、状态机和依赖变化必须新增 RFC，并由契约 owner、独立 QA 和主控完成技术审查；若涉及产品范围、重大隐私/成本/长期形态、远程部署认证或破坏性操作，再提交人类项目负责人批准。`RFC-W1-001` 本次仅接受第一批技术基线，不代表后续任务自动解锁。真实外部模型统一 adapter 的具体运行风险由 T-W1-004B 人工验收记录；若改变 BYOK/隐私边界仍需新 RFC。
