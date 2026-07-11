import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const children = [];
const start = (command, args, env, options = {}) => {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: "ignore",
    windowsHide: true,
    ...options,
  });
  children.push(child);
  return child;
};
const waitFor = async (url) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`platform smoke endpoint did not start: ${url}`);
};
try {
  start(process.execPath, ["apps/api/dist/server.js"], {
    API_HOST: "127.0.0.1",
    API_PORT: "4311",
  });
  const health = await waitFor("http://127.0.0.1:4311/health");
  const healthBody = await health.json();
  if (healthBody.status !== "ok" || healthBody.wave !== 1)
    throw new Error(`unexpected health body: ${JSON.stringify(healthBody)}`);
  const worker = start(
    process.execPath,
    ["apps/worker/dist/worker.js", "--smoke"],
    { WORKER_SMOKE: "1" },
  );
  const workerExit = await new Promise((resolve) =>
    worker.once("exit", resolve),
  );
  if (workerExit !== 0)
    throw new Error(`worker smoke exited with ${workerExit}`);
  start(
    process.execPath,
    [
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
    ],
    { WEB_PORT: "4173" },
    { cwd: path.join(root, "apps", "web") },
  );
  const web = await waitFor("http://127.0.0.1:4173");
  const html = await web.text();
  if (!html.includes("Research Reading"))
    throw new Error("web shell did not return expected page");
  console.log(
    "[smoke] loopback API health, Worker smoke and Web shell verified",
  );
} finally {
  for (const child of children) child.kill("SIGTERM");
}
