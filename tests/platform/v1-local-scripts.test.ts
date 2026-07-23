import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scripts = [
  "scripts/start-v1-local.ps1",
  "scripts/check-v1-local.ps1",
  "scripts/stop-v1-local.ps1",
];

describe("V1 local PowerShell operations", () => {
  it.each(scripts)("%s parses without PowerShell syntax errors", (script) => {
    const absolutePath = resolve(script).replaceAll("'", "''");
    const command = [
      "$tokens = $null",
      "$errors = $null",
      `[System.Management.Automation.Language.Parser]::ParseFile('${absolutePath}', [ref]$tokens, [ref]$errors) | Out-Null`,
      "if ($errors.Count -gt 0) {",
      "$errors | ForEach-Object { Write-Error $_.Message }",
      "exit 1",
      "}",
    ].join("; ");
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
  });

  it("records each partial ownership state atomically before advancing", () => {
    const start = readFileSync(resolve(scripts[0]), "utf8");

    expect(start).toContain('schema_version = "v1-local-processes.v4"');
    expect(start).toContain(
      "worker_ready_observed = [bool]$script:workerReadyObserved",
    );
    expect(start).toContain("function Test-WorkerReadyLog");
    expect(start).toContain("function Sync-WorkerReadyObservation");
    expect(start).toContain("$script:workerReadyObserved = $true");
    expect(start).toContain("processes = @($started)");
    expect(start).toContain('LifecycleStatus = "STARTING_WEB"');
    expect(start).toContain('-LifecycleStatus "STARTING_API"');
    expect(start).toContain('-LifecycleStatus "STARTING_WORKER"');
    expect(start.indexOf("$started.Add($record)")).toBeLessThan(
      start.indexOf("Write-ManagedState -LifecycleStatus $LifecycleStatus"),
    );
    expect(start).toContain('Write-ManagedState -LifecycleStatus "READY"');
    expect(start.indexOf("$script:workerReadyObserved = $true")).toBeLessThan(
      start.indexOf('Write-ManagedState -LifecycleStatus "READY"'),
    );
    expect(start).toContain('$stateTemporaryPath = "$statePath.tmp"');
    expect(start).toContain(
      "Set-Content -LiteralPath $stateTemporaryPath -Value $stateJson",
    );
    expect(start).toContain("[System.IO.File]::Replace");
    expect(start).toContain(
      "Move-Item -LiteralPath $stateTemporaryPath -Destination $statePath",
    );
    expect(start).toContain(
      "Remove-Item -LiteralPath $stateTemporaryPath -Force -ErrorAction SilentlyContinue",
    );
    expect(start).not.toMatch(
      /ConvertTo-Json[^\n]*\|\s*Set-Content\s+-LiteralPath\s+\$statePath/,
    );
  });

  it("uses the production Worker by default and isolates the test entrypoint gate", () => {
    const start = readFileSync(resolve(scripts[0]), "utf8");

    expect(start).toContain(
      '$productionWorkerEntrypoint = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "apps/worker/dist/worker.js"))',
    );
    expect(start).toContain(
      '[Environment]::GetEnvironmentVariable("V1_LOCAL_TEST_MODE", "Process") -eq "1"',
    );
    expect(start).toContain("V1_LOCAL_WORKER_ENTRYPOINT");
    expect(start).toContain("V1_LOCAL_TEST_ROLLBACK_TRIGGER_FILE");
    expect(start).toContain("must not be inside repo apps/**/dist");
    expect(start).toContain("must not reference an acceptance workspace");
    expect(start).toContain("worker_entrypoint = $workerEntrypoint");
    expect(start).not.toContain("WORKFLOW_BYOK_API_KEY");
    expect(start).not.toContain("MODEL_API_KEY");
  });

  it("starts Worker last and distinguishes pre-ready, pending and crashed rollback paths", () => {
    const start = readFileSync(resolve(scripts[0]), "utf8");
    const apiHealth = start.indexOf("Wait-ApiHealth -Record $apiRecord");
    const webStart = start.indexOf(
      "$webRecord = Start-V1OwnedProcess @webStartParameters",
    );
    const webHealth = start.indexOf("Wait-WebHealth -Record $webRecord");
    const workerStart = start.indexOf(
      '$workerRecord = Start-V1OwnedProcess -Role "worker"',
    );

    expect(apiHealth).toBeGreaterThanOrEqual(0);
    expect(webStart).toBeGreaterThan(apiHealth);
    expect(webHealth).toBeGreaterThan(webStart);
    expect(workerStart).toBeGreaterThan(webHealth);
    expect(start).toContain("if (-not $script:workerReadyObserved) {");
    expect(start).toContain("$readyInLog = Sync-WorkerReadyObservation");
    expect(start).toContain("Worker exited after valid ready evidence was emitted.");
    expect(start.indexOf("$readyInLog = Sync-WorkerReadyObservation")).toBeLessThan(
      start.indexOf("$workerAlive = Test-OwnedProcessRunning"),
    );
    expect(start).toContain(
      'Write-ManagedState -LifecycleStatus "START_FAILED_STOP_PENDING"',
    );
    expect(start).toContain(
      'Write-ManagedState -LifecycleStatus "CRASHED_WORKER_REVIEW_REQUIRED"',
    );
    expect(start.indexOf("Request-ManagedWorkerStop")).toBeLessThan(
      start.indexOf("Stop-OwnedApiAndWeb", start.indexOf("} catch {")),
    );
    expect(start).not.toMatch(
      /Get-Process\s+node|Stop-Process\s+-Name|taskkill|Stop-Process[^\n]+worker/,
    );
  });

  it("supports partial stop and restricts crashed-Worker acknowledgement", () => {
    const stop = readFileSync(resolve(scripts[2]), "utf8");

    expect(stop).toContain("[switch]$AcknowledgeCrashedWorker");
    expect(stop).toContain("if (-not $workerRecord) {");
    expect(stop).toContain("if (-not $workerReadyObserved) {");
    expect(stop).toContain("CRASHED_WORKER_REVIEW_REQUIRED");
    expect(stop).toContain("crashed-worker-state.json");
    expect(stop).toContain("no Job or database row will be changed");
    expect(stop).toContain("This was not a graceful Worker stop");
    expect(stop).toContain('Write-Output "$($role): already stopped"');
    expect(stop).not.toContain(
      "Refusing crashed-Worker cleanup because owned $role is no longer running.",
    );
    expect(stop).toContain("actualStart");
    expect(stop).toContain("PID $($Record.pid) was reused");
    expect(stop).not.toMatch(
      /Get-Process\s+node|Stop-Process\s+-Name|taskkill|Stop-Process[^\n]+worker/,
    );
  });

  it("reports lifecycle-specific non-ready status without calling it healthy", () => {
    const check = readFileSync(resolve(scripts[1]), "utf8");

    expect(check).toContain("V1 local status: starting");
    expect(check).toContain("V1 local status: unhealthy interrupted startup");
    expect(check).toContain("V1 local status: startup rollback pending");
    expect(check).toContain("V1 local status: crashed worker review required");
    expect(check).toContain("a RUNNING Job may be orphaned");
    expect(check.indexOf('if ($lifecycleStatus -ne "READY")')).toBeLessThan(
      check.indexOf("api health: ok"),
    );
  });

  it("keeps runtime data and logs on stop", () => {
    const combined = scripts
      .map((script) => readFileSync(resolve(script), "utf8"))
      .join("\n");
    expect(combined).not.toMatch(/Remove-Item[^\n]+(?:content|sqlite)/i);
    expect(combined).toContain(
      "Runtime database, content and per-run logs were preserved.",
    );
  });
});
