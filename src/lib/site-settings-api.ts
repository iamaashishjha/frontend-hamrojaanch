// Real backend API. Replaces previous mock implementation.

import { get, put, upload } from "@/lib/apiClient";
import type { SiteSettings } from "@/lib/site-settings-types";

/**
 * The backend may return branding / contact / socials / support / seoDefaults /
 * header / footer / analytics as JSON *strings* instead of objects.
 * This helper ensures every nested field is a proper object.
 * Exported for unit tests (defaults / empty updates behavior).
 */
export function parseSettingsResponse(raw: Record<string, unknown>): SiteSettings {
  const fields = [
    "branding",
    "contact",
    "socials",
    "support",
    "seoDefaults",
    "header",
    "footer",
    "analytics",
  ] as const;

  const parsed: Record<string, unknown> = { ...raw };

  for (const key of fields) {
    const value = parsed[key];
    if (typeof value === "string") {
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        // Leave as-is if it's not valid JSON.
      }
    }
  }

  return parsed as unknown as SiteSettings;
}

export async function getPublicSiteSettings(): Promise<SiteSettings> {
  const raw = await get<Record<string, unknown>>("/public/site-settings");
  return parseSettingsResponse(raw);
}

export async function getAdminSiteSettings(): Promise<SiteSettings> {
  const raw = await get<Record<string, unknown>>("/admin/site-settings");
  return parseSettingsResponse(raw);
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const res = await put<{ ok: boolean; settings: Record<string, unknown> }>(
    "/admin/site-settings",
    patch,
  );
  return parseSettingsResponse(res.settings);
}

export async function uploadSiteAsset(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return upload<{ url: string }>("/admin/site-settings/upload", formData);
}
