import { useEffect, useMemo, useRef, useState } from "react";
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
import { format, formatDistanceToNowStrict, isToday } from "date-fns";
import {
  Archive,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FilePlus2,
  MoreHorizontal,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Share2,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  archiveExam,
  assignCandidates,
  assignGroups,
  deleteExam,
  duplicateExam,
  getExamLookups,
  importExamsFromCsv,
  listExams,
  listPurchasesByExam,
  publishExam,
  regenerateLink,
  updateExam,
  unpublishExam,
} from "@/lib/exams-module-api";
import type {
  AdminExam,
  ExamCandidate,
  ExamGroup,
  ExamListFilters,
  ExamStatus,
} from "@/lib/exams-module-types";

type BulkAction = "publish" | "unpublish" | "archive" | "delete" | "export" | null;

type FiltersForm = {
  status: "all" | ExamStatus;
  type: "all" | "group" | "link" | "series";
  pricing: "all" | "free" | "demo" | "paid";
  schedule: "any" | "today" | "next_7_days" | "next_30_days" | "completed_last_30_days";
  groupId: string;
  query: string;
  createdBy: string;
  minDuration: string;
  maxDuration: string;
  storefront: "all" | "visible" | "hidden";
  securityPreset: "all" | "basic" | "strict";
};

const defaultFilters: FiltersForm = {
  status: "all",
  type: "all",
  pricing: "all",
  schedule: "any",
  groupId: "",
  query: "",
  createdBy: "",
  minDuration: "",
  maxDuration: "",
  storefront: "all",
  securityPreset: "all",
};

const toBoolean = (value: CheckedState) => value === true;

function toApiFilters(form: FiltersForm): ExamListFilters {
  return {
    status: form.status,
    type: form.type,
    pricing: form.pricing,
    schedule: form.schedule,
    groupId: form.groupId || undefined,
    query: form.query || undefined,
    createdBy: form.createdBy || undefined,
    minDuration: form.minDuration ? Number(form.minDuration) : undefined,
    maxDuration: form.maxDuration ? Number(form.maxDuration) : undefined,
    storefront: form.storefront,
    securityPreset: form.securityPreset,
  };
}

