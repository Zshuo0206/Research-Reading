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

$healthy = $true
foreach ($record in $state.processes) {
  $process = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
  if (-not $process) {
    Write-Output "$($record.role): stopped"
    $healthy = $false
    continue
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = ([DateTime]$record.start_time_utc).ToUniversalTime()
  if ($actualStart.Ticks -ne $expectedStart.Ticks) {
    Write-Output "$($record.role): PID reused; not owned by this state"
    $healthy = $false
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
  $healthy = $false
}
try {
  $web = Invoke-WebRequest -Uri ([string]$state.web_url) -UseBasicParsing -TimeoutSec 3
  if ($web.StatusCode -ne 200) { throw "unexpected web status" }
  Write-Output "web health: ok"
} catch {
  Write-Output "web health: failed"
  $healthy = $false
}

if (-not $healthy) { exit 1 }
