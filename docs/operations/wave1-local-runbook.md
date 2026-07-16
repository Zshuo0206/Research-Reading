# Wave 1 本地运行手册

本手册对应 `T-W1-016`，面向 Windows PowerShell 和本地单用户 Wave 1 验收。当前默认使用确定性 Mock，不需要外部凭据；所有服务只允许 loopback。

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

为本次运行建立明确的数据目录；不要把路径指向用户已有数据库：

```powershell
$env:SQLITE_DATABASE_PATH = "D:\Research-Reading-Acceptance\wave1\run.sqlite"
$env:CONTENT_STORAGE_ROOT = "D:\Research-Reading-Acceptance\wave1\content"
$env:API_HOST = "127.0.0.1"
$env:API_PORT = "4310"
```

分别在三个 PowerShell 窗口运行：

```powershell
npm run api
```

```powershell
npm run worker
```

```powershell
npm run web
```

Web preview 使用 `http://127.0.0.1:4173`；API 使用 `http://127.0.0.1:4310`。健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:4310/health
```

API 默认只监听 `127.0.0.1`。不要设置 `API_HOST=0.0.0.0`，也不要将端口暴露到远程网卡。

## Mock Guided Learning

默认 Worker 使用确定性 Mock。通过 Web 入口完成：创建项目 → 上传文本型 PDF → 输入学习目标 → 选择方向 → 进入 UNDERSTAND → 逐题回答或跳过 → 查看点评、参考答案和 Evidence → 编辑回答 → 主动进入下一题 → 查看阶段总结。

页面 URL 的 `?guidedSession=<session_id>` 用于刷新恢复。失败时只使用服务端返回的安全摘要和 `RETRY`，不要手工修改 SQLite。

## BYOK

真实 BYOK 只在本地人工验收时执行。必须由操作员安全提供 provider、HTTPS endpoint、model 和 API key；不要把 key 写入聊天、代码、提交、URL、SQLite 或日志。

当前 API key 通过 session-memory secret resolver 使用；重启后需要重新输入。真实请求须经本地 API，不允许浏览器直连供应商。没有用户凭据时只能记录 `BLOCKED_BY_MISSING_USER_CREDENTIALS`，不能用 Mock 结果代替真实 BYOK 结果。

## 停止和清理

在三个服务窗口按 `Ctrl+C` 停止。只删除明确的验收目录：

```powershell
Remove-Item -LiteralPath "D:\Research-Reading-Acceptance\wave1" -Recurse -Force
```

执行前确认该路径是本次验收临时目录，不要对未知路径或仓库目录执行递归删除。

## 故障排查

- migration 失败：确认数据库是新文件，并检查 `apps/api/migrations/001` 至 `005`；不要修改已发布 migration。
- `dist` 不存在：先运行 `npm run build:backend-packages` 和 `npm run build`。
- Job 卡在 `QUEUED`：确认 Worker 使用与 API 相同的 `SQLITE_DATABASE_PATH`。
- Session URL 无效：删除 `guidedSession` 参数后重新创建 Session；不要伪造客户端状态。
- CORS：只允许 `http://127.0.0.1:4173` 和 `http://localhost:4173`，无 Origin 的 API 调用仍应正常。
- `npm audit` 网络错误：不把外部网络失败写成代码漏洞；离线 security scan 仍必须通过。
- Windows CRLF：不要运行全仓 format 来掩盖 contract drift；单独运行 `npm run contract` 和 `git diff --check`。
