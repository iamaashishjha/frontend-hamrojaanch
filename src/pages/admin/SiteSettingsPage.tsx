import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, LayoutGrid, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  createAudienceBlock,
  deleteAudienceBlock,
  listAdminAudienceBlocks,
  reorderAudienceBlocks,
  updateAudienceBlock,
} from "@/lib/landing-api";
import type { LandingAudienceBlock } from "@/lib/landing-api";
import {
  getAdminSiteSettings,
  updateSiteSettings,
  uploadSiteAsset,
} from "@/lib/site-settings-api";
import type { NavLink, SiteSettings } from "@/lib/site-settings-types";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings-types";

const emptyLink = (): NavLink => ({ label: "", href: "" });

const emptyAudienceForm = {
  title: "",
  description: "",
  icon: "_none" as string | null,
  ctaLabel: "",
  ctaHref: "",
  sortOrder: 0,
  isActive: true,
};

const AUDIENCE_ICON_OPTIONS = [
  { value: "_none", label: "None" },
  { value: "Users", label: "Users" },
  { value: "Building2", label: "Building / Institution" },
  { value: "Monitor", label: "Monitor / Proctor" },
  { value: "GraduationCap", label: "Graduation cap" },
  { value: "Briefcase", label: "Briefcase" },
  { value: "ShieldCheck", label: "Shield" },
  { value: "Laptop", label: "Laptop" },
  { value: "BookOpen", label: "Book" },
];

const DEMO_AUDIENCE_BLOCKS = [
  {
    title: "Students & Candidates",
    description:
      "Browse exams, complete a quick system check, take secure proctored exams, and download certificates when allowed.",
    icon: "Users" as const,
    ctaLabel: "Candidate Login",
    ctaHref: "/auth",
    sortOrder: 0,
    isActive: true,
  },
  {
    title: "Institutions & Training Providers",
    description:
      "Create exams, set Free / Demo / Paid pricing in NPR, invite candidates, and review detailed evidence and revenue reports.",
    icon: "Building2" as const,
    ctaLabel: "Institution Portal",
    ctaHref: "/admin/login",
    sortOrder: 1,
    isActive: true,
  },
  {
    title: "Proctors & Teachers",
    description:
      "Monitor live webcam feeds, review AI flags and timelines, and act on alerts with a full audit trail.",
    icon: "Monitor" as const,
    ctaLabel: "Proctor Login",
    ctaHref: "/proctor",
    sortOrder: 2,
    isActive: true,
  },
];

