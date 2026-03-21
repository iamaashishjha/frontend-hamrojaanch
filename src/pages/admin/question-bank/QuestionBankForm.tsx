import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import FormField from "@/components/admin/FormField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  createQuestion,
  getQuestion,
  initQuestionMedia,
  listQuestionMedia,
  updateQuestionMediaStatus,
  updateQuestion,
} from "@/lib/question-bank-api";
import type { Question, QuestionType } from "@/lib/question-bank-types";
import type { QuestionMediaAsset } from "@/lib/question-bank-api";

interface QuestionBankFormProps {
  mode: "create" | "edit";
  questionId?: string;
}

const tabItems = [
  { value: "content", label: "Content" },
  { value: "answers", label: "Answers" },
  { value: "marks", label: "Marks & Difficulty" },
  { value: "classification", label: "Classification" },
  { value: "compatibility", label: "Exam Compatibility" },
  { value: "leakage", label: "Leakage Controls" },
  { value: "review", label: "Review & Save" },
];

const makeDefaultQuestion = (): Question => ({
  id: "draft",
  title: "",
  questionHtml: "",
  type: "MCQ_SINGLE",
  options: [
    { id: "A", label: "A", text: "" },
    { id: "B", label: "B", text: "" },
    { id: "C", label: "C", text: "" },
    { id: "D", label: "D", text: "" },
  ],
  correctAnswers: [],
  explanationHtml: "",
  marks: 1,
  negativeMarks: 0,
  difficultyLabel: "Easy",
  difficultyScore: 2,
  subject: "",
  topic: "",
  sectionId: "",
  tags: [],
  estimatedTimeSec: 60,
  language: "EN",
  status: "INACTIVE",
  allowedPricing: ["FREE", "PAID"],
  supportedProctorModes: ["basic"],
  isProctorSafe: false,
  excludeFromStrictPools: false,
  timesUsedInExams: 0,
  lastUsedAt: null,
  exposureRisk: "LOW",
  cooldownUntil: null,
  needsReview: false,
  flaggedCount: 0,
  proctorViolationsCount: 0,
  topViolationTypes: {},
});

const questionTypeLabel = (value: QuestionType) =>
  value.replace("_", " ").replace("MCQ", "MCQ ");

