[CmdletBinding()]
param(
  [int]$ApiPort = 4310,
  [int]$WebPort = 4173,
  [string]$DatabasePath,
  [string]$ContentRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = Join-Path $repoRoot "tmp\v1-local"
$statePath = Join-Path $runtimeRoot "processes.json"
if (-not $DatabasePath) { $DatabasePath = Join-Path $runtimeRoot "v1-local.sqlite" }
if (-not $ContentRoot) { $ContentRoot = Join-Path $runtimeRoot "content" }
$DatabasePath = [System.IO.Path]::GetFullPath($DatabasePath)
$ContentRoot = [System.IO.Path]::GetFullPath($ContentRoot)

if (Test-Path -LiteralPath $statePath) {
  throw "V1 local state already exists. Run scripts/stop-v1-local.ps1 first."
}
foreach ($required in @(
  "apps/api/dist/server.js",
  "apps/worker/dist/worker.js",
  "apps/web/dist/index.html",
  "node_modules/vite/bin/vite.js"
)) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $required))) {
    throw "Missing build artifact: $required. Run npm run build first."
  }
}

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $ContentRoot -Force | Out-Null
$nodePath = (Get-Command node -ErrorAction Stop).Source
$started = [System.Collections.Generic.List[object]]::new()
$managedEnvironment = @(
  "SQLITE_DATABASE_PATH",
  "CONTENT_STORAGE_ROOT",
  "API_HOST",
  "API_PORT"
)
$previousEnvironment = @{}
foreach ($name in $managedEnvironment) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

function Start-V1OwnedProcess {
  param(
    [string]$Role,
    [string[]]$Arguments,
    [string]$ProcessWorkingDirectory = $repoRoot
  )
  $startParameters = @{
    FilePath = $nodePath
    ArgumentList = $Arguments
    WorkingDirectory = $ProcessWorkingDirectory
    RedirectStandardOutput = (Join-Path $runtimeRoot "$Role.stdout.log")
    RedirectStandardError = (Join-Path $runtimeRoot "$Role.stderr.log")
    WindowStyle = "Hidden"
    PassThru = $true
  }
  $process = Start-Process @startParameters
  Start-Sleep -Milliseconds 100
  if ($process.HasExited) {
    throw "$Role exited during startup. Inspect its stderr log."
  }
  $record = [ordered]@{
    role = $Role
    pid = $process.Id
    start_time_utc = $process.StartTime.ToUniversalTime().ToString("o")
  }
  $started.Add($record)
  return $record
}

try {
  [Environment]::SetEnvironmentVariable("SQLITE_DATABASE_PATH", $DatabasePath, "Process")
  [Environment]::SetEnvironmentVariable("CONTENT_STORAGE_ROOT", $ContentRoot, "Process")
  [Environment]::SetEnvironmentVariable("API_HOST", "127.0.0.1", "Process")
  [Environment]::SetEnvironmentVariable("API_PORT", [string]$ApiPort, "Process")

  $apiScript = '"' + (Join-Path $repoRoot "apps/api/dist/server.js") + '"'
  $workerScript = '"' + (Join-Path $repoRoot "apps/worker/dist/worker.js") + '"'
  $viteScript = '"' + (Join-Path $repoRoot "node_modules/vite/bin/vite.js") + '"'
  Start-V1OwnedProcess -Role "api" -Arguments @($apiScript) | Out-Null
  Start-V1OwnedProcess -Role "worker" -Arguments @($workerScript) | Out-Null
  $webStartParameters = @{
    Role = "web"
    ProcessWorkingDirectory = (Join-Path $repoRoot "apps/web")
    Arguments = @(
      $viteScript, "preview", "--host", "127.0.0.1", "--port", [string]$WebPort, "--strictPort"
    )
  }
  Start-V1OwnedProcess @webStartParameters | Out-Null

  [ordered]@{
    schema_version = "v1-local-processes.v1"
    repo_root = $repoRoot
    api_url = "http://127.0.0.1:$ApiPort"
    web_url = "http://127.0.0.1:$WebPort"
    database_path = $DatabasePath
    content_root = $ContentRoot
    processes = @($started)
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding utf8

  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  $apiReady = $false
  $webReady = $false
  while ([DateTime]::UtcNow -lt $deadline -and (-not $apiReady -or -not $webReady)) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 2
      $apiReady = $health.status -eq "ok"
    } catch { $apiReady = $false }
    try {
      $webResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$WebPort" -UseBasicParsing -TimeoutSec 2
      $webReady = $webResponse.StatusCode -eq 200
    } catch { $webReady = $false }
    if (-not $apiReady -or -not $webReady) { Start-Sleep -Milliseconds 250 }
  }
  if (-not $apiReady -or -not $webReady) {
    throw "V1 services did not become healthy within 20 seconds."
  }
  Write-Output "V1 local services ready: http://127.0.0.1:$WebPort (API $ApiPort)."
  Write-Output "State: $statePath"
} catch {
  foreach ($record in $started) {
    $process = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($process) { Stop-Process -Id $record.pid -ErrorAction SilentlyContinue }
  }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  throw
} finally {
  foreach ($name in $managedEnvironment) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}