function statusBadge(status: ExamStatus) {
  if (status === "published") return <Badge variant="success-light">Published</Badge>;
  if (status === "running") return <Badge variant="warning-light">Running</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  if (status === "archived") return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function examTypeChip(type: AdminExam["type"]) {
  if (type === "group") return <Badge variant="outline">Group</Badge>;
  if (type === "link") return <Badge variant="warning-light">Link</Badge>;
  return <Badge variant="secondary">Series</Badge>;
}

function formatCurrencyValue(amount: number, currency: AdminExam["pricing"]["currency"]) {
  return `${currency} ${amount.toLocaleString()}`;
}

function pricingBadge(exam: AdminExam) {
  if (exam.pricing.mode === "PAID") {
    return (
      <div className="space-y-1">
        <Badge variant="warning-light">PAID</Badge>
        <p className="text-xs text-slate-600">{formatCurrencyValue(exam.pricing.price ?? 0, exam.pricing.currency)}</p>
      </div>
    );
  }
  if (exam.pricing.isDemo) return <Badge variant="secondary">DEMO</Badge>;
  return <Badge variant="outline">FREE</Badge>;
}

function getScheduleText(exam: AdminExam) {
  if (exam.availability.mode === "always") return "Always";
  if (exam.availability.mode === "dailySlot") {
    return `Daily ${exam.availability.startTime ?? "--"} - ${exam.availability.endTime ?? "--"}`;
  }
  if (exam.availability.startAt && exam.availability.endAt) {
    const start = new Date(exam.availability.startAt);
    const end = new Date(exam.availability.endAt);
    const startLabel = isToday(start) ? `Today ${format(start, "p")}` : format(start, "MMM d, p");
    const endLabel = format(end, "MMM d, p");
    return `${startLabel} - ${endLabel}`;
  }
  return "Scheduled";
}

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function ExamsPage() {
  const navigate = useNavigate();

  const [groups, setGroups] = useState<ExamGroup[]>([]);
  const [candidates, setCandidates] = useState<ExamCandidate[]>([]);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [allExams, setAllExams] = useState<AdminExam[]>([]);
  const [salesByExam, setSalesByExam] = useState<Record<string, { count: number; revenue: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filters, setFilters] = useState<FiltersForm>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ExamListFilters>(() => toApiFilters(defaultFilters));
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });

  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [deleteExamId, setDeleteExamId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [pricingDialog, setPricingDialog] = useState<{ exam: AdminExam; action: "to_paid" | "to_free" } | null>(null);
  const [pricingSubmitting, setPricingSubmitting] = useState(false);

  const [assignExamId, setAssignExamId] = useState<string | null>(null);
  const [assignGroupIds, setAssignGroupIds] = useState<string[]>([]);
  const [assignCandidateIds, setAssignCandidateIds] = useState<string[]>([]);
  const [assignTarget, setAssignTarget] = useState<"groups" | "candidates">("groups");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  const refresh = () => setRefreshKey((prev) => prev + 1);

  const selectedIds = useMemo(
    () => Object.entries(selection).filter(([, checked]) => checked).map(([id]) => id),
    [selection]
  );

  const selectedRows = useMemo(
    () => exams.filter((exam) => selectedIds.includes(exam.id)),
    [exams, selectedIds]
  );

  const filteredCandidates = useMemo(() => {
    if (!candidateSearch.trim()) return candidates;
    const q = candidateSearch.toLowerCase();
    return candidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(q) ||
        candidate.email.toLowerCase().includes(q) ||
        candidate.phone.toLowerCase().includes(q)
    );
  }, [candidateSearch, candidates]);

  const counts = useMemo(
    () => ({
      draft: allExams.filter((item) => item.status === "draft").length,
      published: allExams.filter((item) => item.status === "published").length,
      running: allExams.filter((item) => item.status === "running").length,
      completed: allExams.filter((item) => item.status === "completed").length,
    }),
    [allExams]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [lookups, filteredRows, fullRows] = await Promise.all([
        getExamLookups(),
        listExams(appliedFilters),
        listExams(),
      ]);
      const salesEntries = await Promise.all(
        fullRows.map(async (exam) => {
          try {
            const purchases = await listPurchasesByExam(exam.id);
            const revenue = purchases
              .filter((row) => row.status === "paid")
              .reduce((sum, row) => sum + row.amount, 0);
            return [exam.id, { count: purchases.length, revenue }] as const;
          } catch {
            return [exam.id, { count: 0, revenue: 0 }] as const;
          }
        })
      );
      setGroups(lookups.groups);
      setCandidates(lookups.candidates);
      setExams(filteredRows);
      setAllExams(fullRows);
      setSalesByExam(Object.fromEntries(salesEntries));
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load exams.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [appliedFilters, refreshKey]);

  const columns = useMemo<ColumnDef<AdminExam>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(toBoolean(value))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(toBoolean(value))}
            aria-label={`Select ${row.original.name}`}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Exam",
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="font-medium text-slate-900">{row.original.name}</p>
            <p className="text-xs text-slate-500">
              Category: {row.original.category || "Uncategorized"}
            </p>
            <div className="flex items-center gap-1">{examTypeChip(row.original.type)}</div>
          </div>
        ),
      },
      {
        id: "schedule",
        header: "Schedule",
        cell: ({ row }) => <span className="text-sm text-slate-700">{getScheduleText(row.original)}</span>,
      },
      {
        accessorKey: "durationMinutes",
        header: "Duration",
        cell: ({ row }) => `${row.original.durationMinutes} min`,
      },
      {
        id: "pricing",
        header: "Pricing",
        cell: ({ row }) => pricingBadge(row.original),
      },
      {
        id: "candidates",
        header: "Candidates",
        cell: ({ row }) => (
          <div className="text-sm">
            <span className="font-medium text-slate-800">{row.original.candidateMetrics.invited}</span>
            <span className="text-slate-500"> invited</span>
            <br />
            <span className="font-medium text-slate-700">{row.original.candidateMetrics.attempted}</span>
            <span className="text-slate-500"> attempted</span>
          </div>
        ),
      },
      {
        id: "sales",
        header: "Sales",
        cell: ({ row }) => <span className="text-sm text-slate-700">{salesByExam[row.original.id]?.count ?? 0}</span>,
      },
      {
        id: "revenue",
        header: "Revenue",
        cell: ({ row }) => {
          if (row.original.pricing.mode !== "PAID") return <span className="text-sm text-slate-400">-</span>;
          return (
            <span className="text-sm font-medium text-slate-800">
              {formatCurrencyValue(salesByExam[row.original.id]?.revenue ?? 0, row.original.pricing.currency)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        accessorKey: "updatedAt",
        header: "Last Updated",
        cell: ({ row }) =>
          formatDistanceToNowStrict(new Date(row.original.updatedAt), { addSuffix: true }),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const exam = row.original;
          const canShare = exam.type === "link";
          const canAssign = exam.type === "group";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(`/admin/exams/${exam.id}`)}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/admin/exams/${exam.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      const dup = await duplicateExam(exam.id);
                      notifySuccess(`Duplicated as ${dup.name}`);
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to duplicate exam.");
                    }
                  }}
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      if (exam.status === "published") {
                        await unpublishExam(exam.id);
                        notifySuccess("Exam moved to draft.");
                      } else {
                        await publishExam(exam.id);
                        notifySuccess("Exam published.");
                      }
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to update status.");
                    }
                  }}
                >
                  {exam.status === "published" ? "Unpublish" : "Publish"}
                </DropdownMenuItem>
                {exam.pricing.mode === "PAID" && (
                  <DropdownMenuItem onClick={() => navigate(`/admin/exams/${exam.id}?tab=sales`)}>
                    View Sales
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await updateExam(exam.id, {
                        pricing: {
                          ...exam.pricing,
                          showOnStorefront: !exam.pricing.showOnStorefront,
                        },
                      });
                      notifySuccess(
                        exam.pricing.showOnStorefront
                          ? "Exam hidden from storefront."
                          : "Exam visible on storefront."
                      );
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to update storefront visibility.");
                    }
                  }}
                >
                  {exam.pricing.showOnStorefront ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {exam.pricing.showOnStorefront ? "Hide on Storefront" : "Show on Storefront"}
                </DropdownMenuItem>
                {exam.pricing.mode === "PAID" ? (
                  <DropdownMenuItem onClick={() => setPricingDialog({ exam, action: "to_free" })}>
                    Convert to Free...
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setPricingDialog({ exam, action: "to_paid" })}>
                    Convert to Paid...
                  </DropdownMenuItem>
                )}
                {canShare && (
                  <>
                    <DropdownMenuItem
                      onClick={async () => {
                        const link = exam.access.linkSettings?.shareLink;
                        if (!link) {
                          notifyError("Share link not available.");
                          return;
                        }
                        const copied = await copyText(link);
                        if (copied) notifySuccess("Share link copied.");
                        else notifyError("Clipboard permission denied.");
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Share (Copy Link)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const newLink = await regenerateLink(exam.id);
                          const copied = await copyText(newLink);
                          if (copied) notifySuccess("Link regenerated and copied.");
                          else notifySuccess("Link regenerated.");
                          refresh();
                        } catch (error) {
                          notifyError(error instanceof Error ? error.message : "Unable to regenerate link.");
                        }
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Regenerate Link
                    </DropdownMenuItem>
                  </>
                )}
                {canAssign && (
                  <DropdownMenuItem
                    onClick={() => {
                      setAssignExamId(exam.id);
                      setAssignGroupIds(exam.access.groupIds);
                      setAssignCandidateIds(exam.access.candidateIds);
                      setAssignTarget(exam.access.targetType === "candidates" ? "candidates" : "groups");
                    }}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Assign
                  </DropdownMenuItem>
                )}
                {exam.status === "running" && (
                  <DropdownMenuItem onClick={() => navigate(`/admin/exams/${exam.id}/monitor`)}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Monitor
                  </DropdownMenuItem>
                )}
                {exam.status === "completed" && (
                  <DropdownMenuItem onClick={() => navigate(`/admin/exams/${exam.id}/results`)}>
                    Results
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await archiveExam(exam.id);
                      notifySuccess("Exam archived.");
                      refresh();
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to archive exam.");
                    }
                  }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => setDeleteExamId(exam.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, notifyError, notifySuccess, refresh, salesByExam]
  );

  const table = useReactTable({
    data: exams,
    columns,
    state: { sorting, rowSelection: selection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const runBulkAction = async () => {
    if (!bulkAction || selectedRows.length === 0) {
      notifyError("Select one or more exams.");
      return;
    }
    setBulkSubmitting(true);
    try {
      if (bulkAction === "publish") {
        await Promise.all(selectedRows.map((exam) => publishExam(exam.id)));
        notifySuccess("Selected exams published.");
      } else if (bulkAction === "unpublish") {
        await Promise.all(selectedRows.map((exam) => unpublishExam(exam.id)));
        notifySuccess("Selected exams moved to draft.");
      } else if (bulkAction === "archive") {
        await Promise.all(selectedRows.map((exam) => archiveExam(exam.id)));
        notifySuccess("Selected exams archived.");
      } else if (bulkAction === "delete") {
        await Promise.all(selectedRows.map((exam) => deleteExam(exam.id)));
        notifySuccess("Selected exams deleted.");
      } else if (bulkAction === "export") {
        const rows = [
          ["Name", "Type", "Pricing", "Status", "Duration", "Invited", "Attempted", "Sales", "Revenue", "Updated"],
          ...selectedRows.map((row) => [
            row.name,
            row.type,
            row.pricing.mode === "PAID" ? `PAID ${formatCurrencyValue(row.pricing.price ?? 0, row.pricing.currency)}` : row.pricing.isDemo ? "DEMO" : "FREE",
            row.status,
            String(row.durationMinutes),
            String(row.candidateMetrics.invited),
            String(row.candidateMetrics.attempted),
            String(salesByExam[row.id]?.count ?? 0),
            row.pricing.mode === "PAID"
              ? formatCurrencyValue(salesByExam[row.id]?.revenue ?? 0, row.pricing.currency)
              : "-",
            row.updatedAt,
          ]),
        ];
        downloadCsv("selected-exams.csv", rows);
        notifySuccess("Selected exams exported.");
      }
      setBulkAction(null);
      setSelection({});
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Bulk action failed.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const submitAssign = async () => {
    if (!assignExamId) return;
    setAssignSubmitting(true);
    try {
      if (assignTarget === "groups") {
        await assignGroups(assignExamId, assignGroupIds);
        notifySuccess("Groups assigned successfully.");
      } else {
        await assignCandidates(assignExamId, assignCandidateIds);
        notifySuccess("Candidates assigned successfully.");
      }
      setAssignExamId(null);
      refresh();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to assign exam access.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Exams</h1>
          <p className="mt-1 text-sm text-slate-600">Create, publish, monitor, and analyze exams.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/admin/exams/new")}>
            <Plus className="h-4 w-4" />
            Create Exam
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportFile(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Import Exams</DialogTitle>
                <DialogDescription>
                  Upload a CSV with columns: title, type, durationMinutes, pricingMode, price, description. One exam per row.
                </DialogDescription>
              </DialogHeader>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv,application/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setImportFile(f);
                  e.target.value = "";
                }}
              />
              <div
                role="button"
                tabIndex={0}
                className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => importInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && importInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-muted/30"); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-muted/30"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-primary", "bg-muted/30");
                  const f = e.dataTransfer.files?.[0];
                  if (f && (f.name.endsWith(".csv") || f.type === "text/csv" || f.type === "application/csv")) setImportFile(f);
                  else if (f) notifyError("Please use a CSV file.");
                }}
              >
                {importFile ? (
                  <span className="font-medium text-foreground">{importFile.name}</span>
                ) : (
                  "Drag & drop a CSV here, or click to browse."
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                <Button
                  disabled={!importFile || importLoading}
                  onClick={async () => {
                    if (!importFile) return;
                    setImportLoading(true);
                    try {
                      const csv = await importFile.text();
                      const result = await importExamsFromCsv(csv);
                      setImportOpen(false);
                      setImportFile(null);
                      refresh();
                      if (result.imported > 0) notifySuccess(`${result.imported} exam(s) imported.`);
                      if (result.errors.length > 0) {
                        const msg = result.errors.slice(0, 5).join("; ") + (result.errors.length > 5 ? ` (+${result.errors.length - 5} more)` : "");
                        notifyError(msg);
                      }
                      if (result.imported === 0 && result.errors.length === 0) notifyError("No valid rows. Check CSV format.");
                    } catch (e) {
                      notifyError(e instanceof Error ? e.message : "Import failed.");
                    } finally {
                      setImportLoading(false);
                    }
                  }}
                >
                  {importLoading ? "Importing…" : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => {
              const rows = [
                ["Name", "Type", "Pricing", "Status", "Duration", "Invited", "Attempted", "Sales", "Revenue", "Updated"],
                ...exams.map((row) => [
                  row.name,
                  row.type,
                  row.pricing.mode === "PAID" ? `PAID ${formatCurrencyValue(row.pricing.price ?? 0, row.pricing.currency)}` : row.pricing.isDemo ? "DEMO" : "FREE",
                  row.status,
                  String(row.durationMinutes),
                  String(row.candidateMetrics.invited),
                  String(row.candidateMetrics.attempted),
                  String(salesByExam[row.id]?.count ?? 0),
                  row.pricing.mode === "PAID"
                    ? formatCurrencyValue(salesByExam[row.id]?.revenue ?? 0, row.pricing.currency)
                    : "-",
                  row.updatedAt,
                ]),
              ];
              downloadCsv("exams-export.csv", rows);
              notifySuccess("Exams exported.");
            }}
          >
            <FileDown className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="cursor-pointer" onClick={() => {
          const next = { ...filters, status: "draft" as const };
          setFilters(next);
          setAppliedFilters(toApiFilters(next));
        }}>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle>{counts.draft}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer" onClick={() => {
          const next = { ...filters, status: "published" as const };
          setFilters(next);
          setAppliedFilters(toApiFilters(next));
        }}>
          <CardHeader className="pb-2">
            <CardDescription>Published</CardDescription>
            <CardTitle>{counts.published}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer" onClick={() => {
          const next = { ...filters, status: "running" as const };
          setFilters(next);
          setAppliedFilters(toApiFilters(next));
        }}>
          <CardHeader className="pb-2">
            <CardDescription>Running</CardDescription>
            <CardTitle>{counts.running}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="cursor-pointer" onClick={() => {
          const next = { ...filters, status: "completed" as const };
          setFilters(next);
          setAppliedFilters(toApiFilters(next));
        }}>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle>{counts.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2 lg:grid-cols-8">
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as FiltersForm["status"] }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value as FiltersForm["type"] }))}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="series">Series</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.pricing} onValueChange={(value) => setFilters((prev) => ({ ...prev, pricing: value as FiltersForm["pricing"] }))}>
              <SelectTrigger><SelectValue placeholder="Pricing" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pricing</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.schedule} onValueChange={(value) => setFilters((prev) => ({ ...prev, schedule: value as FiltersForm["schedule"] }))}>
              <SelectTrigger><SelectValue placeholder="Schedule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="next_7_days">Next 7 days</SelectItem>
                <SelectItem value="next_30_days">Next 30 days</SelectItem>
                <SelectItem value="completed_last_30_days">Completed last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.groupId || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, groupId: value === "all" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              placeholder="Search exam name..."
              className="lg:col-span-2"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setAppliedFilters(toApiFilters(filters))}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" onClick={() => setMoreFiltersOpen(true)}>More Filters</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedRows.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="flex flex-wrap items-center gap-2 pt-5">
            <span className="text-sm font-medium text-blue-900">{selectedRows.length} selected</span>
            <Button variant="outline" onClick={() => setBulkAction("publish")}>Publish</Button>
            <Button variant="outline" onClick={() => setBulkAction("unpublish")}>Unpublish</Button>
            <Button variant="outline" onClick={() => setBulkAction("archive")}>Archive</Button>
            <Button variant="outline" onClick={() => setBulkAction("delete")}>Delete</Button>
            <Button variant="outline" onClick={() => setBulkAction("export")}>Export Selected</Button>
            <Button variant="ghost" onClick={() => setSelection({})}>Clear</Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardContent className="pt-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-8 text-center">
              <FilePlus2 className="h-7 w-7 text-slate-500" />
              <p className="font-medium text-slate-700">No exams match your filters.</p>
              <Button onClick={() => navigate("/admin/exams/new")}>
                <Plus className="h-4 w-4" />
                Create Exam
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((group) => (
                      <TableRow key={group.id}>
                        {group.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : (
                              <button type="button" className="inline-flex items-center gap-1" onClick={header.column.getToggleSortingHandler()}>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </button>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <span>
                  Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>More Filters</SheetTitle>
            <SheetDescription>Filter by creator, duration, storefront visibility, and security preset.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label>Created By</Label>
              <Input value={filters.createdBy} onChange={(e) => setFilters((prev) => ({ ...prev, createdBy: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Min Duration (min)</Label>
                <Input type="number" value={filters.minDuration} onChange={(e) => setFilters((prev) => ({ ...prev, minDuration: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Max Duration (min)</Label>
                <Input type="number" value={filters.maxDuration} onChange={(e) => setFilters((prev) => ({ ...prev, maxDuration: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Storefront</Label>
                <Select value={filters.storefront} onValueChange={(value) => setFilters((prev) => ({ ...prev, storefront: value as FiltersForm["storefront"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="visible">Visible</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Security Preset</Label>
                <Select value={filters.securityPreset} onValueChange={(value) => setFilters((prev) => ({ ...prev, securityPreset: value as FiltersForm["securityPreset"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMoreFiltersOpen(false)}>Cancel</Button>
              <Button onClick={() => { setAppliedFilters(toApiFilters(filters)); setMoreFiltersOpen(false); }}>Apply</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(bulkAction)} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Action</DialogTitle>
            <DialogDescription>Apply <span className="font-semibold">{bulkAction}</span> to {selectedRows.length} selected exam(s)?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button onClick={() => void runBulkAction()} disabled={bulkSubmitting}>{bulkSubmitting ? "Processing..." : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteExamId)} onOpenChange={(open) => !open && setDeleteExamId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteExamId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteExamId) return;
                setDeleteSubmitting(true);
                try {
                  await deleteExam(deleteExamId);
                  notifySuccess("Exam deleted.");
                  setDeleteExamId(null);
                  refresh();
                } catch (error) {
                  notifyError(error instanceof Error ? error.message : "Unable to delete exam.");
                } finally {
                  setDeleteSubmitting(false);
                }
              }}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pricingDialog)} onOpenChange={(open) => !open && setPricingDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pricing Change</DialogTitle>
            <DialogDescription>
              {pricingDialog?.action === "to_paid"
                ? "Convert this exam to PAID mode?"
                : "Convert this exam to FREE mode?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingDialog(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!pricingDialog) return;
                setPricingSubmitting(true);
                try {
                  const currentPricing = pricingDialog.exam.pricing;
                  if (pricingDialog.action === "to_paid") {
                    await updateExam(pricingDialog.exam.id, {
                      pricing: {
                        ...currentPricing,
                        mode: "PAID",
                        isDemo: false,
                        requireLoginForFree: false,
                        price: currentPricing.price && currentPricing.price > 0 ? currentPricing.price : 499,
                        discountPrice: null,
                        validityDays: currentPricing.validityDays,
                        paymentRequiredBeforeStart: true,
                      },
                    });
                    notifySuccess("Pricing changed to PAID.");
                  } else {
                    await updateExam(pricingDialog.exam.id, {
                      pricing: {
                        ...currentPricing,
                        mode: "FREE",
                        isDemo: false,
                        requireLoginForFree: false,
                        price: null,
                        discountPrice: null,
                        validityDays: null,
                        paymentRequiredBeforeStart: false,
                      },
                    });
                    notifySuccess("Pricing changed to FREE.");
                  }
                  setPricingDialog(null);
                  refresh();
                } catch (error) {
                  notifyError(error instanceof Error ? error.message : "Unable to change pricing.");
                } finally {
                  setPricingSubmitting(false);
                }
              }}
              disabled={pricingSubmitting}
            >
              {pricingSubmitting ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignExamId)} onOpenChange={(open) => !open && setAssignExamId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Exam Access</DialogTitle>
            <DialogDescription>Assign groups or individual candidates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={assignTarget === "groups" ? "default" : "outline"} onClick={() => setAssignTarget("groups")}>
                <Users className="h-4 w-4" />
                Groups
              </Button>
              <Button variant={assignTarget === "candidates" ? "default" : "outline"} onClick={() => setAssignTarget("candidates")}>
                <UserCheck className="h-4 w-4" />
                Candidates
              </Button>
            </div>

            {assignTarget === "groups" ? (
              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-md border p-3">
                {groups.map((group) => (
                  <label key={group.id} className="flex items-center justify-between rounded border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{group.name}</p>
                      <p className="text-xs text-slate-500">{group.membersCount} members</p>
                    </div>
                    <Checkbox
                      checked={assignGroupIds.includes(group.id)}
                      onCheckedChange={(checked) =>
                        setAssignGroupIds((prev) =>
                          toBoolean(checked)
                            ? prev.includes(group.id)
                              ? prev
                              : [...prev, group.id]
                            : prev.filter((id) => id !== group.id)
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <Input value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} placeholder="Search candidate..." />
                <div className="grid max-h-64 gap-2 overflow-y-auto">
                  {filteredCandidates.map((candidate) => (
                    <label key={candidate.id} className="flex items-center justify-between rounded border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{candidate.name}</p>
                        <p className="text-xs text-slate-500">{candidate.email}</p>
                      </div>
                      <Checkbox
                        checked={assignCandidateIds.includes(candidate.id)}
                        onCheckedChange={(checked) =>
                          setAssignCandidateIds((prev) =>
                            toBoolean(checked)
                              ? prev.includes(candidate.id)
                                ? prev
                                : [...prev, candidate.id]
                              : prev.filter((id) => id !== candidate.id)
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignExamId(null)}>Cancel</Button>
            <Button onClick={() => void submitAssign()} disabled={assignSubmitting}>
              {assignSubmitting ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
