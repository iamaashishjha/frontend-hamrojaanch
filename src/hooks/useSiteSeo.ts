import { useEffect } from "react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import type { SiteSettings } from "@/lib/site-settings-types";

export interface SeoOverrides {
  title?: string;
  description?: string;
  ogImage?: string | null;
  keywords?: string[];
  noIndex?: boolean;
}

function ensureMetaTag(selector: string, attrs: Record<string, string>) {
  const existing = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (existing) return existing;
  const meta = document.createElement("meta");
  Object.entries(attrs).forEach(([key, value]) => meta.setAttribute(key, value));
  document.head.appendChild(meta);
  return meta;
}

function ensureLinkTag(selector: string, attrs: Record<string, string>) {
  const existing = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (existing) return existing;
  const link = document.createElement("link");
  Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
  document.head.appendChild(link);
  return link;
}

function normalizeTwitterHandle(value?: string | null) {
  if (!value) return "";
  if (value.startsWith("@")) return value;
  if (value.startsWith("http")) {
    const parts = value.split("/").filter(Boolean);
    const handle = parts[parts.length - 1] ?? "";
    return handle ? `@${handle.replace(/^@/, "")}` : "";
  }
  return `@${value}`;
}

function applySeo(settings: SiteSettings, overrides?: SeoOverrides) {
  const baseTitle = overrides?.title || settings.seoDefaults.defaultTitle || settings.branding.siteName;
  const template = settings.seoDefaults.titleTemplate || "%s";
  const title = template.includes("%s") ? template.replace("%s", baseTitle) : baseTitle;
  const description = overrides?.description || settings.seoDefaults.defaultDescription || "";
  const ogImage = overrides?.ogImage || settings.seoDefaults.defaultOgImage || settings.branding.logoLight || "";
  const keywords = overrides?.keywords || settings.seoDefaults.keywords || [];

  document.title = title;

  ensureMetaTag('meta[name="description"]', { name: "description" }).setAttribute("content", description);
  ensureMetaTag('meta[name="keywords"]', { name: "keywords" }).setAttribute("content", keywords.join(", "));
  ensureMetaTag('meta[property="og:title"]', { property: "og:title" }).setAttribute("content", title);
  ensureMetaTag('meta[property="og:description"]', { property: "og:description" }).setAttribute("content", description);
  ensureMetaTag('meta[property="og:type"]', { property: "og:type" }).setAttribute("content", "website");
  if (ogImage) {
    ensureMetaTag('meta[property="og:image"]', { property: "og:image" }).setAttribute("content", ogImage);
  }

  ensureMetaTag('meta[name="twitter:card"]', { name: "twitter:card" }).setAttribute("content", "summary_large_image");
  if (ogImage) {
    ensureMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }).setAttribute("content", ogImage);
  }
  const twitterHandle = normalizeTwitterHandle(settings.socials.twitter);
  if (twitterHandle) {
    ensureMetaTag('meta[name="twitter:site"]', { name: "twitter:site" }).setAttribute("content", twitterHandle);
  }

  if (settings.branding.favicon) {
    ensureLinkTag('link[rel="icon"]', { rel: "icon" }).setAttribute("href", settings.branding.favicon);
    ensureLinkTag('link[rel="shortcut icon"]', { rel: "shortcut icon" }).setAttribute("href", settings.branding.favicon);
  }

  if (overrides?.noIndex) {
    ensureMetaTag('meta[name="robots"]', { name: "robots" }).setAttribute("content", "noindex, nofollow");
  }
}

export function useSiteSeo(overrides?: SeoOverrides) {
  const { settings } = useSiteSettings();
  useEffect(() => {
    applySeo(settings, overrides);
  }, [settings, overrides?.title, overrides?.description, overrides?.ogImage, overrides?.keywords, overrides?.noIndex]);
}

export function SiteSeoDefaults() {
  useSiteSeo();
  return null;
}
