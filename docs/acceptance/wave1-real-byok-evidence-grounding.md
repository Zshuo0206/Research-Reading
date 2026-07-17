# T-W1-017 Real BYOK and Evidence Grounding 验收记录

- 日期：2026-07-17（Asia/Shanghai）
- 分支：`feat/w1-real-byok-evidence-grounding`
- 基线：`3df69784de5c3ebbccae36790f2a1e63a8e92ed3`
- 任务状态：`IMPLEMENTING`
- 真实 BYOK 发布状态：`BLOCKED_BY_MISSING_USER_CREDENTIALS`

## 已实现

- 新增连续 `006_guided_learning_provider_config.sql`；未修改 migration 001–005。
- Session provider 配置只持久化 provider、base_url、model、timeout 和输入/输出限制；Job 从同一 Session 配置生成，客户端 secret/ref 不进入持久化。
- Worker 真实 Guided Learning 路径使用服务端固定 `WORKFLOW_BYOK_API_KEY` 环境 secret；Session Memory 仅用于开发连接测试，API/Worker 不共享内存 secret。
- 新增四类 `GENERATE_GUIDED_DIRECTIONS`、`GENERATE_GUIDED_QUESTIONS`、`GENERATE_GUIDED_FEEDBACK`、`GENERATE_GUIDED_STAGE_SUMMARY` operation；真实路径由模型响应驱动，固定模板仅保留 Mock 路径。
- 四类 operation 均使用专用输入 builder；Questions/Feedback/Summary 接收 Session 内完整 selected direction，Feedback 接收当前问题、最新回答和历史，Summary 接收完整 question history 及服务端推导的完成/跳过顺序；模型请求同时携带 operation-specific output requirements。
- Evidence 只做服务端 source verification：quote 在本次 canonical context span 中唯一精确匹配，生成 page number、code-point offset、page hash、profile 和 verification；不把 claim/quote 的语义蕴含判断伪装成验证。无效/未知/重复 quote 降级为 `INSUFFICIENT_EVIDENCE`，不伪造 span；重复 Evidence key 只物化一次。
- 新增 `GET /api/v1/document-versions/:documentVersionId/content`，仅服务已登记 PDF，`application/pdf` + `inline`；Web 刷新从 document version 恢复，Evidence 提供“查看第 N 页”。

## 自动化证据

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过；74 files |
| `npm run contract` | 通过；generated types 无 drift |
| `npm run test:runtime-integration` | 通过；6 files / 26 tests |
| BYOK/Evidence 专项 | 通过；`byok.test.ts` 3/3，HTTP/PDF 2/2 |
| `npm test` | 通过；24/24 |
| `npm run e2e:smoke` | 通过；3/3，覆盖 BYOK 控件、Mock Guided Learning 流程和刷新恢复；真实 BYOK 浏览器 E2E 未执行（`BROWSER_REAL_BYOK_E2E_NOT_EXECUTED`） |

专项 fake provider 覆盖四类模型 operation、默认 Worker BYOK gateway、operation-specific input/output、完整 question history、provider 持久化、非蕴含 claim 的 source verification、重复 Evidence 去重、Unicode/code-point offset、无效 quote 无 Evidence、INSUFFICIENT_EVIDENCE claim 无引用、PDF endpoint、非法页码和客户端 secret/ref 不接受。

## 仍阻塞正式发布

未获得用户真实 provider、endpoint、model 和 API key，未执行真实外部连接、生成、错误分类和人工产品体验验收。fake provider 只证明适配器/Worker/契约链路，不等价于真实 BYOK 通过；因此不得标记 V1.0 `ACCEPTED`。
