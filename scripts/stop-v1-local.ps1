[CmdletBinding()]
param(
  [ValidateRange(1, 300)]
  [int]$WorkerTimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$statePath = Join-Path $repoRoot "tmp\v1-local\processes.json"
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

$workerRecord = @($state.processes | Where-Object { $_.role -eq "worker" })[0]
if (-not $workerRecord) { throw "Managed state has no Worker record." }
$workerProcess = Get-OwnedProcess -Record $workerRecord
$workerStopFile = [System.IO.Path]::GetFullPath([string]$state.worker_stop_file)
$runDirectory = [System.IO.Path]::GetFullPath([string]$state.run_directory)
if (-not $workerStopFile.StartsWith($runDirectory + [System.IO.Path]::DirectorySeparatorChar)) {
  throw "Worker stop control file is outside this run directory."
}
if (-not (Test-Path -LiteralPath $runDirectory)) {
  throw "Managed run directory is missing."
}
New-Item -ItemType File -Path $workerStopFile -Force | Out-Null
Write-Output "worker: control-file stop requested"

if ($workerProcess) {
  $deadline = [DateTime]::UtcNow.AddSeconds($WorkerTimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Get-Process -Id ([int]$workerRecord.pid) -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 250
  }
  if (Get-Process -Id ([int]$workerRecord.pid) -ErrorAction SilentlyContinue) {
    Write-Error "Worker did not exit within $WorkerTimeoutSeconds seconds and may still be completing the current Job. API and Web were left running; state was preserved. Re-run stop later."
    exit 1
  }
}

$workerLogDeadline = [DateTime]::UtcNow.AddSeconds(5)
while (
  [DateTime]::UtcNow -lt $workerLogDeadline -and
  -not (Test-ControlFileStoppedEvent -Path ([string]$state.logs.worker_stdout))
) {
  Start-Sleep -Milliseconds 100
}
if (-not (Test-ControlFileStoppedEvent -Path ([string]$state.logs.worker_stdout))) {
  Write-Error "Worker exited without the expected CONTROL_FILE stopped event. API and Web were left running; state was preserved."
  exit 1
}
Write-Output "worker: stopped gracefully after the current Job"

foreach ($role in @("api", "web")) {
  $record = @($state.processes | Where-Object { $_.role -eq $role })[0]
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

Remove-Item -LiteralPath $workerStopFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $statePath -Force
Write-Output "V1 local process state removed. Runtime database, content and per-run logs were preserved."
