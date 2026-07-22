[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$statePath = Join-Path $repoRoot "tmp\v1-local\processes.json"
$stateTemporaryPath = "$statePath.tmp"
if (-not (Test-Path -LiteralPath $statePath)) {
  Write-Error "No V1 local state exists. Run scripts/start-v1-local.ps1."
  exit 1
}
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ([System.IO.Path]::GetFullPath([string]$state.repo_root) -ne $repoRoot) {
  Write-Error "The V1 state belongs to a different repository."
  exit 1
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

function Write-StateLifecycle {
  param([string]$LifecycleStatus)
  $state.lifecycle_status = $LifecycleStatus
  $stateJson = $state | ConvertTo-Json -Depth 6
  try {
    Set-Content -LiteralPath $stateTemporaryPath -Value $stateJson -Encoding utf8
    [System.IO.File]::Replace($stateTemporaryPath, $statePath, $null)
  } finally {
    Remove-Item -LiteralPath $stateTemporaryPath -Force -ErrorAction SilentlyContinue
  }
}

$unhealthy = $false
$degraded = $false
$lifecycleStatus = if ($state.PSObject.Properties.Name -contains "lifecycle_status") {
  [string]$state.lifecycle_status
} else {
  "UNKNOWN"
}
Write-Output "managed lifecycle: $lifecycleStatus"

$ownedRunning = @{}
foreach ($record in $state.processes) {
  $process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
  if (-not $process) {
    $ownedRunning[[string]$record.role] = $false
    Write-Output "$($record.role): stopped"
    $unhealthy = $true
    continue
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = ([DateTime]$record.start_time_utc).ToUniversalTime()
  if ($actualStart.Ticks -ne $expectedStart.Ticks) {
    $ownedRunning[[string]$record.role] = $false
    Write-Output "$($record.role): PID reused; not owned by this state"
    $unhealthy = $true
    continue
  }
  $ownedRunning[[string]$record.role] = $true
  Write-Output "$($record.role): running (PID $($record.pid))"
}

$workerRecord = @($state.processes | Where-Object { $_.role -eq "worker" })[0]
if (
  $lifecycleStatus -eq "READY" -and
  $state.PSObject.Properties.Name -contains "worker_ready_observed" -and
  $state.worker_ready_observed -eq $true -and
  $workerRecord -and
  $ownedRunning["worker"] -ne $true -and
  -not (Test-ControlFileStoppedEvent -Path ([string]$state.logs.worker_stdout))
) {
  Write-StateLifecycle -LifecycleStatus "CRASHED_WORKER_REVIEW_REQUIRED"
  Write-Warning "A ready Worker exited without CONTROL_FILE stopped evidence; a RUNNING Job may be orphaned."
  Write-Output "V1 local status: crashed worker review required"
  exit 1
}

if (@("STARTING_API", "STARTING_WEB", "STARTING_WORKER") -contains $lifecycleStatus) {
  Write-Output "V1 local status: starting"
  exit 1
}
if ($lifecycleStatus -eq "START_FAILED_STOP_PENDING") {
  Write-Output "V1 local status: startup rollback pending"
  exit 1
}
if ($lifecycleStatus -eq "CRASHED_WORKER_REVIEW_REQUIRED") {
  Write-Warning "A ready Worker exited without CONTROL_FILE stopped evidence; a RUNNING Job may be orphaned."
  Write-Output "V1 local status: crashed worker review required"
  exit 1
}
if ($lifecycleStatus -ne "READY") {
  Write-Output "V1 local status: unhealthy"
  exit 1
}
if (
  -not ($state.PSObject.Properties.Name -contains "worker_ready_observed") -or
  $state.worker_ready_observed -ne $true
) {
  Write-Output "worker ready state: not observed"
  $unhealthy = $true
}
foreach ($requiredRole in @("api", "web", "worker")) {
  if (@($state.processes | Where-Object { $_.role -eq $requiredRole }).Count -ne 1) {
    Write-Output "$requiredRole ownership: missing or duplicated"
    $unhealthy = $true
  }
}

try {
  $api = Invoke-RestMethod -Uri "$($state.api_url)/health" -TimeoutSec 3
  if ($api.status -ne "ok") { throw "unexpected health payload" }
  Write-Output "api health: ok"
} catch {
  Write-Output "api health: failed"
  $unhealthy = $true
}
try {
  $web = Invoke-WebRequest -Uri ([string]$state.web_url) -UseBasicParsing -TimeoutSec 3
  if ($web.StatusCode -ne 200) { throw "unexpected web status" }
  Write-Output "web health: ok"
} catch {
  Write-Output "web health: failed"
  $unhealthy = $true
}

$stdoutEvents = @(Read-JsonEvents -Path ([string]$state.logs.worker_stdout))
$stderrEvents = @(Read-JsonEvents -Path ([string]$state.logs.worker_stderr))
$ready = @($stdoutEvents | Where-Object { Test-WorkerReadyEvent -Event $_ }).Count -gt 0
if ($ready) {
  Write-Output "worker ready: verified"
} else {
  Write-Output "worker ready: missing or invalid"
  $unhealthy = $true
}
$terminalEvents = @(@($stdoutEvents + $stderrEvents) | Where-Object {
  @("worker_platform_shell_error", "worker_start_failed", "worker_platform_shell_stopped") -contains [string]$_.event
})
if ($terminalEvents.Count -gt 0) {
  Write-Output "worker lifecycle: terminal event $([string]$terminalEvents[-1].event)"
  $unhealthy = $true
}
$retryEvents = @($stderrEvents | Where-Object { [string]$_.event -eq "worker_loop_retry" })
if ($retryEvents.Count -gt 0) {
  $latestRetry = $retryEvents[-1]
  Write-Warning "worker retry observed: count=$($retryEvents.Count), latest_consecutive_failures=$($latestRetry.consecutive_failures)"
  $degraded = $true
}

if ($unhealthy) {
  Write-Output "V1 local status: unhealthy"
  exit 1
}
if ($degraded) {
  Write-Output "V1 local status: degraded"
  exit 0
}
Write-Output "V1 local status: healthy"
