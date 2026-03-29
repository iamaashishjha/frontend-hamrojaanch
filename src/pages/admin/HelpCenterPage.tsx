/**
 * README:
 * Visibility and publishing rules:
 * - End users should only consume `published` content.
 * - Visibility is role-based (`admin`, `teacher`, `candidate`, `public`) and enforced via `getPublicArticles(role)`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Eye,
  FileDown,
  FilePlus2,
  Film,
  FolderClosed,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  archiveArticle,
  createArticle,
  createCategory,
  createFaq,
  createVideo,
  deleteArticle,
  deleteCategory,
  deleteFaq,
  deleteVideo,
  duplicateArticle,
  getArticleById,
  getHelpKpis,
  getSettings,
  listArticles,
  listCategories,
  listFaqs,
  listVideos,
  publishArticle,
  publishFaq,
  reorderCategories,
  updateArticle,
  updateCategory,
  updateFaq,
  updateSettings,
  updateVideo,
} from "@/lib/help-center-api";
import type {
  ArticleStatus,
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
import { cn } from "@/lib/utils";

type HelpTab = "overview" | "articles" | "categories" | "faqs" | "videos" | "settings" | "feedback";
type PreviewRole = "teacher" | "candidate";
type ArticleBulkAction = "publish" | "unpublish" | "change-category" | "change-visibility" | "archive" | "delete" | null;
type FaqBulkAction = "publish" | "unpublish" | null;

const HELP_BASE_LEGACY = "/admin/help";
const HELP_BASE_CANONICAL = "/admin/help-center";

const resolveHelpBase = (pathname: string) =>
  pathname.startsWith(HELP_BASE_CANONICAL) ? HELP_BASE_CANONICAL : HELP_BASE_LEGACY;

interface ArticleFilterForm {
  status: "all" | ArticleStatus;
  visibility: "all" | HelpVisibility;
  categoryId: string;
  featuredOnly: boolean;
  query: string;
  updatedFrom: string;
  updatedTo: string;
  createdBy: string;
}

interface FaqFilterForm {
  status: "all" | "draft" | "published";
  visibility: "all" | HelpVisibility;
  categoryId: string;
  query: string;
}

interface VideoFilterForm {
  status: "all" | "published" | "hidden";
  categoryId: string;
  query: string;
}

interface ArticleEditorState {
  title: string;
  slug: string;
  slugEdited: boolean;
  categoryId: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  visibility: HelpVisibility[];
  featured: boolean;
  tags: string[];
  tagInput: string;
}

interface FaqEditorState {
  question: string;
  answer: string;
  categoryId: string;
  status: "draft" | "published";
  visibility: HelpVisibility[];
}

interface VideoEditorState {
  title: string;
  url: string;
  categoryId: string;
  duration: string;
  thumbnailUrl: string;
  status: "published" | "hidden";
}

const toBoolean = (value: CheckedState) => value === true;

const initialArticleFilters: ArticleFilterForm = {
  status: "all",
  visibility: "all",
  categoryId: "",
  featuredOnly: false,
  query: "",
  updatedFrom: "",
  updatedTo: "",
  createdBy: "",
};

const initialFaqFilters: FaqFilterForm = {
  status: "all",
  visibility: "all",
  categoryId: "",
  query: "",
};

const initialVideoFilters: VideoFilterForm = {
  status: "all",
  categoryId: "",
  query: "",
};

const initialSettings: HelpSupportSettings = {
  supportEmail: "",
  supportPhone: "",
  supportHours: "",
  chatLink: "",
  ticketLink: "",
  slaText: "",
};

function createInitialArticleEditor(): ArticleEditorState {
  return {
    title: "",
    slug: "",
    slugEdited: false,
    categoryId: "",
    summary: "",
    content: "",
    status: "draft",
    visibility: ["admin"],
    featured: false,
    tags: [],
    tagInput: "",
  };
}

function createInitialFaqEditor(): FaqEditorState {
  return {
    question: "",
    answer: "",
    categoryId: "",
    status: "draft",
    visibility: ["admin"],
  };
}

function createInitialVideoEditor(): VideoEditorState {
  return {
    title: "",
    url: "",
    categoryId: "",
    duration: "",
    thumbnailUrl: "",
    status: "published",
  };
}

function toArticleApiFilters(form: ArticleFilterForm): HelpArticleFilters {
  return {
    status: form.status,
    visibility: form.visibility,
    categoryId: form.categoryId || undefined,
    featured: form.featuredOnly ? true : undefined,
    query: form.query || undefined,
    updatedFrom: form.updatedFrom || undefined,
    updatedTo: form.updatedTo || undefined,
    createdBy: form.createdBy || undefined,
  };
}

function toFaqApiFilters(form: FaqFilterForm): HelpFaqFilters {
  return {
    status: form.status,
    visibility: form.visibility,
    categoryId: form.categoryId || undefined,
    query: form.query || undefined,
  };
}

function toVideoApiFilters(form: VideoFilterForm): HelpVideoFilters {
  return {
    status: form.status,
    categoryId: form.categoryId || undefined,
    query: form.query || undefined,
  };
}

function getTabFromPath(pathname: string): HelpTab {
  const base = resolveHelpBase(pathname);
  if (pathname.startsWith(`${base}/articles`)) return "articles";
  if (pathname.startsWith(`${base}/categories`)) return "categories";
  if (pathname.startsWith(`${base}/faqs`)) return "faqs";
  if (pathname.startsWith(`${base}/videos`)) return "videos";
  if (pathname.startsWith(`${base}/settings`)) return "settings";
  if (pathname.startsWith(`${base}/feedback`)) return "feedback";
  return "overview";
}

function tabToPath(tab: HelpTab, basePath: string): string {
  if (tab === "overview") return basePath;
  return `${basePath}/${tab}`;
}

function statusBadgeVariant(status: ArticleStatus) {
  if (status === "published") return "success-light";
  if (status === "archived") return "secondary";
  return "outline";
}

function visibilityBadgeVariant(value: HelpVisibility) {
  if (value === "public") return "success-light";
  if (value === "admin") return "secondary";
  if (value === "teacher") return "outline";
  return "warning-light";
}

function faqStatusVariant(status: "draft" | "published") {
  return status === "published" ? "success-light" : "outline";
}

function videoStatusVariant(status: "published" | "hidden") {
  return status === "published" ? "success-light" : "secondary";
}

function toSafeHref(rawHref: string): string {
  const href = rawHref.trim();
  if (!href) return "#";
  if (href.startsWith("/") || href.startsWith("#")) return href;
  try {
    const parsed = new URL(href, "https://hamrojaanch.local");
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:") {
      return href;
    }
  } catch {
    // Fall through.
  }
  return "#";
}

function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\[(.*?)\]\((.*?)\)/g, (_match, label, href) => `<a href="${toSafeHref(href)}">${label}</a>`)
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n/g, "<br/>");
}

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: articleIdParam } = useParams<{ id?: string }>();
  const activeTab = getTabFromPath(location.pathname);
  const helpBase = resolveHelpBase(location.pathname);
  const buildHelpPath = useCallback(
    (suffix?: string) => (suffix ? `${helpBase}/${suffix}` : helpBase),
    [helpBase]
  );

  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [faqs, setFaqs] = useState<HelpFaq[]>([]);
  const [videos, setVideos] = useState<HelpVideo[]>([]);
  const [settings, setSettings] = useState<HelpSupportSettings>(initialSettings);
  const [kpis, setKpis] = useState({ publishedArticles: 0, drafts: 0, views: 0, helpfulRate: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [articleFilters, setArticleFilters] = useState<ArticleFilterForm>(initialArticleFilters);
  const [appliedArticleFilters, setAppliedArticleFilters] = useState<HelpArticleFilters>(() =>
    toArticleApiFilters(initialArticleFilters)
  );
  const [moreArticleFiltersOpen, setMoreArticleFiltersOpen] = useState(false);

  const [faqFilters, setFaqFilters] = useState<FaqFilterForm>(initialFaqFilters);
  const [appliedFaqFilters, setAppliedFaqFilters] = useState<HelpFaqFilters>(() => toFaqApiFilters(initialFaqFilters));

  const [videoFilters, setVideoFilters] = useState<VideoFilterForm>(initialVideoFilters);
  const [appliedVideoFilters, setAppliedVideoFilters] = useState<HelpVideoFilters>(() =>
    toVideoApiFilters(initialVideoFilters)
  );

  const [articleSorting, setArticleSorting] = useState<SortingState>([]);
  const [articleSelection, setArticleSelection] = useState<RowSelectionState>({});
  const [articlePagination, setArticlePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });

  const [faqSorting, setFaqSorting] = useState<SortingState>([]);
  const [faqSelection, setFaqSelection] = useState<RowSelectionState>({});
  const [faqPagination, setFaqPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });

  const [videoSorting, setVideoSorting] = useState<SortingState>([]);
  const [videoSelection, setVideoSelection] = useState<RowSelectionState>({});
  const [videoPagination, setVideoPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });

  const [articleEditorOpen, setArticleEditorOpen] = useState(false);
  const [articleEditorSubmitting, setArticleEditorSubmitting] = useState(false);
  const [articleEditorId, setArticleEditorId] = useState<string | null>(null);
  const [articleEditor, setArticleEditor] = useState<ArticleEditorState>(createInitialArticleEditor());

  const [faqEditorOpen, setFaqEditorOpen] = useState(false);
  const [faqEditorId, setFaqEditorId] = useState<string | null>(null);
  const [faqEditorSubmitting, setFaqEditorSubmitting] = useState(false);
  const [faqEditor, setFaqEditor] = useState<FaqEditorState>(createInitialFaqEditor());

  const [videoEditorOpen, setVideoEditorOpen] = useState(false);
  const [videoEditorId, setVideoEditorId] = useState<string | null>(null);
  const [videoEditorSubmitting, setVideoEditorSubmitting] = useState(false);
  const [videoEditor, setVideoEditor] = useState<VideoEditorState>(createInitialVideoEditor());

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDialogId, setCategoryDialogId] = useState<string | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryIconInput, setCategoryIconInput] = useState("Folder");
  const [categoryDialogSubmitting, setCategoryDialogSubmitting] = useState(false);

  const [articleBulkAction, setArticleBulkAction] = useState<ArticleBulkAction>(null);
  const [articleBulkCategoryId, setArticleBulkCategoryId] = useState("");
  const [articleBulkVisibility, setArticleBulkVisibility] = useState<HelpVisibility[]>([]);
  const [articleBulkSubmitting, setArticleBulkSubmitting] = useState(false);

  const [faqBulkAction, setFaqBulkAction] = useState<FaqBulkAction>(null);
  const [faqBulkSubmitting, setFaqBulkSubmitting] = useState(false);

  const [articlePreviewOpen, setArticlePreviewOpen] = useState(false);
  const [articlePreviewRole, setArticlePreviewRole] = useState<PreviewRole>("teacher");
  const [articlePreviewItem, setArticlePreviewItem] = useState<HelpArticle | null>(null);

  const [articleDeleteOpen, setArticleDeleteOpen] = useState(false);
  const [articleDeleteId, setArticleDeleteId] = useState<string | null>(null);
  const [articleDeleteSubmitting, setArticleDeleteSubmitting] = useState(false);

  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailArticle, setDetailArticle] = useState<HelpArticle | null>(null);
  const [detailTab, setDetailTab] = useState("overview");

  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const feedbackItems = [
    {
      id: "f1",
      title: "Candidate feedback - \"Great onboarding guide\"",
      detail: "Article clarity rated 5/5. Requested more screenshots.",
    },
    {
      id: "f2",
      title: "Teacher feedback - \"Need more FAQ on evaluation\"",
      detail: "Asked for sample rubric examples in Help Center.",
    },
  ];

  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories]
  );

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  const refresh = () => setRefreshKey((prev) => prev + 1);

  const loadArticles = async () => {
    setLoadingArticles(true);
    try {
      const rows = await listArticles(appliedArticleFilters);
      setArticles(rows);
      setArticlePagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load articles.");
    } finally {
      setLoadingArticles(false);
    }
  };

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const rows = await listCategories();
      setCategories(rows);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load categories.");
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadFaqs = async () => {
    setLoadingFaqs(true);
    try {
      const rows = await listFaqs(appliedFaqFilters);
      setFaqs(rows);
      setFaqPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load FAQs.");
    } finally {
      setLoadingFaqs(false);
    }
  };

  const loadVideos = async () => {
    setLoadingVideos(true);
    try {
      const rows = await listVideos(appliedVideoFilters);
      setVideos(rows);
      setVideoPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load videos.");
    } finally {
      setLoadingVideos(false);
    }
  };

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const row = await getSettings();
      setSettings(row);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load settings.");
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadKpis = async () => {
    try {
      const row = await getHelpKpis();
      setKpis(row);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load KPIs.");
    }
  };

  const loadDetailArticle = async (id: string) => {
    setDetailLoading(true);
    try {
      const row = await getArticleById(id);
      if (!row) {
        notifyError("Article not found.");
        navigate(buildHelpPath("articles"), { replace: true });
        return;
      }
      setDetailArticle(row);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load article details.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
    void loadSettings();
    void loadKpis();
  }, []);

  useEffect(() => {
    void loadArticles();
  }, [appliedArticleFilters, refreshKey]);

  useEffect(() => {
    void loadFaqs();
  }, [appliedFaqFilters, refreshKey]);

  useEffect(() => {
    void loadVideos();
  }, [appliedVideoFilters, refreshKey]);

  useEffect(() => {
    void loadKpis();
  }, [refreshKey]);

  useEffect(() => {
    if (!articleIdParam) {
      setDetailArticle(null);
      return;
    }
    setDetailTab("overview");
    void loadDetailArticle(articleIdParam);
  }, [articleIdParam, refreshKey]);

  useEffect(() => {
    if (location.pathname === buildHelpPath("articles/new")) {
      openArticleCreate();
      navigate(buildHelpPath("articles"), { replace: true });
    }
  }, [location.pathname]);

  const openArticleCreate = () => {
    setArticleEditorId(null);
    setArticleEditor(createInitialArticleEditor());
    setArticleEditorOpen(true);
  };

  const openArticleEdit = (item: HelpArticle) => {
    setArticleEditorId(item.id);
    setArticleEditor({
      title: item.title,
      slug: item.slug,
      slugEdited: true,
      categoryId: item.categoryId,
      summary: item.summary,
      content: item.content,
      status: item.status,
      visibility: [...item.visibility],
      featured: item.featured,
      tags: [...item.tags],
      tagInput: "",
    });
    setArticleEditorOpen(true);
  };

  const openFaqCreate = () => {
    setFaqEditorId(null);
    setFaqEditor(createInitialFaqEditor());
    setFaqEditorOpen(true);
  };

  const openFaqEdit = (item: HelpFaq) => {
    setFaqEditorId(item.id);
    setFaqEditor({
      question: item.question,
      answer: item.answer,
      categoryId: item.categoryId,
      status: item.status,
      visibility: [...item.visibility],
    });
    setFaqEditorOpen(true);
  };

  const openVideoCreate = () => {
    setVideoEditorId(null);
    setVideoEditor(createInitialVideoEditor());
    setVideoEditorOpen(true);
  };

  const openVideoEdit = (item: HelpVideo) => {
    setVideoEditorId(item.id);
    setVideoEditor({
      title: item.title,
      url: item.url,
      categoryId: item.categoryId,
      duration: item.duration,
      thumbnailUrl: item.thumbnailUrl,
      status: item.status,
    });
    setVideoEditorOpen(true);
  };

  const articleSelectedIds = useMemo(
    () => Object.entries(articleSelection).filter(([, isSelected]) => isSelected).map(([id]) => id),
    [articleSelection]
  );

  const faqSelectedIds = useMemo(
    () => Object.entries(faqSelection).filter(([, isSelected]) => isSelected).map(([id]) => id),
    [faqSelection]
  );

  const detailLinkedFaqs = useMemo(() => {
    if (!detailArticle) return [];
    const articleTags = detailArticle.tags.map((tag) => tag.toLowerCase());
    return faqs.filter((faq) => {
      if (faq.categoryId === detailArticle.categoryId) return true;
      const haystack = `${faq.question} ${faq.answer}`.toLowerCase();
      return articleTags.some((tag) => haystack.includes(tag));
    });
  }, [detailArticle, faqs]);

  const detailRevisions = useMemo(() => {
    if (!detailArticle) return [];
    return Array.from({ length: 5 }).map((_, index) => {
      const revisionTime = new Date(new Date(detailArticle.updatedAt).getTime() - index * 1000 * 60 * 60 * 12);
      return {
        id: `${detailArticle.id}_rev_${index + 1}`,
        label: `Revision ${5 - index}`,
        savedAt: revisionTime.toISOString(),
        savedBy: index % 2 === 0 ? detailArticle.createdBy : "Admin",
      };
    });
  }, [detailArticle]);

  const articleColumns = useMemo<ColumnDef<HelpArticle>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(toBoolean(value))}
            aria-label="Select all articles"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(toBoolean(value))}
            aria-label={`Select ${row.original.title}`}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">{row.original.title}</p>
            <p className="text-xs text-slate-500">{row.original.summary}</p>
          </div>
        ),
      },
      {
        accessorKey: "categoryId",
        header: "Category",
        cell: ({ row }) => categoriesById.get(row.original.categoryId)?.name ?? "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "visibility",
        header: "Visibility",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.visibility.map((value) => (
              <Badge key={value} variant={visibilityBadgeVariant(value)}>
                {value}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "featured",
        header: "Featured",
        cell: ({ row }) => row.original.featured ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : "-",
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => formatDistanceToNowStrict(new Date(row.original.updatedAt), { addSuffix: true }),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate(buildHelpPath(`articles/${item.id}`))}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openArticleEdit(item)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await duplicateArticle(item.id);
                      notifySuccess("Article duplicated.");
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to duplicate article.");
                    }
                  }}
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      if (item.status === "published") {
                        await updateArticle(item.id, { status: "draft" });
                        notifySuccess("Article unpublished.");
                      } else {
                        await publishArticle(item.id);
                        notifySuccess("Article published.");
                      }
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to update publish status.");
                    }
                  }}
                >
                  {item.status === "published" ? "Unpublish" : "Publish"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await archiveArticle(item.id);
                      notifySuccess("Article archived.");
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to archive article.");
                    }
                  }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setArticlePreviewRole("teacher");
                    setArticlePreviewItem(item);
                    setArticlePreviewOpen(true);
                  }}
                >
                  Preview as Teacher/Candidate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => {
                    setArticleDeleteId(item.id);
                    setArticleDeleteOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [categoriesById, navigate]
  );

  const faqColumns = useMemo<ColumnDef<HelpFaq>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(toBoolean(value))}
            aria-label="Select all FAQs"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(toBoolean(value))}
            aria-label={`Select ${row.original.question}`}
          />
        ),
        enableSorting: false,
      },
      { accessorKey: "question", header: "Question" },
      {
        accessorKey: "categoryId",
        header: "Category",
        cell: ({ row }) => categoriesById.get(row.original.categoryId)?.name ?? "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={faqStatusVariant(row.original.status)}>{row.original.status}</Badge>,
      },
      {
        id: "visibility",
        header: "Visibility",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.visibility.map((value) => (
              <Badge key={value} variant={visibilityBadgeVariant(value)}>
                {value}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => formatDistanceToNowStrict(new Date(row.original.updatedAt), { addSuffix: true }),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openFaqEdit(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await publishFaq(row.original.id, row.original.status !== "published");
                    notifySuccess("FAQ status updated.");
                    refresh();
                  } catch (error) {
                    notifyError(error instanceof Error ? error.message : "Unable to update FAQ.");
                  }
                }}
              >
                {row.original.status === "published" ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={async () => {
                  try {
                    await deleteFaq(row.original.id);
                    notifySuccess("FAQ deleted.");
                    refresh();
                  } catch (error) {
                    notifyError(error instanceof Error ? error.message : "Unable to delete FAQ.");
                  }
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [categoriesById]
  );

  const videoColumns = useMemo<ColumnDef<HelpVideo>[]>(
    () => [
      { accessorKey: "title", header: "Title" },
      {
        accessorKey: "categoryId",
        header: "Category",
        cell: ({ row }) => categoriesById.get(row.original.categoryId)?.name ?? "-",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={videoStatusVariant(row.original.status)}>{row.original.status}</Badge>,
      },
      { accessorKey: "duration", header: "Duration" },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => formatDistanceToNowStrict(new Date(row.original.updatedAt), { addSuffix: true }),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openVideoEdit(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setVideoPreviewUrl(row.original.url);
                  setVideoPreviewOpen(true);
                }}
              >
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={async () => {
                  try {
                    await deleteVideo(row.original.id);
                    notifySuccess("Video deleted.");
                    refresh();
                  } catch (error) {
                    notifyError(error instanceof Error ? error.message : "Unable to delete video.");
                  }
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [categoriesById]
  );

  const articleTable = useReactTable({
    data: articles,
    columns: articleColumns,
    state: { sorting: articleSorting, rowSelection: articleSelection, pagination: articlePagination },
    onSortingChange: setArticleSorting,
    onRowSelectionChange: setArticleSelection,
    onPaginationChange: setArticlePagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const faqTable = useReactTable({
    data: faqs,
    columns: faqColumns,
    state: { sorting: faqSorting, rowSelection: faqSelection, pagination: faqPagination },
    onSortingChange: setFaqSorting,
    onRowSelectionChange: setFaqSelection,
    onPaginationChange: setFaqPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const videoTable = useReactTable({
    data: videos,
    columns: videoColumns,
    state: { sorting: videoSorting, rowSelection: videoSelection, pagination: videoPagination },
    onSortingChange: setVideoSorting,
    onRowSelectionChange: setVideoSelection,
    onPaginationChange: setVideoPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const saveArticle = async (mode: "draft" | "publish") => {
    if (!articleEditor.title.trim()) {
      notifyError("Title is required.");
      return;
    }
    if (!articleEditor.categoryId) {
      notifyError("Category is required.");
      return;
    }
    if (mode === "publish" && !articleEditor.content.trim()) {
      notifyError("Content is required for publishing.");
      return;
    }
    setArticleEditorSubmitting(true);
    try {
      if (articleEditorId) {
        await updateArticle(articleEditorId, {
          title: articleEditor.title.trim(),
          slug: articleEditor.slug.trim(),
          categoryId: articleEditor.categoryId,
          summary: articleEditor.summary.trim(),
          content: articleEditor.content,
          status: mode === "publish" ? "published" : "draft",
          visibility: articleEditor.visibility,
          featured: articleEditor.featured,
          tags: articleEditor.tags,
        });
      } else {
        await createArticle({
          title: articleEditor.title.trim(),
          slug: articleEditor.slug.trim(),
          categoryId: articleEditor.categoryId,
          summary: articleEditor.summary.trim(),
          content: articleEditor.content,
          status: mode === "publish" ? "published" : "draft",
          visibility: articleEditor.visibility,
          featured: articleEditor.featured,
          tags: articleEditor.tags,
          createdBy: "Admin",
        });
      }
      notifySuccess(mode === "publish" ? "Article published." : "Draft saved.");
      setArticleEditorOpen(false);
      setArticleEditorId(null);
      setArticleEditor(createInitialArticleEditor());
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save article.");
    } finally {
      setArticleEditorSubmitting(false);
    }
  };

  const executeArticleBulkAction = async () => {
    if (!articleBulkAction || articleSelectedIds.length === 0) {
      notifyError("Select one or more articles first.");
      return;
    }
    setArticleBulkSubmitting(true);
    try {
      if (articleBulkAction === "publish") {
        await Promise.all(articleSelectedIds.map((id) => publishArticle(id)));
        notifySuccess("Selected articles published.");
      } else if (articleBulkAction === "unpublish") {
        await Promise.all(articleSelectedIds.map((id) => updateArticle(id, { status: "draft" })));
        notifySuccess("Selected articles unpublished.");
      } else if (articleBulkAction === "change-category") {
        if (!articleBulkCategoryId) {
          notifyError("Select a category for bulk change.");
          return;
        }
        await Promise.all(articleSelectedIds.map((id) => updateArticle(id, { categoryId: articleBulkCategoryId })));
        notifySuccess("Category updated for selected articles.");
      } else if (articleBulkAction === "change-visibility") {
        if (articleBulkVisibility.length === 0) {
          notifyError("Select one or more visibility roles.");
          return;
        }
        await Promise.all(articleSelectedIds.map((id) => updateArticle(id, { visibility: articleBulkVisibility })));
        notifySuccess("Visibility updated for selected articles.");
      } else if (articleBulkAction === "archive") {
        await Promise.all(articleSelectedIds.map((id) => archiveArticle(id)));
        notifySuccess("Selected articles archived.");
      } else if (articleBulkAction === "delete") {
        await Promise.all(articleSelectedIds.map((id) => deleteArticle(id)));
        notifySuccess("Selected articles deleted.");
      }
      setArticleBulkAction(null);
      setArticleSelection({});
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setArticleBulkSubmitting(false);
    }
  };

  const executeFaqBulkAction = async () => {
    if (!faqBulkAction || faqSelectedIds.length === 0) {
      notifyError("Select FAQs first.");
      return;
    }
    setFaqBulkSubmitting(true);
    try {
      const publish = faqBulkAction === "publish";
      await Promise.all(faqSelectedIds.map((id) => publishFaq(id, publish)));
      notifySuccess(publish ? "Selected FAQs published." : "Selected FAQs unpublished.");
      setFaqBulkAction(null);
      setFaqSelection({});
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to update selected FAQs.");
    } finally {
      setFaqBulkSubmitting(false);
    }
  };

  const submitFaq = async () => {
    if (!faqEditor.question.trim() || !faqEditor.answer.trim()) {
      notifyError("Question and answer are required.");
      return;
    }
    if (!faqEditor.categoryId) {
      notifyError("Select FAQ category.");
      return;
    }
    setFaqEditorSubmitting(true);
    try {
      if (faqEditorId) {
        await updateFaq(faqEditorId, {
          question: faqEditor.question.trim(),
          answer: faqEditor.answer,
          categoryId: faqEditor.categoryId,
          status: faqEditor.status,
          visibility: faqEditor.visibility,
        });
      } else {
        await createFaq({
          question: faqEditor.question.trim(),
          answer: faqEditor.answer,
          categoryId: faqEditor.categoryId,
          status: faqEditor.status,
          visibility: faqEditor.visibility,
        });
      }
      notifySuccess("FAQ saved.");
      setFaqEditorOpen(false);
      setFaqEditorId(null);
      setFaqEditor(createInitialFaqEditor());
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save FAQ.");
    } finally {
      setFaqEditorSubmitting(false);
    }
  };

  const submitVideo = async () => {
    if (!videoEditor.title.trim() || !videoEditor.url.trim() || !videoEditor.categoryId) {
      notifyError("Title, URL and category are required.");
      return;
    }
    setVideoEditorSubmitting(true);
    try {
      if (videoEditorId) {
        await updateVideo(videoEditorId, { ...videoEditor });
      } else {
        await createVideo({ ...videoEditor });
      }
      notifySuccess("Video saved.");
      setVideoEditorOpen(false);
      setVideoEditorId(null);
      setVideoEditor(createInitialVideoEditor());
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save video.");
    } finally {
      setVideoEditorSubmitting(false);
    }
  };

  const submitCategory = async () => {
    if (!categoryNameInput.trim()) {
      notifyError("Category name is required.");
      return;
    }
    setCategoryDialogSubmitting(true);
    try {
      if (categoryDialogId) {
        await updateCategory(categoryDialogId, { name: categoryNameInput.trim(), icon: categoryIconInput.trim() });
      } else {
        await createCategory({ name: categoryNameInput.trim(), icon: categoryIconInput.trim() });
      }
      notifySuccess("Category saved.");
      setCategoryDialogOpen(false);
      setCategoryDialogId(null);
      setCategoryNameInput("");
      setCategoryIconInput("Folder");
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save category.");
    } finally {
      setCategoryDialogSubmitting(false);
    }
  };

  const moveCategory = async (id: string, direction: "up" | "down") => {
    const ordered = [...categories].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((row) => row.id === id);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      await reorderCategories(ordered.map((row) => row.id));
      notifySuccess("Category order updated.");
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to reorder categories.");
    }
  };

  const saveSupportSettings = async () => {
    setSettingsSubmitting(true);
    try {
      const next = await updateSettings(settings);
      setSettings(next);
      notifySuccess("Support settings saved.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSettingsSubmitting(false);
    }
  };

  const renderTablePagination = (table: ReturnType<typeof useReactTable>) => (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Help Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage categories, articles, FAQs, videos, and support settings.
          </p>
        </div>
        {activeTab === "articles" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openArticleCreate}>
              <Plus className="h-4 w-4" />
              New Article
            </Button>
            <Button variant="outline" onClick={() => notifySuccess("Import started.")}>
              Import
            </Button>
            <Button variant="outline" onClick={() => notifySuccess("Export started.")}>
              Export
            </Button>
          </div>
        )}
        {activeTab === "faqs" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={openFaqCreate}>
              <Plus className="h-4 w-4" />
              New FAQ
            </Button>
            <Button variant="outline" onClick={() => notifySuccess("FAQ export complete.")}>
              Export
            </Button>
          </div>
        )}
        {activeTab === "videos" && (
          <Button onClick={openVideoCreate}>
            <Plus className="h-4 w-4" />
            Add Video
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published Articles</CardDescription>
            <CardTitle>{kpis.publishedArticles}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle>{kpis.drafts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Views</CardDescription>
            <CardTitle>{kpis.views}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Helpful Rate</CardDescription>
            <CardTitle>{kpis.helpfulRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="rounded-xl border bg-white p-2">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {(["overview", "articles", "categories", "faqs", "videos", "settings", "feedback"] as HelpTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              onClick={() => navigate(tabToPath(tab, helpBase))}
              className="capitalize"
            >
              {tab === "faqs" ? "FAQs" : tab}
            </Button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <Card className="border-slate-200">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-slate-600">
              Use the tabs above to manage articles, categories, FAQs, videos, and support settings.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader><CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate(buildHelpPath("articles"))}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Manage Articles
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate(buildHelpPath("faqs"))}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Manage FAQs
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigate(buildHelpPath("settings"))}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Support Settings
                </Button>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader><CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>Article "How to create your first exam" updated 2 hours ago.</li>
                  <li>FAQ "Can I reschedule an exam?" published yesterday.</li>
                  <li>Video "Platform onboarding overview" edited this week.</li>
                </ul>
              </CardContent></Card>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "articles" && (
        <>
          <Card className="border-slate-200">
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-2 lg:grid-cols-6">
                <Select
                  value={articleFilters.status}
                  onValueChange={(value) => setArticleFilters((prev) => ({ ...prev, status: value as ArticleFilterForm["status"] }))}
                >
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={articleFilters.visibility}
                  onValueChange={(value) => setArticleFilters((prev) => ({ ...prev, visibility: value as ArticleFilterForm["visibility"] }))}
                >
                  <SelectTrigger><SelectValue placeholder="Visibility" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="candidate">Candidate</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={articleFilters.categoryId || "all"}
                  onValueChange={(value) => setArticleFilters((prev) => ({ ...prev, categoryId: value === "all" ? "" : value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 rounded-md border px-3">
                  <Switch
                    checked={articleFilters.featuredOnly}
                    onCheckedChange={(checked) => setArticleFilters((prev) => ({ ...prev, featuredOnly: checked }))}
                  />
                  <span className="text-sm">Featured</span>
                </label>
                <Input
                  placeholder="Search title, slug, tag..."
                  value={articleFilters.query}
                  onChange={(e) => setArticleFilters((prev) => ({ ...prev, query: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setAppliedArticleFilters(toArticleApiFilters(articleFilters))}>
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                  <Button variant="outline" onClick={() => setMoreArticleFiltersOpen(true)}>
                    More
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {articleSelectedIds.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/60">
              <CardContent className="flex flex-wrap items-center gap-2 pt-5">
                <span className="text-sm font-medium text-blue-900">{articleSelectedIds.length} selected</span>
                <Button variant="outline" onClick={() => setArticleBulkAction("publish")}>Publish</Button>
                <Button variant="outline" onClick={() => setArticleBulkAction("unpublish")}>Unpublish</Button>
                <Button variant="outline" onClick={() => setArticleBulkAction("change-category")}>Change Category</Button>
                <Button variant="outline" onClick={() => setArticleBulkAction("change-visibility")}>Change Visibility</Button>
                <Button variant="outline" onClick={() => setArticleBulkAction("archive")}>Archive</Button>
                <Button variant="outline" onClick={() => setArticleBulkAction("delete")}>Delete</Button>
                <Button variant="ghost" onClick={() => setArticleSelection({})}>Clear</Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200">
            <CardContent className="pt-5">
              {loadingArticles ? (
                <div className="space-y-3">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ) : articles.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-8 text-center">
                  <FilePlus2 className="h-6 w-6 text-slate-500" />
                  <p className="font-medium text-slate-700">No articles found.</p>
                  <p className="text-sm text-slate-500">Create your first article or clear filters to see results.</p>
                  <Button onClick={openArticleCreate}><Plus className="h-4 w-4" />New Article</Button>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {articleTable.getHeaderGroups().map((group) => (
                          <TableRow key={group.id}>
                            {group.headers.map((header) => (
                              <TableHead key={header.id}>
                                {header.isPlaceholder ? null : (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1"
                                    onClick={header.column.getToggleSortingHandler()}
                                  >
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                  </button>
                                )}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {articleTable.getRowModel().rows.map((row) => (
                          <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {renderTablePagination(articleTable)}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "categories" && (
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Categories</CardTitle>
              <Button
                onClick={() => {
                  setCategoryDialogId(null);
                  setCategoryNameInput("");
                  setCategoryIconInput("Folder");
                  setCategoryDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {categories.length === 0 && (
                  <div className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                    <FolderClosed className="h-6 w-6 text-slate-500" />
                    <p className="font-medium text-slate-700">No categories yet.</p>
                    <p>Create categories to organize articles, FAQs, and videos.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCategoryDialogId(null);
                        setCategoryNameInput("");
                        setCategoryIconInput("Folder");
                        setCategoryDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </div>
                )}
                {categories
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((cat, index) => {
                    const articleCount = articles.filter((article) => article.categoryId === cat.id).length;
                    return (
                      <div key={cat.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                        <div>
                          <p className="font-medium text-slate-800">{cat.name}</p>
                          <p className="text-xs text-slate-500">{cat.icon} - {articleCount} articles</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => void moveCategory(cat.id, "up")} disabled={index === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void moveCategory(cat.id, "down")} disabled={index === categories.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCategoryDialogId(cat.id);
                              setCategoryNameInput(cat.name);
                              setCategoryIconInput(cat.icon);
                              setCategoryDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await deleteCategory(cat.id);
                                notifySuccess("Category deleted.");
                                refresh();
                              } catch (error) {
                                notifyError(error instanceof Error ? error.message : "Unable to delete category.");
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "faqs" && (
        <>
          <Card className="border-slate-200">
            <CardContent className="grid gap-2 pt-6 lg:grid-cols-5">
              <Select value={faqFilters.status} onValueChange={(value) => setFaqFilters((prev) => ({ ...prev, status: value as FaqFilterForm["status"] }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <Select value={faqFilters.visibility} onValueChange={(value) => setFaqFilters((prev) => ({ ...prev, visibility: value as FaqFilterForm["visibility"] }))}>
                <SelectTrigger><SelectValue placeholder="Visibility" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="candidate">Candidate</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              <Select value={faqFilters.categoryId || "all"} onValueChange={(value) => setFaqFilters((prev) => ({ ...prev, categoryId: value === "all" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={faqFilters.query} onChange={(e) => setFaqFilters((prev) => ({ ...prev, query: e.target.value }))} placeholder="Search question..." />
              <Button onClick={() => setAppliedFaqFilters(toFaqApiFilters(faqFilters))}>
                <Search className="h-4 w-4" />
                Search
              </Button>
            </CardContent>
          </Card>

          {faqSelectedIds.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/60">
              <CardContent className="flex flex-wrap items-center gap-2 pt-5">
                <span className="text-sm font-medium text-blue-900">{faqSelectedIds.length} selected</span>
                <Button variant="outline" onClick={() => setFaqBulkAction("publish")}>Publish</Button>
                <Button variant="outline" onClick={() => setFaqBulkAction("unpublish")}>Unpublish</Button>
                <Button variant="ghost" onClick={() => setFaqSelection({})}>Clear</Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200">
            <CardContent className="pt-5">
              {loadingFaqs ? (
                <div className="space-y-3">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {faqTable.getHeaderGroups().map((group) => (
                          <TableRow key={group.id}>
                            {group.headers.map((header) => (
                              <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {faqTable.getRowModel().rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center">
                              <div className="flex flex-col items-center gap-2 py-6 text-sm text-slate-600">
                                <p className="font-medium text-slate-700">No FAQs found.</p>
                                <p>Create FAQs to answer common candidate questions.</p>
                                <Button variant="outline" size="sm" onClick={openFaqCreate}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add FAQ
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          faqTable.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {renderTablePagination(faqTable)}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "videos" && (
        <>
          <Card className="border-slate-200">
            <CardContent className="grid gap-2 pt-6 lg:grid-cols-4">
              <Select value={videoFilters.status} onValueChange={(value) => setVideoFilters((prev) => ({ ...prev, status: value as VideoFilterForm["status"] }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
              <Select value={videoFilters.categoryId || "all"} onValueChange={(value) => setVideoFilters((prev) => ({ ...prev, categoryId: value === "all" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={videoFilters.query} onChange={(e) => setVideoFilters((prev) => ({ ...prev, query: e.target.value }))} placeholder="Search video..." />
              <Button onClick={() => setAppliedVideoFilters(toVideoApiFilters(videoFilters))}>
                <Search className="h-4 w-4" />
                Search
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="pt-5">
              {loadingVideos ? (
                <div className="space-y-3">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        {videoTable.getHeaderGroups().map((group) => (
                          <TableRow key={group.id}>
                            {group.headers.map((header) => (
                              <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {videoTable.getRowModel().rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">
                              <div className="flex flex-col items-center gap-2 py-6 text-sm text-slate-600">
                                <p className="font-medium text-slate-700">No videos found.</p>
                                <p>Add tutorial videos to guide candidates and proctors.</p>
                                <Button variant="outline" size="sm" onClick={openVideoCreate}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Video
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          videoTable.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {renderTablePagination(videoTable)}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "settings" && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Support Settings</CardTitle>
            <CardDescription>Configure support contact channels and SLA details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSettings ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {!(settings.supportEmail?.trim() ||
                  settings.supportPhone?.trim() ||
                  settings.supportHours?.trim() ||
                  settings.slaText?.trim()) && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-700">No support details configured yet.</p>
                    <p className="mt-1">
                      Add support email, hours, and SLA text to show help contacts to candidates.
                    </p>
                  </div>
                )}
                <div className="rounded-md border p-4 text-sm text-slate-700">
                  <p className="font-medium text-slate-800">Public support preview</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p>Email: {settings.supportEmail || "Not set"}</p>
                    <p>Phone: {settings.supportPhone || "Not set"}</p>
                    <p>Hours: {settings.supportHours || "Not set"}</p>
                    <p>Chat link: {settings.chatLink ? "Enabled" : "Not set"}</p>
                    <p>Ticket link: {settings.ticketLink ? "Enabled" : "Not set"}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Support Email</Label>
                    <Input value={settings.supportEmail} onChange={(e) => setSettings((prev) => ({ ...prev, supportEmail: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Support Phone</Label>
                    <Input value={settings.supportPhone} onChange={(e) => setSettings((prev) => ({ ...prev, supportPhone: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Support Hours</Label>
                  <Input value={settings.supportHours} onChange={(e) => setSettings((prev) => ({ ...prev, supportHours: e.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Chat Link</Label>
                    <Input value={settings.chatLink} disabled />
                    <p className="text-xs text-slate-500">Managed in Site Settings.</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Ticket Link</Label>
                    <Input value={settings.ticketLink} disabled />
                    <p className="text-xs text-slate-500">Managed in Site Settings.</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>SLA Text</Label>
                  <Textarea value={settings.slaText} onChange={(e) => setSettings((prev) => ({ ...prev, slaText: e.target.value }))} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void saveSupportSettings()} disabled={settingsSubmitting}>
                    {settingsSubmitting ? "Saving..." : "Save"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "feedback" && (
        <Card className="border-slate-200">
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-slate-600">Feedback module is optional. This section lists incoming ratings when available.</p>
            {feedbackItems.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-700">No feedback received yet.</p>
                <p className="mt-1">Collect ratings on published articles to populate this view.</p>
              </div>
            ) : (
              <Accordion type="single" collapsible>
                {feedbackItems.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger>{item.title}</AccordionTrigger>
                    <AccordionContent>{item.detail}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={moreArticleFiltersOpen} onOpenChange={setMoreArticleFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>More Filters</SheetTitle>
            <SheetDescription>Filter by updated range and author.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label>Updated From</Label>
              <Input
                type="date"
                value={articleFilters.updatedFrom}
                onChange={(e) => setArticleFilters((prev) => ({ ...prev, updatedFrom: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Updated To</Label>
              <Input
                type="date"
                value={articleFilters.updatedTo}
                onChange={(e) => setArticleFilters((prev) => ({ ...prev, updatedTo: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Created By</Label>
              <Input
                value={articleFilters.createdBy}
                onChange={(e) => setArticleFilters((prev) => ({ ...prev, createdBy: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMoreArticleFiltersOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setAppliedArticleFilters(toArticleApiFilters(articleFilters));
                  setMoreArticleFiltersOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(articleBulkAction)} onOpenChange={(open) => !open && setArticleBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Article Action</DialogTitle>
            <DialogDescription>Apply action to {articleSelectedIds.length} selected article(s).</DialogDescription>
          </DialogHeader>
          {articleBulkAction === "change-category" && (
            <div className="grid gap-2">
              <Label>Target Category</Label>
              <Select value={articleBulkCategoryId} onValueChange={setArticleBulkCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {articleBulkAction === "change-visibility" && (
            <div className="grid gap-2 rounded-md border p-3">
              {(["admin", "teacher", "candidate", "public"] as HelpVisibility[]).map((role) => (
                <label key={role} className="flex items-center justify-between gap-2">
                  <span className="text-sm capitalize">{role}</span>
                  <Checkbox
                    checked={articleBulkVisibility.includes(role)}
                    onCheckedChange={(checked) =>
                      setArticleBulkVisibility((prev) =>
                        toBoolean(checked)
                          ? prev.includes(role)
                            ? prev
                            : [...prev, role]
                          : prev.filter((item) => item !== role)
                      )
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={() => void executeArticleBulkAction()} disabled={articleBulkSubmitting}>
              {articleBulkSubmitting ? "Processing..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(faqBulkAction)} onOpenChange={(open) => !open && setFaqBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk FAQ Action</DialogTitle>
            <DialogDescription>Apply action to {faqSelectedIds.length} selected FAQ(s).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqBulkAction(null)}>
              Cancel
            </Button>
            <Button onClick={() => void executeFaqBulkAction()} disabled={faqBulkSubmitting}>
              {faqBulkSubmitting ? "Processing..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialogId ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>Category helps organize articles, FAQs, and videos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={categoryNameInput} onChange={(e) => setCategoryNameInput(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Icon</Label>
              <Input value={categoryIconInput} onChange={(e) => setCategoryIconInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitCategory()} disabled={categoryDialogSubmitting}>
              {categoryDialogSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={articlePreviewOpen} onOpenChange={setArticlePreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview Article</DialogTitle>
            <DialogDescription>Preview how this article appears by role visibility.</DialogDescription>
          </DialogHeader>
          {articlePreviewItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Role</Label>
                <Select value={articlePreviewRole} onValueChange={(value) => setArticlePreviewRole(value as PreviewRole)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="candidate">Candidate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {articlePreviewItem.visibility.includes(articlePreviewRole) || articlePreviewItem.visibility.includes("public") ? (
                <div className="rounded-md border p-4">
                  <h3 className="text-lg font-semibold">{articlePreviewItem.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{articlePreviewItem.summary}</p>
                  <Separator className="my-3" />
                  <article
                    className="prose max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(articlePreviewItem.content) }}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  This role does not have visibility to this article.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={articleDeleteOpen} onOpenChange={setArticleDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!articleDeleteId) return;
                setArticleDeleteSubmitting(true);
                try {
                  await deleteArticle(articleDeleteId);
                  notifySuccess("Article deleted.");
                  setArticleDeleteOpen(false);
                  setArticleDeleteId(null);
                  refresh();
                } catch (error) {
                  notifyError(error instanceof Error ? error.message : "Unable to delete article.");
                } finally {
                  setArticleDeleteSubmitting(false);
                }
              }}
              disabled={articleDeleteSubmitting}
            >
              {articleDeleteSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={articleEditorOpen} onOpenChange={setArticleEditorOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[920px]">
          <SheetHeader>
            <SheetTitle>{articleEditorId ? "Edit Article" : "New Article"}</SheetTitle>
            <SheetDescription>Write, preview, and control article visibility.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">1) Basics</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Title*</Label>
                  <Input
                    value={articleEditor.title}
                    onChange={(e) =>
                      setArticleEditor((prev) => ({
                        ...prev,
                        title: e.target.value,
                        slug: prev.slugEdited ? prev.slug : e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Slug</Label>
                  <Input
                    value={articleEditor.slug}
                    onChange={(e) => setArticleEditor((prev) => ({ ...prev, slug: e.target.value, slugEdited: true }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category*</Label>
                  <Select value={articleEditor.categoryId} onValueChange={(value) => setArticleEditor((prev) => ({ ...prev, categoryId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Quick add category</Label>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCategoryDialogId(null);
                      setCategoryNameInput("");
                      setCategoryIconInput("Folder");
                      setCategoryDialogOpen(true);
                    }}
                  >
                    <FolderClosed className="mr-2 h-4 w-4" />
                    Add Category
                  </Button>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Summary</Label>
                  <Textarea value={articleEditor.summary} onChange={(e) => setArticleEditor((prev) => ({ ...prev, summary: e.target.value }))} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">2) Content</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setArticleEditor((prev) => ({ ...prev, content: `${prev.content} **bold**` }))}>Bold</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setArticleEditor((prev) => ({ ...prev, content: `${prev.content} *italic*` }))}>Italic</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setArticleEditor((prev) => ({ ...prev, content: `${prev.content} [link](https://)` }))}>Link</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setArticleEditor((prev) => ({ ...prev, content: `${prev.content} \`code\`` }))}>Code</Button>
                  </div>
                  <Textarea
                    className="min-h-[280px]"
                    value={articleEditor.content}
                    onChange={(e) => setArticleEditor((prev) => ({ ...prev, content: e.target.value }))}
                  />
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Live preview</p>
                  <Separator className="my-2" />
                  <article
                    className="prose max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(articleEditor.content || "_No content yet_") }}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">3) Publishing</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={articleEditor.status} onValueChange={(value) => setArticleEditor((prev) => ({ ...prev, status: value as ArticleStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 rounded-md border px-3">
                  <Switch checked={articleEditor.featured} onCheckedChange={(checked) => setArticleEditor((prev) => ({ ...prev, featured: checked }))} />
                  <span className="text-sm">Featured</span>
                </div>
              </div>
              <div className="grid gap-2 rounded-md border p-3">
                <Label>Visibility</Label>
                {(["admin", "teacher", "candidate", "public"] as HelpVisibility[]).map((role) => (
                  <label key={role} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{role}</span>
                    <Checkbox
                      checked={articleEditor.visibility.includes(role)}
                      onCheckedChange={(checked) =>
                        setArticleEditor((prev) => ({
                          ...prev,
                          visibility: toBoolean(checked)
                            ? prev.visibility.includes(role)
                              ? prev.visibility
                              : [...prev.visibility, role]
                            : prev.visibility.filter((item) => item !== role),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={articleEditor.tagInput}
                    placeholder="Add tag"
                    onChange={(e) => setArticleEditor((prev) => ({ ...prev, tagInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && articleEditor.tagInput.trim()) {
                        e.preventDefault();
                        setArticleEditor((prev) => ({
                          ...prev,
                          tags: prev.tags.includes(prev.tagInput.trim()) ? prev.tags : [...prev.tags, prev.tagInput.trim()],
                          tagInput: "",
                        }));
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setArticleEditor((prev) => ({
                        ...prev,
                        tags: prev.tagInput.trim()
                          ? prev.tags.includes(prev.tagInput.trim())
                            ? prev.tags
                            : [...prev.tags, prev.tagInput.trim()]
                          : prev.tags,
                        tagInput: "",
                      }))
                    }
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {articleEditor.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => setArticleEditor((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }))}
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setArticleEditorOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => void saveArticle("draft")} disabled={articleEditorSubmitting}>Save Draft</Button>
            <Button onClick={() => void saveArticle("publish")} disabled={articleEditorSubmitting}>Publish</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={faqEditorOpen} onOpenChange={setFaqEditorOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[820px]">
          <SheetHeader>
            <SheetTitle>{faqEditorId ? "Edit FAQ" : "New FAQ"}</SheetTitle>
            <SheetDescription>Create and manage Help Center FAQ entries.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Question*</Label>
                <Input
                  value={faqEditor.question}
                  onChange={(e) => setFaqEditor((prev) => ({ ...prev, question: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Answer*</Label>
                <Textarea
                  className="min-h-[240px]"
                  value={faqEditor.answer}
                  onChange={(e) => setFaqEditor((prev) => ({ ...prev, answer: e.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Category*</Label>
                  <Select
                    value={faqEditor.categoryId}
                    onValueChange={(value) => setFaqEditor((prev) => ({ ...prev, categoryId: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={faqEditor.status}
                    onValueChange={(value) => setFaqEditor((prev) => ({ ...prev, status: value as "draft" | "published" }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 rounded-md border p-3">
                <Label>Visibility</Label>
                {(["admin", "teacher", "candidate", "public"] as HelpVisibility[]).map((role) => (
                  <label key={role} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{role}</span>
                    <Checkbox
                      checked={faqEditor.visibility.includes(role)}
                      onCheckedChange={(checked) =>
                        setFaqEditor((prev) => ({
                          ...prev,
                          visibility: toBoolean(checked)
                            ? prev.visibility.includes(role)
                              ? prev.visibility
                              : [...prev.visibility, role]
                            : prev.visibility.filter((item) => item !== role),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Markdown preview</p>
              <Separator className="my-2" />
              <h4 className="text-sm font-semibold text-slate-800">{faqEditor.question || "Question preview"}</h4>
              <article
                className="prose mt-2 max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(faqEditor.answer || "_No answer yet_") }}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setFaqEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitFaq()} disabled={faqEditorSubmitting}>
              {faqEditorSubmitting ? "Saving..." : "Save FAQ"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={videoEditorOpen} onOpenChange={setVideoEditorOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[760px]">
          <SheetHeader>
            <SheetTitle>{videoEditorId ? "Edit Video" : "Add Video"}</SheetTitle>
            <SheetDescription>Manage Help Center tutorial videos.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label>Title*</Label>
              <Input
                value={videoEditor.title}
                onChange={(e) => setVideoEditor((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Video URL*</Label>
              <Input
                value={videoEditor.url}
                onChange={(e) => setVideoEditor((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category*</Label>
                <Select
                  value={videoEditor.categoryId}
                  onValueChange={(value) => setVideoEditor((prev) => ({ ...prev, categoryId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Duration</Label>
                <Input
                  value={videoEditor.duration}
                  onChange={(e) => setVideoEditor((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="08:30"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Thumbnail URL</Label>
                <Input
                  value={videoEditor.thumbnailUrl}
                  onChange={(e) => setVideoEditor((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={videoEditor.status}
                  onValueChange={(value) => setVideoEditor((prev) => ({ ...prev, status: value as "published" | "hidden" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border p-3 text-sm text-slate-600">
              Tip: Use embeddable URLs for best preview compatibility.
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setVideoEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitVideo()} disabled={videoEditorSubmitting}>
              {videoEditorSubmitting ? "Saving..." : "Save Video"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={videoPreviewOpen} onOpenChange={setVideoPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Video Preview</DialogTitle>
            <DialogDescription>Preview embedded Help Center video.</DialogDescription>
          </DialogHeader>
          <div className="aspect-video overflow-hidden rounded-md border bg-slate-100">
            {videoPreviewUrl ? (
              <iframe
                src={videoPreviewUrl}
                title="Video preview"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">No preview URL provided.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(articleIdParam)}
        onOpenChange={(open) => {
          if (!open) navigate(buildHelpPath("articles"));
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[880px]">
          <SheetHeader>
            <SheetTitle>Article Details</SheetTitle>
            <SheetDescription>Review metadata, revisions, analytics, and related FAQs.</SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : detailArticle ? (
            <div className="mt-6 space-y-5">
              <Card>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{detailArticle.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{detailArticle.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(detailArticle.status)}>{detailArticle.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          openArticleEdit(detailArticle);
                          navigate(buildHelpPath("articles"));
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detailArticle.visibility.map((role) => (
                      <Badge key={role} variant={visibilityBadgeVariant(role)}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Updated {format(new Date(detailArticle.updatedAt), "PPpp")} by {detailArticle.createdBy}
                  </p>
                </CardContent>
              </Card>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="revisions">Revisions</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="linked-faqs">Linked FAQs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                  <Card>
                    <CardContent className="space-y-3 pt-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Slug: {detailArticle.slug}</Badge>
                        {detailArticle.featured && <Badge variant="success-light">Featured</Badge>}
                      </div>
                      <article
                        className="prose max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: markdownToHtml(detailArticle.content) }}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="revisions" className="mt-4">
                  <Card>
                    <CardContent className="pt-5">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Revision</TableHead>
                              <TableHead>Saved At</TableHead>
                              <TableHead>Saved By</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailRevisions.map((revision) => (
                              <TableRow key={revision.id}>
                                <TableCell>{revision.label}</TableCell>
                                <TableCell>{format(new Date(revision.savedAt), "PPpp")}</TableCell>
                                <TableCell>{revision.savedBy}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Views</CardDescription>
                        <CardTitle>{detailArticle.views}</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Helpful Rate</CardDescription>
                        <CardTitle>{detailArticle.helpfulRate}%</CardTitle>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Visibility Audience</CardDescription>
                        <CardTitle>{detailArticle.visibility.length}</CardTitle>
                      </CardHeader>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="linked-faqs" className="mt-4">
                  <Card>
                    <CardContent className="pt-5">
                      {detailLinkedFaqs.length === 0 ? (
                        <p className="text-sm text-slate-600">No related FAQs found by category/tags.</p>
                      ) : (
                        <div className="space-y-2">
                          {detailLinkedFaqs.map((faq) => (
                            <div key={faq.id} className="rounded-md border p-3">
                              <p className="font-medium text-slate-800">{faq.question}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {categoriesById.get(faq.categoryId)?.name ?? "Unknown category"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Article not found.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
