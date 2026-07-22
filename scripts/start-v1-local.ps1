[CmdletBinding()]
param(
  [string]$DatabasePath,
  [string]$ContentRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiPort = 4310
$webPort = 4173
$apiUrl = "http://127.0.0.1:$apiPort"
$webUrl = "http://127.0.0.1:$webPort"
$runtimeRoot = Join-Path $repoRoot "tmp\v1-local"
$statePath = Join-Path $runtimeRoot "processes.json"
if (-not $DatabasePath) { $DatabasePath = Join-Path $runtimeRoot "v1-local.sqlite" }
if (-not $ContentRoot) { $ContentRoot = Join-Path $runtimeRoot "content" }
$DatabasePath = [System.IO.Path]::GetFullPath($DatabasePath)
$ContentRoot = [System.IO.Path]::GetFullPath($ContentRoot)

function Test-TcpListener {
  param([int]$Port)
  return [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains $Port
}

function Read-JsonEvents {
  param([string]$Path)
  $events = @()
  if (-not (Test-Path -LiteralPath $Path)) { return $events }
  foreach ($line in @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    try {
      $event = $line | ConvertFrom-Json -ErrorAction Stop
      if ($event -and $event.PSObject.Properties.Name -contains "event") {
        $events += $event
      }
    } catch {}
  }
  return $events
}

function Test-WorkerReadyEvent {
  param($Event)
  if (-not $Event -or [string]$Event.event -ne "worker_platform_shell_ready") { return $false }
  if ($Event.accepts_jobs -ne $true) { return $false }
  $verified = @($Event.readiness_verified)
  return (
    $verified -contains "database" -and
    $verified -contains "migrations" -and
    $verified -contains "handlers"
  )
}

function Test-OwnedProcessRunning {
  param($Record)
  $process = Get-Process -Id ([int]$Record.pid) -ErrorAction SilentlyContinue
  if (-not $process) { return $false }
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = ([DateTime]$Record.start_time_utc).ToUniversalTime()
  return $actualStart.Ticks -eq $expectedStart.Ticks
}

if (Test-Path -LiteralPath $statePath) {
  throw "V1 local state already exists. Run scripts/stop-v1-local.ps1 first."
}
foreach ($port in @($apiPort, $webPort)) {
  if (Test-TcpListener -Port $port) {
    throw "TCP port $port is already listening. No V1 local process was started."
  }
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

$runId = [Guid]::NewGuid().ToString("N")
$runDirectory = Join-Path $runtimeRoot ("runs\" + $runId)
$workerStopFile = Join-Path $runDirectory "worker.stop"
$logs = [ordered]@{
  api_stdout = Join-Path $runDirectory "api.stdout.log"
  api_stderr = Join-Path $runDirectory "api.stderr.log"
  worker_stdout = Join-Path $runDirectory "worker.stdout.log"
  worker_stderr = Join-Path $runDirectory "worker.stderr.log"
  web_stdout = Join-Path $runDirectory "web.stdout.log"
  web_stderr = Join-Path $runDirectory "web.stderr.log"
}

New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $ContentRoot -Force | Out-Null
$nodePath = (Get-Command node -ErrorAction Stop).Source
$started = [System.Collections.Generic.List[object]]::new()
$managedEnvironment = @(
  "SQLITE_DATABASE_PATH",
  "CONTENT_STORAGE_ROOT",
  "API_HOST",
  "API_PORT",
  "WORKER_STOP_FILE"
)
$previousEnvironment = @{}
foreach ($name in $managedEnvironment) {
  $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

function Start-V1OwnedProcess {
  param(
    [string]$Role,
    [string[]]$Arguments,
    [string]$StandardOutput,
    [string]$StandardError,
    [string]$ProcessWorkingDirectory = $repoRoot
  )
  $startParameters = @{
    FilePath = $nodePath
    ArgumentList = $Arguments
    WorkingDirectory = $ProcessWorkingDirectory
    RedirectStandardOutput = $StandardOutput
    RedirectStandardError = $StandardError
    WindowStyle = "Hidden"
    PassThru = $true
  }
  $process = Start-Process @startParameters
  Start-Sleep -Milliseconds 100
  if ($process.HasExited) {
    throw "$Role exited during startup. Inspect this run's stderr log."
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
  [Environment]::SetEnvironmentVariable("API_PORT", [string]$apiPort, "Process")
  [Environment]::SetEnvironmentVariable("WORKER_STOP_FILE", $null, "Process")

  $apiScript = '"' + (Join-Path $repoRoot "apps/api/dist/server.js") + '"'
  $workerScript = '"' + (Join-Path $repoRoot "apps/worker/dist/worker.js") + '"'
  $viteScript = '"' + (Join-Path $repoRoot "node_modules/vite/bin/vite.js") + '"'
  Start-V1OwnedProcess -Role "api" -Arguments @($apiScript) -StandardOutput $logs.api_stdout -StandardError $logs.api_stderr | Out-Null

  [Environment]::SetEnvironmentVariable("WORKER_STOP_FILE", $workerStopFile, "Process")
  $workerRecord = Start-V1OwnedProcess -Role "worker" -Arguments @($workerScript) -StandardOutput $logs.worker_stdout -StandardError $logs.worker_stderr
  [Environment]::SetEnvironmentVariable("WORKER_STOP_FILE", $null, "Process")

  $webStartParameters = @{
    Role = "web"
    ProcessWorkingDirectory = (Join-Path $repoRoot "apps/web")
    Arguments = @($viteScript, "preview", "--host", "127.0.0.1", "--port", [string]$webPort, "--strictPort")
    StandardOutput = $logs.web_stdout
    StandardError = $logs.web_stderr
  }
  Start-V1OwnedProcess @webStartParameters | Out-Null

  [ordered]@{
    schema_version = "v1-local-processes.v2"
    repo_root = $repoRoot
    run_id = $runId
    run_directory = $runDirectory
    worker_stop_file = $workerStopFile
    api_url = $apiUrl
    web_url = $webUrl
    database_path = $DatabasePath
    content_root = $ContentRoot
    logs = $logs
    processes = @($started)
  } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding utf8

  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  $apiReady = $false
  $webReady = $false
  $workerReady = $false
  while ([DateTime]::UtcNow -lt $deadline -and (-not $apiReady -or -not $webReady -or -not $workerReady)) {
    if (-not (Test-OwnedProcessRunning -Record $workerRecord)) {
      throw "Worker exited before a valid ready event was observed."
    }
    $workerErrors = @(Read-JsonEvents -Path $logs.worker_stderr | Where-Object {
      @("worker_start_failed", "worker_platform_shell_error") -contains [string]$_.event
    })
    if ($workerErrors.Count -gt 0) {
      throw "Worker emitted a startup failure event before becoming ready."
    }
    $workerReady = @(
      Read-JsonEvents -Path $logs.worker_stdout | Where-Object {
        Test-WorkerReadyEvent -Event $_
      }
    ).Count -gt 0
    try {
      $health = Invoke-RestMethod -Uri "$apiUrl/health" -TimeoutSec 2
      $apiReady = $health.status -eq "ok"
    } catch { $apiReady = $false }
    try {
      $webResponse = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
      $webReady = $webResponse.StatusCode -eq 200
    } catch { $webReady = $false }
    if (-not $apiReady -or -not $webReady -or -not $workerReady) {
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $apiReady -or -not $webReady -or -not $workerReady) {
    throw "V1 services did not produce API, Web and Worker ready evidence within 30 seconds."
  }
  Write-Output "V1 local services ready: $webUrl (API $apiUrl; Worker ready verified)."
  Write-Output "Run: $runId"
  Write-Output "State: $statePath"
} catch {
  foreach ($record in @($started | Sort-Object -Property role -Descending)) {
    if (Test-OwnedProcessRunning -Record $record) {
      Stop-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
    }
  }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $workerStopFile -Force -ErrorAction SilentlyContinue
  throw
} finally {
  foreach ($name in $managedEnvironment) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}
