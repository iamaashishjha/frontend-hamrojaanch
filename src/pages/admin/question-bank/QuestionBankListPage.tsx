import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import DataTable, { ColumnDef } from "@/components/admin/DataTable";
import Modal from "@/components/admin/Modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  createQuestion,
  deleteQuestion,
  importQuestionsCsv,
  listQuestions,
  updateQuestion,
} from "@/lib/question-bank-api";
import type { Question, QuestionFilters } from "@/lib/question-bank-types";

function formatExposure(risk: Question["exposureRisk"]) {
  if (risk === "HIGH") return <Badge variant="danger-light">High</Badge>;
  if (risk === "MEDIUM") return <Badge variant="warning-light">Medium</Badge>;
  return <Badge variant="success-light">Low</Badge>;
}

function typeBadge(type: Question["type"]) {
  const label = type.replace("_", " ");
  return <Badge variant="secondary">{label}</Badge>;
}

function statusBadge(status: Question["status"]) {
  if (status === "ACTIVE") return <Badge variant="success-light">Active</Badge>;
  if (status === "INACTIVE") return <Badge variant="warning-light">Inactive</Badge>;
  return <Badge variant="outline">Archived</Badge>;
}

function pricingBadges(values: Question["allowedPricing"]) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.includes("FREE") && <Badge variant="outline">FREE</Badge>}
      {values.includes("PAID") && <Badge variant="warning-light">PAID</Badge>}
    </div>
  );
}

function proctorBadges(question: Question) {
  return (
    <div className="flex flex-wrap gap-1">
      {question.supportedProctorModes.includes("basic") && <Badge variant="outline">Basic</Badge>}
      {question.supportedProctorModes.includes("strict") && <Badge variant="warning-light">Strict</Badge>}
      {question.supportedProctorModes.includes("strict") && (
        question.isProctorSafe ? (
          <Badge variant="success-light">Proctor-safe</Badge>
        ) : (
          <Badge variant="danger-light">Risky</Badge>
        )
      )}
    </div>
  );
}

