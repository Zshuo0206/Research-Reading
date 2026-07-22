[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$statePath = Join-Path $repoRoot "tmp\v1-local\processes.json"
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

$unhealthy = $false
$degraded = $false
if (
  -not ($state.PSObject.Properties.Name -contains "lifecycle_status") -or
  [string]$state.lifecycle_status -ne "READY"
) {
  $lifecycleStatus = if ($state.PSObject.Properties.Name -contains "lifecycle_status") {
    [string]$state.lifecycle_status
  } else {
    "UNKNOWN"
  }
  Write-Output "managed lifecycle: $lifecycleStatus"
  $unhealthy = $true
}
foreach ($record in $state.processes) {
  $process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
  if (-not $process) {
    Write-Output "$($record.role): stopped"
    $unhealthy = $true
    continue
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = ([DateTime]$record.start_time_utc).ToUniversalTime()
  if ($actualStart.Ticks -ne $expectedStart.Ticks) {
    Write-Output "$($record.role): PID reused; not owned by this state"
    $unhealthy = $true
    continue
  }
  Write-Output "$($record.role): running (PID $($record.pid))"
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
