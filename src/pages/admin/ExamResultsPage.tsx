import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/components/ui/use-toast";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import { getExam, listResultsPage } from "@/lib/exams-module-api";
import type { AdminExam, ExamResultRow } from "@/lib/exams-module-types";

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

export default function ExamResultsPage() {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [results, setResults] = useState<ExamResultRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  useEffect(() => {
    const load = async () => {
      if (!examId) return;
      setLoading(true);
      try {
        const [examRow, firstPage] = await Promise.all([
          getExam(examId),
          listResultsPage(examId, { limit: 100 }),
        ]);
        if (!examRow) {
          notifyError("Exam not found.");
          navigate("/admin/exams", { replace: true });
          return;
        }
        setExam(examRow);
        setResults(firstPage.items);
        setHasMore(Boolean(firstPage.hasMore));
        setNextCursor(firstPage.nextCursor ?? null);
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load exam results.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [examId]);

  const loadMoreResults = async () => {
    if (!examId || !hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listResultsPage(examId, { limit: 100, cursor: nextCursor });
      setResults((prev) => [...prev, ...page.items]);
      setHasMore(Boolean(page.hasMore));
      setNextCursor(page.nextCursor ?? null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load more results.");
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = useMemo(() => {
    if (results.length === 0) {
      return { attempts: 0, avgScore: 0, passRate: 0 };
    }
    const attempts = results.length;
    const avgScore = Math.round(results.reduce((sum, row) => sum + row.score, 0) / attempts);
    const passRate = Math.round((results.filter((row) => row.status === "passed").length / attempts) * 100);
    return { attempts, avgScore, passRate };
  }, [results]);

  const distributionData = useMemo(() => {
    const buckets = [
      { range: "0-39", count: 0 },
      { range: "40-59", count: 0 },
      { range: "60-79", count: 0 },
      { range: "80-100", count: 0 },
    ];
    results.forEach((row) => {
      if (row.score < 40) buckets[0].count += 1;
      else if (row.score < 60) buckets[1].count += 1;
      else if (row.score < 80) buckets[2].count += 1;
      else buckets[3].count += 1;
    });
    return buckets;
  }, [results]);

  const trendData = useMemo(() => {
    return results
      .slice()
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      .map((row, index) => ({
        name: `Attempt ${index + 1}`,
        score: row.score,
      }));
  }, [results]);

  const virtualizedResults = useVirtualRows({
    itemCount: results.length,
    rowHeight: 56,
    containerHeight: 520,
    enabled: results.length >= 200,
  });
  const visibleResults = virtualizedResults.enabled
    ? results.slice(virtualizedResults.startIndex, virtualizedResults.endIndex)
    : results;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Results</h1>
          <p className="mt-1 text-sm text-slate-600">{exam.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/admin/exams/${exam.id}`}>Back to Detail</Link>
          </Button>
          <Button
            onClick={() => {
              const rows = [
                ["Candidate", "Score", "Status", "Time Taken", "Submitted At"],
                ...results.map((result) => [
                  result.candidateName,
                  `${result.score}%`,
                  result.status,
                  `${result.timeTakenMinutes} min`,
                  result.submittedAt,
                ]),
              ];
              downloadCsv(`exam-${exam.id}-results.csv`, rows);
            }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Attempts</CardDescription><CardTitle>{summary.attempts}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Avg Score</CardDescription><CardTitle>{summary.avgScore}%</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pass Rate</CardDescription><CardTitle>{summary.passRate}%</CardTitle></CardHeader></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attempt Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#16a34a" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Results Table</CardTitle>
          <CardDescription>
            Candidate performance and status. Showing {results.length} result(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div
              className={virtualizedResults.enabled ? "max-h-[520px] overflow-auto" : undefined}
              onScroll={virtualizedResults.enabled ? virtualizedResults.onScroll : undefined}
            >
              <Table>
                <TableHeader className={virtualizedResults.enabled ? "sticky top-0 z-10 bg-white" : undefined}>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time Taken</TableHead>
                    <TableHead>Submitted At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {virtualizedResults.enabled && virtualizedResults.topSpacerHeight > 0 && (
                    <TableRow aria-hidden="true" className="border-0">
                      <TableCell colSpan={5} className="border-0 p-0" style={{ height: `${virtualizedResults.topSpacerHeight}px` }} />
                    </TableRow>
                  )}
                  {visibleResults.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.candidateName}</TableCell>
                      <TableCell>{row.score}%</TableCell>
                      <TableCell>
                        {row.status === "passed" && <Badge variant="success-light">Passed</Badge>}
                        {row.status === "failed" && <Badge variant="danger-light">Failed</Badge>}
                        {row.status === "review" && <Badge variant="warning-light">Review</Badge>}
                      </TableCell>
                      <TableCell>{row.timeTakenMinutes} min</TableCell>
                      <TableCell>{format(new Date(row.submittedAt), "PPp")}</TableCell>
                    </TableRow>
                  ))}
                  {virtualizedResults.enabled && virtualizedResults.bottomSpacerHeight > 0 && (
                    <TableRow aria-hidden="true" className="border-0">
                      <TableCell colSpan={5} className="border-0 p-0" style={{ height: `${virtualizedResults.bottomSpacerHeight}px` }} />
                    </TableRow>
                  )}
                  {results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                        No results available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          {(hasMore || loadingMore) && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" onClick={() => void loadMoreResults()} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more results"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
