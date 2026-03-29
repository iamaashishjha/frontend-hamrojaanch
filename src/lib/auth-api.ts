/**
 * Auth API — real backend calls for login, register, profile.
 */

import { runtimeConfig } from "@/config/runtime";
import {
  clearAuthStorage,
  readToken,
  readUser,
  writeAuth,
  writeLegacyRoleHints,
  writeUser,
} from "@/lib/auth-storage";

const API_BASE_URL = runtimeConfig.apiBaseUrl;

export const TOKEN_KEY = "hj_token";
export const USER_KEY = "hj_user";

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

export function getToken(): string | null {
  return readToken();
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

export function getStoredUser(): AuthUser | null {
  return readUser<AuthUser>();
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return Date.now() < payload.exp * 1000;
}

export function hasRole(...roles: string[]): boolean {
  const token = getToken();
  const tokenRole = token ? decodeTokenPayload(token)?.role : undefined;
  const role = tokenRole ?? getStoredUser()?.role;
  if (!role) return false;
  return roles.some((r) => r.toLowerCase() === String(role).toLowerCase());
}

function persistAuth(data: AuthResponse): void {
  writeAuth(data.token, data.user as Record<string, unknown>);
  writeLegacyRoleHints(data.user.role);
}

export function clearAuth(): void {
  clearAuthStorage();
}

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

export async function getMe(): Promise<AuthUser> {
  const { user } = await authFetch<{ user: AuthUser }>("/auth/me");
  writeUser(user as Record<string, unknown>);
  return user;
}

export interface UpdateMePayload {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  const { user } = await authFetch<{ user: AuthUser }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  writeUser(user as Record<string, unknown>);
  return user;
}

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
