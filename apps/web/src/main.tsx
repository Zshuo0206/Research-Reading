import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function PlatformShell() {
  return (
    <main>
      <h1>Research Reading</h1>
      <p>Wave 1 platform shell</p>
      <p data-testid="platform-status">
        Business workflows are not enabled in this shell.
      </p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Web shell root element is missing");

createRoot(root).render(
  <StrictMode>
    <PlatformShell />
  </StrictMode>,
);
