# RFC — Wave 1 Technical Foundation and Contract Baseline

- RFC ID: `RFC-W1-001`
- Status: `REPAIR_PENDING_REVIEW`
- Author/Agent: Orchestrator
- Date (UTC): 2026-07-11
- Related Task/Wave: Wave 1 / T-W1-001
- Technical reviewer(s): `contract-agent`, `qa-evaluation-agent`, Orchestrator
- Independent QA owner: `qa-evaluation-agent`
- Human decision required: `RECORDED_IN_USER_STARTUP_DECISION` for Gate A and the first-batch Gate B authorization

## Problem

Wave 1 产品范围已经通过人工审核，但 Wave 0 只有占位契约。真实实现前必须统一 Node 版本、部署边界、公共 Schema、Job/Question/Answer 状态、PDF canonical 文本、证据物化、ModelGateway、SQLite 恢复、QA 和 CI 门槛。启动材料还必须避免把“先实现才能冻结/授权”的循环条件写成前置要求。

## Proposed change

### 1. 三个独立 Gate

- **Gate A 技术方案冻结**：只审查方案、契约、ownership、QA、部署和回滚；不要求业务实现。通过后 RFC 可从 `PROPOSED` 变为 `ACCEPTED`，任务仍为 `DRAFT`。
- **Gate B 编码授权**：Gate A 通过后，由人类项目负责人单独明确允许真实业务编码；不由技术 RFC 自动触发。
- **Gate C 业务任务解锁**：Gate B 通过后，主控逐个检查依赖、写路径、契约、测试、验收和回滚，将具体任务从 `DRAFT` 转为 `READY`；未通过的任务继续锁定。

### 2. Runtime 和部署

- 目标基线为 Node.js 24 LTS + TypeScript；Node 24作为更新的LTS目标基线；Node 22仍处于LTS支持期，Wave 0 Node 22 仅作迁移前基线。
- Wave 1 只允许本地部署，API/Web 监听 `127.0.0.1`，不绑定 `0.0.0.0`，不提供远程部署。
- 认证主体定义为运行本地工作台的本地操作员；跨项目检查是 workspace-local project binding，不表述为没有认证主体的“项目级授权”。远程部署必须另行提交认证/部署 RFC。

### 3. Contract baseline

- 公共基线为 `wave1.v1`；细分为 `api.v1`、`document.v1`、`job.v1`、`question-plan.v1`、`answer.v1`、`evidence.v1` 和 `model-gateway.v1`。
- `question-plan.v1` 增加 `document_language`、`retrieval_queries`、`retrieval_terms`，允许中文问题与英文论文之间生成目标语言词法检索提示。
- Question/Answer 使用 `review_status` 与 `verification_status`；`MODIFIED` 只表示 revision 事件，不是稳定状态。
- Job 固定为 `QUEUED`、`RUNNING`、`SUCCEEDED`、`FAILED`、`CANCEL_REQUESTED`、`CANCELLED`；attempt、failure_class、next_run_at 和 lease 表达重试及恢复。

### 4. PDF and Evidence

- 使用 `pdfjs-text-v1`：NFKC、LF、空白规则、text item 顺序、无自动去连字符，统一记录 extraction profile。
- `canonical_page_text` 是规范化页面文本；offset 使用 Unicode code points，区间为 `[char_start, char_end)`。
- `quote` 必须是 canonical page text 的精确连续子串；SHA-256 是 canonical text UTF-8 字节的小写 64 位 hex。
- PDF 限制为 50 MiB、300 页、10,000,000 code points、30 秒提取超时和 256 MiB 单文档 Worker 内存预算；加密/损坏文件拒绝，临时文件 finally 清理并由 sweeper 恢复清理。

### 5. ModelGateway and BYOK

- Wave 1 必须包含 `ModelGateway.v1`、确定性 Mock、Schema/证据验证和失败边界。
- Wave 1 同时包含统一 OpenAI-compatible BYOK 适配器、OpenAI/Gemini/Groq/OpenRouter 预设、自定义 HTTPS `base_url`/模型名称、配置验证和连接测试。
- Mock 用于 CI、自动测试、无网络开发、确定性失败和前端/状态机开发；真实适配器用于用户实际使用和本地人工验收。真实外部调用不进入普通 CI。
- 平台不提供共享密钥；API Key 只来自环境变量或当前应用运行会话内存，应用重启后允许重新输入。API Key 不写入 Git、SQLite、日志、审计、导出或 fixture，浏览器不得直连供应商。
- 持久化模型配置只含 provider、base_url、model、超时和输入/输出上限；secret ref 与普通配置分离，Schema 不含明文密钥字段。
- 模型只能返回服务端生成的 `context_span_id` 或候选引用，不得生成最终 `char_start`/`char_end`。最终 EvidenceSpan 由服务端依据 context span 物化、计算和验证。

### 6. SQLite and QA

- SQLite 使用 WAL、`foreign_keys=ON`、5 秒 busy timeout、事务型 `BEGIN IMMEDIATE` job claim、60 秒 lease/20 秒续租、启动崩溃恢复、周期性 PASSIVE checkpoint 和备份前 TRUNCATE checkpoint。
- 独立 QA owner 为 `qa-evaluation-agent`，其只读实现模块并独立维护评测、fixture 和 QA 审计文件。
- 确定性 CI 门槛包括 PR Playwright smoke；问题可用率、带证据回答用户接受率等是产品观察指标，不是确定性 PR 阻断条件。

