import { API_BASE, get, post, upload } from "@/lib/apiClient";

export interface FileVaultAsset {
  id: string;
  kind: string;
  storageKey: string;
  sha256?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
  status: "pending_scan" | "safe" | "quarantined";
  createdAt: string;
  updatedAt: string;
}

export async function listFileVaultAssets(params?: {
  kind?: string;
  status?: string;
  q?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: FileVaultAsset[]; total: number }> {
  return get<{ items: FileVaultAsset[]; total: number }>("/files", {
    kind: params?.kind,
    status: params?.status,
    q: params?.q,
    fromDate: params?.fromDate,
    toDate: params?.toDate,
    page: params?.page ?? 1,
    pageSize: params?.pageSize ?? 50,
  });
}

export async function updateFileVaultAssetStatus(
  id: string,
  status: "safe" | "quarantined",
): Promise<FileVaultAsset> {
  const result = await post<{ asset: FileVaultAsset }>(`/files/${id}/complete`, { status });
  return result.asset;
}

export async function getFileVaultAssetUrl(id: string): Promise<string> {
  const result = await get<{ url: string }>(`/files/${id}/url`);
  return result.url;
}

export async function uploadFileToVault(params: {
  file: File;
  kind: string;
  prefix?: string;
}): Promise<{ asset: FileVaultAsset; url: string }> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("kind", params.kind);
  if (params.prefix) formData.append("prefix", params.prefix);
  return upload<{ asset: FileVaultAsset; url: string }>("/files/upload", formData);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeVaultPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Stored as plain file id.
  if (UUID_RE.test(trimmed)) {
    return `/api/files/${trimmed}/download`;
  }

  // Legacy path variants that missed `/api`.
  if (trimmed.startsWith("/files/")) {
    return `/api${trimmed}`;
  }
  if (trimmed.startsWith("files/")) {
    return `/api/${trimmed}`;
  }
  if (trimmed.startsWith("api/")) {
    return `/${trimmed}`;
  }

  // Some older values may point to metadata endpoint `/url`.
  const directUrlMatch = trimmed.match(/^\/api\/files\/([^/]+)\/url$/i);
  if (directUrlMatch?.[1]) {
    return `/api/files/${directUrlMatch[1]}/download`;
  }

  return trimmed;
}

function normalizeAbsoluteVaultUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const metadataMatch = parsed.pathname.match(/^\/api\/files\/([^/]+)\/url$/i);
    if (metadataMatch?.[1]) {
      parsed.pathname = `/api/files/${metadataMatch[1]}/download`;
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function resolveApiAssetUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return normalizeAbsoluteVaultUrl(url);

  const normalized = normalizeVaultPath(url);
  if (!normalized.startsWith("/")) return normalized;
  if (!API_BASE) return normalized;
  try {
    return new URL(normalized, API_BASE).toString();
  } catch {
    return `${API_BASE}${normalized}`;
  }
}
