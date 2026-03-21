import { get, post } from "@/lib/apiClient";

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

