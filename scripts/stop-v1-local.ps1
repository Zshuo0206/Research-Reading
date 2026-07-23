[CmdletBinding()]
param(
  [ValidateRange(1, 300)]
  [int]$WorkerTimeoutSeconds = 45,
  [switch]$AcknowledgeCrashedWorker
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$statePath = Join-Path $repoRoot "tmp\v1-local\processes.json"
$stateTemporaryPath = "$statePath.tmp"
if (-not (Test-Path -LiteralPath $statePath)) {
  Write-Output "No V1 local processes are recorded."
  exit 0
}
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ([System.IO.Path]::GetFullPath([string]$state.repo_root) -ne $repoRoot) {
  throw "Refusing to stop processes: state belongs to a different repository."
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

function Test-ControlFileStoppedEvent {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  foreach ($line in @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue)) {
    try {
      $event = $line | ConvertFrom-Json -ErrorAction Stop
      if (
        [string]$event.event -eq "worker_platform_shell_stopped" -and
        [string]$event.signal -eq "CONTROL_FILE"
      ) { return $true }
    } catch {}
  }
  return $false
}

function Write-StateLifecycle {
  param(
    [ValidateSet("START_FAILED_STOP_PENDING", "CRASHED_WORKER_REVIEW_REQUIRED")]
    [string]$LifecycleStatus
  )
  $state.lifecycle_status = $LifecycleStatus
  $stateJson = $state | ConvertTo-Json -Depth 6
  try {
    Set-Content -LiteralPath $stateTemporaryPath -Value $stateJson -Encoding utf8
    [System.IO.File]::Replace($stateTemporaryPath, $statePath, $null)
  } finally {
    Remove-Item -LiteralPath $stateTemporaryPath -Force -ErrorAction SilentlyContinue
  }
}

function Get-RoleRecord {
  param([string]$Role)
  return @($state.processes | Where-Object { $_.role -eq $Role })[0]
}

function Stop-OwnedApiAndWeb {
  foreach ($role in @("api", "web")) {
    $record = Get-RoleRecord -Role $role
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

function Remove-ActiveState {
  param([string]$WorkerStopFile)
  Remove-Item -LiteralPath $WorkerStopFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stateTemporaryPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $statePath -Force
}

$workerStopFile = [System.IO.Path]::GetFullPath([string]$state.worker_stop_file)
$runDirectory = [System.IO.Path]::GetFullPath([string]$state.run_directory)
if (-not $workerStopFile.StartsWith($runDirectory + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Worker stop control file is outside this run directory."
}
if (-not (Test-Path -LiteralPath $runDirectory)) {
  throw "Managed run directory is missing."
}
$workerRecord = Get-RoleRecord -Role "worker"
$workerReadyObserved = (
  $state.PSObject.Properties.Name -contains "worker_ready_observed" -and
  $state.worker_ready_observed -eq $true
)
$workerLog = [string]$state.logs.worker_stdout
$hasControlStopped = Test-ControlFileStoppedEvent -Path $workerLog
$lifecycle = [string]$state.lifecycle_status

if ($AcknowledgeCrashedWorker) {
  if ($lifecycle -ne "CRASHED_WORKER_REVIEW_REQUIRED") {
    throw "-AcknowledgeCrashedWorker is valid only for CRASHED_WORKER_REVIEW_REQUIRED state."
  }
  if (-not $workerRecord) { throw "Crashed-Worker state has no Worker record." }
  if (Get-OwnedProcess -Record $workerRecord) {
    throw "Refusing crashed-Worker cleanup because the Worker PID is still alive."
  }
  if (-not $workerReadyObserved) {
    throw "Refusing crashed-Worker cleanup because valid Worker ready evidence was not recorded."
  }
  if ($hasControlStopped) {
    throw "Refusing crashed-Worker acknowledgement because CONTROL_FILE stopped evidence exists; use normal stop."
  }
  foreach ($role in @("api", "web")) {
    $record = Get-RoleRecord -Role $role
    if (-not $record) { throw "Crashed-Worker state has no $role ownership record." }
    [void](Get-OwnedProcess -Record $record)
  }
  Write-Warning "Acknowledging a ready Worker crash without CONTROL_FILE stopped evidence. A RUNNING Job may be orphaned; no Job or database row will be changed."
  $archivePath = Join-Path $runDirectory "crashed-worker-state.json"
  Copy-Item -LiteralPath $statePath -Destination $archivePath -Force
  Stop-OwnedApiAndWeb
  Remove-ActiveState -WorkerStopFile $workerStopFile
  Write-Output "Crashed Worker state archived: $archivePath"
  Write-Output "V1 local process state removed after explicit crashed-Worker acknowledgement. This was not a graceful Worker stop; runtime database, content and per-run logs were preserved."
  exit 0
}

if ($lifecycle -eq "CRASHED_WORKER_REVIEW_REQUIRED") {
  Write-Warning "Worker was ready but has no CONTROL_FILE stopped evidence. A RUNNING Job may be orphaned."
  Write-Error "Crashed Worker review is required. State, API, Web, database, content and logs were preserved. Re-run with -AcknowledgeCrashedWorker only after reviewing the orphan risk."
  exit 1
}

if (-not $workerRecord) {
  Stop-OwnedApiAndWeb
  Remove-ActiveState -WorkerStopFile $workerStopFile
  Write-Output "V1 partial local process state removed. Runtime database, content and per-run logs were preserved."
  exit 0
}

$workerProcess = Get-OwnedProcess -Record $workerRecord
if ($workerProcess) {
  New-Item -ItemType File -Path $workerStopFile -Force | Out-Null
  Write-Output "worker: control-file stop requested"
  $deadline = [DateTime]::UtcNow.AddSeconds($WorkerTimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Get-Process -Id ([int]$workerRecord.pid) -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 250
  }
  if (Get-Process -Id ([int]$workerRecord.pid) -ErrorAction SilentlyContinue) {
    Write-StateLifecycle -LifecycleStatus "START_FAILED_STOP_PENDING"
    Write-Error "Worker did not exit within $WorkerTimeoutSeconds seconds and may still be completing the current Job. API and Web were left running; state was preserved. Re-run stop later."
    exit 1
  }
}

if (-not $workerReadyObserved) {
  Write-Output "worker: pre-ready process stopped; CONTROL_FILE evidence was not required"
  Stop-OwnedApiAndWeb
  Remove-ActiveState -WorkerStopFile $workerStopFile
  Write-Output "V1 local process state removed. Runtime database, content and per-run logs were preserved."
  exit 0
}

$workerLogDeadline = [DateTime]::UtcNow.AddSeconds(5)
while (
  [DateTime]::UtcNow -lt $workerLogDeadline -and
  -not (Test-ControlFileStoppedEvent -Path $workerLog)
) {
  Start-Sleep -Milliseconds 100
}
if (-not (Test-ControlFileStoppedEvent -Path $workerLog)) {
  Write-StateLifecycle -LifecycleStatus "CRASHED_WORKER_REVIEW_REQUIRED"
  Write-Warning "Worker was ready but exited without CONTROL_FILE stopped evidence. A RUNNING Job may be orphaned."
  Write-Error "API and Web were left running; state, database, content and logs were preserved for crashed-Worker review."
  exit 1
}
Write-Output "worker: stopped gracefully after the current Job"
Stop-OwnedApiAndWeb
Remove-ActiveState -WorkerStopFile $workerStopFile
Write-Output "V1 local process state removed. Runtime database, content and per-run logs were preserved."
