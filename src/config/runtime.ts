const DEFAULT_SIGNALING_WS_URL = "ws://localhost:3001/ws";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return "";
}

const apiBaseUrl = trimTrailingSlash(asString(import.meta.env.VITE_API_BASE_URL));
const servingUrl = trimTrailingSlash(asString(import.meta.env.VITE_SERVING_URL));
const signalingWsUrl = firstNonEmpty(
  import.meta.env.VITE_SIGNALING_WS_URL,
  import.meta.env.VITE_SIGNALING_URL,
  DEFAULT_SIGNALING_WS_URL,
);
const signalingHttpUrl = trimTrailingSlash(
  firstNonEmpty(
    import.meta.env.VITE_SIGNALING_HTTP_URL,
    signalingWsUrl.replace(/^ws/i, "http").replace(/\/ws$/, ""),
  ),
);

export const runtimeConfig = Object.freeze({
  apiBaseUrl,
  servingUrl,
  signalingWsUrl,
  signalingHttpUrl,
});

export type RuntimeConfig = typeof runtimeConfig;
