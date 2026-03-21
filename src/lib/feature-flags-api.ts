import { get, patch } from "@/lib/apiClient";

export interface FeatureFlagItem {
  key: string;
  value: string;
}

export interface FeatureFlagsResponse {
  tenantId: string;
  flags: FeatureFlagItem[];
}

export async function getFeatureFlags(tenantId: string = "default"): Promise<FeatureFlagsResponse> {
  return get<FeatureFlagsResponse>(`/admin/feature-flags?tenantId=${encodeURIComponent(tenantId)}`);
}

export async function setFeatureFlag(
  tenantId: string,
  key: string,
  value: string
): Promise<{ flag: FeatureFlagItem }> {
  return patch<{ flag: FeatureFlagItem }>("/admin/feature-flags", { tenantId, key, value });
}
