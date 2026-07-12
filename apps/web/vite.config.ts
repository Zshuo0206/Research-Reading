import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { isWebHostAllowed } from "./host-policy.js";

const host = process.env.WEB_HOST ?? "127.0.0.1";
const containerMode = process.env.CONTAINER_MODE === "1";
if (!isWebHostAllowed(host, containerMode)) {
  throw new Error(
    "WEB_HOST must be 127.0.0.1 unless CONTAINER_MODE=1 explicitly allows 0.0.0.0 inside a container",
  );
}

export default defineConfig({
  plugins: [react()],
  preview: {
    host,
    port: Number(process.env.WEB_PORT ?? 4173),
    strictPort: true,
  },
});
