[CmdletBinding()]
param(
  [string]$DatabasePath,
  [string]$ContentRoot,
  [ValidateRange(1, 300)]
  [int]$WorkerStopTimeoutSeconds = 45
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

function Test-ControlFileStoppedEvent {
  param([string]$Path)
  foreach ($event in @(Read-JsonEvents -Path $Path)) {
    if (
      [string]$event.event -eq "worker_platform_shell_stopped" -and
      [string]$event.signal -eq "CONTROL_FILE"
    ) { return $true }
  }
  return $false
}

function Get-OwnedProcess {
  param($Record)
  $process = Get-Process -Id ([int]$Record.pid) -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = ([DateTime]$Record.start_time_utc).ToUniversalTime()
  if ($actualStart.Ticks -ne $expectedStart.Ticks) {
    throw "$($Record.role): PID $($Record.pid) was reused; leaving it untouched."
  }
  return $process
}

function Test-OwnedProcessRunning {
  param($Record)
  return $null -ne (Get-OwnedProcess -Record $Record)
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
$workerRecord = $null
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

function Write-ManagedState {
  param(
    [ValidateSet("STARTING", "READY", "START_FAILED_STOP_PENDING")]
    [string]$LifecycleStatus
  )
  [ordered]@{
    schema_version = "v1-local-processes.v3"
    repo_root = $repoRoot
    run_id = $runId
    run_directory = $runDirectory
    worker_stop_file = $workerStopFile
    api_url = $apiUrl
    web_url = $webUrl
    database_path = $DatabasePath
    content_root = $ContentRoot
    lifecycle_status = $LifecycleStatus
    logs = $logs
    processes = @($started)
  } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Test-ApiHealth {
  try {
    $health = Invoke-RestMethod -Uri "$apiUrl/health" -TimeoutSec 2
    return $health.status -eq "ok"
  } catch { return $false }
}

function Test-WebHealth {
  try {
    $response = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch { return $false }
}

function Wait-ApiHealth {
  param($Record)
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Test-OwnedProcessRunning -Record $Record)) {
      throw "API exited before its health check passed."
    }
    if (Test-ApiHealth) {
      Write-Output "api: healthy"
      return
    }
    Start-Sleep -Milliseconds 250
  }
  throw "API health did not pass within 30 seconds."
}

function Wait-WebHealth {
  param($Record)
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Test-OwnedProcessRunning -Record $Record)) {
      throw "Web exited before its health check passed."
    }
    if (Test-WebHealth) {
      Write-Output "web: healthy"
      return
    }
    Start-Sleep -Milliseconds 250
  }
  throw "Web health did not pass within 30 seconds."
}

function Wait-WorkerReady {
  param($Record)
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Test-OwnedProcessRunning -Record $Record)) {
      throw "Worker exited before a valid ready event was observed."
    }
    $workerErrors = @(Read-JsonEvents -Path $logs.worker_stderr | Where-Object {
      @("worker_start_failed", "worker_platform_shell_error") -contains [string]$_.event
    })
    if ($workerErrors.Count -gt 0) {
      throw "Worker emitted a startup failure event before becoming ready."
    }
    $ready = @(
      Read-JsonEvents -Path $logs.worker_stdout | Where-Object {
        Test-WorkerReadyEvent -Event $_
      }
    ).Count -gt 0
    if ($ready -and (Test-ApiHealth) -and (Test-WebHealth)) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "Worker did not produce valid ready evidence while API and Web remained healthy within 30 seconds."
}

function Request-ManagedWorkerStop {
  New-Item -ItemType File -Path $workerStopFile -Force | Out-Null
  Write-Output "worker: startup rollback control-file stop requested"
}

function Wait-ManagedWorkerExit {
  param($Record)
  $deadline = [DateTime]::UtcNow.AddSeconds($WorkerStopTimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Test-OwnedProcessRunning -Record $Record)) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return -not (Test-OwnedProcessRunning -Record $Record)
}

function Wait-ControlFileStoppedEvent {
  $deadline = [DateTime]::UtcNow.AddSeconds(5)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-ControlFileStoppedEvent -Path $logs.worker_stdout) { return $true }
    Start-Sleep -Milliseconds 100
  }
  return Test-ControlFileStoppedEvent -Path $logs.worker_stdout
}

function Stop-OwnedApiAndWeb {
  foreach ($role in @("api", "web")) {
    $record = @($started | Where-Object { $_.role -eq $role })[0]
    if (-not $record) { continue }
    $process = Get-OwnedProcess -Record $record
    if (-not $process) {
      Write-Output "$($role): already stopped"
      continue
    }
    Stop-Process -Id ([int]$record.pid)
    try { [void]$process.WaitForExit(5000) } catch {}
    Write-Output "$($role): stopped"
  }
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

  $apiRecord = Start-V1OwnedProcess -Role "api" -Arguments @($apiScript) -StandardOutput $logs.api_stdout -StandardError $logs.api_stderr
  Wait-ApiHealth -Record $apiRecord

  $webStartParameters = @{
    Role = "web"
    ProcessWorkingDirectory = (Join-Path $repoRoot "apps/web")
    Arguments = @($viteScript, "preview", "--host", "127.0.0.1", "--port", [string]$webPort, "--strictPort")
    StandardOutput = $logs.web_stdout
    StandardError = $logs.web_stderr
  }
  $webRecord = Start-V1OwnedProcess @webStartParameters
  Wait-WebHealth -Record $webRecord

  [Environment]::SetEnvironmentVariable("WORKER_STOP_FILE", $workerStopFile, "Process")
  $workerRecord = Start-V1OwnedProcess -Role "worker" -Arguments @($workerScript) -StandardOutput $logs.worker_stdout -StandardError $logs.worker_stderr
  [Environment]::SetEnvironmentVariable("WORKER_STOP_FILE", $null, "Process")
  Write-ManagedState -LifecycleStatus "STARTING"
  Wait-WorkerReady -Record $workerRecord
  Write-ManagedState -LifecycleStatus "READY"

  Write-Output "V1 local services ready: $webUrl (API $apiUrl; Worker ready verified)."
  Write-Output "Run: $runId"
  Write-Output "State: $statePath"
} catch {
  $startupFailure = $_
  if ($workerRecord) {
    try { Write-ManagedState -LifecycleStatus "START_FAILED_STOP_PENDING" } catch {
      Write-Warning "Could not update managed lifecycle state after Worker startup failure."
    }
    Request-ManagedWorkerStop
    if (-not (Wait-ManagedWorkerExit -Record $workerRecord)) {
      try { Write-ManagedState -LifecycleStatus "START_FAILED_STOP_PENDING" } catch {}
      throw "Startup failed and Worker did not exit within $WorkerStopTimeoutSeconds seconds. It may still be completing its current Job. API and Web remain running; managed state and logs were preserved. Re-run stop-v1-local.ps1 later."
    }
    if (-not (Wait-ControlFileStoppedEvent)) {
      try { Write-ManagedState -LifecycleStatus "START_FAILED_STOP_PENDING" } catch {}
      throw "Startup failed and Worker exited without the expected CONTROL_FILE stopped event. API and Web remain running; managed state and logs were preserved for diagnosis."
    }
    Write-Output "worker: stopped gracefully during startup rollback"
    Stop-OwnedApiAndWeb
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $workerStopFile -Force -ErrorAction SilentlyContinue
    throw $startupFailure
  }

  Stop-OwnedApiAndWeb
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $workerStopFile -Force -ErrorAction SilentlyContinue
  throw $startupFailure
} finally {
  foreach ($name in $managedEnvironment) {
    [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
  }
}
