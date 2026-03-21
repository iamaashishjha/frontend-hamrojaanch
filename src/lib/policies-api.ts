/**
 * P2: Policy engine API — list, create, update policies (global → category → exam).
 */
import { get, post, patch } from "@/lib/apiClient";

export interface Policy {
  id: string;
  tenantId: string;
  scope: "global" | "category" | "exam";
  scopeId: string | null;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export async function listPolicies(filters?: { scope?: string; scopeId?: string }): Promise<Policy[]> {
  const params: Record<string, string> = {};
  if (filters?.scope) params.scope = filters.scope;
  if (filters?.scopeId) params.scopeId = filters.scopeId;
  const { items } = await get<{ items: Policy[] }>("/admin/policies", params as any);
  return items;
}

export async function createPolicy(data: {
  scope: "global" | "category" | "exam";
  scopeId?: string;
  key: string;
  value?: string;
}): Promise<Policy> {
  const { policy } = await post<{ policy: Policy }>("/admin/policies", {
    scope: data.scope,
    scopeId: data.scopeId,
    key: data.key,
    value: data.value ?? "",
  });
  return policy;
}

export async function updatePolicy(id: string, data: { key?: string; value?: string }): Promise<Policy> {
  const { policy } = await patch<{ policy: Policy }>(`/admin/policies/${id}`, data);
  return policy;
}
