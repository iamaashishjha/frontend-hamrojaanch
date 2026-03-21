/**
 * Auth API — real backend calls for login, register, profile.
 *
 * WHY: Previously the frontend used localStorage flags ("hj_admin"="true")
 *      with zero validation. Now we call the real backend, store a JWT,
 *      and verify it on protected routes.
 */

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/$/, "") : "";

// ── localStorage keys ──
export const TOKEN_KEY = "hj_token";
export const USER_KEY = "hj_user";

// ── Types ──
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
}

// ── Helpers ──

/** Get stored JWT token */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function decodeTokenPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const data = JSON.parse(atob(padded));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** Get stored user object */
export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Check if user is authenticated (has a token) */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return Date.now() < payload.exp * 1000;
}

/** Check if authenticated user has one of the given roles */
export function hasRole(...roles: string[]): boolean {
  const token = getToken();
  const tokenRole = token ? decodeTokenPayload(token)?.role : undefined;
  const role = tokenRole ?? getStoredUser()?.role;
  if (!role) return false;
  return roles.some((r) => r.toLowerCase() === String(role).toLowerCase());
}

/** Store auth data in localStorage after successful login/register */
function persistAuth(data: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  // WHY: Keep legacy keys for backward compatibility with components
  // that still read these (gradual migration)
  if (["admin", "teacher", "proctor"].includes(data.user.role)) {
    localStorage.setItem("hj_admin", "true");
    const roleName =
      data.user.role === "admin"
        ? "Admin"
        : data.user.role === "teacher"
        ? "Teacher"
        : "Organization";
    localStorage.setItem("hj_admin_role", roleName);
  }
  if (data.user.role === "student") {
    localStorage.setItem("hj_registered", "true");
  }
}

/** Clear all auth data on logout */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("hj_admin");
  localStorage.removeItem("hj_admin_role");
  localStorage.removeItem("hj_registered");
}

// ── API calls ──

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "Failed to fetch") return true;
  if (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message)) return true;
  return false;
}

function backendUnreachableMessage(): string {
  return (
    "Cannot reach the backend. Make sure it's running on http://localhost:4000 — run .\\run.bat or in the backend folder run: npx tsx watch src/index.ts"
  );
}

async function authFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (err) {
    if (isNetworkError(err)) throw new Error(backendUnreachableMessage());
    throw err;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (body as { error?: string }).error ||
      (body as { message?: string }).message ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

/**
 * Login with email + password.
 * Stores JWT + user in localStorage on success.
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      "Backend not configured. Set VITE_API_BASE_URL in frontend/.env"
    );
  }
  const data = await authFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  persistAuth(data);
  return data;
}

/**
 * Register a new account.
 * Stores JWT + user in localStorage on success.
 */
export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      "Backend not configured. Set VITE_API_BASE_URL in frontend/.env"
    );
  }
  const data = await authFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  persistAuth(data);
  return data;
}

/**
 * Get current user profile from backend (validates token).
 */
export async function getMe(): Promise<AuthUser> {
  const { user } = await authFetch<{ user: AuthUser }>("/auth/me");
  // Update stored user with fresh data
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export interface UpdateMePayload {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

/**
 * Update current user profile (basic fields only).
 */
export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  const { user } = await authFetch<{ user: AuthUser }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/**
 * Logout — clear tokens and optionally redirect.
 */
export function logout(redirectTo?: string): void {
  if (API_BASE_URL) {
    void fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  }
  clearAuth();
  if (redirectTo && typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}
