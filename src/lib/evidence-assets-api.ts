/**
 * Admin evidence assets API — list assets, signed URL, chain-of-custody export.
 */
import { get } from "@/lib/apiClient";

export interface ExportManifestItem {
  assetId: string;
  type: string;
  storageKeyHint: string;
  sha256: string | null;
  sizeBytes: number | null;
  createdAt: string;
  legalHold: boolean;
}

export interface ExportManifest {
  version: number;
  kind: string;
  attemptId: string;
  examId: string;
  candidateEmail: string;
  exportedAt: string;
  itemCount: number;
  items: ExportManifestItem[];
  manifestHash: string;
}

/** GET /admin/evidence-assets/export-manifest?attemptId= — chain-of-custody hash manifest */
export async function getExportManifest(attemptId: string): Promise<ExportManifest> {
  const data = await get<ExportManifest>(
    "/admin/evidence-assets/export-manifest",
    { attemptId }
  );
  return data;
}
