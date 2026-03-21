import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Award,
  BarChart3,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReportsSummary, type ExamReportRow } from "@/lib/reports-api";
import FileVaultQuickTriageCard from "@/components/admin/FileVaultQuickTriageCard";

function downloadCsv(rows: ExamReportRow[]) {
  const headers = [
    "Exam",
    "Status",
    "Total attempts",
    "Submitted",
    "Passed",
    "Failed",
    "Under review",
    "Avg %",
    "Pass %",
  ];
  const data = rows.map((e) => [
    e.title,
    e.status,
    e.totalAttempts,
    e.submitted,
    e.passed,
    e.failed,
    e.underReview,
    e.avgPercentage ?? "",
    e.passRate ?? "",
  ]);
  const csv = [headers.join(","), ...data.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reports-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "reports", "summary"],
    queryFn: getReportsSummary,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6 p-4">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="font-medium text-destructive">Could not load reports</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : "Check that the backend is running and try again."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, exams } = data;
  const examsWithActivity = exams.filter((e) => e.submitted > 0);

  return (
    <div className="space-y-6 p-4">
      {/* Purpose and description */}
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Review exam performance across all exams: see attempt counts, pass rates, and outcomes at a glance.
          Use this page to identify exams that need grading, export summaries for records, and jump to detailed results or the review queue.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total attempts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalAttempts}</p>
            <p className="text-xs text-muted-foreground">Submitted or graded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exams with activity</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.totalExamsWithAttempts}</p>
            <p className="text-xs text-muted-foreground">Have at least one submitted attempt</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall pass rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary.overallPassRate != null ? `${summary.overallPassRate}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.passed} passed / {summary.failed} failed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending review</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.underReview}</p>
            <p className="text-xs text-muted-foreground">Under review or need grading</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/review-queue">
            <ClipboardList className="h-4 w-4 mr-1" />
            Review queue
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/evidence-audit">
            <ShieldAlert className="h-4 w-4 mr-1" />
            Evidence audit
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/file-vault">
            <FileText className="h-4 w-4 mr-1" />
            File Vault
          </Link>
        </Button>
      </div>

      <FileVaultQuickTriageCard
        title="Evidence file quick triage"
        description="Recent evidence video assets from File Vault."
        kind="evidence_video"
        pageSize={6}
      />

      {/* Per-exam table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Exam performance
            </CardTitle>
            <CardDescription>
              Per-exam attempt and outcome summary. Click an exam to see candidate-level results.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(examsWithActivity.length > 0 ? examsWithActivity : exams)}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Under review</TableHead>
                <TableHead className="text-right">Avg %</TableHead>
                <TableHead className="text-right">Pass %</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No exams yet. Create and publish exams to see report data here.
                  </TableCell>
                </TableRow>
              ) : (
                exams.map((row) => (
                  <TableRow key={row.examId}>
                    <TableCell>
                      <Link
                        to={`/admin/exams/${row.examId}/results`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.title}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">({row.status})</span>
                    </TableCell>
                    <TableCell className="text-right">{row.totalAttempts}</TableCell>
                    <TableCell className="text-right">{row.submitted}</TableCell>
                    <TableCell className="text-right">{row.passed}</TableCell>
                    <TableCell className="text-right">{row.failed}</TableCell>
                    <TableCell className="text-right">{row.underReview}</TableCell>
                    <TableCell className="text-right">
                      {row.avgPercentage != null ? `${row.avgPercentage}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.passRate != null ? `${row.passRate}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/exams/${row.examId}/results`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* What this page is for (footer note) */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-medium flex items-center gap-2">
            <Award className="h-4 w-4" />
            What this page is for
          </h3>
          <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>See which exams have activity and how many candidates passed or failed.</li>
            <li>Export a CSV summary for records or external analysis.</li>
            <li>Open exam-level results (scores, candidates) via the exam name or View link.</li>
            <li>Use Review queue for attempts that need manual grading or flags; use Evidence audit for proctoring and access logs.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
