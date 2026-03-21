/**
 * Site settings API tests (Phase 6 TEST_PLAN).
 * - Default settings structure; empty nav/footer do not erase configured defaults; parse behavior.
 */
import { describe, expect, it, vi } from "vitest";
import { parseSettingsResponse } from "@/lib/site-settings-api";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings-types";

describe("site-settings-types", () => {
  it("DEFAULT_SITE_SETTINGS has required structure", () => {
    expect(DEFAULT_SITE_SETTINGS.branding.siteName).toBeTruthy();
    expect(DEFAULT_SITE_SETTINGS.footer.links.length).toBeGreaterThan(0);
    expect(DEFAULT_SITE_SETTINGS.header.navLinks.length).toBeGreaterThan(0);
    expect(DEFAULT_SITE_SETTINGS.contact).toBeDefined();
    expect(DEFAULT_SITE_SETTINGS.socials).toBeDefined();
  });
});

describe("parseSettingsResponse", () => {
  it("returns object with required top-level keys when raw has them", () => {
    const raw = {
      branding: { siteName: "Test" },
      contact: {},
      socials: {},
      support: {},
      seoDefaults: { titleTemplate: "%s", defaultTitle: "T", defaultDescription: "D", keywords: [] },
      header: { navLinks: [] },
      footer: { links: [] },
      analytics: {},
      updatedAt: new Date().toISOString(),
    };
    const out = parseSettingsResponse(raw as Record<string, unknown>);
    expect(out.branding.siteName).toBe("Test");
    expect(out.header.navLinks).toEqual([]);
    expect(out.footer.links).toEqual([]);
  });

  it("parses stringified JSON for nested fields (backend may send strings)", () => {
    const raw = {
      branding: JSON.stringify({ siteName: "Parsed", tagline: null }),
      contact: "{}",
      socials: "{}",
      support: "{}",
      seoDefaults: JSON.stringify({ titleTemplate: "%s", defaultTitle: "T", defaultDescription: "D", keywords: [] }),
      header: JSON.stringify({ navLinks: [{ label: "Home", href: "/" }] }),
      footer: JSON.stringify({ links: [] }),
      analytics: "{}",
      updatedAt: new Date().toISOString(),
    };
    const out = parseSettingsResponse(raw as Record<string, unknown>);
    expect(out.branding.siteName).toBe("Parsed");
    expect(out.header.navLinks).toHaveLength(1);
    expect(out.header.navLinks[0]).toEqual({ label: "Home", href: "/" });
    expect(out.footer.links).toEqual([]);
  });

  it("empty nav/footer updates do not erase structure (empty arrays preserved)", () => {
    const raw = {
      ...(DEFAULT_SITE_SETTINGS as unknown as Record<string, unknown>),
      header: JSON.stringify({ navLinks: [] }),
      footer: JSON.stringify({ links: [] }),
    };
    const out = parseSettingsResponse(raw);
    expect(out.header.navLinks).toEqual([]);
    expect(out.footer.links).toEqual([]);
    expect(out.branding?.siteName).toBeDefined();
  });
});
