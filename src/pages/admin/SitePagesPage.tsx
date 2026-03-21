import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { deletePage, listAdminPages, updatePage } from "@/lib/site-pages-api";
import type { SitePage } from "@/lib/site-pages-types";

export default function SitePagesPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAdminPages();
      setPages(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load pages",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (page: SitePage) => {
    if (!window.confirm(`Delete page "${page.title}"? This will soft delete it.`)) return;
    try {
      await deletePage(page.id);
      toast({ title: "Page deleted", description: "The page was moved to trash." });
      void load();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete page.",
      });
    }
  };

  const togglePublish = async (page: SitePage) => {
    try {
      await updatePage(page.id, {
        status: page.status === "published" ? "draft" : "published",
      });
      void load();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update status.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages"
        subtitle="Manage public CMS pages displayed under /pages/:slug."
        actions={
          <Button onClick={() => navigate("/admin/site-pages/new")}>New Page</Button>
        }
      />

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-3 p-6">
          {loading && <p className="text-sm text-muted-foreground">Loading pages...</p>}
          {!loading && pages.length === 0 && (
            <p className="text-sm text-muted-foreground">No pages yet.</p>
          )}
          {!loading && pages.length > 0 && (
            <div className="space-y-3">
              {pages.map((page) => (
                <div key={page.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{page.title}</p>
                    <p className="text-xs text-muted-foreground">/pages/{page.slug}</p>
                    <p className="text-xs text-muted-foreground">Updated {new Date(page.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {page.deletedAt ? (
                      <Badge variant="destructive">Deleted</Badge>
                    ) : (
                      <Badge variant={page.status === "published" ? "default" : "secondary"}>
                        {page.status}
                      </Badge>
                    )}
                    <Button variant="outline" onClick={() => navigate(`/admin/site-pages/${page.id}`)}>
                      Edit
                    </Button>
                    {!page.deletedAt && (
                      <Button variant="outline" onClick={() => void togglePublish(page)}>
                        {page.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                    {!page.deletedAt && (
                      <Button variant="destructive" onClick={() => void handleDelete(page)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
