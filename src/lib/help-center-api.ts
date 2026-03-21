/**
 * Real backend API. Replaces previous mock implementation.
 *
 * Help Center publishing/visibility contract:
 * - Only `status = published` content should be consumed by frontend users.
 * - `getPublicArticles(role)` enforces this and filters by visibility.
 */
import type {
  HelpArticle,
  HelpArticleFilters,
  HelpCategory,
  HelpFaq,
  HelpFaqFilters,
  HelpSupportSettings,
  HelpVideo,
  HelpVideoFilters,
  HelpVisibility,
} from "@/lib/help-center-types";
import { get, post, patch, del } from "@/lib/apiClient";

// ── Articles ──

export async function listArticles(filters: HelpArticleFilters = {}): Promise<HelpArticle[]> {
  const { items } = await get<{ items: HelpArticle[] }>("/admin/help-center/articles", {
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    categoryId: filters.categoryId,
    audience: filters.visibility && filters.visibility !== "all" ? filters.visibility : undefined,
    q: filters.query,
  });
  return items;
}

export async function getArticleById(id: string): Promise<HelpArticle | null> {
  try {
    const { article } = await get<{ article: HelpArticle }>(`/admin/help-center/articles/${id}`);
    return article;
  } catch {
    return null;
  }
}

export async function createArticle(
  payload: Omit<HelpArticle, "id" | "createdAt" | "updatedAt" | "slug" | "views" | "helpfulRate"> & { slug?: string }
): Promise<HelpArticle> {
  const { article } = await post<{ article: HelpArticle }>("/admin/help-center/articles", {
    title: payload.title,
    content: payload.content,
    categoryId: payload.categoryId || undefined,
    audience: payload.visibility,
    status: payload.status,
    summary: payload.summary,
    featured: payload.featured,
    tags: payload.tags,
    slug: payload.slug,
    createdBy: payload.createdBy,
  });
  return article;
}

export async function updateArticle(
  id: string,
  payload: Partial<Omit<HelpArticle, "id" | "createdAt" | "createdBy" | "views" | "helpfulRate">>
): Promise<HelpArticle> {
  const { article } = await patch<{ article: HelpArticle }>(`/admin/help-center/articles/${id}`, payload);
  return article;
}

export async function publishArticle(id: string): Promise<HelpArticle> {
  return updateArticle(id, { status: "published" });
}

export async function archiveArticle(id: string): Promise<HelpArticle> {
  return updateArticle(id, { status: "archived" });
}

export async function deleteArticle(id: string): Promise<void> {
  await del(`/admin/help-center/articles/${id}`);
}

export async function duplicateArticle(id: string): Promise<HelpArticle> {
  const original = await getArticleById(id);
  if (!original) throw new Error("Article not found.");
  const copy = await createArticle({
    title: `${original.title} (Copy)`,
    content: original.content,
    categoryId: original.categoryId,
    summary: original.summary,
    status: "draft",
    visibility: original.visibility,
    featured: original.featured,
    tags: original.tags,
    createdBy: original.createdBy,
  });
  return copy;
}

// ── Categories ──

export async function listCategories(): Promise<HelpCategory[]> {
  const { items } = await get<{ items: HelpCategory[] }>("/admin/help-center/categories");
  return items;
}

export async function reorderCategories(categoryIdsInOrder: string[]): Promise<HelpCategory[]> {
  // No backend reorder endpoint — return current list as-is
  const current = await listCategories();
  const ordered = categoryIdsInOrder
    .map((id, index) => {
      const found = current.find((c) => c.id === id);
      return found ? { ...found, order: index + 1 } : null;
    })
    .filter((c): c is HelpCategory => c !== null);
  return ordered;
}

export async function createCategory(payload: { name: string; icon: string }): Promise<HelpCategory> {
  const { item } = await post<{ item: HelpCategory }>("/admin/help-center/categories", {
    name: payload.name,
  });
  return item;
}

export async function updateCategory(id: string, payload: Partial<Pick<HelpCategory, "name" | "icon">>): Promise<HelpCategory> {
  const { item } = await patch<{ item: HelpCategory }>(`/admin/help-center/categories/${id}`, payload);
  return item;
}