export default function SiteSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState(settings.seoDefaults.keywords.join(", "));

  const [audienceBlocks, setAudienceBlocks] = useState<LandingAudienceBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [audienceDialogOpen, setAudienceDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<LandingAudienceBlock | null>(null);
  const [audienceForm, setAudienceForm] = useState(emptyAudienceForm);
  const [audienceSaving, setAudienceSaving] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getAdminSiteSettings();
        setSettings(data);
        setKeywordsInput(data.seoDefaults.keywords.join(", "));
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Unable to load settings",
          description: error instanceof Error ? error.message : "Try again.",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const loadAudienceBlocks = async () => {
    setLoadingBlocks(true);
    try {
      const items = await listAdminAudienceBlocks();
      setAudienceBlocks(items);
    } catch {
      setAudienceBlocks([]);
    } finally {
      setLoadingBlocks(false);
    }
  };

  useEffect(() => {
    void loadAudienceBlocks();
  }, []);

  const openAddAudience = () => {
    setEditingBlock(null);
    setAudienceForm(emptyAudienceForm);
    setAudienceDialogOpen(true);
  };

  const openEditAudience = (block: LandingAudienceBlock) => {
    setEditingBlock(block);
    setAudienceForm({
      title: block.title,
      description: block.description,
      icon: block.icon ?? "_none",
      ctaLabel: block.ctaLabel,
      ctaHref: block.ctaHref,
      sortOrder: block.sortOrder,
      isActive: block.isActive,
    });
    setAudienceDialogOpen(true);
  };

  const saveAudienceBlock = async () => {
    if (!audienceForm.title.trim()) {
      toast({ variant: "destructive", title: "Title required", description: "Enter a title for the block." });
      return;
    }
    setAudienceSaving(true);
    try {
      const payload = { ...audienceForm, icon: (audienceForm.icon && audienceForm.icon !== "_none" ? audienceForm.icon.trim() : null) };
      if (editingBlock) {
        await updateAudienceBlock(editingBlock.id, payload);
        toast({ title: "Block updated", description: "Landing audience block saved." });
      } else {
        await createAudienceBlock(payload);
        toast({ title: "Block added", description: "New audience block will appear on the landing page." });
      }
      setAudienceDialogOpen(false);
      void loadAudienceBlocks();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save block.",
      });
    } finally {
      setAudienceSaving(false);
    }
  };

  const confirmDeleteBlock = async () => {
    if (!deleteBlockId) return;
    try {
      await deleteAudienceBlock(deleteBlockId);
      toast({ title: "Block deleted", description: "Removed from landing page." });
      setDeleteBlockId(null);
      void loadAudienceBlocks();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete block.",
      });
    }
  };

  const moveBlock = async (index: number, direction: "up" | "down") => {
    const newOrder = [...audienceBlocks];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= newOrder.length) return;
    [newOrder[index], newOrder[swap]] = [newOrder[swap], newOrder[index]];
    const orderedIds = newOrder.map((b) => b.id);
    setReorderingId(audienceBlocks[index].id);
    try {
      const items = await reorderAudienceBlocks(orderedIds);
      setAudienceBlocks(items);
      toast({ title: "Order updated", description: "Block order saved." });
    } catch (e) {
      toast({ variant: "destructive", title: "Reorder failed", description: e instanceof Error ? e.message : "Try again." });
    } finally {
      setReorderingId(null);
    }
  };

  const duplicateBlock = async (block: LandingAudienceBlock) => {
    try {
      await createAudienceBlock({
        title: `${block.title} (copy)`,
        description: block.description,
        icon: block.icon ?? undefined,
        ctaLabel: block.ctaLabel,
        ctaHref: block.ctaHref,
        sortOrder: audienceBlocks.length,
        isActive: false,
      });
      toast({ title: "Block duplicated", description: "Edit the new block as needed." });
      void loadAudienceBlocks();
    } catch (e) {
      toast({ variant: "destructive", title: "Duplicate failed", description: e instanceof Error ? e.message : "Try again." });
    }
  };

  const loadDemoAudienceData = async () => {
    if (audienceBlocks.length > 0) {
      toast({
        variant: "destructive",
        title: "List not empty",
        description: "Delete existing blocks first, or add blocks manually.",
      });
      return;
    }
    setLoadingDemo(true);
    try {
      for (const block of DEMO_AUDIENCE_BLOCKS) {
        await createAudienceBlock(block);
      }
      toast({ title: "Demo data loaded", description: "3 audience blocks added. They appear on the landing page." });
      void loadAudienceBlocks();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Load demo failed",
        description: e instanceof Error ? e.message : "Could not create demo blocks.",
      });
    } finally {
      setLoadingDemo(false);
    }
  };

  const updateBranding = (patch: Partial<SiteSettings["branding"]>) =>
    setSettings((prev) => ({ ...prev, branding: { ...prev.branding, ...patch } }));

  const updateContact = (patch: Partial<SiteSettings["contact"]>) =>
    setSettings((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));

  const updateSocials = (patch: Partial<SiteSettings["socials"]>) =>
    setSettings((prev) => ({ ...prev, socials: { ...prev.socials, ...patch } }));

  const updateSupport = (patch: Partial<SiteSettings["support"]>) =>
    setSettings((prev) => ({ ...prev, support: { ...prev.support, ...patch } }));

  const updateSeoDefaults = (patch: Partial<SiteSettings["seoDefaults"]>) =>
    setSettings((prev) => ({ ...prev, seoDefaults: { ...prev.seoDefaults, ...patch } }));

  const updateFooter = (patch: Partial<SiteSettings["footer"]>) =>
    setSettings((prev) => ({ ...prev, footer: { ...prev.footer, ...patch } }));

  const updateHeaderLink = (index: number, patch: Partial<NavLink>) => {
    setSettings((prev) => {
      const next = prev.header.navLinks.map((link, idx) =>
        idx === index ? { ...link, ...patch } : link
      );
      return { ...prev, header: { ...prev.header, navLinks: next } };
    });
  };

  const addHeaderLink = () =>
    setSettings((prev) => ({
      ...prev,
      header: { ...prev.header, navLinks: [...prev.header.navLinks, emptyLink()] },
    }));

  const removeHeaderLink = (index: number) =>
    setSettings((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        navLinks: prev.header.navLinks.filter((_, idx) => idx !== index),
      },
    }));

  const updateFooterLink = (index: number, patch: Partial<NavLink>) => {
    setSettings((prev) => {
      const next = prev.footer.links.map((link, idx) =>
        idx === index ? { ...link, ...patch } : link
      );
      return { ...prev, footer: { ...prev.footer, links: next } };
    });
  };

  const addFooterLink = () =>
    setSettings((prev) => ({
      ...prev,
      footer: { ...prev.footer, links: [...prev.footer.links, emptyLink()] },
    }));

  const removeFooterLink = (index: number) =>
    setSettings((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        links: prev.footer.links.filter((_, idx) => idx !== index),
      },
    }));

  const handleUpload = async (file: File, onSuccess: (value: string) => void) => {
    try {
      const path = await uploadSiteAsset(file);
      onSuccess(path);
      toast({ title: "Asset uploaded", description: "Preview updated." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unable to upload asset.",
      });
    }
  };

  const save = async () => {
    if (!settings.branding.siteName.trim()) {
      toast({
        variant: "destructive",
        title: "Site name required",
        description: "Please provide a site name before saving.",
      });
      return;
    }
    setSaving(true);
    try {
      const next = await updateSiteSettings(settings);
      setSettings(next);
      toast({ title: "Settings saved", description: "Site settings updated." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Settings"
        subtitle="Manage branding, SEO, and global site content."
        actions={
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        }
      />

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Update the global brand name, tagline, and logos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Site Name</Label>
            <Input
              value={settings.branding.siteName}
              onChange={(event) => updateBranding({ siteName: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Tagline</Label>
            <Input
              value={settings.branding.tagline ?? ""}
              onChange={(event) => updateBranding({ tagline: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Logo (Light)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file, (path) => updateBranding({ logoLight: path }));
              }}
            />
            {settings.branding.logoLight ? (
              <img src={settings.branding.logoLight} alt="Logo light" className="h-12 w-auto" />
            ) : (
              <div className="flex h-12 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                No light logo uploaded
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Logo (Dark)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file, (path) => updateBranding({ logoDark: path }));
              }}
            />
            {settings.branding.logoDark ? (
              <img src={settings.branding.logoDark} alt="Logo dark" className="h-12 w-auto" />
            ) : (
              <div className="flex h-12 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                No dark logo uploaded
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Favicon</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file, (path) => updateBranding({ favicon: path }));
              }}
            />
            {settings.branding.favicon ? (
              <img src={settings.branding.favicon} alt="Favicon" className="h-10 w-10" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                --
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Public support and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input
              value={settings.contact.email ?? ""}
              onChange={(event) => updateContact({ email: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Phone</Label>
            <Input
              value={settings.contact.phone ?? ""}
              onChange={(event) => updateContact({ phone: event.target.value })}
            />
          </div>
          <div className="grid gap-2 md:col-span-3">
            <Label>Address</Label>
            <Input
              value={settings.contact.address ?? ""}
              onChange={(event) => updateContact({ address: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Support Links</CardTitle>
          <CardDescription>Chat and ticket links surfaced in help center views.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Chat Link</Label>
            <Input
              value={settings.support.chatLink ?? ""}
              onChange={(event) => updateSupport({ chatLink: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Ticket Link</Label>
            <Input
              value={settings.support.ticketLink ?? ""}
              onChange={(event) => updateSupport({ ticketLink: event.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Use full URLs (https://...). Leave blank to hide support links in public pages.
          </p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>Profiles displayed in marketing and footer areas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {(["facebook", "instagram", "youtube", "tiktok", "linkedin", "twitter"] as const).map((key) => (
            <div key={key} className="grid gap-2">
              <Label className="capitalize">{key}</Label>
              <Input
                value={settings.socials[key] ?? ""}
                onChange={(event) => updateSocials({ [key]: event.target.value })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>SEO Defaults</CardTitle>
          <CardDescription>Applied across all public pages unless overridden.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Title Template</Label>
            <Input
              value={settings.seoDefaults.titleTemplate}
              onChange={(event) => updateSeoDefaults({ titleTemplate: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Use %s as the page title placeholder (example: "%s | Brand").
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Default Title</Label>
            <Input
              value={settings.seoDefaults.defaultTitle}
              onChange={(event) => updateSeoDefaults({ defaultTitle: event.target.value })}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Default Description</Label>
            <Textarea
              rows={3}
              value={settings.seoDefaults.defaultDescription}
              onChange={(event) => updateSeoDefaults({ defaultDescription: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Default OG Image</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file, (path) => updateSeoDefaults({ defaultOgImage: path }));
              }}
            />
            {settings.seoDefaults.defaultOgImage && (
              <img src={settings.seoDefaults.defaultOgImage} alt="OG" className="h-16 w-auto" />
            )}
          </div>
          <div className="grid gap-2">
            <Label>Keywords (comma separated)</Label>
            <Input
              value={keywordsInput}
              onChange={(event) => {
                const value = event.target.value;
                setKeywordsInput(value);
                updateSeoDefaults({
                  keywords: value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Header Navigation</CardTitle>
          <CardDescription>Links shown in public headers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.header.navLinks.map((link, index) => (
            <div key={`${link.label}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="Label"
                value={link.label}
                onChange={(event) => updateHeaderLink(index, { label: event.target.value })}
              />
              <Input
                placeholder="Href"
                value={link.href}
                onChange={(event) => updateHeaderLink(index, { href: event.target.value })}
              />
              <Button variant="outline" onClick={() => removeHeaderLink(index)}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addHeaderLink}>
            Add Link
          </Button>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Footer</CardTitle>
          <CardDescription>Footer text and quick links.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Footer Text</Label>
            <Input
              value={settings.footer.footerText ?? ""}
              onChange={(event) => updateFooter({ footerText: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Copyright</Label>
            <Input
              value={settings.footer.copyright ?? ""}
              onChange={(event) => updateFooter({ copyright: event.target.value })}
            />
          </div>
          <div className="space-y-3">
            {settings.footer.links.map((link, index) => (
              <div key={`${link.label}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input
                  placeholder="Label"
                  value={link.label}
                  onChange={(event) => updateFooterLink(index, { label: event.target.value })}
                />
                <Input
                  placeholder="Href"
                  value={link.href}
                  onChange={(event) => updateFooterLink(index, { href: event.target.value })}
                />
                <Button variant="outline" onClick={() => removeFooterLink(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={addFooterLink}>
              Add Link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Landing page — Who Uses HamroJaanch?
            </CardTitle>
            <CardDescription>
              Control the homepage audience section: add blocks, set title and CTA, choose an icon, reorder with the arrows, duplicate, or hide. Only active blocks appear on the landing page.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBlocks ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
              Loading blocks…
            </div>
          ) : audienceBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mb-1 font-medium text-foreground">No audience blocks yet</p>
              <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                Add blocks to show the &quot;Who Uses HamroJaanch?&quot; section on the homepage. Each block can have a title, description, icon, and call-to-action button.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={openAddAudience}>Add first block</Button>
                <Button variant="secondary" onClick={() => void loadDemoAudienceData()} disabled={loadingDemo}>
                  {loadingDemo ? "Loading…" : "Load demo data"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {audienceBlocks.map((block, index) => (
                  <li
                    key={block.id}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary" title="Order">
                        {index + 1}
                      </span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0 || reorderingId !== null}
                          onClick={() => void moveBlock(index, "up")}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === audienceBlocks.length - 1 || reorderingId !== null}
                          onClick={() => void moveBlock(index, "down")}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{block.title}</span>
                        {block.icon && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{block.icon}</span>
                        )}
                        {!block.isActive && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Hidden</span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{block.description || "—"}</p>
                      {(block.ctaLabel || block.ctaHref) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Button: {block.ctaLabel || "—"} → {block.ctaHref || "—"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={block.isActive}
                        onCheckedChange={async (checked) => {
                          try {
                            await updateAudienceBlock(block.id, { isActive: checked });
                            void loadAudienceBlocks();
                          } catch {
                            toast({ variant: "destructive", title: "Update failed" });
                          }
                        }}
                      />
                      <Button variant="outline" size="sm" onClick={() => openEditAudience(block)} title="Edit">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void duplicateBlock(block)} title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteBlockId(block.id)}
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                <Button variant="outline" onClick={openAddAudience}>
                  Add block
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void loadDemoAudienceData()}
                  disabled={loadingDemo || audienceBlocks.length > 0}
                >
                  {loadingDemo ? "Loading…" : "Load demo data"}
                </Button>
                {audienceBlocks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Use arrows to reorder. To reload demo data, delete all blocks first.
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={audienceDialogOpen} onOpenChange={setAudienceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBlock ? "Edit audience block" : "Add audience block"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                value={audienceForm.title}
                onChange={(e) => setAudienceForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Students & Candidates"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={audienceForm.description}
                onChange={(e) => setAudienceForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short description for this audience."
              />
            </div>
            <div className="grid gap-2">
              <Label>Icon (optional)</Label>
              <Select
                value={audienceForm.icon ?? "_none"}
                onValueChange={(v) => setAudienceForm((p) => ({ ...p, icon: v === "_none" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Shown next to the block on the landing page.</p>
            </div>
            <div className="grid gap-2">
              <Label>Button label (CTA)</Label>
              <Input
                value={audienceForm.ctaLabel}
                onChange={(e) => setAudienceForm((p) => ({ ...p, ctaLabel: e.target.value }))}
                placeholder="e.g. Candidate Login"
              />
            </div>
            <div className="grid gap-2">
              <Label>Button link (href)</Label>
              <Input
                value={audienceForm.ctaHref}
                onChange={(e) => setAudienceForm((p) => ({ ...p, ctaHref: e.target.value }))}
                placeholder="e.g. /auth or /admin/login"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sort order (lower = first)</Label>
              <Input
                type="number"
                value={audienceForm.sortOrder}
                onChange={(e) => setAudienceForm((p) => ({ ...p, sortOrder: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={audienceForm.isActive}
                onCheckedChange={(checked) => setAudienceForm((p) => ({ ...p, isActive: checked }))}
              />
              <Label>Visible on landing page</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAudienceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveAudienceBlock()} disabled={audienceSaving}>
              {audienceSaving ? "Saving…" : editingBlock ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBlockId} onOpenChange={(open) => !open && setDeleteBlockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription>
              This block will be removed from the landing page. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteBlock()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
