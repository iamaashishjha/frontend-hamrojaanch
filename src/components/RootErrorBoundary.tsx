import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors so the app never shows a blank white screen.
 * Shows a minimal fallback with refresh and backend check hints.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("RootErrorBoundary:", error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    const hasBackend = Boolean(apiBase?.trim());

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#1e293b",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", marginBottom: 8 }}>Something went wrong</h1>
        {this.state.error?.message && (
          <p style={{ marginBottom: 12, maxWidth: 480, textAlign: "center", fontSize: "0.875rem", color: "#b91c1c" }}>
            {this.state.error.message}
          </p>
        )}
        <p style={{ marginBottom: 16, maxWidth: 400, textAlign: "center" }}>
          The app couldn’t load properly. This often happens when the backend isn’t running or the API URL is wrong.
        </p>
        {!hasBackend && (
          <p style={{ marginBottom: 16, fontSize: "0.875rem", color: "#64748b" }}>
            Set <code style={{ background: "#e2e8f0", padding: "2px 6px" }}>VITE_API_BASE_URL=http://localhost:4000/api</code> in{" "}
            <code style={{ background: "#e2e8f0", padding: "2px 6px" }}>frontend/.env</code> and restart the dev server.
          </p>
        )}
        <p style={{ marginBottom: 16, fontSize: "0.875rem", color: "#64748b" }}>
          Make sure the backend is running on port 4000 (e.g. <code style={{ background: "#e2e8f0", padding: "2px 6px" }}>npx tsx watch src/index.ts</code> in the backend folder).
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 20px",
            fontSize: "1rem",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Refresh page
        </button>
      </div>
    );
  }
}