export default function QuestionBankForm({ mode, questionId }: QuestionBankFormProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("content");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Question>(makeDefaultQuestion());
  const [cooldownDays, setCooldownDays] = useState("");
  const [mediaItems, setMediaItems] = useState<QuestionMediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaActionId, setMediaActionId] = useState<string | null>(null);

  const tagsInput = useMemo(() => form.tags.join(", "), [form.tags]);

  useEffect(() => {
    if (mode !== "edit" || !questionId) return;
    const load = async () => {
      setLoading(true);
      try {
        const existing = await getQuestion(questionId);
        if (!existing) {
          toast({
            variant: "destructive",
            title: "Question not found",
            description: "Unable to locate this question.",
          });
          navigate("/admin/question-bank");
          return;
        }
        setForm(existing);
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
    void load();
  }, [mode, questionId, navigate]);

  useEffect(() => {
    if (!form.cooldownUntil) {
      setCooldownDays("");
      return;
    }
    const diff = new Date(form.cooldownUntil).getTime() - Date.now();
    const days = Math.max(1, Math.ceil(diff / 86400000));
    setCooldownDays(String(days));
  }, [form.cooldownUntil]);

  useEffect(() => {
    if (mode !== "edit" || !questionId) return;
    const loadMedia = async () => {
      try {
        const items = await listQuestionMedia(questionId);
        setMediaItems(items);
      } catch {
        // Non-blocking for main form experience.
      }
    };
    void loadMedia();
  }, [mode, questionId]);

  const handleTypeChange = (value: QuestionType) => {
    if (value === "MCQ_SINGLE" || value === "MCQ_MULTI") {
      setForm((prev) => ({
        ...prev,
        type: value,
        options: prev.options.length ? prev.options : makeDefaultQuestion().options,
        correctAnswers: value === "MCQ_MULTI" ? prev.correctAnswers : prev.correctAnswers.slice(0, 1),
      }));
      return;
    }
    if (value === "TRUE_FALSE") {
      setForm((prev) => ({
        ...prev,
        type: value,
        options: [
          { id: "true", label: "True", text: "True" },
          { id: "false", label: "False", text: "False" },
        ],
        correctAnswers: ["true"],
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      type: value,
      options: [],
      correctAnswers: prev.correctAnswers.slice(0, 1),
    }));
  };

  const updateOptionText = (index: number, text: string) => {
    setForm((prev) => {
      const nextOptions = prev.options.map((option, idx) =>
        idx === index ? { ...option, text } : option
      );
      return { ...prev, options: nextOptions };
    });
  };

  const toggleMultiAnswer = (id: string) => {
    setForm((prev) => {
      const selected = prev.correctAnswers.includes(id)
        ? prev.correctAnswers.filter((item) => item !== id)
        : [...prev.correctAnswers, id];
      return { ...prev, correctAnswers: selected };
    });
  };

  const setSingleAnswer = (id: string) => {
    setForm((prev) => ({ ...prev, correctAnswers: [id] }));
  };

  const addOption = () => {
    setForm((prev) => {
      const nextIndex = prev.options.length;
      const label = String.fromCharCode(65 + nextIndex);
      return {
        ...prev,
        options: [...prev.options, { id: label, label, text: "" }],
      };
    });
  };

  const handleSave = async (nextStatus?: Question["status"]) => {
    if (form.supportedProctorModes.includes("strict") && !form.isProctorSafe) {
      toast({
        variant: "destructive",
        title: "Strict exam safety required",
        description: "Enable Proctor-safe to allow strict proctor compatibility.",
      });
      setActiveTab("compatibility");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, status: nextStatus ?? form.status };
      if (mode === "create") {
        const created = await createQuestion(payload);
        toast({ title: "Question created", description: "Question saved successfully." });
        navigate(`/admin/question-bank/${created.id}`);
      } else if (questionId) {
        await updateQuestion(questionId, payload);
        toast({ title: "Question updated", description: "Changes saved successfully." });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save question.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMediaPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!questionId || mode !== "edit") {
      toast({
        variant: "destructive",
        title: "Save question first",
        description: "Create the question first, then attach media in edit mode.",
      });
      return;
    }
    setMediaLoading(true);
    try {
      await initQuestionMedia(questionId, file);
      const items = await listQuestionMedia(questionId);
      setMediaItems(items);
      toast({
        title: "Media registered",
        description: "Question media metadata has been added to File Vault.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Media registration failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setMediaLoading(false);
      event.target.value = "";
    }
  };

  const handleMediaStatusChange = async (
    fileId: string,
    status: "safe" | "quarantined",
  ) => {
    if (!questionId || mode !== "edit") return;
    setMediaActionId(fileId);
    try {
      await updateQuestionMediaStatus(fileId, status);
      const items = await listQuestionMedia(questionId);
      setMediaItems(items);
      toast({
        title: "Media status updated",
        description: `Marked as ${status}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setMediaActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 rounded-2xl border bg-muted/30" />
        <div className="h-96 rounded-2xl border bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Create Question" : "Edit Question"}
        subtitle="Build exam-ready questions with proctor and pricing compatibility."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/admin/question-bank")}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-7">
          {tabItems.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <FormField label="Question Type" required hint="Choose the interaction style for candidates.">
              <Select value={form.type} onValueChange={(value) => handleTypeChange(value as QuestionType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "MCQ_SINGLE",
                    "MCQ_MULTI",
                    "TRUE_FALSE",
                    "SHORT",
                    "LONG",
                    "NUMERIC",
                    "CODING",
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      {questionTypeLabel(value as QuestionType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Title" hint="Optional. Short label for search and list; leave blank to use a snippet of the question text.">
              <Input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="e.g. Fractions addition, Capital of France"
              />
            </FormField>

            <FormField label="Question" required hint="Full question text shown to candidates. Use HTML if needed.">
              <Textarea
                rows={6}
                value={form.questionHtml}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, questionHtml: event.target.value }))
                }
                placeholder="Write the full question here..."
              />
            </FormField>

            <FormField
              label="Question Media (optional)"
              hint="Registers media in File Vault. In create mode, save first then attach."
            >
              <Input
                type="file"
                onChange={(event) => void handleMediaPick(event)}
                disabled={mode !== "edit" || mediaLoading}
              />
              <div className="mt-3 space-y-2">
                {mediaItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No media attached yet.</p>
                ) : (
                  mediaItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border px-3 py-2 text-xs text-muted-foreground space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{item.storageKey}</span>
                        <Badge variant={item.status === "quarantined" ? "destructive" : "secondary"}>
                          {item.status}
                        </Badge>
                        {item.previewUrl ? (
                          <a
                            className="text-primary underline"
                            href={item.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mediaActionId === item.id || item.status === "safe"}
                          onClick={() => void handleMediaStatusChange(item.id, "safe")}
                        >
                          Mark Safe
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={mediaActionId === item.id || item.status === "quarantined"}
                          onClick={() => void handleMediaStatusChange(item.id, "quarantined")}
                        >
                          Quarantine
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </FormField>
          </div>
        </TabsContent>

        <TabsContent value="answers" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            {(form.type === "MCQ_SINGLE" || form.type === "MCQ_MULTI") && (
              <FormField
                label="Answer Options"
                required
                hint="Keep options short and mutually exclusive."
              >
                {form.type === "MCQ_SINGLE" ? (
                  <RadioGroup
                    value={form.correctAnswers[0] ?? ""}
                    onValueChange={setSingleAnswer}
                    className="space-y-3"
                  >
                    {form.options.map((option, index) => (
                      <label key={option.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <RadioGroupItem value={option.id} />
                        <Input
                          value={option.text}
                          onChange={(event) => updateOptionText(index, event.target.value)}
                          placeholder={`Option ${option.label}`}
                        />
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-3">
                    {form.options.map((option, index) => (
                      <label key={option.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <Checkbox
                          checked={form.correctAnswers.includes(option.id)}
                          onCheckedChange={() => toggleMultiAnswer(option.id)}
                        />
                        <Input
                          value={option.text}
                          onChange={(event) => updateOptionText(index, event.target.value)}
                          placeholder={`Option ${option.label}`}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <Button variant="outline" onClick={addOption} className="mt-3">
                  Add Option
                </Button>
              </FormField>
            )}

            {form.type === "TRUE_FALSE" && (
              <FormField label="Correct Answer" required hint="Select the true/false response.">
                <RadioGroup
                  value={form.correctAnswers[0] ?? "true"}
                  onValueChange={setSingleAnswer}
                  className="space-y-2"
                >
                  {form.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <RadioGroupItem value={option.id} />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </RadioGroup>
              </FormField>
            )}

            {["SHORT", "LONG", "NUMERIC", "CODING"].includes(form.type) && (
              <FormField
                label="Expected Answer"
                required
                hint="Provide a model answer or evaluation notes for graders."
              >
                <Textarea
                  rows={6}
                  value={form.correctAnswers[0] ?? ""}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, correctAnswers: [event.target.value] }))
                  }
                  placeholder="Expected answer or rubric notes..."
                />
              </FormField>
            )}

            <FormField label="Explanation" hint="Shown after submission (optional).">
              <Textarea
                rows={5}
                value={form.explanationHtml}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, explanationHtml: event.target.value }))
                }
                placeholder="Provide a short explanation..."
              />
            </FormField>
          </div>
        </TabsContent>

        <TabsContent value="marks" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Marks" required hint="Points awarded for a correct response.">
                <Input
                  type="number"
                  value={form.marks}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, marks: Number(event.target.value) }))
                  }
                />
              </FormField>
              <FormField label="Negative Marks" hint="Penalty for incorrect answers (optional).">
                <Input
                  type="number"
                  value={form.negativeMarks}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, negativeMarks: Number(event.target.value) }))
                  }
                />
              </FormField>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Difficulty Label" required hint="Shown to admins and analytics.">
                <Select
                  value={form.difficultyLabel}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, difficultyLabel: value as Question["difficultyLabel"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Difficulty Score (1-5)" required hint="Used by auto-pick balancing.">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.difficultyScore}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, difficultyScore: Number(event.target.value) }))
                  }
                />
              </FormField>
            </div>

            <FormField label="Estimated Time (sec)" required hint="Helps pacing and timers.">
              <Input
                type="number"
                value={form.estimatedTimeSec}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, estimatedTimeSec: Number(event.target.value) }))
                }
              />
            </FormField>
          </div>
        </TabsContent>

        <TabsContent value="classification" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Subject" required hint="High-level curriculum grouping.">
                <Input
                  value={form.subject}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, subject: event.target.value }))
                  }
                  placeholder="e.g., Programming"
                />
              </FormField>
              <FormField label="Topic" required hint="Specific topic within the subject.">
                <Input
                  value={form.topic}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, topic: event.target.value }))
                  }
                  placeholder="e.g., Arrays"
                />
              </FormField>
            </div>

            <FormField label="Section ID" required hint="Section used by auto-pick by section.">
              <Input
                value={form.sectionId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sectionId: event.target.value }))
                }
                placeholder="e.g., sec_prog"
              />
            </FormField>

            <FormField label="Tags" hint="Comma separated keywords for search.">
              <Input
                value={tagsInput}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="e.g., arrays, loops, basics"
              />
            </FormField>

            <FormField label="Language" required hint="Primary language for the question.">
              <Select
                value={form.language}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, language: value as Question["language"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EN">English</SelectItem>
                  <SelectItem value="NE">Nepali</SelectItem>
                  <SelectItem value="MIXED">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </TabsContent>

        <TabsContent value="compatibility" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                label="Allowed Pricing"
                required
                hint="Select which exam pricing modes can use this question."
              >
                <div className="space-y-2">
                  {(["FREE", "PAID"] as const).map((value) => (
                    <label key={value} className="flex items-center gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={form.allowedPricing.includes(value)}
                        onCheckedChange={(checked) => {
                          setForm((prev) => ({
                            ...prev,
                            allowedPricing: checked
                              ? Array.from(new Set([...prev.allowedPricing, value]))
                              : prev.allowedPricing.filter((item) => item !== value),
                          }));
                        }}
                      />
                      <span>{value === "FREE" ? "Free/Demo Exams" : "Paid Exams"}</span>
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField
                label="Supported Proctor Modes"
                required
                hint="Strict mode requires proctor-safe questions."
              >
                <div className="space-y-2">
                  {(["basic", "strict"] as const).map((value) => (
                    <label key={value} className="flex items-center gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={form.supportedProctorModes.includes(value)}
                        onCheckedChange={(checked) => {
                          setForm((prev) => ({
                            ...prev,
                            supportedProctorModes: checked
                              ? Array.from(new Set([...prev.supportedProctorModes, value]))
                              : prev.supportedProctorModes.filter((item) => item !== value),
                          }));
                        }}
                      />
                      <span className="capitalize">{value} proctor</span>
                    </label>
                  ))}
                </div>
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Proctor-safe</p>
                  <p className="text-xs text-muted-foreground">
                    Required for strict exams. Turn on only if cheating risk is low.
                  </p>
                </div>
                <Switch
                  checked={form.isProctorSafe}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isProctorSafe: checked }))}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Exclude from strict pools</p>
                  <p className="text-xs text-muted-foreground">
                    Keeps this question out of strict auto-pick.
                  </p>
                </div>
                <Switch
                  checked={form.excludeFromStrictPools}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, excludeFromStrictPools: checked }))
                  }
                />
              </label>
            </div>

            {form.supportedProctorModes.includes("strict") && !form.isProctorSafe && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Strict proctor mode selected. Enable Proctor-safe to allow this question in strict exams.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leakage" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
            <FormField label="Cooldown Days" hint="Cooldown removes the question from auto-pick pools.">
              <Input
                type="number"
                value={cooldownDays}
                onChange={(event) => {
                  const value = event.target.value;
                  setCooldownDays(value);
                  const days = Number(value || 0);
                  setForm((prev) => ({
                    ...prev,
                    cooldownUntil:
                      days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
                  }));
                }}
                placeholder="e.g., 7"
              />
            </FormField>

            <label className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Needs review</p>
                <p className="text-xs text-muted-foreground">
                  Flag for content review before further use.
                </p>
              </div>
              <Switch
                checked={form.needsReview}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, needsReview: checked }))}
              />
            </label>
          </div>
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{form.type.replace("_", " ")}</Badge>
              <Badge variant="secondary">{form.difficultyLabel}</Badge>
              {form.allowedPricing.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
              {form.supportedProctorModes.map((item) => (
                <Badge key={item} variant="warning-light">
                  {item}
                </Badge>
              ))}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Title</p>
              <p className="text-base font-semibold">{form.title || "Untitled"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Marks</p>
              <p className="text-base font-semibold">{form.marks} marks</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Classification</p>
              <p className="text-sm">
                {form.subject || "--"} / {form.topic || "--"} / {form.sectionId || "--"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as Question["status"] }))
                }
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INACTIVE">Draft (Inactive)</SelectItem>
                  <SelectItem value="ACTIVE">Publish (Active)</SelectItem>
                  <SelectItem value="ARCHIVED">Archive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => void handleSave("INACTIVE")} disabled={saving}>
                Save Draft
              </Button>
              <Button onClick={() => void handleSave("ACTIVE")} disabled={saving}>
                Publish
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
