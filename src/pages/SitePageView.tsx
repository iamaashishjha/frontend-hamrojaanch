import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import MarkdownContent from "@/components/MarkdownContent";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { useSiteSeo } from "@/hooks/useSiteSeo";
import { getPublicPageBySlug } from "@/lib/site-pages-api";
import type { SitePage } from "@/lib/site-pages-types";

export default function SitePageView() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSiteSettings();
  const [page, setPage] = useState<SitePage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getPublicPageBySlug(slug)
      .then((data) => setPage(data))
      .finally(() => setLoading(false));
  }, [slug]);

  useSiteSeo({
    title: page?.seo?.metaTitle || page?.title,
    description: page?.seo?.metaDescription || settings.seoDefaults.defaultDescription,
    ogImage: page?.seo?.ogImage || settings.seoDefaults.defaultOgImage || undefined,
  });

  return (
    <div className="min-h-screen bg-background public-page-scale">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <BrandText className="font-bold text-xl" />
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            {settings.header.navLinks.map((link) => (
              <a key={`${link.label}-${link.href}`} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        {loading && <p className="text-sm text-muted-foreground">Loading page...</p>}
        {!loading && !page && (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Page not found.
          </div>
        )}
        {!loading && page && (
          <div className="mx-auto max-w-3xl space-y-4">
            <h1 className="text-3xl font-bold">{page.title}</h1>
            <MarkdownContent content={page.content} />
            <p className="text-xs text-muted-foreground">Last updated {new Date(page.updatedAt).toLocaleDateString()}</p>
          </div>
        )}
      </main>

      <footer className="border-t bg-card">
        <div className="container mx-auto flex flex-col items-start justify-between gap-3 px-6 py-6 md:flex-row md:items-center">
          <span className="text-sm text-muted-foreground">
            {settings.footer.footerText || settings.branding.tagline}
          </span>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {settings.footer.links.map((link) => (
              <Link key={`${link.label}-${link.href}`} to={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
