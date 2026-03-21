import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Archive, Copy, Edit3, ExternalLink } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { hasRole } from "@/lib/auth-api";
import {
  archiveExam,
  duplicateExam,
  exportSalesCsv,
  getExam,
  listCandidatesForExamPage,
  listExamActivityPage,
  listPurchasesByExamPage,
  listResults,
  publishExam,
  unpublishExam,
} from "@/lib/exams-module-api";
import { getExamQuestions } from "@/lib/api";
import type { AdminExam, ExamActivityLog, ExamCandidateStatusRow, ExamPurchase, ExamResultRow } from "@/lib/exams-module-types";

function statusBadge(status: AdminExam["status"]) {
  if (status === "published") return <Badge variant="success-light">Published</Badge>;
  if (status === "running") return <Badge variant="warning-light">Running</Badge>;
  if (status === "completed") return <Badge variant="secondary">Completed</Badge>;
  if (status === "archived") return <Badge variant="outline">Archived</Badge>;
  // Approval workflow: teacher sees these when backend supports them
  if (status === "submitted") return <Badge variant="warning-light">Pending</Badge>;
  if (status === "under_review") return <Badge variant="warning-light">Under Review</Badge>;
  if (status === "approved") return <Badge variant="success-light">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function statusText(value: ExamCandidateStatusRow["status"]) {
  if (value === "in_progress") return "In Progress";
  if (value === "completed") return "Completed";
  if (value === "abandoned") return "Abandoned";
  return "Not Started";
}

function pricingChip(exam: AdminExam) {
  if (exam.pricing.mode === "PAID") return <Badge variant="warning-light">PAID</Badge>;
  if (exam.pricing.isDemo) return <Badge variant="secondary">DEMO</Badge>;
  return <Badge variant="outline">FREE</Badge>;
}

function money(amount: number, currency: AdminExam["pricing"]["currency"]) {
  return `${currency} ${amount.toLocaleString()}`;
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

export default function ExamDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { examId } = useParams<{ examId: string }>();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [candidates, setCandidates] = useState<ExamCandidateStatusRow[]>([]);
  const [results, setResults] = useState<ExamResultRow[]>([]);
  const [purchases, setPurchases] = useState<ExamPurchase[]>([]);
  const [activity, setActivity] = useState<ExamActivityLog[]>([]);
  const [candidatesHasMore, setCandidatesHasMore] = useState(false);
  const [candidatesNextCursor, setCandidatesNextCursor] = useState<string | null>(null);
  const [candidatesLoadingMore, setCandidatesLoadingMore] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityNextCursor, setActivityNextCursor] = useState<string | null>(null);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [purchasesHasMore, setPurchasesHasMore] = useState(false);
  const [purchasesNextCursor, setPurchasesNextCursor] = useState<string | null>(null);
  const [purchasesLoadingMore, setPurchasesLoadingMore] = useState(false);
  const [includeAbandoned, setIncludeAbandoned] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [questionCount, setQuestionCount] = useState<number | null>(null);

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  useEffect(() => {
    const nextTab = new URLSearchParams(location.search).get("tab");
    setActiveTab(nextTab === "sales" ? "sales" : "overview");
  }, [location.search]);

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const [examRow, candidatePage, resultRows, activityPage, purchasePage, questionRows] =
        await Promise.all([
          getExam(examId),
          listCandidatesForExamPage(examId, { includeAbandoned, limit: 100 }),
          listResults(examId),
          listExamActivityPage(examId, { limit: 100 }),
          listPurchasesByExamPage(examId, { limit: 100 }),
          getExamQuestions(examId),
        ]);
      if (!examRow) {
        notifyError("Exam not found.");
        navigate("/admin/exams", { replace: true });
        return;
      }
      setExam(examRow);
      setCandidates(candidatePage.items);
      setCandidatesHasMore(Boolean(candidatePage.hasMore));
      setCandidatesNextCursor(candidatePage.nextCursor ?? null);
      setResults(resultRows);
      setActivity(activityPage.items);
      setActivityHasMore(Boolean(activityPage.hasMore));
      setActivityNextCursor(activityPage.nextCursor ?? null);
      setPurchases(purchasePage.items);
      setPurchasesHasMore(Boolean(purchasePage.hasMore));
      setPurchasesNextCursor(purchasePage.nextCursor ?? null);
      setQuestionCount(questionRows.length);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load exam details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [examId, includeAbandoned]);

  const loadMoreCandidates = async () => {
    if (!examId || !candidatesHasMore || !candidatesNextCursor || candidatesLoadingMore) return;
    setCandidatesLoadingMore(true);
    try {
      const page = await listCandidatesForExamPage(examId, {
        includeAbandoned,
        cursor: candidatesNextCursor,
        limit: 100,
      });
      setCandidates((prev) => [...prev, ...page.items]);
      setCandidatesHasMore(Boolean(page.hasMore));
      setCandidatesNextCursor(page.nextCursor ?? null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load more candidates.");
    } finally {
      setCandidatesLoadingMore(false);
    }
  };

  const loadMoreActivity = async () => {
    if (!examId || !activityHasMore || !activityNextCursor || activityLoadingMore) return;
    setActivityLoadingMore(true);
    try {
      const page = await listExamActivityPage(examId, {
        cursor: activityNextCursor,
        limit: 100,
      });
      setActivity((prev) => [...prev, ...page.items]);
      setActivityHasMore(Boolean(page.hasMore));
      setActivityNextCursor(page.nextCursor ?? null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load more activity.");
    } finally {
      setActivityLoadingMore(false);
    }
  };

  const loadMorePurchases = async () => {
    if (!examId || !purchasesHasMore || !purchasesNextCursor || purchasesLoadingMore) return;
    setPurchasesLoadingMore(true);
    try {
      const page = await listPurchasesByExamPage(examId, {
        cursor: purchasesNextCursor,
        limit: 100,
      });
      setPurchases((prev) => [...prev, ...page.items]);
      setPurchasesHasMore(Boolean(page.hasMore));
      setPurchasesNextCursor(page.nextCursor ?? null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load more purchases.");
    } finally {
      setPurchasesLoadingMore(false);
    }
  };

  const scoreSummary = useMemo(() => {
    if (results.length === 0) return { avgScore: 0, passRate: 0 };
    const avgScore = Math.round(results.reduce((sum, row) => sum + row.score, 0) / results.length);
    const passRate = Math.round((results.filter((row) => row.status === "passed").length / results.length) * 100);
    return { avgScore, passRate };
  }, [results]);

  const salesSummary = useMemo(() => {
    return {
      purchases: purchases.length,
      revenue: purchases.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.amount, 0),
    };
  }, [purchases]);

  const virtualizedCandidates = useVirtualRows({
    itemCount: candidates.length,
    rowHeight: 72,
    containerHeight: 460,
    enabled: candidates.length >= 150,
  });
  const visibleCandidates = virtualizedCandidates.enabled
    ? candidates.slice(virtualizedCandidates.startIndex, virtualizedCandidates.endIndex)
    : candidates;

  const virtualizedPurchases = useVirtualRows({
    itemCount: purchases.length,
    rowHeight: 56,
    containerHeight: 420,
    enabled: purchases.length >= 150,
  });
  const visiblePurchases = virtualizedPurchases.enabled
    ? purchases.slice(virtualizedPurchases.startIndex, virtualizedPurchases.endIndex)
    : purchases;

  useEffect(() => {
    if (exam && exam.pricing.mode !== "PAID" && activeTab === "sales") {
      setActiveTab("overview");
    }
  }, [activeTab, exam]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{exam.name}</h1>
            {statusBadge(exam.status)}
            {pricingChip(exam)}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Created by {exam.createdBy} - Updated {formatDistanceToNowStrict(new Date(exam.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* When under_review, teacher cannot edit (governance: admin is reviewing). */}
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/exams/${exam.id}/edit`)}
            disabled={hasRole("teacher") && !hasRole("admin") && String(exam.status) === "under_review"}
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </Button>
          {/* Teacher must not see Publish; they submit for approval. Admin keeps Publish/Unpublish. */}
          {hasRole("admin") ? (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  if (exam.status === "published") {
                    const row = await unpublishExam(exam.id);
                    setExam(row);
                    notifySuccess("Exam moved to draft.");
                  } else {
                    const row = await publishExam(exam.id);
                    setExam(row);
                    notifySuccess("Exam published.");
                  }
                } catch (error) {
                  notifyError(error instanceof Error ? error.message : "Unable to update status.");
                }
              }}
            >
              {exam.status === "published" ? "Unpublish" : "Publish"}
            </Button>
          ) : (
            String(exam.status) === "draft" && (
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: call submit-for-approval API when backend supports it
                  notifySuccess("Submit for approval: contact admin or use approval flow when available.");
                }}
              >
                Submit for Approval
              </Button>
            )
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const dup = await duplicateExam(exam.id);
                notifySuccess(`Duplicated as ${dup.name}`);
                navigate(`/admin/exams/${dup.id}`);
              } catch (error) {
                notifyError(error instanceof Error ? error.message : "Unable to duplicate exam.");
              }
            }}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const row = await archiveExam(exam.id);
                setExam(row);
                notifySuccess("Exam archived.");
              } catch (error) {
                notifyError(error instanceof Error ? error.message : "Unable to archive exam.");
              }
            }}
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid w-full ${exam.pricing.mode === "PAID" ? "grid-cols-6" : "grid-cols-5"}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          {exam.pricing.mode === "PAID" && <TabsTrigger value="sales">Sales</TabsTrigger>}
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Basics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>Type: {exam.type}</p>
                <p>Category: {exam.category || "Uncategorized"}</p>
                <p>Duration: {exam.durationMinutes} min</p>
                <p>Attempts Allowed: {exam.attemptsAllowed}</p>
                <p>Availability: {exam.availability.mode}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>Target: {exam.access.targetType}</p>
                <p>Groups: {exam.access.groupIds.length}</p>
                <p>Candidates: {exam.access.candidateIds.length}</p>
                {exam.access.linkSettings?.shareLink && (
                  <p className="truncate">Link: {exam.access.linkSettings.shareLink}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>Mode: {exam.questionsMode}</p>
                <p>Section Configs: {exam.sectionsConfig.length}</p>
                <p>
                  Total Questions:{" "}
                  {questionCount !== null ? questionCount : exam.selectedQuestionIds.length}
                </p>
                <p>Randomize: {exam.randomizeQuestions ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>Preset: {exam.security.preset}</p>
                <p>Proctoring: {exam.security.proctoringEnabled ? "Enabled" : "Disabled"}</p>
                <p>Fullscreen: {exam.security.fullscreenRequired ? "Required" : "Optional"}</p>
                <p>Disable Copy/Paste: {exam.security.disableCopyPaste ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-700">
                <p>
                  Mode:{" "}
                  {exam.pricing.mode === "PAID"
                    ? `PAID (${money(exam.pricing.price ?? 0, exam.pricing.currency)})`
                    : exam.pricing.isDemo
                    ? "FREE Demo/Trial"
                    : "FREE"}
                </p>
                <p>Storefront: {exam.pricing.showOnStorefront ? "Visible" : "Hidden"}</p>
                <p>Validity: {exam.pricing.mode === "PAID" ? (exam.pricing.validityDays ? `${exam.pricing.validityDays} days` : "Lifetime") : "N/A"}</p>
                <p>Payment Required: {exam.pricing.paymentRequiredBeforeStart ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="candidates">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Invited Candidates</CardTitle>
                  <CardDescription>Status and admin actions.</CardDescription>
                </div>
                <Button
                  variant={includeAbandoned ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setIncludeAbandoned((prev) => !prev)}
                >
                  {includeAbandoned ? "Hide Abandoned Sessions" : "Include Abandoned Sessions"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 text-xs text-slate-500">Showing {candidates.length} candidate row(s).</div>
              <div className="rounded-md border">
                <div
                  className={virtualizedCandidates.enabled ? "max-h-[460px] overflow-auto" : undefined}
                  onScroll={virtualizedCandidates.enabled ? virtualizedCandidates.onScroll : undefined}
                >
                  <Table>
                    <TableHeader className={virtualizedCandidates.enabled ? "sticky top-0 z-10 bg-white" : undefined}>
                      <TableRow>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>Flags</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {virtualizedCandidates.enabled && virtualizedCandidates.topSpacerHeight > 0 && (
                        <TableRow aria-hidden="true" className="border-0">
                          <TableCell colSpan={5} className="border-0 p-0" style={{ height: `${virtualizedCandidates.topSpacerHeight}px` }} />
                        </TableRow>
                      )}
                      {visibleCandidates.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <p className="font-medium text-slate-800">{row.candidateName}</p>
                            <p className="text-xs text-slate-500">{row.email}</p>
                          </TableCell>
                          <TableCell>{statusText(row.status)}</TableCell>
                          <TableCell>{row.startTime ? format(new Date(row.startTime), "PPp") : "-"}</TableCell>
                          <TableCell>{row.flags}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => notifySuccess(`Reminder sent to ${row.candidateName}`)}>
                                Send Reminder
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setCandidates((prev) => prev.filter((item) => item.id !== row.id))}>
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {virtualizedCandidates.enabled && virtualizedCandidates.bottomSpacerHeight > 0 && (
                        <TableRow aria-hidden="true" className="border-0">
                          <TableCell colSpan={5} className="border-0 p-0" style={{ height: `${virtualizedCandidates.bottomSpacerHeight}px` }} />
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {(candidatesHasMore || candidatesLoadingMore) && (
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => void loadMoreCandidates()} disabled={candidatesLoadingMore}>
                    {candidatesLoadingMore ? "Loading..." : "Load more candidates"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monitoring Shell</CardTitle>
              <CardDescription>Open full monitoring for live supervision.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild>
                <Link to={`/admin/exams/${exam.id}/monitor`}>
                  Open Monitor
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <div className="rounded-md border p-3 text-sm text-slate-700">
                Running candidates: {candidates.filter((row) => row.status === "in_progress").length}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card><CardHeader className="pb-2"><CardDescription>Attempts</CardDescription><CardTitle>{results.length}</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>Avg Score</CardDescription><CardTitle>{scoreSummary.avgScore}%</CardTitle></CardHeader></Card>
              <Card><CardHeader className="pb-2"><CardDescription>Pass Rate</CardDescription><CardTitle>{scoreSummary.passRate}%</CardTitle></CardHeader></Card>
            </div>
            <Button asChild variant="outline">
              <Link to={`/admin/exams/${exam.id}/results`}>
                Open Full Results
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </TabsContent>

        {exam.pricing.mode === "PAID" && (
          <TabsContent value="sales">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Purchases</CardDescription>
                    <CardTitle>{salesSummary.purchases}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Revenue</CardDescription>
                    <CardTitle>{money(salesSummary.revenue, exam.pricing.currency)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const exported = await exportSalesCsv(exam.id);
                      downloadCsv(exported.fileName, exported.rows);
                      notifySuccess("Sales CSV exported.");
                    } catch (error) {
                      notifyError(error instanceof Error ? error.message : "Unable to export sales.");
                    }
                  }}
                >
                  Export CSV
                </Button>
              </div>
              <div className="rounded-md border">
                <div
                  className={virtualizedPurchases.enabled ? "max-h-[420px] overflow-auto" : undefined}
                  onScroll={virtualizedPurchases.enabled ? virtualizedPurchases.onScroll : undefined}
                >
                  <Table>
                    <TableHeader className={virtualizedPurchases.enabled ? "sticky top-0 z-10 bg-white" : undefined}>
                      <TableRow>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {virtualizedPurchases.enabled && virtualizedPurchases.topSpacerHeight > 0 && (
                        <TableRow aria-hidden="true" className="border-0">
                          <TableCell colSpan={5} className="border-0 p-0" style={{ height: `${virtualizedPurchases.topSpacerHeight}px` }} />
                        </TableRow>
                      )}
                      {visiblePurchases.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.buyerName}</TableCell>
                          <TableCell>{row.buyerEmail}</TableCell>
                          <TableCell>{money(row.amount, row.currency)}</TableCell>
                          <TableCell>
                            {row.status === "paid" ? (
                              <Badge variant="success-light">Paid</Badge>
                            ) : (
                              <Badge variant="warning-light">Refunded</Badge>
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(row.purchasedAt), "PPp")}</TableCell>
                        </TableRow>
                      ))}
                      {virtualizedPurchases.enabled && virtualizedPurchases.bottomSpacerHeight > 0 && (
                        <TableRow aria-hidden="true" className="border-0">
                          <TableCell colSpan={5} className="border-0 p-0" style={{ height: `${virtualizedPurchases.bottomSpacerHeight}px` }} />
                        </TableRow>
                      )}
                      {purchases.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                            No purchases yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {(purchasesHasMore || purchasesLoadingMore) && (
                <div className="mt-3 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => void loadMorePurchases()} disabled={purchasesLoadingMore}>
                    {purchasesLoadingMore ? "Loading..." : "Load more purchases"}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Audit / Activity</CardTitle>
              <CardDescription>Timeline of exam operations.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity.map((log) => (
                  <div key={log.id} className="rounded-md border p-3">
                    <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                    <p className="text-xs text-slate-500">{format(new Date(log.timestamp), "PPpp")} by {log.actor}</p>
                    <p className="mt-1 text-sm text-slate-700">{log.details}</p>
                  </div>
                ))}
                {activity.length === 0 && (
                  <p className="text-sm text-slate-500">No activity logs yet.</p>
                )}
                {(activityHasMore || activityLoadingMore) && (
                  <div className="flex justify-center pt-1">
                    <Button variant="outline" size="sm" onClick={() => void loadMoreActivity()} disabled={activityLoadingMore}>
                      {activityLoadingMore ? "Loading..." : "Load more activity"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
