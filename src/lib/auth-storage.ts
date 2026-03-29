export const AUTH_STORAGE_KEYS = Object.freeze({
  token: "hj_token",
  user: "hj_user",
  legacyAdmin: "hj_admin",
  legacyAdminRole: "hj_admin_role",
  legacyRegistered: "hj_registered",
});

type StoredUserLike = Record<string, unknown>;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readToken(): string | null {
  if (!hasStorage()) return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEYS.token);
}

export function readUser<T extends StoredUserLike>(): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeAuth(token: string, user: StoredUserLike): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(AUTH_STORAGE_KEYS.token, token);
  window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
}

export function writeUser(user: StoredUserLike): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
}

export function writeLegacyRoleHints(role: string): void {
  if (!hasStorage()) return;
  const normalized = role.toLowerCase();

  if (["admin", "teacher", "proctor"].includes(normalized)) {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.legacyAdmin, "true");
    const roleName =
      normalized === "admin"
        ? "Admin"
        : normalized === "teacher"
          ? "Teacher"
          : "Proctor";
    window.localStorage.setItem(AUTH_STORAGE_KEYS.legacyAdminRole, roleName);
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.legacyAdmin);
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.legacyAdminRole);
  }

  if (normalized === "student") {
    window.localStorage.setItem(AUTH_STORAGE_KEYS.legacyRegistered, "true");
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEYS.legacyRegistered);
  }
}

export function clearAuthStorage(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.token);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.user);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.legacyAdmin);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.legacyAdminRole);
  window.localStorage.removeItem(AUTH_STORAGE_KEYS.legacyRegistered);
}
