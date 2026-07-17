# T-W1-018 V1.0 Release Gate

## 基本信息

- 验收日期：2026-07-17（Asia/Shanghai）
- 分支：`chore/v1-release-gate`
- worktree：`D:\Research-Reading-Worktrees\v1-release-gate`
- 验收基线：`54043fb28cb082eb871773732bafce0f031fc562`
- 操作系统：Windows PowerShell
- Node/npm：Node `v24.16.0`，npm `11.13.0`
- 任务状态：`IMPLEMENTING`

## 自动发布 Gate

| 检查 | 结果 |
|---|---|
| migration 001–006 / schema version 6 | 通过；全新 SQLite 测试覆盖，provider config 表存在 |
| Wave 1 planning | 通过；当前 19 tasks（阶段 A 合并前 main 为 18，新增 T-W1-018 后为 19），无依赖环、无 ownership overlap |
| `node scripts/check.mjs all` | 通过 |
| `npm run lint` | 通过；75 files |
| `npm run typecheck` | 通过 |
| `npm run test:runtime-integration` | 通过；26/26 |
| BYOK/Evidence 定向 | 通过；13/13 |
| `npm test` | 通过；24/24 |
| `npm run contract` | 通过；contract generate/check 无 drift |
| `npm run build` | 通过 |
| `npm run e2e:smoke` | 通过；Playwright 3/3 |
| `npm run smoke` | 通过；loopback API/Worker/Web |
| security scan | 通过；`--skip-audit` |
| `git diff --check` | 通过 |

PDF fixture SHA-256 保持：

```text
99e07b4ba995b7c90bd84628a5db55b71a4faa1f06d3714a5942741cd39a55f8
```

自动化证据覆盖真实 PDF Mock 闭环、快速问答回归、Session 刷新/重启恢复、RETRY、EDIT_ANSWER、PDF content endpoint、Evidence 页码定位、provider config 白名单和 secret 边界。fake provider 只证明适配器与 Worker 链路，不等价于真实外部 BYOK。

## 真实 BYOK 与浏览器状态

当前安全检查只确认 `WORKFLOW_BYOK_API_KEY` 是否存在，未打印其值；结果为不存在：

```text
REAL_BYOK_ACCEPTANCE = BLOCKED_BY_MISSING_USER_CREDENTIALS
BROWSER_REAL_BYOK_E2E = NOT_EXECUTED
```

没有执行真实外部连接、真实模型生成或真实浏览器 BYOK 人工验收。现有 Playwright 3/3 只能描述为：

```text
BYOK controls + Mock Guided Learning UI flow
```

## Evidence、产品和安全人工 Gate

- Evidence 人工抽查：`NOT_EXECUTED`，需要真实模型输出和人工逐条判断；服务端只保证 canonical source verification，不宣称语义蕴含证明。
- Secret 检查：自动化通过；未发现 key 进入 SQLite、Job、Session、response、日志、URL、Git 工作区或发布材料。
- PDF 恢复/页码跳转：自动化通过；真实人工产品体验待执行。
- 快速问答回归：自动化通过。
- 产品负责人批准：`PENDING`。

## 最终发布判定

```text
AUTOMATED_RELEASE_GATE = PASS
REAL_BYOK_ACCEPTANCE = BLOCKED_BY_MISSING_USER_CREDENTIALS
BROWSER_REAL_BYOK_MANUAL_ACCEPTANCE = NOT_EXECUTED
HUMAN_EVIDENCE_REVIEW = NOT_EXECUTED
SECURITY_SECRET_CHECK = PASS
PRODUCT_OWNER_APPROVAL = PENDING
V1_RELEASE_STATUS = BLOCKED_BY_MISSING_USER_CREDENTIALS
```

因此当前不能标记 `ACCEPTED` 或 `RELEASED`，不创建 `v1.0.0` tag，不创建 GitHub Release。下一步需要项目负责人提供安全配置的真实凭据并明确批准真实 BYOK/浏览器人工验收窗口。
