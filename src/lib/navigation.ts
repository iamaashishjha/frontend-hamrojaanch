export function resolveSafeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  const normalized = next.trim();
  if (!normalized) return fallback;

  if (normalized.includes("\n") || normalized.includes("\r")) return fallback;
  if (normalized.startsWith("//")) return fallback;
  if (normalized.includes("://")) return fallback;
  if (!normalized.startsWith("/")) return fallback;

  return normalized;
}