## Alternatives considered

1. **Python/FastAPI + pypdf**：会形成第二套运行时，暂不采用。
2. **PostgreSQL + Redis + 云对象存储**：超出单用户本地 Wave 1 的运维边界，暂不采用。
3. **模型 SDK 直接进入业务层**：供应商锁定且难以保持 Mock 同契约，拒绝。
4. **每家供应商单独绑定 SDK**：会造成供应商锁定；采用一个 OpenAI-compatible BYOK 适配器和预设，真实调用仅作为人工验收。
5. **模型直接返回最终字符 offset**：模型无法可靠掌握服务端 canonical 文本，改为 context span 引用和服务端物化。

## Affected contracts and consumers

- 新增/冻结 `packages/contracts/wave1/**` 下的 JSON Schema 和契约测试。
- API、Worker、Web、Mock ModelGateway、PDF/Evidence 校验、固定评测集均为消费者。
- Wave 0 `wave0.v1` 健康占位契约保留至 Wave 1 API 完成替换，不在本 RFC 中破坏性删除。

## Migration and compatibility

- 先合并契约和契约测试，再合并消费者；Gate A 不要求这些实现已经存在。
- 不兼容字段变更创建新版本，不复用旧字段语义。
- Question/Answer 的旧 `MODIFIED` 状态不得进入 Wave 1 Schema；用户修改通过 revision 追加表示。
- SQLite 迁移必须通过空库和上一版本库测试；不做隐式删除。

## Security and privacy impact

- Wave 1 默认 Mock，同时包含统一 OpenAI-compatible BYOK 适配器；真实外部调用仅为人工验收项，不进入普通 CI。
- 原始 PDF 不发送到外部服务；未来允许发送的内容必须是本地操作员明确同意后的规范化文本/context spans。
- API 仅 loopback；远程访问不受本 RFC 授权。
- PDF、论文文本、模型输出均为不可信数据；服务端强制 Schema、context span、EvidenceSpan 和本地工作区项目绑定检查。

## Tests and acceptance

技术验收 owner、QA 复核方式、证据位置和例外处理：

- `contract-agent`：Schema、错误模型、revision/review/verification、Job 迁移和兼容 fixture。
- `pdf-storage-agent`：canonical page text、offset、quote、hash、资源限制和临时文件清理。
- `model-gateway-agent`：Mock、context_span_id、输出验证、超时和预算边界。
- `workflow-backend-agent`：本地操作员/工作区绑定、幂等和闭环状态转换。
- `frontend-agent`：基于契约的 Web 骨架和 PR smoke 消费路径。
- `qa-evaluation-agent`：独立运行契约、迁移、资源边界、失败恢复、Playwright smoke 和固定评测；不得只复用责任 Agent 结果。
- Orchestrator：复跑确定性 CI、关键 E2E、依赖环和 ownership 检查，核对范围和证据。

### Reviewer sign-off

| Reviewer | Role | Status | Date (UTC) | Review conclusion | Signature/record |
|---|---|---|---|---|---|
| `contract-agent` | Contract owner | `NOT_APPLICABLE_AS_SUBAGENT` | 2026-07-11 | 本次由主控在共享工作区完成契约实现并复跑测试；未伪造子 Agent 签字 | `startup-decision` |
| `qa-evaluation-agent` | Independent QA owner | `NOT_APPLICABLE_AS_SUBAGENT` | 2026-07-11 | QA 基础资料已按独立写路径准备；未伪造独立 Reviewer 签字 | `startup-decision` |
| Orchestrator | Main control | `RECORDED` | 2026-07-11 | 完成一致性收口并记录第一批范围；以实际命令结果作为技术证据 | `startup-decision` |

任何 reviewer 标记 `CHANGES_REQUESTED` 时，RFC 保持 `PROPOSED`，不进入 Gate B/C。例外必须记录原因、风险、批准人和恢复计划，未批准不得绕过必过门槛。

## Rollback plan

- RFC 未接受前不开始业务编码。
- Gate A 失败时只修订规划材料，保持 Wave 0 健康占位和契约不变。
- Gate B 未授权时所有实现任务继续 `DRAFT`，不创建分支/worktree。
- 外部供应商风险通过不启用 provider 规避；Mock 保持验收闭环。
- 已集成后若需回滚，使用最近通过 CI 的契约/实现版本、SQLite 一致备份和前向修复，不使用强制 reset 或盲删。

## Decision

- Technical decision owner: Orchestrator + `contract-agent`
- Human project owner (only if required): Gate B coding authorization; provider/remote deployment RFC if later proposed
- Decision date (UTC): 2026-07-11 human startup decision recorded; independent repair review pending
- Notes: 本 RFC 记录第一批整改后的技术基线，不授权后续 SQLite、PDF、Gateway 运行时、工作流 API 或 Web 业务任务；真实 BYOK 外部调用只在人工验收项中执行。
