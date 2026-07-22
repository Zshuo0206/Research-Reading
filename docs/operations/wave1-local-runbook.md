# Wave 1 本地运行手册

本手册对应 `T-W1-017` 至 `T-W1-019`，面向 Windows PowerShell 和本地单用户 Wave 1 V1.0 Release Gate。当前默认使用确定性 Mock，不需要外部凭据；所有服务只允许 loopback。

## 前置条件

- Node.js `24.x`（仓库要求 `>=24.0.0 <25`）。
- npm `>=10`。
- Windows PowerShell。
- 一篇可提取文本 PDF；自动验收使用已登记的 `tests/fixtures/pdf/synthetic-text.pdf`。

检查版本：

```powershell
node --version
npm --version
```

## 安装和构建

在仓库根目录执行：

```powershell
npm ci --ignore-scripts
npm run build:backend-packages
npm run build
```

## 启动本地服务

推荐使用仓库脚本。API 和 Web 固定监听 `127.0.0.1:4310`、`127.0.0.1:4173`；脚本不会寻找或伪装成动态端口。任一固定端口已被占用时，start 会在创建状态文件和进程前失败，也不会终止占用端口的外部进程。

每次 start 都在已忽略的 `tmp/v1-local/runs/<run-id>/` 下创建独立日志和空的 Worker stop control file 路径，并在 `tmp/v1-local/state.json` 中记录本次 run id、PID、启动时间和路径。状态文件不保存 secret：

```powershell
.\scripts\start-v1-local.ps1
.\scripts\check-v1-local.ps1
```

打开 `http://127.0.0.1:4173`。停止时：

```powershell
.\scripts\stop-v1-local.ps1
```

stop 脚本只管理状态文件中 PID 与启动时间均匹配的进程。它先创建本次运行专属的空 stop file；Worker 只检查文件是否存在，不读取文件内容。Worker 收到控制信号后不再领取新 Job，允许正在执行的 Job 完成，关闭数据库并输出 `stopped`/`CONTROL_FILE` JSON 后，stop 才依次停止 API 和 Web。该机制不提供崩溃恢复或孤儿 Job 接管，只支持推荐的单 Worker 本地拓扑。

如果 Worker 未在默认 45 秒内退出，stop 会返回非零并保留 API、Web、状态文件和日志以便诊断；它不会强制终止 Worker。PID 已复用时也会保留该进程。成功停止后数据库、content 和每次运行的日志均保留，不会递归删除。