export default function QuestionBankListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [catalog, setCatalog] = useState<Question[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 8;
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkCooldownOpen, setBulkCooldownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [query, setQuery] = useState("");
  const [pricing, setPricing] = useState<QuestionFilters["pricing"]>("all");
  const [proctorMode, setProctorMode] = useState<QuestionFilters["proctorMode"]>("any");
  const [proctorSafe, setProctorSafe] = useState<QuestionFilters["proctorSafe"]>("all");
  const [difficulty, setDifficulty] = useState<QuestionFilters["difficulty"]>("all");
  const [subject, setSubject] = useState<QuestionFilters["subject"]>("all");
  const [topic, setTopic] = useState<QuestionFilters["topic"]>("all");
  const [sectionId, setSectionId] = useState<QuestionFilters["sectionId"]>("all");
  const [status, setStatus] = useState<QuestionFilters["status"]>("all");
  const [exposureRisk, setExposureRisk] = useState<QuestionFilters["exposureRisk"]>("all");
  const [cooldown, setCooldown] = useState<QuestionFilters["cooldown"]>("all");
  const [needsReviewFilter, setNeedsReviewFilter] = useState<QuestionFilters["needsReview"]>("all");
  const [tagInput, setTagInput] = useState("");

  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkCooldownDays, setBulkCooldownDays] = useState("7");

  const filters = useMemo<QuestionFilters>(
    () => ({
      query: query.trim() || undefined,
      pricing,
      proctorMode,
      proctorSafe,
      difficulty,
      subject,
      topic,
      sectionId,
      status,
      exposureRisk,
      cooldown,
      needsReview: needsReviewFilter,
      tags: tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    }),
    [
      query,
      pricing,
      proctorMode,
      proctorSafe,
      difficulty,
      subject,
      topic,
      sectionId,
      status,
      exposureRisk,
      cooldown,
      needsReviewFilter,
      tagInput,
    ]
  );

  const subjectOptions = useMemo(() => {
    return Array.from(new Set(catalog.map((question) => question.subject))).filter(Boolean);
  }, [catalog]);

  const topicOptions = useMemo(() => {
    return Array.from(new Set(catalog.map((question) => question.topic))).filter(Boolean);
  }, [catalog]);

  const sectionOptions = useMemo(() => {
    return Array.from(new Set(catalog.map((question) => question.sectionId))).filter(Boolean);
  }, [catalog]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const [rows, catalogRows] = await Promise.all([
        listQuestions(filters),
        listQuestions(),
      ]);
      setQuestions(rows);
      setCatalog(catalogRows);
      setPageIndex(0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to load question bank.";
      const is429 = msg.includes("429");
      toast({
        variant: "destructive",
        title: "Question bank unavailable",
        description: is429
          ? "Too many requests. Wait a minute and try again, or refresh the page."
          : msg,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuestions();
  }, [filters]);

  const pageCount = Math.max(1, Math.ceil(questions.length / pageSize));

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, pageCount - 1));
  }, [pageCount]);

  const pageRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return questions.slice(start, start + pageSize);
  }, [questions, pageIndex, pageSize]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearSelection = () => setSelectedIds([]);

  const bulkUpdate = async (payload: Partial<Question>, successMessage: string) => {
    try {
      await Promise.all(selectedIds.map((id) => updateQuestion(id, payload)));
      toast({ title: "Updated", description: successMessage });
      clearSelection();
      await loadQuestions();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Bulk update failed",
        description: error instanceof Error ? error.message : "Unable to update questions.",
      });
    }
  };

  const BULK_DELETE_BATCH = 25;
  const bulkDeleteIds = async (ids: string[], label: string) => {
    if (!window.confirm(`Delete ${ids.length} question(s)? They will be removed from any exams. This cannot be undone.`)) return;
    try {
      for (let i = 0; i < ids.length; i += BULK_DELETE_BATCH) {
        const chunk = ids.slice(i, i + BULK_DELETE_BATCH);
        await Promise.all(chunk.map((id) => deleteQuestion(id)));
      }
      toast({ title: "Deleted", description: `${ids.length} question(s) removed.` });
      clearSelection();
      await loadQuestions();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete some or all questions.",
      });
    }
  };

  const bulkDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    void bulkDeleteIds(selectedIds, "selected");
  };

  const escapeCsv = (cell: unknown) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`;

  const downloadSampleCsv = () => {
    const header = ["title", "Question", "type", "difficultyLabel", "option_1", "option_2", "option_3", "option_4", "correct_index", "subject", "topic"];
    const sampleRows = [
      ["Addition basic", "What is 2 + 2?", "MCQ_SINGLE", "Easy", "3", "4", "5", "6", "1", "Math", "Arithmetic"],
      ["Capital city", "What is the capital of France?", "MCQ_SINGLE", "Medium", "London", "Paris", "Berlin", "Madrid", "1", "Geography", "Europe"],
    ];
    const csv = [header.map(escapeCsv).join(","), ...sampleRows.map((row) => row.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "question-bank-sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Sample CSV downloaded", description: "Use as template or feed to ChatGPT to generate more questions." });
  };

  const exportSelection = async () => {
    try {
      const toExport = selectedIds.length ? questions.filter((q) => selectedIds.includes(q.id)) : questions;
      const header = ["title", "Question", "type", "difficultyLabel", "option_1", "option_2", "option_3", "option_4", "correct_index", "subject", "topic"];
      const rows = toExport.map((q) => {
        const opts = q.options || [];
        const correctIdx = q.correctAnswers?.length && opts.length
          ? opts.findIndex((o) => q.correctAnswers!.includes(o.label))
          : 0;
        const correctIndex = correctIdx >= 0 ? correctIdx : 0;
        const questionText = q.questionHtml?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || q.title || "";
        return [
          q.title || "",
          questionText,
          q.type || "MCQ_SINGLE",
          q.difficultyLabel || "Medium",
          opts[0]?.text ?? "",
          opts[1]?.text ?? "",
          opts[2]?.text ?? "",
          opts[3]?.text ?? "",
          correctIndex,
          q.subject || "",
          q.topic || "",
        ];
      });
      const csv = [header.map(escapeCsv).join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "question-bank-import-format.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "CSV includes question content. Re-import or use as template for ChatGPT." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export CSV.",
      });
    }
  };

  const columns: ColumnDef<Question>[] = [
    {
      header: "",
      className: "w-[48px]",
      cell: (row) => (
        <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
      ),
    },
    {
      header: "Question",
      cell: (row) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-800">{row.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            {typeBadge(row.type)}
            {row.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      ),
    },
    {
      header: "Difficulty",
      cell: (row) => (
        <div className="space-y-1">
          <p className="text-sm font-medium">{row.difficultyLabel}</p>
          <p className="text-xs text-muted-foreground">Score {row.difficultyScore}/5</p>
        </div>
      ),
    },
    {
      header: "Pricing",
      cell: (row) => pricingBadges(row.allowedPricing),
    },
    {
      header: "Proctor",
      cell: (row) => proctorBadges(row),
    },
    {
      header: "Exposure",
      cell: (row) => (
        <div className="space-y-1">
          {formatExposure(row.exposureRisk)}
          <p className="text-xs text-muted-foreground">{row.timesUsedInExams} used</p>
        </div>
      ),
    },
    {
      header: "Violations",
      cell: (row) => (
        <span className="text-sm font-semibold text-slate-700">{row.proctorViolationsCount}</span>
      ),
    },
    {
      header: "Status / Review",
      cell: (row) => (
        <div className="space-y-1">
          {statusBadge(row.status)}
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {row.needsReview && <Badge variant="warning-light">Needs review</Badge>}
            <span>{row.reviewStatus}</span>
            {row.reviewPriority !== "normal" && (
              <span className="uppercase tracking-wide">
                • {row.reviewPriority === "high" ? "HIGH PRIORITY" : "LOW PRIORITY"}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/question-bank/${row.id}`)}>
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/admin/question-bank/${row.id}/edit`)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const copy = await createQuestion({
                    ...row,
                    title: `${row.title} (Copy)`,
                    status: "INACTIVE",
                  });
                  toast({ title: "Duplicated", description: `Created ${copy.title}.` });
                  await loadQuestions();
                }}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  updateQuestion(row.id, {
                    cooldownUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
                  }).then(loadQuestions)
                }
              >
                Cooldown 7 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateQuestion(row.id, { needsReview: true }).then(loadQuestions)}>
                Mark needs review
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateQuestion(row.id, { excludeFromStrictPools: true }).then(loadQuestions)}
              >
                Exclude from strict pools
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateQuestion(row.id, { status: "ARCHIVED" }).then(loadQuestions)}>
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (!window.confirm("Delete this question? It will be removed from any exams that use it.")) return;
                  try {
                    await deleteQuestion(row.id);
                    toast({ title: "Deleted", description: "Question removed." });
                    await loadQuestions();
                  } catch (error) {
                    toast({
                      variant: "destructive",
                      title: "Delete failed",
                      description:
                        error instanceof Error ? error.message : "Unable to delete question.",
                    });
                  }
                }}
                className="text-danger"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Bank"
        subtitle="Exam-first question catalog with proctor insights."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button variant="outline" onClick={downloadSampleCsv}>
              Sample CSV
            </Button>
            <Button variant="outline" onClick={() => void exportSelection()}>
              Export
            </Button>
            <Button asChild>
              <Link to="/admin/question-bank/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Link>
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <div className="grid gap-3 lg:grid-cols-[2fr_repeat(4,1fr)]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, tags, subject, topic..."
          />
          <Select value={pricing} onValueChange={setPricing}>
            <SelectTrigger>
              <SelectValue placeholder="Pricing compatibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pricing</SelectItem>
              <SelectItem value="free_allowed">Free allowed</SelectItem>
              <SelectItem value="paid_allowed">Paid allowed</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
          <Select value={proctorMode} onValueChange={setProctorMode}>
            <SelectTrigger>
              <SelectValue placeholder="Proctor mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any proctor</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="strict">Strict</SelectItem>
            </SelectContent>
          </Select>
          <Select value={proctorSafe} onValueChange={setProctorSafe}>
            <SelectTrigger>
              <SelectValue placeholder="Proctor safe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All safety</SelectItem>
              <SelectItem value="safe">Safe</SelectItem>
              <SelectItem value="risky">Risky</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulty</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 lg:grid-cols-[repeat(7,1fr)]">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjectOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger>
              <SelectValue placeholder="Topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topicOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger>
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sectionOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={exposureRisk} onValueChange={setExposureRisk}>
            <SelectTrigger>
              <SelectValue placeholder="Exposure risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exposure</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cooldown} onValueChange={setCooldown}>
            <SelectTrigger>
              <SelectValue placeholder="Cooldown" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Include cooldown</SelectItem>
              <SelectItem value="available_only">Available only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={needsReviewFilter} onValueChange={setNeedsReviewFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Needs review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All review states</SelectItem>
              <SelectItem value="yes">Needs review only</SelectItem>
              <SelectItem value="no">No review needed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <Input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="Tags (comma separated)"
          />
          <Button variant="outline" onClick={() => setSelectedIds(questions.map((q) => q.id))}>
            Select all filtered
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">
              {selectedIds.length} questions selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => bulkUpdate({ status: "ACTIVE" }, "Questions activated.")}>
                Activate
              </Button>
              <Button variant="outline" onClick={() => bulkUpdate({ status: "INACTIVE" }, "Questions deactivated.")}>
                Deactivate
              </Button>
              <Button variant="outline" onClick={() => setBulkAssignOpen(true)}>
                Assign tags/subject/topic
              </Button>
              <Button variant="outline" onClick={() => setBulkCooldownOpen(true)}>
                Apply cooldown
              </Button>
              <Button variant="outline" onClick={() => bulkUpdate({ status: "ARCHIVED" }, "Questions archived.")}>
                Archive
              </Button>
              <Button variant="outline" onClick={() => void exportSelection()}>
                Export
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={bulkDeleteSelected}
              >
                Delete
              </Button>
              <Button variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="overflow-hidden rounded-xl border">
          <DataTable
            columns={columns}
            data={pageRows}
            emptyMessage={loading ? "Loading questions..." : "No questions match your filters."}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={pageIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageIndex((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={pageIndex >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportFile(null);
        }}
        title="Import Questions"
        description="Upload CSV to import questions into the new bank. Columns: questionHtml, type, difficultyLabel, option_1, option_2, option_3, option_4, correct_index, subject, topic."
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!importFile || importLoading}
              onClick={async () => {
                if (!importFile) return;
                setImportLoading(true);
                try {
                  const csv = await importFile.text();
                  const result = await importQuestionsCsv(csv);
                  setImportOpen(false);
                  setImportFile(null);
                  loadQuestions();
                  if (result.imported > 0) {
                    const errNote = result.errors.length ? " " + result.errors.length + " row(s) had errors." : "";
                    toast({ title: "Import complete", description: result.imported + " question(s) imported." + errNote });
                  }
                  if (result.errors.length > 0) {
                    const moreCount = result.errors.length - 5;
                    const errMsg = result.errors.slice(0, 5).join("; ") + (moreCount > 0 ? " (+" + moreCount + " more)" : "");
                    toast({ title: "Import warnings", description: errMsg, variant: "destructive" });
                  }
                  if (result.imported === 0 && result.errors.length === 0) {
                    toast({ title: "No data imported", description: "CSV had no valid rows. Check header and format." });
                  }
                } catch (e: any) {
                  toast({ title: "Import failed", description: e?.message || "Could not import CSV.", variant: "destructive" });
                } finally {
                  setImportLoading(false);
                }
              }}
            >
              {importLoading ? "Uploading…" : "Upload"}
            </Button>
          </>
        }
      >
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
            else if (f) toast({ title: "Use a CSV file", variant: "destructive" });
          }}
        >
          {importFile ? (
            <span className="font-medium text-foreground">{importFile.name}</span>
          ) : (
            "Drag & drop a CSV file here, or click to browse."
          )}
        </div>
      </Modal>

      <Modal
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        title="Assign tags, subject, topic"
        description="Apply metadata to all selected questions."
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const tags = bulkTags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean);
                void bulkUpdate(
                  {
                    subject: bulkSubject || undefined,
                    topic: bulkTopic || undefined,
                    tags: tags.length > 0 ? tags : undefined,
                  },
                  "Metadata applied."
                );
                setBulkAssignOpen(false);
              }}
            >
              Apply
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            value={bulkSubject}
            onChange={(event) => setBulkSubject(event.target.value)}
            placeholder="Subject (optional)"
          />
          <Input
            value={bulkTopic}
            onChange={(event) => setBulkTopic(event.target.value)}
            placeholder="Topic (optional)"
          />
          <Input
            value={bulkTags}
            onChange={(event) => setBulkTags(event.target.value)}
            placeholder="Tags (comma separated)"
          />
        </div>
      </Modal>

      <Modal
        open={bulkCooldownOpen}
        onOpenChange={setBulkCooldownOpen}
        title="Apply cooldown"
        description="Set a cooldown window for selected questions."
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkCooldownOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const days = Number(bulkCooldownDays || 0);
                const cooldownUntil =
                  days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
                void bulkUpdate({ cooldownUntil }, "Cooldown set for " + days + " days.");
                setBulkCooldownOpen(false);
              }}
            >
              Apply cooldown
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Input
            type="number"
            value={bulkCooldownDays}
            onChange={(event) => setBulkCooldownDays(event.target.value)}
            placeholder="Cooldown days"
          />
          <p className="text-xs text-muted-foreground">
            Questions in cooldown are excluded from strict exam pools.
          </p>
        </div>
      </Modal>
    </div>
  );
}
