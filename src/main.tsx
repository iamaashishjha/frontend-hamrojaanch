import { createRoot } from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element");

function renderFallback(message: string, detail?: string, err?: unknown) {
  const errText = err instanceof Error ? err.message : err != null ? String(err) : "";
  const extra = errText ? `<p style="margin-bottom:12px;max-width:560px;text-align:center;color:#b91c1c;font-size:0.875rem;word-break:break-word;">${errText.replace(/</g, "&lt;")}</p>` : "";
  rootEl.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b;"><h1 style="font-size:1.25rem;margin-bottom:8px;">${message}</h1>${extra}${detail ? `<p style="margin-bottom:16px;max-width:400px;text-align:center;color:#64748b;">${detail}</p>` : ""}<a href="/" style="padding:10px 20px;font-size:1rem;background:#2563eb;color:white;border-radius:8px;text-decoration:none;">Refresh</a></div>`;
}

(async function init() {
  try {
    const [{ default: App }, { RootErrorBoundary }] = await Promise.all([
      import("./App.tsx"),
      import("./components/RootErrorBoundary"),
    ]);
    createRoot(rootEl).render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    );
  } catch (err) {
    console.error("App failed to load:", err);
    renderFallback(
      "Failed to load app",
      "Ensure the dev server is running (npm run dev) and the backend on port 4000. Set VITE_API_BASE_URL in frontend/.env if needed.",
      err
    );
  }
})();