start 必须逐行解析 Worker stdout 的真实 JSON，只有看到当前进程输出的 `ready`、`accepts_jobs: true` 和完整 readiness 标记才会成功；仅有存活 PID 不算 ready。check 使用相同规则，并将 retry 事件报告为 degraded、错误或终止事件报告为 unhealthy。

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:4310/health
```

API 默认只监听 `127.0.0.1`。不要设置 `API_HOST=0.0.0.0`，也不要将端口暴露到远程网卡。

## Mock Guided Learning

默认 Worker 使用确定性 Mock。通过 Web 入口完成：创建项目 → 上传文本型 PDF → 输入学习目标 → 选择方向 → 进入 UNDERSTAND → 逐题回答或跳过 → 查看点评、参考答案和 Evidence → 编辑回答 → 主动进入下一题 → 查看阶段总结。

页面 URL 的 `?guidedSession=<session_id>` 用于刷新恢复。失败时只使用服务端返回的安全摘要和 `RETRY`，不要手工修改 SQLite。

## BYOK

真实 BYOK 只在本地人工验收时执行。必须由操作员安全提供 provider、HTTPS endpoint、model 和 API key；不要把 key 写入聊天、代码、提交、URL、SQLite 或日志。

V1 默认关闭浏览器 Session Memory secret 端点。真实 Guided Learning Job 使用运行时环境变量 `WORKFLOW_BYOK_API_KEY`：操作员在执行 start 的同一个 PowerShell 会话中设置一次，API 和 Worker 子进程会继承该值；start/check/stop 的输出、日志和状态文件均不得写入它。Mock 不需要设置 key。Web 只提交 provider/base_url/model/limits，不提交 key、runtime_secret_ref 或环境变量名；真实请求须经本地 API，不允许浏览器直连供应商。不要为了本地验收重新开启浏览器 session-key；该内存 secret 无法在 API 与 Worker 间共享。没有用户凭据时只能记录 `BLOCKED_BY_MISSING_USER_CREDENTIALS`。

Evidence 中的 `VERIFIED` 只代表引用位置与原文字符串通过 exact-match 核验，不代表模型 claim 的解释、推理或科研结论已被系统确认。Feedback 区的 reference answer 只由 resolver 已解析的 claim 重建，模型原始 `reference_answer` 不直接展示；UI 将“有原文支持”和“当前证据不足”分组。全部 claim 均证据不足时只显示固定的保守提示，不拼接未经支持的模型答案。

自动化 Playwright 只覆盖 BYOK 控件和 Mock Guided Learning UI 流程（含刷新恢复）；它不会把 fake API route 伪装成真实外部 BYOK，真实浏览器 BYOK E2E 记录为 `BROWSER_REAL_BYOK_E2E_NOT_EXECUTED`。真实人工验收前，必须用用户提供的凭据在本地 API/Worker 进程完成连接测试和最小四 operation 生成闭环。

## V1.0 Release Gate


不访问外部模型的真实本地闭环：

```powershell
npm run test:v1-smoke
```

该命令使用临时 SQLite/content root、真实 PDF、实际 loopback HTTP API，并直接调用真实 Worker runtime handler 完成三题与阶段总结，核对完整 PDF 响应和 exact Evidence，并在结束后清理临时资源。它不启动正式 Worker 轮询进程，因此不能替代 Windows start/check/stop 的实机演练。

Windows 实机演练必须额外确认：固定端口空闲、start 解析到真实 Worker ready JSON、check 健康、stop file 触发 `CONTROL_FILE` 停止事件、停止顺序为 Worker → API → Web，以及数据库/content/logs 保留。

在全新临时目录和 SQLite 数据库上运行 `npm run build:backend-packages`、planning/check、lint、typecheck、runtime integration、contract、build、Playwright、smoke 和 security scan。自动化通过不等于真实 BYOK 通过；没有安全配置的 `WORKFLOW_BYOK_API_KEY` 时记录 `REAL_BYOK_ACCEPTANCE = BLOCKED_BY_MISSING_USER_CREDENTIALS`，不创建 `v1.0.0` tag 或 GitHub Release。

## 停止和清理

使用 `stop-v1-local.ps1` 停止托管运行。脚本只删除成功停止后本次运行的状态文件和 stop control file；SQLite、content root 和每次运行日志继续保留。需要清理时，只处理操作员明确为本次运行创建并核验过的临时路径，不对未知路径或仓库目录执行递归删除。

## 故障排查

- migration 失败：确认数据库是新文件，并检查 `apps/api/migrations/001` 至 `005`；不要修改已发布 migration。
- `dist` 不存在：先运行 `npm run build:backend-packages` 和 `npm run build`。
- Job 卡在 `QUEUED`：确认 Worker 使用与 API 相同的 `SQLITE_DATABASE_PATH`。
- start 报端口占用：关闭或改配占用固定端口的外部程序后重试；不要终止不属于本次状态文件的进程，也不要改为动态端口绕过检查。
- check 报 Worker 未 ready：检查本次 run 目录的 Worker stdout/stderr；PID 存活不能替代合法 ready JSON。
- stop 超时：当前 Job 可能仍在运行；保留现有进程和状态，查看日志并等待后重试，不强制终止 Worker。
- Session URL 无效：删除 `guidedSession` 参数后重新创建 Session；不要伪造客户端状态。
- CORS：只允许 `http://127.0.0.1:4173` 和 `http://localhost:4173`，无 Origin 的 API 调用仍应正常。
- `npm audit` 网络错误：不把外部网络失败写成代码漏洞；离线 security scan 仍必须通过。
- Windows CRLF：不要运行全仓 format 来掩盖 contract drift；单独运行 `npm run contract` 和 `git diff --check`。
