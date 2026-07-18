[CmdletBinding()]
param()

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

foreach ($record in @($state.processes | Sort-Object -Property role -Descending)) {
  $process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
  if (-not $process) {
    Write-Output "$($record.role): already stopped"
    continue
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = ([DateTime]$record.start_time_utc).ToUniversalTime()
  if ($actualStart.Ticks -ne $expectedStart.Ticks) {
    Write-Warning "$($record.role): PID $($record.pid) was reused; leaving it untouched."
    continue
  }
  Stop-Process -Id ([int]$record.pid)
  try {
    [void]$process.WaitForExit(5000)
  } catch {
    Write-Warning "$($record.role): stop was requested but exit could not be confirmed."
  }
  Write-Output "$($record.role): stop requested"
}

Remove-Item -LiteralPath $statePath -Force
Write-Output "V1 local process state removed. Runtime database and content were preserved."
