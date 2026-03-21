import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import MarkdownContent from "@/components/MarkdownContent";
import { createPage, getAdminPage, slugify, updatePage } from "@/lib/site-pages-api";
import type { SitePage, SitePageInput } from "@/lib/site-pages-types";
import { uploadSiteAsset } from "@/lib/site-settings-api";

interface SitePageEditorPageProps {
  mode: "create" | "edit";
}

const emptyForm: SitePageInput = {
  title: "",
  slug: "",
  content: "",
  status: "draft",
  seo: {},
};

export default function SitePageEditorPage({ mode }: SitePageEditorPageProps) {
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();
  const [form, setForm] = useState<SitePageInput>(emptyForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<SitePage | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !pageId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getAdminPage(pageId);
        if (!data) {
          toast({ variant: "destructive", title: "Page not found" });
          navigate("/admin/site-pages", { replace: true });
          return;
        }
        setPage(data);
        setForm({
          title: data.title,
          slug: data.slug,
          content: data.content,
          status: data.status,
          seo: { ...data.seo },
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Unable to load page",
          description: error instanceof Error ? error.message : "Try again.",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [mode, pageId, navigate]);

  const updateField = (patch: Partial<SitePageInput>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const updateSeo = (patch: Partial<SitePageInput["seo"]>) =>
    setForm((prev) => ({ ...prev, seo: { ...prev.seo, ...patch } }));

  const handleUpload = async (file: File) => {
    try {
      const path = await uploadSiteAsset(file);
      updateSeo({ ogImage: path });
      toast({ title: "Image uploaded", description: "OG image updated." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload image.",
      });
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", title: "Title is required" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug?.trim() || slugify(form.title),
      };
      if (mode === "create") {
        const created = await createPage(payload);
        toast({ title: "Page created", description: "Draft saved." });
        navigate(`/admin/site-pages/${created.id}`, { replace: true });
      } else if (pageId) {
        const updated = await updatePage(pageId, payload);
        setPage(updated);
        toast({ title: "Page updated", description: "Changes saved." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save page.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading page...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? "New Page" : page?.title ?? "Edit Page"}
        subtitle="Edit public CMS content and SEO overrides."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/site-pages")}>Back</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(event) => updateField({ title: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Slug</Label>
              <Input
                value={form.slug ?? ""}
                onChange={(event) => updateField({ slug: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">URL: /pages/{form.slug || slugify(form.title || "page")}</p>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => updateField({ status: value as SitePageInput["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Content (Markdown)</Label>
              <Textarea
                rows={12}
                value={form.content}
                onChange={(event) => updateField({ content: event.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-2">
              <Label>SEO Title</Label>
              <Input value={form.seo?.metaTitle ?? ""} onChange={(event) => updateSeo({ metaTitle: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>SEO Description</Label>
              <Textarea rows={3} value={form.seo?.metaDescription ?? ""} onChange={(event) => updateSeo({ metaDescription: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>OG Image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
              {form.seo?.ogImage && (
                <img src={form.seo.ogImage} alt="OG" className="h-16 w-auto" />
              )}
            </div>
            <div className="rounded-lg border bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600">Preview</p>
              <MarkdownContent content={form.content || "# Preview\n\nStart typing content."} className="text-sm" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
