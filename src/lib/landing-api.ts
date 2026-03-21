/**
 * Landing page dynamic content — audience blocks ("Who Uses HamroJaanch?").
 */
import { get, post, patch, del } from "@/lib/apiClient";

export interface LandingAudienceBlock {
  id: string;
  tenantId?: string;
  title: string;
  description: string;
  icon?: string | null;
  ctaLabel: string;
  ctaHref: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Public: active blocks for the landing page (no auth). */
export async function getPublicAudienceBlocks(): Promise<LandingAudienceBlock[]> {
  const res = await get<{ items: LandingAudienceBlock[] }>("/public/landing/audience-blocks");
  return res.items ?? [];
}

/** Admin: list all blocks. */
export async function listAdminAudienceBlocks(): Promise<LandingAudienceBlock[]> {
  const res = await get<{ items: LandingAudienceBlock[] }>("/admin/landing/audience-blocks");
  return res.items ?? [];
}

/** Admin: create block. */
export async function createAudienceBlock(data: {
  title: string;
  description?: string;
  icon?: string | null;
  ctaLabel?: string;
  ctaHref?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<LandingAudienceBlock> {
  return post<LandingAudienceBlock>("/admin/landing/audience-blocks", data);
}

/** Admin: update block. */
export async function updateAudienceBlock(
  id: string,
  data: Partial<Pick<LandingAudienceBlock, "title" | "description" | "icon" | "ctaLabel" | "ctaHref" | "sortOrder" | "isActive">>
): Promise<LandingAudienceBlock> {
  return patch<LandingAudienceBlock>(`/admin/landing/audience-blocks/${id}`, data);
}

/** Admin: reorder blocks by id order. */
export async function reorderAudienceBlocks(orderedIds: string[]): Promise<LandingAudienceBlock[]> {
  const res = await post<{ items: LandingAudienceBlock[] }>("/admin/landing/audience-blocks/reorder", {
    orderedIds,
  });
  return res.items ?? [];
}

/** Admin: delete block. */
export async function deleteAudienceBlock(id: string): Promise<void> {
  await del(`/admin/landing/audience-blocks/${id}`);
}
