/**
 * Shared API client for all frontend modules.
 *
 * WHY: Every mock API file was using in-memory arrays or localStorage.
 *      This client provides authenticated HTTP helpers (GET/POST/PUT/PATCH/DELETE)
 *      that hit the real backend. All module APIs import from here.
 */

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : "";

function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("hj_token") : null;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/** Parse the JSON error body returned by the backend and throw a descriptive Error. */
async function handleError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    const err = body.error ?? body;
    if (typeof err === "string") message = err;
    else if (err && typeof err.message === "string") message = err.message;
    else if (body.message && typeof body.message === "string") message = body.message;
  } catch {
    // body wasn't JSON — use default message
  }
  throw new Error(message);
}

/** Generic fetch wrapper. Returns parsed JSON on success, throws on failure. */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | undefined | null>
): Promise<T> {
  // Build query string from params (skip undefined/null)
  let url = `${API_BASE}${path}`;
  if (queryParams) {
    const qs = Object.entries(queryParams)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const options: RequestInit = {
    method,
    headers: buildHeaders(),
    credentials: "include",
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) return handleError(res);

  // Some DELETE endpoints return 204 No Content
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}

// ── Public helpers ──

export function get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  return request<T>("GET", path, undefined, params);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function del<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

/**
 * Upload a file via multipart/form-data (for asset uploads).
 * Does NOT set Content-Type header — browser sets it with boundary.
 */
export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });
  if (!res.ok) return handleError(res);
  return res.json() as Promise<T>;
}