export async function deleteCategory(id: string): Promise<void> {
  await del(`/admin/help-center/categories/${id}`);
}

// ── FAQs ──

export async function listFaqs(filters: HelpFaqFilters = {}): Promise<HelpFaq[]> {
  const { items } = await get<{ items: HelpFaq[] }>("/admin/help-center/faqs", {
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    categoryId: filters.categoryId,
    q: filters.query,
  });
  return items;
}

export async function createFaq(payload: Omit<HelpFaq, "id" | "updatedAt">): Promise<HelpFaq> {
  const { item } = await post<{ item: HelpFaq }>("/admin/help-center/faqs", {
    question: payload.question,
    answer: payload.answer,
    status: payload.status,
    categoryId: payload.categoryId,
    visibility: payload.visibility,
  });
  return item;
}

export async function updateFaq(id: string, payload: Partial<Omit<HelpFaq, "id">>): Promise<HelpFaq> {
  const { item } = await patch<{ item: HelpFaq }>(`/admin/help-center/faqs/${id}`, payload);
  return item;
}

export async function publishFaq(id: string, publish = true): Promise<HelpFaq> {
  return updateFaq(id, { status: publish ? "published" : "draft" });
}

export async function deleteFaq(id: string): Promise<void> {
  await del(`/admin/help-center/faqs/${id}`);
}

// ── Videos ──

export async function listVideos(filters: HelpVideoFilters = {}): Promise<HelpVideo[]> {
  const { items } = await get<{ items: HelpVideo[] }>("/admin/help-center/videos", {
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    categoryId: filters.categoryId,
    q: filters.query,
  });
  return items;
}

export async function createVideo(payload: Omit<HelpVideo, "id" | "updatedAt">): Promise<HelpVideo> {
  const { item } = await post<{ item: HelpVideo }>("/admin/help-center/videos", {
    title: payload.title,
    url: payload.url,
    description: payload.thumbnailUrl,
    status: payload.status,
    categoryId: payload.categoryId,
    duration: payload.duration,
  });
  return item;
}

export async function updateVideo(id: string, payload: Partial<Omit<HelpVideo, "id">>): Promise<HelpVideo> {
  const { item } = await patch<{ item: HelpVideo }>(`/admin/help-center/videos/${id}`, payload);
  return item;
}

export async function deleteVideo(id: string): Promise<void> {
  await del(`/admin/help-center/videos/${id}`);
}

// ── Settings (no backend endpoint — return sensible defaults) ──

const defaultSettings: HelpSupportSettings = {
  supportEmail: "support@hamrojaanch.com",
  supportPhone: "",
  supportHours: "Mon-Fri, 9:00 AM - 6:00 PM",
  chatLink: "",
  ticketLink: "",
  slaText: "Initial response within 4 business hours for priority issues.",
};

export async function getSettings(): Promise<HelpSupportSettings> {
  return { ...defaultSettings };
}

export async function updateSettings(
  payload: Partial<HelpSupportSettings>
): Promise<HelpSupportSettings> {
  // No backend endpoint — merge locally and return
  Object.assign(defaultSettings, payload);
  return { ...defaultSettings };
}

// ── Public articles ──

export async function getPublicArticles(role: HelpVisibility): Promise<HelpArticle[]> {
  const { items } = await get<{ items: HelpArticle[] }>("/admin/help-center/articles", {
    status: "published",
    audience: role,
  });
  return items;
}

// ── KPIs (computed from articles list) ──

export async function getHelpKpis(): Promise<{
  publishedArticles: number;
  drafts: number;
  views: number;
  helpfulRate: number;
}> {
  const all = await listArticles();
  const published = all.filter((a) => a.status === "published");
  const drafts = all.filter((a) => a.status === "draft");
  const views = published.reduce((sum, a) => sum + (a.views ?? 0), 0);
  const helpfulRate =
    published.length === 0
      ? 0
      : Math.round(published.reduce((sum, a) => sum + (a.helpfulRate ?? 0), 0) / published.length);
  return { publishedArticles: published.length, drafts: drafts.length, views, helpfulRate };
}
