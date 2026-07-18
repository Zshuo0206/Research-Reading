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
    expect(start).toContain('WindowStyle = "Hidden"');
    expect(start).toContain("processes.json");
    expect(stop).toContain("actualStart");
    expect(stop).toContain("PID $($record.pid) was reused");
    expect(stop).not.toMatch(
      /Get-Process\s+node|Stop-Process\s+-Name|taskkill/,
    );
  });

  it("keeps secrets out of script output and preserves runtime data on stop", () => {
    const combined = scripts
      .map((script) => readFileSync(resolve(script), "utf8"))
      .join("\n");
    expect(combined).not.toContain("WORKFLOW_BYOK_API_KEY");
    expect(combined).not.toContain("MODEL_API_KEY");
    expect(combined).not.toMatch(/Remove-Item[^\n]+(?:content|sqlite)/i);
    expect(combined).toContain("Runtime database and content were preserved.");
  });
});
