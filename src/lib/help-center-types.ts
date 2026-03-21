export type HelpVisibility = "admin" | "teacher" | "candidate" | "public";
export type ArticleStatus = "draft" | "published" | "archived";
export type FaqStatus = "draft" | "published";
export type VideoStatus = "published" | "hidden";

export interface HelpCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  createdAt: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  visibility: HelpVisibility[];
  featured: boolean;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  createdBy: string;
  views: number;
  helpfulRate: number;
}

export interface HelpFaq {
  id: string;
  question: string;
  answer: string;
  categoryId: string;
  status: FaqStatus;
  visibility: HelpVisibility[];
  updatedAt: string;
}

export interface HelpVideo {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  status: VideoStatus;
  duration: string;
  thumbnailUrl: string;
  updatedAt: string;
}

export interface HelpSupportSettings {
  supportEmail: string;
  supportPhone: string;
  supportHours: string;
  chatLink: string;
  ticketLink: string;
  slaText: string;
}

export interface HelpArticleFilters {
  status?: "all" | ArticleStatus;
  visibility?: "all" | HelpVisibility;
  categoryId?: string;
  featured?: boolean;
  query?: string;
  updatedFrom?: string;
  updatedTo?: string;
  createdBy?: string;
}

export interface HelpFaqFilters {
  status?: "all" | FaqStatus;
  visibility?: "all" | HelpVisibility;
  categoryId?: string;
  query?: string;
}

export interface HelpVideoFilters {
  status?: "all" | VideoStatus;
  categoryId?: string;
  query?: string;
}

