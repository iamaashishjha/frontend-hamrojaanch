// Real backend API. Replaces previous mock implementation.

import { get, post, put, del } from "@/lib/apiClient";
import type { SitePage } from "@/lib/site-pages-types";

export async function listAdminPages(): Promise<SitePage[]> {
  return get<SitePage[]>("/admin/pages");
}

export async function getAdminPage(id: string): Promise<SitePage> {
  return get<SitePage>(`/admin/pages/${id}`);
}

export async function createPage(input: {
  title: string;
  slug?: string;
  content: string;
  status: string;
  seo?: any;
}): Promise<SitePage> {
  return post<SitePage>("/admin/pages", input);
}

export async function updatePage(id: string, patch: Partial<SitePage>): Promise<SitePage> {
  return put<SitePage>(`/admin/pages/${id}`, patch);
}

export async function deletePage(id: string): Promise<void> {
  await del(`/admin/pages/${id}`);
}

export async function listPublicPages(): Promise<SitePage[]> {
  return get<SitePage[]>("/public/pages");
}

export async function getPublicPageBySlug(slug: string): Promise<SitePage | null> {
  try {
    return await get<SitePage>(`/public/pages/${slug}`);
  } catch (err: unknown) {
    // Return null on 404 (page not found).
    if (err instanceof Error && err.message.includes("404")) {
      return null;
    }
    throw err;
  }
}

/** Pure client-side utility — converts text to a URL-safe slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
