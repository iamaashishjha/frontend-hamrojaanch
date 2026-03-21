/**
 * P2: Tenant and Institution admin API (list, create, update).
 */
import { get, post, patch } from "@/lib/apiClient";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listTenants(): Promise<Tenant[]> {
  const { items } = await get<{ items: Tenant[] }>("/admin/tenants", { page: 1, pageSize: 200 });
  return items;
}

export async function createTenant(data: { name: string; slug: string; isActive?: boolean }): Promise<Tenant> {
  const { tenant } = await post<{ tenant: Tenant }>("/admin/tenants", {
    name: data.name,
    slug: data.slug,
    isActive: data.isActive ?? true,
  });
  return tenant;
}

export async function listInstitutions(tenantId?: string): Promise<Institution[]> {
  const { items } = await get<{ items: Institution[] }>("/admin/institutions", {
    ...(tenantId ? { tenantId } : {}),
    page: 1,
    pageSize: 200,
  });
  return items;
}

export async function createInstitution(data: {
  tenantId: string;
  name: string;
  slug: string;
  isActive?: boolean;
}): Promise<Institution> {
  const { institution } = await post<{ institution: Institution }>("/admin/institutions", {
    tenantId: data.tenantId,
    name: data.name,
    slug: data.slug,
    isActive: data.isActive ?? true,
  });
  return institution;
}

export async function updateInstitution(
  id: string,
  data: { name?: string; slug?: string; isActive?: boolean }
): Promise<Institution> {
  const { institution } = await patch<{ institution: Institution }>(`/admin/institutions/${id}`, data);
  return institution;
}
