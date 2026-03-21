import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Copy, Edit3 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  createQuestion,
  getQuestion,
  getQuestionProctorSummary,
  updateQuestion,
} from "@/lib/question-bank-api";
import type { MappedProctorEvent, Question } from "@/lib/question-bank-types";

function riskBadge(level: "LOW" | "MEDIUM" | "HIGH") {
  if (level === "HIGH") return <Badge variant="danger-light">High Risk</Badge>;
  if (level === "MEDIUM") return <Badge variant="warning-light">Medium Risk</Badge>;
  return <Badge variant="success-light">Low Risk</Badge>;
}

export default function QuestionBankDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    highSeverity: number;
    breakdown: Record<string, number>;
    recentEvents: MappedProctorEvent[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState("preview");
  const [cooldownDays, setCooldownDays] = useState("7");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [questionRow, proctorSummary] = await Promise.all([
        getQuestion(id),
        getQuestionProctorSummary(id),
      ]);
      if (!questionRow) {
        toast({
          variant: "destructive",
          title: "Question not found",
          description: "Unable to load question details.",
        });
        navigate("/admin/question-bank");
        return;
      }
      setQuestion(questionRow);
      setSummary(proctorSummary);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to load question",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const riskLevel = useMemo(() => {
    if (!summary) return "LOW";
    if (summary.highSeverity >= 2 || summary.total >= 5) return "HIGH";
    if (summary.total >= 2) return "MEDIUM";
    return "LOW";
  }, [summary]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl border bg-muted/30" />
        <div className="h-96 rounded-2xl border bg-muted/30" />
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={question.title}
        subtitle={`Question ID: ${question.id}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/admin/question-bank/${question.id}/edit`)}>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const copy = await createQuestion({
                  ...question,
                  title: `${question.title} (Copy)`,
                  status: "INACTIVE",
                });
                toast({ title: "Duplicated", description: "New copy created." });
                navigate(`/admin/question-bank/${copy.id}`);
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/question-bank")}>
              Back
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="proctor">Proctor Risk</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="audit">Audit/Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Candidate View</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="rounded-lg border bg-muted/30 p-4 text-sm text-slate-800"
                dangerouslySetInnerHTML={{ __html: question.questionHtml || "<p>No question content.</p>" }}
              />
              {question.options.length > 0 && (
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <div key={option.id} className="rounded-lg border px-3 py-2 text-sm">
                      <span className="font-semibold">{option.label}.</span> {option.text}
                    </div>
                  ))}
                </div>
              )}
              {question.options.length === 0 && (
                <div className="rounded-lg border px-3 py-3 text-sm text-muted-foreground">
                  Candidate response will be typed.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Core Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Type: {question.type}</p>
                <p>Difficulty: {question.difficultyLabel} (Score {question.difficultyScore}/5)</p>
                <p>Marks: {question.marks}</p>
                <p>Negative: {question.negativeMarks}</p>
                <p>Estimated Time: {question.estimatedTimeSec} sec</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Subject: {question.subject}</p>
                <p>Topic: {question.topic}</p>
                <p>Section: {question.sectionId}</p>
                <p>Tags: {question.tags.length ? question.tags.join(", ") : "--"}</p>
                <p>Language: {question.language}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Compatibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Allowed Pricing: {question.allowedPricing.join(", ")}</p>
                <p>Proctor Modes: {question.supportedProctorModes.join(", ")}</p>
                <p>Proctor Safe: {question.isProctorSafe ? "Yes" : "No"}</p>
                <p>Exclude from Strict Pools: {question.excludeFromStrictPools ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Status: {question.status}</p>
                <p>Needs Review: {question.needsReview ? "Yes" : "No"}</p>
                <p>Review Status: {question.reviewStatus}</p>
                <p>Review Priority: {question.reviewPriority}</p>
                <p>Assigned Reviewer: {question.assignedReviewerId || "--"}</p>
                <p>
                  Assigned At:{" "}
                  {question.assignedReviewerAt
                    ? format(new Date(question.assignedReviewerAt), "PPp")
                    : "--"}
                </p>
                <p>Reviewed By: {question.reviewedBy || "--"}</p>
                <p>
                  Reviewed At:{" "}
                  {question.reviewedAt ? format(new Date(question.reviewedAt), "PPp") : "--"}
                </p>
                <p>Review Notes: {question.reviewNotes || "--"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proctor">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Proctor Risk Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  {riskBadge(riskLevel)}
                  <span>{summary?.total ?? 0} mapped violations</span>
                  <span>{summary?.highSeverity ?? 0} high severity</span>
                </div>
                <div className="space-y-2">
                  {summary && Object.keys(summary.breakdown).length > 0 ? (
                    Object.entries(summary.breakdown).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span>{type}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No mapped violations yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risk Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <Button
                  variant="outline"
                  onClick={() => updateQuestion(question.id, { needsReview: true }).then(load)}
                >
                  Mark risky (needs review)
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    updateQuestion(question.id, { excludeFromStrictPools: true }).then(load)
                  }
                >
                  Exclude from strict pools
                </Button>
                <div className="space-y-2">
                  <Label>Cooldown Days</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={cooldownDays}
                      onChange={(event) => setCooldownDays(event.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const days = Number(cooldownDays || 0);
                        const cooldownUntil =
                          days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
                        updateQuestion(question.id, { cooldownUntil }).then(load);
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Mapped Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              {summary?.recentEvents.length ? (
                summary.recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <p className="font-medium">{event.eventType}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), "PPp")} • Candidate #{event.candidateId.slice(-3)}
                      </p>
                    </div>
                    <Badge variant={event.severity === "high" ? "danger-light" : event.severity === "medium" ? "warning-light" : "outline"}>
                      {event.severity}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No mapped events for this question.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Usage Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Times Used: {question.timesUsedInExams}</p>
                <p>Last Used: {question.lastUsedAt ? format(new Date(question.lastUsedAt), "PPp") : "--"}</p>
                <p>Exposure Risk: {question.exposureRisk}</p>
                <p>Flagged Count: {question.flaggedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cooldown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Cooldown Until: {question.cooldownUntil ? format(new Date(question.cooldownUntil), "PPp") : "--"}</p>
                <p>Needs Review: {question.needsReview ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Audit & Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>Latest update tracked by admin actions. Add internal notes here in the future.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
