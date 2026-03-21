export type SitePageStatus = "draft" | "published";

export interface SitePageSeo {
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
}

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: SitePageStatus;
  seo: SitePageSeo;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SitePageInput {
  slug?: string;
  title: string;
  content: string;
  status: SitePageStatus;
  seo?: SitePageSeo;
}
