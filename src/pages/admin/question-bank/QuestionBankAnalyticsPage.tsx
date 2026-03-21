import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/admin/PageHeader";
import DataTable, { ColumnDef } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  exportCsv,
  getQuestionAnalytics,
  listQuestions,
  updateQuestion,
} from "@/lib/question-bank-api";
import type { Question, QuestionAnalytics, QuestionFilters } from "@/lib/question-bank-types";

const exposureColors: Record<string, string> = {
  LOW: "hsl(var(--success))",
  MEDIUM: "hsl(var(--warning))",
  HIGH: "hsl(var(--danger))",
};

export default function QuestionBankAnalyticsPage() {
  const [analytics, setAnalytics] = useState<QuestionAnalytics | null>(null);
  const [catalog, setCatalog] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState<QuestionFilters["subject"]>("all");
  const [topic, setTopic] = useState<QuestionFilters["topic"]>("all");
  const [difficulty, setDifficulty] = useState<QuestionFilters["difficulty"]>("all");
  const [type, setType] = useState<string>("all");
  const [proctorSafe, setProctorSafe] = useState<QuestionFilters["proctorSafe"]>("all");
  const [pricing, setPricing] = useState<QuestionFilters["pricing"]>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filters = useMemo<QuestionFilters>(
    () => ({
      subject,
      topic,
      difficulty,
      proctorSafe,
      pricing,
      type: type === "all" ? "all" : (type as Question["type"]),
    }),
    [subject, topic, difficulty, proctorSafe, pricing, type]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analyticsData, catalogData] = await Promise.all([
          getQuestionAnalytics(filters),
          listQuestions(),
        ]);
        setAnalytics(analyticsData);
        setCatalog(catalogData);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Analytics unavailable",
          description: error instanceof Error ? error.message : "Unable to load analytics.",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filters, startDate, endDate]);

  const subjectOptions = useMemo(
    () => Array.from(new Set(catalog.map((question) => question.subject))).filter(Boolean),
    [catalog]
  );
  const topicOptions = useMemo(
    () => Array.from(new Set(catalog.map((question) => question.topic))).filter(Boolean),
    [catalog]
  );

  const columns: ColumnDef<Question>[] = [
    {
      header: "Question",
      cell: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.subject} • {row.topic}</p>
        </div>
      ),
    },
    {
      header: "Exposure",
      cell: (row) => <Badge variant={row.exposureRisk === "HIGH" ? "danger-light" : row.exposureRisk === "MEDIUM" ? "warning-light" : "success-light"}>{row.exposureRisk}</Badge>,
    },
    {
      header: "Violations",
      cell: (row) => <span className="text-sm font-semibold">{row.proctorViolationsCount}</span>,
    },
    {
      header: "Times Used",
      cell: (row) => <span className="text-sm font-semibold">{row.timesUsedInExams}</span>,
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateQuestion(row.id, {
                cooldownUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
              }).then(() => toast({ title: "Cooldown set" }))
            }
          >
            Cooldown
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateQuestion(row.id, { needsReview: true })}>
            Review
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateQuestion(row.id, { excludeFromStrictPools: true })}>
            Exclude
          </Button>
        </div>
      ),
    },
  ];

  const exportAnalytics = async () => {
    if (!analytics) return;
    try {
      const rows = analytics.highRiskQuestions.map((question) => [
        question.id,
        question.title,
        question.exposureRisk,
        String(question.proctorViolationsCount),
        String(question.timesUsedInExams),
        question.needsReview ? "Yes" : "No",
      ]);
      const data = await exportCsv({
        fileName: "question-analytics.csv",
        rows: [["ID", "Title", "Exposure", "Violations", "Times Used", "Needs Review"], ...rows],
      });
      const csv = data.rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", data.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Analytics exported" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export analytics.",
      });
    }
  };

  if (loading || !analytics) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl border bg-muted/30" />
        <div className="h-96 rounded-2xl border bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Analytics"
        subtitle="Track exposure, accuracy, and proctor violations."
        actions={
          <Button variant="outline" onClick={() => void exportAnalytics()}>
            Export CSV
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Start Date</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End Date</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
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
        </div>
        <div className="grid gap-3 md:grid-cols-4">
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
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="MCQ_SINGLE">MCQ Single</SelectItem>
              <SelectItem value="MCQ_MULTI">MCQ Multi</SelectItem>
              <SelectItem value="TRUE_FALSE">True/False</SelectItem>
              <SelectItem value="SHORT">Short</SelectItem>
              <SelectItem value="LONG">Long</SelectItem>
              <SelectItem value="NUMERIC">Numeric</SelectItem>
              <SelectItem value="CODING">Coding</SelectItem>
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
        </div>
        <div className="grid gap-3 md:grid-cols-2">
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle>{analytics.totals.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Used in Exams</CardDescription>
            <CardTitle>{analytics.totals.usedInExams}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Exposure</CardDescription>
            <CardTitle>{analytics.totals.highExposure}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Needs Review</CardDescription>
            <CardTitle>{analytics.totals.needsReview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Violations</CardDescription>
            <CardTitle>{analytics.totals.highProctorViolations}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.usageTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="used" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accuracy by Difficulty</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.accuracyByDifficulty}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="difficulty" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="accuracy" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proctor Violations Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.proctorViolationsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="violations" stroke="hsl(var(--danger))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Exposure Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.exposureDistribution} dataKey="count" nameKey="risk" innerRadius={45} outerRadius={70}>
                  {analytics.exposureDistribution.map((entry) => (
                    <Cell key={entry.risk} fill={exposureColors[entry.risk]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">High Risk Questions</CardTitle>
          <CardDescription>Questions with high exposure or proctor violations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <DataTable
              columns={columns}
              data={analytics.highRiskQuestions}
              emptyMessage="No high risk questions found."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
