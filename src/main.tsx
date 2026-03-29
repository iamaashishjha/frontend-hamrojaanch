import { createRoot } from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No #root element");

function createText(tag: keyof HTMLElementTagNameMap, text: string, style?: Partial<CSSStyleDeclaration>) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (style) Object.assign(el.style, style);
  return el;
}

function renderFallback(message: string, detail?: string, err?: unknown) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "system-ui,sans-serif",
    background: "#f8fafc",
    color: "#1e293b",
  } satisfies Partial<CSSStyleDeclaration>);

  container.appendChild(createText("h1", message, { fontSize: "1.25rem", marginBottom: "8px" }));

  const errText = err instanceof Error ? err.message : err != null ? String(err) : "";
  if (errText) {
    container.appendChild(
      createText("p", errText, {
        marginBottom: "12px",
        maxWidth: "560px",
        textAlign: "center",
        color: "#b91c1c",
        fontSize: "0.875rem",
        wordBreak: "break-word",
      }),
    );
  }

  if (detail) {
    container.appendChild(
      createText("p", detail, {
        marginBottom: "16px",
        maxWidth: "400px",
        textAlign: "center",
        color: "#64748b",
      }),
    );
  }

  const refreshLink = document.createElement("a");
  refreshLink.href = "/";
  refreshLink.textContent = "Refresh";
  Object.assign(refreshLink.style, {
    padding: "10px 20px",
    fontSize: "1rem",
    background: "#2563eb",
    color: "white",
    borderRadius: "8px",
    textDecoration: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  container.appendChild(refreshLink);

  rootEl.replaceChildren(container);
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
