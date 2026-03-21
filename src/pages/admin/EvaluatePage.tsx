import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  FileCheck,
  Flag,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  getEvaluateDashboard,
  type ReviewQueueItem,
  type UnderReviewAttempt,
  type ProctorFlaggedAttempt,
} from "@/lib/evaluate-api";
import { addToReviewQueue, updateReview } from "@/lib/review-queue-api";
import { getEligibleProctors } from "@/lib/proctor-api";
import { formatDistanceToNow } from "date-fns";

export default function EvaluatePage() {
  const queryClient = useQueryClient();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [addAttemptId, setAddAttemptId] = useState("");
  const [adding, setAdding] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "evaluate", "dashboard"],
    queryFn: getEvaluateDashboard,
  });

  const { data: proctors = [] } = useQuery({
    queryKey: ["proctor", "eligible"],
    queryFn: getEligibleProctors,
  });

  const handleStatus = async (item: ReviewQueueItem, status: string) => {
    try {
      await updateReview(item.id, { status });
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "evaluate"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "review-queue"] });
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    }
  };

  const handleAssign = async (item: ReviewQueueItem) => {
    if (!assignUserId) return;
    setAssigningId(item.id);
    try {
      await updateReview(item.id, { assignedToUserId: assignUserId });
      toast({ title: "Assigned" });
      queryClient.invalidateQueries({ queryKey: ["admin", "evaluate"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "review-queue"] });
      setAssignUserId("");
      setAssigningId(null);
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
      setAssigningId(null);
    }
  };

  const handleAddToQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    const attemptId = addAttemptId.trim();
    if (!attemptId) return;
    setAdding(true);
    try {
      await addToReviewQueue(attemptId);
      toast({ title: "Added to review queue" });
      setAddAttemptId("");
      queryClient.invalidateQueries({ queryKey: ["admin", "evaluate"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "review-queue"] });
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6 p-4">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="font-medium text-destructive">Could not load Evaluate dashboard</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : "Check that the backend is running and try again."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { reviewQueue, underReviewAttempts, proctorFlaggedCount, reviewQueueItems, underReviewList, proctorFlaggedList } = data;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin Panel</p>
          <h1 className="text-2xl font-semibold tracking-tight">Evaluate</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Track pending evaluations, rubric checks, and review workflow. Manage the review queue, grade attempts under review, and act on proctor-flagged attempts in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/review-queue">Full review queue</Link>
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <ClipboardList className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reviewQueue.pending}</p>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In review</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reviewQueue.inReview}</p>
            <p className="text-xs text-muted-foreground">Being evaluated</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved today</CardTitle>
            <FileCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reviewQueue.resolvedToday}</p>
            <p className="text-xs text-muted-foreground">Completed today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs grading</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{underReviewAttempts}</p>
            <p className="text-xs text-muted-foreground">Under review result</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proctor flagged</CardTitle>
            <Flag className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{proctorFlaggedCount}</p>
            <p className="text-xs text-muted-foreground">With proctor events</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="queue" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Review queue
            {reviewQueue.pending + reviewQueue.inReview > 0 && (
              <Badge variant="secondary" className="ml-1">{reviewQueue.pending + reviewQueue.inReview}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="grading" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Needs grading
            {underReviewAttempts > 0 && (
              <Badge variant="secondary" className="ml-1">{underReviewAttempts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="flagged" className="gap-2">
            <Flag className="h-4 w-4" />
            Proctor flagged
            {proctorFlaggedCount > 0 && (
              <Badge variant="destructive" className="ml-1">{proctorFlaggedCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Review queue</CardTitle>
                <CardDescription>Assign, mark in review, or resolve. Open exam results or evidence for context.</CardDescription>
              </div>
              <form onSubmit={handleAddToQueue} className="flex gap-2 items-end">
                <div className="space-y-1">
                  <Label htmlFor="add-attempt" className="text-xs">Add attempt to queue</Label>
                  <Input
                    id="add-attempt"
                    placeholder="Attempt ID"
                    value={addAttemptId}
                    onChange={(e) => setAddAttemptId(e.target.value)}
                    className="w-48 font-mono text-sm"
                  />
                </div>
                <Button type="submit" size="sm" disabled={adding || !addAttemptId.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </form>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewQueueItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                        No items in review queue. Add an attempt by ID above or from exam results.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviewQueueItems.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.attempt?.exam ? (
                            <Link to={`/admin/exams/${r.attempt.exam.id}/results`} className="text-primary hover:underline font-medium">
                              {r.attempt.exam.title}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{r.attempt?.user?.email ?? r.attempt?.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "resolved" ? "secondary" : r.status === "in_review" ? "default" : "outline"}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.assignedTo?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap gap-2 justify-end">
                            {r.attempt?.exam && (
                              <>
                                <Button size="sm" variant="ghost" asChild>
                                  <Link to={`/admin/exams/${r.attempt.exam.id}/results`}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button size="sm" variant="ghost" asChild>
                                  <Link to="/admin/evidence-audit">Evidence</Link>
                                </Button>
                              </>
                            )}
                            {r.status !== "in_review" && (
                              <Button size="sm" variant="outline" onClick={() => handleStatus(r, "in_review")}>
                                In review
                              </Button>
                            )}
                            {r.status !== "resolved" && (
                              <Button size="sm" variant="outline" onClick={() => handleStatus(r, "resolved")}>
                                Resolve
                              </Button>
                            )}
                            <Select
                              value={assigningId === r.id ? assignUserId : ""}
                              onValueChange={(v) => {
                                setAssignUserId(v);
                                setAssigningId(r.id);
                              }}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Assign" />
                              </SelectTrigger>
                              <SelectContent>
                                {proctors.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {assigningId === r.id && assignUserId && (
                              <Button size="sm" onClick={() => handleAssign(r)}>Save</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Needs grading</CardTitle>
              <CardDescription>
                Attempts with result status &quot;under review&quot;. Open exam results to assign scores or change result.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {underReviewList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                        No attempts under review.
                      </TableCell>
                    </TableRow>
                  ) : (
                    underReviewList.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.exam ? (
                            <Link to={`/admin/exams/${a.exam.id}/results`} className="text-primary hover:underline font-medium">
                              {a.exam.title}
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{a.candidateName ?? a.email}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {a.submittedAt ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true }) : "—"}
                        </TableCell>
                        <TableCell>
                          {a.exam && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/admin/exams/${a.exam.id}/results`}>
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Open results
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flagged" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Proctor-flagged attempts
              </CardTitle>
              <CardDescription>
                Attempts with one or more proctor events (e.g. tab switch, face not detected). Review evidence and decide if they need to be added to the review queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proctorFlaggedList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                        No proctor-flagged attempts.
                      </TableCell>
                    </TableRow>
                  ) : (
                    proctorFlaggedList.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.exam ? (
                            <Link to={`/admin/exams/${a.exam.id}/results`} className="text-primary hover:underline font-medium">
                              {a.exam.title}
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{a.candidateName ?? a.email}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{a.eventCount} event{a.eventCount !== 1 ? "s" : ""}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {a.submittedAt ? formatDistanceToNow(new Date(a.submittedAt), { addSuffix: true }) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link to="/admin/evidence-audit">Evidence</Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await addToReviewQueue(a.id);
                                  toast({ title: "Added to review queue" });
                                  queryClient.invalidateQueries({ queryKey: ["admin", "evaluate"] });
                                } catch (e) {
                                  toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
                                }
                              }}
                            >
                              Add to queue
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            How Evaluate works
          </h3>
          <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Review queue:</strong> Items flagged for manual review. Assign to a reviewer, mark &quot;In review&quot;, then &quot;Resolve&quot; when done.</li>
            <li><strong>Needs grading:</strong> Attempts with result status &quot;under review&quot; — open exam results to set score or pass/fail.</li>
            <li><strong>Proctor flagged:</strong> Attempts with proctor events (tab switch, face not detected, etc.). Review evidence and optionally add to the queue.</li>
            <li>Use <Link to="/admin/review-queue" className="text-primary underline">Review queue</Link> for the full list; use <Link to="/admin/evidence-audit" className="text-primary underline">Evidence audit</Link> for access logs and chain-of-custody.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
