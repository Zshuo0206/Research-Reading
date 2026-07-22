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

  it("records ownership and stops only a matching PID plus start time", () => {
    const start = readFileSync(resolve(scripts[0]), "utf8");
    const stop = readFileSync(resolve(scripts[2]), "utf8");

    expect(start).toContain("start_time_utc");
    expect(start).toContain("worker_stop_file");
    expect(start).toContain("worker_platform_shell_ready");
    expect(start).toContain("GetActiveTcpListeners");
    expect(start).toContain('WindowStyle = "Hidden"');
    expect(start).toContain("processes.json");
    expect(start).toContain("lifecycle_status = $LifecycleStatus");
    expect(start).toContain('Write-ManagedState -LifecycleStatus "STARTING"');
    expect(start).toContain('Write-ManagedState -LifecycleStatus "READY"');
    expect(start).toContain(
      'Write-ManagedState -LifecycleStatus "START_FAILED_STOP_PENDING"',
    );
    expect(start).not.toContain("[int]$ApiPort");
    expect(start).not.toContain("[int]$WebPort");
    expect(stop).toContain("actualStart");
    expect(stop).toContain("PID $($Record.pid) was reused");
    expect(stop).toContain("CONTROL_FILE");
    expect(stop.indexOf('foreach ($role in @("api", "web"))')).toBeGreaterThan(
      stop.indexOf("Test-ControlFileStoppedEvent"),
    );
    expect(stop).not.toMatch(
      /Get-Process\s+node|Stop-Process\s+-Name|taskkill|Stop-Process[^\n]+worker/,
    );
    expect(start).not.toMatch(
      /Get-Process\s+node|Stop-Process\s+-Name|taskkill|Stop-Process[^\n]+worker/,
    );
  });

  it("starts the Worker only after API and Web health checks complete", () => {
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
    expect(start.indexOf("Request-ManagedWorkerStop")).toBeLessThan(
      start.indexOf("Stop-OwnedApiAndWeb", start.indexOf("} catch {")),
    );
  });

  it("keeps secrets out of script output and preserves runtime data on stop", () => {
    const combined = scripts
      .map((script) => readFileSync(resolve(script), "utf8"))
      .join("\n");
    expect(combined).not.toContain("WORKFLOW_BYOK_API_KEY");
    expect(combined).not.toContain("MODEL_API_KEY");
    expect(combined).not.toMatch(/Remove-Item[^\n]+(?:content|sqlite)/i);
    expect(combined).toContain(
      "Runtime database, content and per-run logs were preserved.",
    );
  });
});
