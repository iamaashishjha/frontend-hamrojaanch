import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import {
  createExam,
  createExamGroup,
  getExam,
  getExamLookups,
  publishExam,
  regenerateLink,
  syncManualExamQuestions,
  updateExam,
} from "@/lib/exams-module-api";
import type {
  ExamLookups,
  SectionConfig,
  UpsertExamPayload,
} from "@/lib/exams-module-types";
import {
  listExamCompatibleQuestions,
  listQuestions,
  pickBalancedQuestions,
} from "@/lib/question-bank-api";
import type { Question } from "@/lib/question-bank-types";

interface ExamWizardPageProps {
  mode: "create" | "edit";
}

interface WizardStoreValue {
  draft: UpsertExamPayload;
  setDraft: React.Dispatch<React.SetStateAction<UpsertExamPayload>>;
  resetDraft: () => void;
}

const WizardStoreContext = createContext<WizardStoreValue | null>(null);

const WIZARD_STORAGE_KEY = "hj_exam_wizard_draft_v1";

const steps = ["Basics", "Access", "Questions", "Rules & Security", "Review & Publish"];

function getDefaultPricing() {
  return {
    mode: "FREE" as const,
    isDemo: false,
    requireLoginForFree: false,
    price: null as number | null,
    currency: "NPR" as const,
    discountPrice: null as number | null,
    validityDays: null as number | null,
    paymentRequiredBeforeStart: false,
    showOnStorefront: true,
  };
}

function resolvePricing(
  draft: UpsertExamPayload & { pricing?: UpsertExamPayload["pricing"]; advanced?: { paidEnabled?: boolean; price?: number } }
) {
  const pricing = draft.pricing;
  const defaults = getDefaultPricing();
  if (pricing) {
    return {
      ...defaults,
      ...pricing,
      mode: pricing.mode ?? defaults.mode,
    };
  }
  const fromLegacyPaid = Boolean(draft.advanced?.paidEnabled);
  return {
    ...defaults,
    mode: fromLegacyPaid ? "PAID" : "FREE",
    price: fromLegacyPaid ? draft.advanced?.price ?? null : null,
    paymentRequiredBeforeStart: fromLegacyPaid,
  };
}

function makeDefaultDraft(): UpsertExamPayload {
  return {
    name: "",
    thumbnailUrl: "",
    category: "General",
    type: "group",
    status: "draft",
    durationMinutes: 60,
    negativeMarking: { mode: "none" },
    availability: { mode: "always" },
    attemptsAllowed: 1,
    allowEarlySubmit: true,
    showCountdown: true,
    access: {
      targetType: "all",
      groupIds: [],
      candidateIds: [],
    },
    questionsMode: "auto",
    sectionsConfig: [],
    selectedQuestionIds: [],
    randomizeQuestions: true,
    randomizeOptions: true,
    rules: {
      allowBackNav: true,
      allowSkip: true,
      showResultsWhen: "after_completion",
      showCorrectAnswersWhen: "never",
    },
    security: {
      preset: "basic",
      trustedIpEnabled: false,
      watermarkEnabled: true,
      proctoringEnabled: true,
      fullscreenRequired: true,
      disableCopyPaste: true,
    },
    evidencePlayback: {
      candidateCanViewWebcam: true,
      candidateCanViewScreen: false,
      candidateCanDownload: false,
      visibleDelayMinutes: 0,
      hideProctorNotes: true,
      legalHold: false,
    },
    pricing: getDefaultPricing(),
    advanced: {
      webhookEnabled: false,
    },
    createdBy: "Admin",
  };
}

function WizardStoreProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useLocalStorageState<UpsertExamPayload>(WIZARD_STORAGE_KEY, makeDefaultDraft());

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft: () => setDraft(makeDefaultDraft()),
    }),
    [draft, setDraft]
  );

  return <WizardStoreContext.Provider value={value}>{children}</WizardStoreContext.Provider>;
}

function useWizardStore() {
  const context = useContext(WizardStoreContext);
  if (!context) {
    throw new Error("useWizardStore must be used within WizardStoreProvider");
  }
  return context;
}

function validateStep(step: number, draft: UpsertExamPayload): string[] {
  const errors: string[] = [];
  const pricing = resolvePricing(draft as UpsertExamPayload & { pricing?: UpsertExamPayload["pricing"]; advanced?: { paidEnabled?: boolean; price?: number } });
  if (step === 0) {
    if (!draft.name.trim()) errors.push("Exam name is required.");
    if (draft.durationMinutes <= 0) errors.push("Duration must be greater than 0.");
    if (draft.negativeMarking.mode !== "none" && (!draft.negativeMarking.value || draft.negativeMarking.value <= 0)) {
      errors.push("Negative marking value must be set.");
    }
    if (draft.availability.mode === "scheduled") {
      if (!draft.availability.startAt || !draft.availability.endAt) errors.push("Scheduled start and end are required.");
      if (draft.availability.startAt && draft.availability.endAt) {
        if (new Date(draft.availability.endAt).getTime() <= new Date(draft.availability.startAt).getTime()) {
          errors.push("Scheduled end must be after start.");
        }
      }
    }
    if (draft.availability.mode === "dailySlot") {
      if (!draft.availability.startTime || !draft.availability.endTime) errors.push("Daily slot start and end time are required.");
    }
    if (pricing.mode === "PAID") {
      if (!pricing.price || pricing.price <= 0) {
        errors.push("Price must be greater than 0 for paid exams.");
      }
      if (
        typeof pricing.discountPrice === "number" &&
        pricing.discountPrice > 0 &&
        (!pricing.price || pricing.discountPrice >= pricing.price)
      ) {
        errors.push("Discount price must be lower than base price.");
      }
    }
  }

  if (step === 1) {
    if (draft.type === "group" || draft.type === "series") {
      if (draft.access.targetType === "groups" && draft.access.groupIds.length === 0) {
        errors.push("Select at least one group.");
      }
      if (draft.access.targetType === "candidates" && draft.access.candidateIds.length === 0) {
        errors.push("Select at least one candidate.");
      }
    }
    if (draft.type === "link" && draft.access.linkSettings) {
      if (draft.access.linkSettings.visibility === "require_pin" && !draft.access.linkSettings.pin?.trim()) {
        errors.push("PIN is required for link visibility 'require PIN'.");
      }
      if (draft.access.linkSettings.expiryMode === "datetime" && !draft.access.linkSettings.expiresAt) {
        errors.push("Expiry date/time is required for scheduled expiry.");
      }
    }
  }

  if (step === 2) {
    if (draft.questionsMode === "auto") {
      if (draft.sectionsConfig.length === 0) errors.push("Add at least one section configuration.");
      draft.sectionsConfig.forEach((section, index) => {
        if (!section.sectionId) errors.push(`Section ${index + 1}: section is required.`);
        if (section.questionCount <= 0) errors.push(`Section ${index + 1}: question count must be greater than 0.`);
        if (section.marksPerQuestion <= 0) errors.push(`Section ${index + 1}: marks per question must be greater than 0.`);
      });
    } else if (draft.selectedQuestionIds.length === 0) {
      errors.push("Select at least one question in manual mode.");
    }
  }

  if (step === 3) {
    if (draft.rules.passMarkPercent !== undefined) {
      if (draft.rules.passMarkPercent < 0 || draft.rules.passMarkPercent > 100) {
        errors.push("Pass mark must be between 0 and 100.");
      }
    }
  }

  return errors;
}

function getQuestionSummary(draft: UpsertExamPayload, questionBank: Question[]) {
  if (draft.questionsMode === "auto") {
    const totalQuestions = draft.sectionsConfig.reduce((sum, section) => sum + section.questionCount, 0);
    const totalMarks = draft.sectionsConfig.reduce(
      (sum, section) => sum + section.questionCount * section.marksPerQuestion,
      0
    );
    return {
      totalQuestions,
      totalMarks,
      avgTimePerQuestion: totalQuestions > 0 ? Number((draft.durationMinutes / totalQuestions).toFixed(2)) : 0,
    };
  }

  const selected = questionBank.filter((question) => draft.selectedQuestionIds.includes(question.id));
  const totalQuestions = draft.selectedQuestionIds.length;
  const totalMarks = selected.reduce((sum, question) => sum + question.marks, 0);
  return {
    totalQuestions,
    totalMarks,
    avgTimePerQuestion: totalQuestions > 0 ? Number((draft.durationMinutes / totalQuestions).toFixed(2)) : 0,
  };
}

function getDifficultyBreakdown(pool: Question[]) {
  return pool.reduce(
    (acc, question) => {
      if (question.difficultyLabel === "Easy") acc.easy += 1;
      else if (question.difficultyLabel === "Medium") acc.medium += 1;
      else acc.hard += 1;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 }
  );
}

export default function ExamWizardPage({ mode }: ExamWizardPageProps) {
  return (
    <WizardStoreProvider>
      <ExamWizardPageContent mode={mode} />
    </WizardStoreProvider>
  );
}

function ExamWizardPageContent({ mode }: ExamWizardPageProps) {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const { draft, setDraft, resetDraft } = useWizardStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [currentExamId, setCurrentExamId] = useState<string | null>(examId ?? null);

  const [lookups, setLookups] = useState<ExamLookups>({
    groups: [],
    candidates: [],
    sections: [],
    certificateTemplates: [],
    categories: [],
  });
  const [groupQuickInput, setGroupQuickInput] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionSectionFilter, setQuestionSectionFilter] = useState("all");
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState("all");
  const [pricingConfirmed, setPricingConfirmed] = useState(false);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [questionCatalog, setQuestionCatalog] = useState<Question[]>([]);
  const [autoBalanceEnabled, setAutoBalanceEnabled] = useState(true);
  const [autoMix, setAutoMix] = useState({ easy: 40, medium: 40, hard: 20 });
  const [autoPreferLowExposure, setAutoPreferLowExposure] = useState(true);
  const [autoPickPreview, setAutoPickPreview] = useState<{
    selectedIds: string[];
    warnings: string[];
    breakdown: { easy: number; medium: number; hard: number };
    exposureScore: number;
    sections: {
      configId: string;
      sectionId: string;
      sectionLabel: string;
      requested: number;
      available: number;
      poolBreakdown: { easy: number; medium: number; hard: number };
      selectedBreakdown: { easy: number; medium: number; hard: number };
      mixUsed: { easy: number; medium: number; hard: number };
    }[];
  } | null>(null);
  const [autoPickLoading, setAutoPickLoading] = useState(false);

  const pricing = resolvePricing(
    draft as UpsertExamPayload & { pricing?: UpsertExamPayload["pricing"]; advanced?: { paidEnabled?: boolean; price?: number } }
  );

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  useEffect(() => {
    setPricingConfirmed(false);
  }, [
    pricing.mode,
    pricing.isDemo,
    pricing.requireLoginForFree,
    pricing.price,
    pricing.currency,
    pricing.discountPrice,
    pricing.validityDays,
    pricing.paymentRequiredBeforeStart,
    pricing.showOnStorefront,
    draft.access.targetType,
    draft.access.groupIds.length,
    draft.access.candidateIds.length,
  ]);

  useEffect(() => {
    if ((draft as UpsertExamPayload & { pricing?: UpsertExamPayload["pricing"] }).pricing) return;
    setDraft((prev) => ({
      ...prev,
      pricing,
      advanced: {
        webhookEnabled: Boolean(prev.advanced?.webhookEnabled),
        certificateTemplateId: prev.advanced?.certificateTemplateId,
      },
    }));
  }, [draft, pricing, setDraft]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const nextLookups = await getExamLookups();
        setLookups(nextLookups);
        if (mode === "edit" && examId) {
          const existing = await getExam(examId);
          if (!existing) {
            notifyError("Exam not found.");
            navigate("/admin/exams", { replace: true });
            return;
          }
          setDraft({
            ...existing,
            id: undefined,
            createdAt: undefined,
            updatedAt: undefined,
            candidateMetrics: undefined,
          } as unknown as UpsertExamPayload);
          setCurrentExamId(existing.id);
        }
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load wizard data.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [mode, examId]);

  const examSnapshot = useMemo(
    () => ({
      pricingMode: pricing.mode === "PAID" ? "PAID" : "FREE",
      proctorPreset: draft.security.preset,
    }),
    [pricing.mode, draft.security.preset]
  );

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const catalog = await listQuestions();
        setQuestionCatalog(catalog);
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load question catalog.");
      }
    };
    void loadCatalog();
  }, []);

  useEffect(() => {
    const loadPool = async () => {
      try {
        const pool = await listExamCompatibleQuestions(currentExamId ?? "draft", {
          examSnapshot,
        });
        setQuestionPool(pool);
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load question pool.");
      }
    };
    void loadPool();
  }, [currentExamId, examSnapshot]);

  const filteredCandidates = useMemo(() => {
    if (!candidateSearch.trim()) return lookups.candidates;
    const query = candidateSearch.toLowerCase();
    return lookups.candidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(query) ||
        candidate.email.toLowerCase().includes(query) ||
        candidate.phone.toLowerCase().includes(query)
    );
  }, [candidateSearch, lookups.candidates]);

  const filteredQuestions = useMemo(() => {
    const query = questionSearch.toLowerCase().trim();
    return questionPool.filter((question) => {
      if (questionSectionFilter !== "all" && question.sectionId !== questionSectionFilter) return false;
      if (questionDifficultyFilter !== "all" && question.difficultyLabel !== questionDifficultyFilter) return false;
      if (
        query &&
        !(
          question.title.toLowerCase().includes(query) ||
          question.tags.join(" ").toLowerCase().includes(query)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [questionPool, questionSearch, questionSectionFilter, questionDifficultyFilter]);

  const poolStatsBySection = useMemo(() => {
    const stats: Record<
      string,
      { total: number; breakdown: { easy: number; medium: number; hard: number } }
    > = {};
    questionPool.forEach((question) => {
      const key = question.sectionId;
      if (!stats[key]) {
        stats[key] = { total: 0, breakdown: { easy: 0, medium: 0, hard: 0 } };
      }
      stats[key].total += 1;
      if (question.difficultyLabel === "Easy") stats[key].breakdown.easy += 1;
      else if (question.difficultyLabel === "Medium") stats[key].breakdown.medium += 1;
      else stats[key].breakdown.hard += 1;
    });
    return stats;
  }, [questionPool]);

  const allStepErrors = useMemo(() => {
    return steps.flatMap((_, index) => validateStep(index, draft));
  }, [draft]);

  const questionSummary = useMemo(
    () => getQuestionSummary(draft, questionCatalog),
    [draft, questionCatalog]
  );

  const goNext = () => {
    const errors = validateStep(step, draft);
    if (errors.length > 0) {
      notifyError(errors[0]);
      return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 0));

  const saveDraft = async () => {
    if (pricing.mode === "PAID") {
      if (!pricing.price || pricing.price <= 0) {
        notifyError("Set a valid paid price before saving.");
        setStep(0);
        return;
      }
      if (
        typeof pricing.discountPrice === "number" &&
        pricing.discountPrice > 0 &&
        pricing.discountPrice >= pricing.price
      ) {
        notifyError("Discount price must be lower than base price.");
        setStep(0);
        return;
      }
    }

    setSaving(true);
    try {
      let examRecordId = currentExamId;
      if (examRecordId) {
        const updated = await updateExam(examRecordId, { ...draft, pricing, status: "draft" });
        setDraft({
          ...updated,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          candidateMetrics: undefined,
        } as unknown as UpsertExamPayload);
      } else {
        const created = await createExam({ ...draft, pricing, status: "draft" });
        examRecordId = created.id;
        setCurrentExamId(created.id);
        setDraft({
          ...created,
          id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          candidateMetrics: undefined,
        } as unknown as UpsertExamPayload);
      }

      // For manual mode, keep exam_question mappings in sync with selectedQuestionIds
      if (examRecordId && draft.questionsMode === "manual") {
        await syncManualExamQuestions(examRecordId, draft.selectedQuestionIds);
      }
      notifySuccess("Exam draft saved.");
      if (mode === "create" && examRecordId) {
        navigate(`/admin/exams/${examRecordId}/edit`, { replace: true });
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (allStepErrors.length > 0) {
      notifyError(allStepErrors[0]);
      setStep(0);
      return;
    }
    if (!pricingConfirmed) {
      notifyError("Confirm pricing and access rules before publishing.");
      setStep(4);
      return;
    }
    setPublishing(true);
    try {
      let examRecordId = currentExamId;
      if (examRecordId) {
        await updateExam(examRecordId, { ...draft, pricing });
        if (draft.questionsMode === "manual") {
          await syncManualExamQuestions(examRecordId, draft.selectedQuestionIds);
        }
        await publishExam(examRecordId);
      } else {
        const created = await createExam({ ...draft, pricing, status: "draft" });
        examRecordId = created.id;
        if (draft.questionsMode === "manual") {
          await syncManualExamQuestions(examRecordId, draft.selectedQuestionIds);
        }
        await publishExam(examRecordId);
      }
      notifySuccess("Exam published successfully.");
      resetDraft();
      navigate(`/admin/exams/${examRecordId}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to publish exam.");
    } finally {
      setPublishing(false);
    }
  };

  const addSectionBlock = () => {
    const section: SectionConfig = {
      id: `section_${Math.random().toString(36).slice(2, 9)}`,
      sectionId: "",
      questionCount: 10,
      marksPerQuestion: 1,
    };
    setDraft((prev) => ({ ...prev, sectionsConfig: [...prev.sectionsConfig, section] }));
  };

  const updateSectionBlock = (id: string, update: Partial<SectionConfig>) => {
    setDraft((prev) => ({
      ...prev,
      sectionsConfig: prev.sectionsConfig.map((section) => (section.id === id ? { ...section, ...update } : section)),
    }));
  };

  const removeSectionBlock = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      sectionsConfig: prev.sectionsConfig.filter((section) => section.id !== id),
    }));
  };

  const addQuestion = (questionId: string) => {
    setDraft((prev) => ({
      ...prev,
      selectedQuestionIds: prev.selectedQuestionIds.includes(questionId)
        ? prev.selectedQuestionIds
        : [...prev.selectedQuestionIds, questionId],
    }));
  };

  const removeQuestion = (questionId: string) => {
    setDraft((prev) => ({
      ...prev,
      selectedQuestionIds: prev.selectedQuestionIds.filter((id) => id !== questionId),
    }));
  };

  const addGroupQuick = async () => {
    const name = groupQuickInput.trim();
    if (!name) return;
    try {
      const created = await createExamGroup({ name });
      setLookups((prev) => ({
        ...prev,
        groups: [...prev.groups, created],
      }));
      setGroupQuickInput("");
      notifySuccess("Group added for selection.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to add group.");
    }
  };

  const autoMixTotal = autoMix.easy + autoMix.medium + autoMix.hard;

  const generateAutoPickPreview = async () => {
    if (draft.sectionsConfig.length === 0) {
      setAutoPickPreview(null);
      return;
    }
    if (autoBalanceEnabled && autoMixTotal !== 100) {
      notifyError("Difficulty mix must total 100%.");
      return;
    }
    setAutoPickLoading(true);
    try {
      const poolBase = questionPool;
      const totalQuestions = draft.sectionsConfig.reduce((sum, section) => sum + section.questionCount, 0);
      if (totalQuestions === 0) {
        setAutoPickPreview(null);
        return;
      }

      const deriveMix = (pool: Question[]) => {
        const counts = getDifficultyBreakdown(pool);
        const total = counts.easy + counts.medium + counts.hard || 1;
        return {
          easy: Math.round((counts.easy / total) * 100),
          medium: Math.round((counts.medium / total) * 100),
          hard: Math.max(
            0,
            100 - Math.round((counts.easy / total) * 100) - Math.round((counts.medium / total) * 100)
          ),
        };
      };

      const sectionPools = draft.sectionsConfig.map((section, index) => {
        const sectionPool = poolBase.filter((question) => question.sectionId === section.sectionId);
        const sectionLabel =
          lookups.sections.find((item) => item.id === section.sectionId)?.name ?? `Section ${index + 1}`;
        return {
          section,
          sectionPool,
          sectionLabel,
          mixUsed: autoBalanceEnabled ? autoMix : deriveMix(sectionPool),
        };
      });

      const sectionResults = await Promise.all(
        sectionPools.map(({ section, sectionPool, mixUsed }) =>
          pickBalancedQuestions({
            pool: sectionPool,
            count: section.questionCount,
            mixPercent: mixUsed,
            constraints: { preferLowExposure: autoPreferLowExposure },
          })
        )
      );

      const combined = sectionResults.reduce(
        (acc, result, index) => {
          acc.selectedIds.push(...result.selectedIds);
          acc.warnings.push(
            ...result.warnings.map((warning) => `Section ${index + 1}: ${warning}`)
          );
          acc.breakdown.easy += result.breakdown.easy;
          acc.breakdown.medium += result.breakdown.medium;
          acc.breakdown.hard += result.breakdown.hard;
          acc.exposureScore += result.exposureScore * result.selectedIds.length;
          return acc;
        },
        {
          selectedIds: [] as string[],
          warnings: [] as string[],
          breakdown: { easy: 0, medium: 0, hard: 0 },
          exposureScore: 0,
        }
      );

      const exposureScore =
        combined.selectedIds.length > 0
          ? Math.round(combined.exposureScore / combined.selectedIds.length)
          : 0;

      const sectionSummaries = sectionPools.map((entry, index) => ({
        configId: entry.section.id,
        sectionId: entry.section.sectionId,
        sectionLabel: entry.sectionLabel,
        requested: entry.section.questionCount,
        available: entry.sectionPool.length,
        poolBreakdown: getDifficultyBreakdown(entry.sectionPool),
        selectedBreakdown: sectionResults[index]?.breakdown ?? { easy: 0, medium: 0, hard: 0 },
        mixUsed: entry.mixUsed,
      }));

      setAutoPickPreview({
        selectedIds: combined.selectedIds,
        warnings: combined.warnings,
        breakdown: combined.breakdown,
        exposureScore,
        sections: sectionSummaries,
      });
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to generate auto-pick preview.");
    } finally {
      setAutoPickLoading(false);
    }
  };

  useEffect(() => {
    if (draft.questionsMode !== "auto") return;
    void generateAutoPickPreview();
  }, [
    draft.questionsMode,
    draft.sectionsConfig,
    autoBalanceEnabled,
    autoMix.easy,
    autoMix.medium,
    autoMix.hard,
    autoPreferLowExposure,
    questionPool,
    lookups.sections,
  ]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {mode === "create" ? "Create Exam" : "Edit Exam"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure access, questions, rules, security, and publish settings.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin/exams")}>
          Cancel
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {steps.map((stepName, index) => (
                <Button
                  key={stepName}
                  size="sm"
                  variant={index === step ? "default" : "outline"}
                  onClick={() => setStep(index)}
                >
                  {index + 1}. {stepName}
                </Button>
              ))}
            </div>
            <Badge variant="outline">
              {step + 1} / {steps.length}
            </Badge>
          </div>
          <Progress value={((step + 1) / steps.length) * 100} />
        </CardContent>
      </Card>

      {step === 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Step 1: Basics</CardTitle>
            <CardDescription>Define exam identity, duration, scoring, and availability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Exam Name *</Label>
                <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Thumbnail image URL (optional)</Label>
                <Input
                  value={draft.thumbnailUrl ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      thumbnailUrl: e.target.value || undefined,
                    }))
                  }
                  placeholder="https://example.com/mbbs-test1.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Used on the student exams catalog card on the All Exams page. Leave blank to use the default
                  illustration.
                </p>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Category</Label>
                <Select
                  value={draft.category ?? "uncategorized"}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      category: value === "uncategorized" ? undefined : value,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uncategorized">Uncategorized</SelectItem>
                    {lookups.categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for storefront grouping and search filters.
                </p>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <Label>Type</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { value: "group", label: "Group Exam", desc: "Assign to groups/candidates." },
                    { value: "link", label: "Link Exam", desc: "Shareable link based access." },
                    { value: "series", label: "Series", desc: "Multi-exam flow.", badge: "Upgrade" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, type: item.value as typeof prev.type }))}
                      className={`rounded-md border p-3 text-left ${
                        draft.type === item.value ? "border-blue-500 bg-blue-50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                        {item.badge && <Badge variant="outline">{item.badge}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <Label>Pricing</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => {
                        const prevPricing = resolvePricing(
                          prev as UpsertExamPayload & {
                            pricing?: UpsertExamPayload["pricing"];
                            advanced?: { paidEnabled?: boolean; price?: number };
                          }
                        );
                        return {
                          ...prev,
                          pricing: {
                            ...prevPricing,
                            mode: "FREE",
                            price: null,
                            discountPrice: null,
                            validityDays: null,
                            paymentRequiredBeforeStart: false,
                          },
                        };
                      })
                    }
                    className={`rounded-md border p-3 text-left ${pricing.mode === "FREE" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
                  >
                    <p className="text-sm font-semibold text-slate-800">Free</p>
                    <p className="mt-1 text-xs text-slate-500">No payment required before attempt.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => {
                        const prevPricing = resolvePricing(
                          prev as UpsertExamPayload & {
                            pricing?: UpsertExamPayload["pricing"];
                            advanced?: { paidEnabled?: boolean; price?: number };
                          }
                        );
                        return {
                          ...prev,
                          pricing: {
                            ...prevPricing,
                            mode: "PAID",
                            isDemo: false,
                            requireLoginForFree: false,
                            price: prevPricing.price && prevPricing.price > 0 ? prevPricing.price : 499,
                            currency: prevPricing.currency ?? "NPR",
                            paymentRequiredBeforeStart: true,
                            showOnStorefront: true,
                          },
                        };
                      })
                    }
                    className={`rounded-md border p-3 text-left ${pricing.mode === "PAID" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
                  >
                    <p className="text-sm font-semibold text-slate-800">Paid</p>
                    <p className="mt-1 text-xs text-slate-500">Students purchase exam before they can start.</p>
                  </button>
                </div>

                {pricing.mode === "FREE" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                      <div className="space-y-1">
                        <span className="text-sm">Mark as Demo/Trial</span>
                        <p className="text-xs text-slate-500">Free exam used for promotion and trial.</p>
                      </div>
                      <Switch
                        checked={pricing.isDemo}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            pricing: {
                              ...resolvePricing(
                                prev as UpsertExamPayload & {
                                  pricing?: UpsertExamPayload["pricing"];
                                  advanced?: { paidEnabled?: boolean; price?: number };
                                }
                              ),
                              mode: "FREE",
                              isDemo: checked,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm">Require login for free exam</span>
                      <Switch
                        checked={pricing.requireLoginForFree}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            pricing: {
                              ...resolvePricing(
                                prev as UpsertExamPayload & {
                                  pricing?: UpsertExamPayload["pricing"];
                                  advanced?: { paidEnabled?: boolean; price?: number };
                                }
                              ),
                              mode: "FREE",
                              requireLoginForFree: checked,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm">Show on storefront</span>
                      <Switch
                        checked={pricing.showOnStorefront}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            pricing: {
                              ...resolvePricing(
                                prev as UpsertExamPayload & {
                                  pricing?: UpsertExamPayload["pricing"];
                                  advanced?: { paidEnabled?: boolean; price?: number };
                                }
                              ),
                              mode: "FREE",
                              showOnStorefront: checked,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-2 sm:col-span-2">
                        <Label>Price *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={pricing.price ?? ""}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                price: e.target.value ? Number(e.target.value) : null,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Currency</Label>
                        <Select
                          value={pricing.currency}
                          onValueChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                currency: value as "NPR" | "USD" | "INR",
                              },
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NPR">NPR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="INR">INR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Discount Price (optional)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={pricing.discountPrice ?? ""}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                discountPrice: e.target.value ? Number(e.target.value) : null,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Validity</Label>
                        <Select
                          value={pricing.validityDays === null ? "lifetime" : "days"}
                          onValueChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                validityDays: value === "lifetime" ? null : Math.max(1, pricing.validityDays ?? 30),
                              },
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lifetime">Lifetime</SelectItem>
                            <SelectItem value="days">X Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {pricing.validityDays !== null && (
                      <div className="grid gap-2 sm:max-w-xs">
                        <Label>Validity Days</Label>
                        <Input
                          type="number"
                          min={1}
                          value={pricing.validityDays}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                validityDays: e.target.value ? Math.max(1, Number(e.target.value)) : 30,
                              },
                            }))
                          }
                        />
                      </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center justify-between rounded-md border p-3">
                        <div className="space-y-1">
                          <span className="text-sm">Payment required before start</span>
                          <p className="text-xs text-slate-500">Students must pay before they can start the exam.</p>
                        </div>
                        <Switch
                          checked={pricing.paymentRequiredBeforeStart}
                          onCheckedChange={(checked) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                paymentRequiredBeforeStart: checked,
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm">Show on storefront</span>
                        <Switch
                          checked={pricing.showOnStorefront}
                          onCheckedChange={(checked) =>
                            setDraft((prev) => ({
                              ...prev,
                              pricing: {
                                ...resolvePricing(
                                  prev as UpsertExamPayload & {
                                    pricing?: UpsertExamPayload["pricing"];
                                    advanced?: { paidEnabled?: boolean; price?: number };
                                  }
                                ),
                                mode: "PAID",
                                showOnStorefront: checked,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={draft.durationMinutes}
                  onChange={(e) => setDraft((prev) => ({ ...prev, durationMinutes: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Attempts Allowed</Label>
                <Input
                  type="number"
                  value={draft.attemptsAllowed}
                  onChange={(e) => setDraft((prev) => ({ ...prev, attemptsAllowed: Number(e.target.value || 1) }))}
                />
              </div>

              <div className="grid gap-2">
                <Label>Negative Marking</Label>
                <Select
                  value={draft.negativeMarking.mode}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      negativeMarking: { ...prev.negativeMarking, mode: value as typeof prev.negativeMarking.mode },
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Negative Value</Label>
                <Input
                  type="number"
                  disabled={draft.negativeMarking.mode === "none"}
                  value={draft.negativeMarking.value ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      negativeMarking: {
                        ...prev.negativeMarking,
                        value: e.target.value ? Number(e.target.value) : undefined,
                      },
                    }))
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Availability</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "always", label: "Always" },
                  { value: "scheduled", label: "Scheduled Window" },
                  { value: "dailySlot", label: "Daily Slot" },
                ].map((item) => (
                  <Button
                    key={item.value}
                    variant={draft.availability.mode === item.value ? "default" : "outline"}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, availability: { ...prev.availability, mode: item.value as typeof prev.availability.mode } }))
                    }
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {draft.availability.mode === "scheduled" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Start</Label>
                    <Input
                      type="datetime-local"
                      value={draft.availability.startAt ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, availability: { ...prev.availability, startAt: e.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End</Label>
                    <Input
                      type="datetime-local"
                      value={draft.availability.endAt ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, availability: { ...prev.availability, endAt: e.target.value } }))}
                    />
                  </div>
                </div>
              )}

              {draft.availability.mode === "dailySlot" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Daily Start</Label>
                    <Input
                      type="time"
                      value={draft.availability.startTime ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, availability: { ...prev.availability, startTime: e.target.value } }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Daily End</Label>
                    <Input
                      type="time"
                      value={draft.availability.endTime ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, availability: { ...prev.availability, endTime: e.target.value } }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Allow Early Submit</span>
                <Switch checked={draft.allowEarlySubmit} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, allowEarlySubmit: checked }))} />
              </label>
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Show Countdown</span>
                <Switch checked={draft.showCountdown} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showCountdown: checked }))} />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Step 2: Access</CardTitle>
            <CardDescription>Define who can attempt this exam.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pricing.mode === "PAID" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This is a PAID exam. Students must pay before starting.
              </div>
            )}
            {pricing.mode === "FREE" && pricing.isDemo && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                This is a FREE demo/trial exam.
              </div>
            )}
            {(draft.type === "group" || draft.type === "series") && (
              <div className="space-y-4">
                <Label>Target</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { value: "all", label: "All Candidates" },
                    { value: "groups", label: "Selected Groups" },
                    { value: "candidates", label: "Selected Candidates" },
                  ].map((item) => (
                    <Button
                      key={item.value}
                      variant={draft.access.targetType === item.value ? "default" : "outline"}
                      onClick={() => setDraft((prev) => ({ ...prev, access: { ...prev.access, targetType: item.value as typeof prev.access.targetType } }))}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                {draft.access.targetType === "groups" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex gap-2">
                      <Input value={groupQuickInput} onChange={(e) => setGroupQuickInput(e.target.value)} placeholder="Create group inline..." />
                      <Button type="button" variant="outline" onClick={() => void addGroupQuick()}>
                        <Plus className="h-4 w-4" />
                        Add Group
                      </Button>
                    </div>
                    <div className="grid max-h-56 gap-2 overflow-y-auto">
                      {lookups.groups.map((group) => (
                        <label key={group.id} className="flex items-center justify-between rounded border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{group.name}</p>
                            <p className="text-xs text-slate-500">{group.membersCount} members</p>
                          </div>
                          <Checkbox
                            checked={draft.access.groupIds.includes(group.id)}
                            onCheckedChange={(checked) =>
                              setDraft((prev) => ({
                                ...prev,
                                access: {
                                  ...prev.access,
                                  groupIds: checked
                                    ? prev.access.groupIds.includes(group.id)
                                      ? prev.access.groupIds
                                      : [...prev.access.groupIds, group.id]
                                    : prev.access.groupIds.filter((id) => id !== group.id),
                                },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {draft.access.targetType === "candidates" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <Input value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} placeholder="Search candidate..." />
                    <div className="grid max-h-56 gap-2 overflow-y-auto">
                      {filteredCandidates.map((candidate) => (
                        <label key={candidate.id} className="flex items-center justify-between rounded border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{candidate.name}</p>
                            <p className="text-xs text-slate-500">{candidate.email}</p>
                          </div>
                          <Checkbox
                            checked={draft.access.candidateIds.includes(candidate.id)}
                            onCheckedChange={(checked) =>
                              setDraft((prev) => ({
                                ...prev,
                                access: {
                                  ...prev.access,
                                  candidateIds: checked
                                    ? prev.access.candidateIds.includes(candidate.id)
                                      ? prev.access.candidateIds
                                      : [...prev.access.candidateIds, candidate.id]
                                    : prev.access.candidateIds.filter((id) => id !== candidate.id),
                                },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {draft.type === "link" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Link Visibility</Label>
                    <Select
                      value={draft.access.linkSettings?.visibility ?? "require_login"}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          access: {
                            ...prev.access,
                            linkSettings: {
                              visibility: value as "anyone" | "require_login" | "require_pin",
                              pin: prev.access.linkSettings?.pin,
                              expiryMode: prev.access.linkSettings?.expiryMode ?? "never",
                              expiresAt: prev.access.linkSettings?.expiresAt,
                              attemptsPerUser: prev.access.linkSettings?.attemptsPerUser ?? prev.attemptsAllowed,
                              shareLink: prev.access.linkSettings?.shareLink ?? "",
                            },
                          },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anyone">Anyone</SelectItem>
                        <SelectItem value="require_login">Require Login</SelectItem>
                        <SelectItem value="require_pin">Require PIN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Attempts Per User</Label>
                    <Input
                      type="number"
                      value={draft.access.linkSettings?.attemptsPerUser ?? draft.attemptsAllowed}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          access: {
                            ...prev.access,
                            linkSettings: {
                              visibility: prev.access.linkSettings?.visibility ?? "require_login",
                              pin: prev.access.linkSettings?.pin,
                              expiryMode: prev.access.linkSettings?.expiryMode ?? "never",
                              expiresAt: prev.access.linkSettings?.expiresAt,
                              attemptsPerUser: Number(e.target.value || 1),
                              shareLink: prev.access.linkSettings?.shareLink ?? "",
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                {(draft.access.linkSettings?.visibility ?? "require_login") === "require_pin" && (
                  <div className="grid gap-2 sm:max-w-xs">
                    <Label>PIN</Label>
                    <Input
                      value={draft.access.linkSettings?.pin ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          access: {
                            ...prev.access,
                            linkSettings: {
                              visibility: prev.access.linkSettings?.visibility ?? "require_pin",
                              pin: e.target.value,
                              expiryMode: prev.access.linkSettings?.expiryMode ?? "never",
                              expiresAt: prev.access.linkSettings?.expiresAt,
                              attemptsPerUser: prev.access.linkSettings?.attemptsPerUser ?? prev.attemptsAllowed,
                              shareLink: prev.access.linkSettings?.shareLink ?? "",
                            },
                          },
                        }))
                      }
                    />
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Expiry</Label>
                    <Select
                      value={draft.access.linkSettings?.expiryMode ?? "never"}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          access: {
                            ...prev.access,
                            linkSettings: {
                              visibility: prev.access.linkSettings?.visibility ?? "require_login",
                              pin: prev.access.linkSettings?.pin,
                              expiryMode: value as "never" | "datetime",
                              expiresAt: prev.access.linkSettings?.expiresAt,
                              attemptsPerUser: prev.access.linkSettings?.attemptsPerUser ?? prev.attemptsAllowed,
                              shareLink: prev.access.linkSettings?.shareLink ?? "",
                            },
                          },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="datetime">Date/Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(draft.access.linkSettings?.expiryMode ?? "never") === "datetime" && (
                    <div className="grid gap-2">
                      <Label>Expires At</Label>
                      <Input
                        type="datetime-local"
                        value={draft.access.linkSettings?.expiresAt ?? ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            access: {
                              ...prev.access,
                              linkSettings: {
                                visibility: prev.access.linkSettings?.visibility ?? "require_login",
                                pin: prev.access.linkSettings?.pin,
                                expiryMode: prev.access.linkSettings?.expiryMode ?? "datetime",
                                expiresAt: e.target.value,
                                attemptsPerUser: prev.access.linkSettings?.attemptsPerUser ?? prev.attemptsAllowed,
                                shareLink: prev.access.linkSettings?.shareLink ?? "",
                              },
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                {currentExamId && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Share Link</CardTitle>
                      <CardDescription>Copy or regenerate the exam link.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {draft.access.linkSettings?.shareLink || "Save draft to generate link"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const value = draft.access.linkSettings?.shareLink;
                            if (!value) return;
                            const copied = await copyText(value);
                            if (copied) notifySuccess("Link copied.");
                            else notifyError("Clipboard permission denied.");
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            if (!currentExamId) return;
                            try {
                              const link = await regenerateLink(currentExamId);
                              setDraft((prev) => ({
                                ...prev,
                                access: {
                                  ...prev.access,
                                  linkSettings: {
                                    visibility: prev.access.linkSettings?.visibility ?? "require_login",
                                    pin: prev.access.linkSettings?.pin,
                                    expiryMode: prev.access.linkSettings?.expiryMode ?? "never",
                                    expiresAt: prev.access.linkSettings?.expiresAt,
                                    attemptsPerUser: prev.access.linkSettings?.attemptsPerUser ?? prev.attemptsAllowed,
                                    shareLink: link,
                                  },
                                },
                              }));
                              notifySuccess("Link regenerated.");
                            } catch (error) {
                              notifyError(error instanceof Error ? error.message : "Unable to regenerate link.");
                            }
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Regenerate Link
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Step 3: Questions</CardTitle>
            <CardDescription>Choose auto-pick by section or manual selection from the question bank.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant={draft.questionsMode === "auto" ? "default" : "outline"} onClick={() => setDraft((prev) => ({ ...prev, questionsMode: "auto" }))}>Auto-pick by Section</Button>
              <Button variant={draft.questionsMode === "manual" ? "default" : "outline"} onClick={() => setDraft((prev) => ({ ...prev, questionsMode: "manual" }))}>Manual Selection</Button>
            </div>

            {draft.questionsMode === "auto" && (
              <div className="space-y-3">
                {draft.sectionsConfig.map((section, index) => {
                  const poolStats = section.sectionId ? poolStatsBySection[section.sectionId] : undefined;
                  return (
                    <div key={section.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-7">
                      <div className="grid gap-1 sm:col-span-2">
                        <Label>Section</Label>
                        <Select value={section.sectionId} onValueChange={(value) => updateSectionBlock(section.id, { sectionId: value })}>
                          <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                          <SelectContent>
                            {lookups.sections.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {poolStats && (
                          <p className="text-xs text-slate-500">
                            Pool: {poolStats.total} available (E/M/H: {poolStats.breakdown.easy}/{poolStats.breakdown.medium}/{poolStats.breakdown.hard})
                          </p>
                        )}
                        {poolStats && section.questionCount > poolStats.total && (
                          <p className="text-xs text-amber-600">
                            Requested {section.questionCount} &gt; available {poolStats.total}. Adjust the count or add more questions.
                          </p>
                        )}
                      </div>
                    <div className="grid gap-1">
                      <Label># Questions</Label>
                      <Input type="number" value={section.questionCount} onChange={(e) => updateSectionBlock(section.id, { questionCount: Number(e.target.value || 0) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Marks/Q</Label>
                      <Input type="number" value={section.marksPerQuestion} onChange={(e) => updateSectionBlock(section.id, { marksPerQuestion: Number(e.target.value || 0) })} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Neg Override</Label>
                      <Select
                        value={section.negativeOverrideMode ?? "none"}
                        onValueChange={(value) =>
                          updateSectionBlock(section.id, {
                            negativeOverrideMode: value === "none" ? undefined : (value as "fixed" | "percent"),
                            negativeOverrideValue: value === "none" ? undefined : section.negativeOverrideValue,
                          })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="fixed">Fixed</SelectItem>
                          <SelectItem value="percent">Percent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label>Neg Value</Label>
                      <Input
                        type="number"
                        value={section.negativeOverrideValue ?? ""}
                        disabled={!section.negativeOverrideMode}
                        onChange={(e) => updateSectionBlock(section.id, { negativeOverrideValue: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                    <div className="grid items-end">
                      <Button variant="outline" onClick={() => removeSectionBlock(section.id)}>
                        Remove {index + 1}
                      </Button>
                    </div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={addSectionBlock}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section Block
                </Button>
                <Card className="bg-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Auto-pick Controls</CardTitle>
                    <CardDescription>Balance difficulty mix and control exposure.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center justify-between rounded-md border bg-white p-3">
                        <div>
                          <p className="text-sm font-medium">Enable difficulty balancing</p>
                          <p className="text-xs text-muted-foreground">
                            Uses the mix below for each section. Turn off to follow each section's pool mix.
                          </p>
                        </div>
                        <Switch checked={autoBalanceEnabled} onCheckedChange={setAutoBalanceEnabled} />
                      </label>
                      <label className="flex items-center justify-between rounded-md border bg-white p-3">
                        <div>
                          <p className="text-sm font-medium">Prefer low exposure</p>
                          <p className="text-xs text-muted-foreground">Prioritize low usage questions.</p>
                        </div>
                        <Switch checked={autoPreferLowExposure} onCheckedChange={setAutoPreferLowExposure} />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label>Easy %</Label>
                        <Input
                          type="number"
                          value={autoMix.easy}
                          onChange={(e) => setAutoMix((prev) => ({ ...prev, easy: Number(e.target.value || 0) }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Medium %</Label>
                        <Input
                          type="number"
                          value={autoMix.medium}
                          onChange={(e) => setAutoMix((prev) => ({ ...prev, medium: Number(e.target.value || 0) }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Hard %</Label>
                        <Input
                          type="number"
                          value={autoMix.hard}
                          onChange={(e) => setAutoMix((prev) => ({ ...prev, hard: Number(e.target.value || 0) }))}
                        />
                      </div>
                    </div>

                    {autoBalanceEnabled && autoMixTotal !== 100 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        Difficulty mix must total 100%. Current total: {autoMixTotal}%.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => void generateAutoPickPreview()} disabled={autoPickLoading}>
                        {autoPickLoading ? "Generating..." : "Regenerate"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Filtered by exam rules (pricing + proctor).
                      </span>
                    </div>

                    {autoPickPreview && (
                      <div className="rounded-md border bg-white p-3 text-sm text-slate-700 space-y-2">
                        <div className="flex flex-wrap gap-3">
                          <span>Easy: <strong>{autoPickPreview.breakdown.easy}</strong></span>
                          <span>Medium: <strong>{autoPickPreview.breakdown.medium}</strong></span>
                          <span>Hard: <strong>{autoPickPreview.breakdown.hard}</strong></span>
                          <span>Exposure Score: <strong>{autoPickPreview.exposureScore}/100</strong></span>
                        </div>
                        {autoPickPreview.sections.length > 0 && (
                          <div className="grid gap-2 text-xs text-slate-600">
                            {autoPickPreview.sections.map((section) => (
                              <div key={section.configId} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
                                  <span className="font-medium">{section.sectionLabel}</span>
                                  <span>Requested {section.requested} · Available {section.available}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span>Pool E/M/H: {section.poolBreakdown.easy}/{section.poolBreakdown.medium}/{section.poolBreakdown.hard}</span>
                                  <span>Picked E/M/H: {section.selectedBreakdown.easy}/{section.selectedBreakdown.medium}/{section.selectedBreakdown.hard}</span>
                                  {!autoBalanceEnabled && (
                                    <span>Mix used: {section.mixUsed.easy}/{section.mixUsed.medium}/{section.mixUsed.hard}</span>
                                  )}
                                  {section.available < section.requested && (
                                    <span className="text-amber-600">Short by {section.requested - section.available}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {autoPickPreview.warnings.length > 0 && (
                          <div className="space-y-1 text-xs text-amber-700">
                            {autoPickPreview.warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {draft.questionsMode === "manual" && (
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Question Bank</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      Filtered by exam rules (pricing + proctor). Strict exams only show proctor-safe items.
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} placeholder="Search question or tag..." className="sm:col-span-2" />
                      <Select value={questionSectionFilter} onValueChange={setQuestionSectionFilter}>
                        <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sections</SelectItem>
                          {lookups.sections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Select value={questionDifficultyFilter} onValueChange={setQuestionDifficultyFilter}>
                      <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Difficulty</SelectItem>
                        <SelectItem value="Easy">Easy</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="grid max-h-72 gap-2 overflow-y-auto">
                      {filteredQuestions.map((question) => (
                        <div key={question.id} className="flex items-start justify-between rounded border px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{question.title}</p>
                            <p className="text-xs text-slate-500">{question.difficultyLabel} - {question.tags.join(", ")}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => addQuestion(question.id)}>Add</Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Exam Cart</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {draft.selectedQuestionIds.length === 0 ? (
                      <p className="text-sm text-slate-500">No questions selected yet.</p>
                    ) : (
                      draft.selectedQuestionIds.map((questionId) => {
                        const question = questionCatalog.find((item) => item.id === questionId);
                        return (
                          <div key={questionId} className="flex items-start justify-between rounded border px-3 py-2">
                            <div>
                              <p className="text-sm text-slate-700">
                                {question?.title ?? "Missing question (legacy)"}
                              </p>
                              {!question && (
                                <p className="text-xs text-amber-600">Replace this missing item.</p>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeQuestion(questionId)}>Remove</Button>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Randomize Questions</span>
                <Switch checked={draft.randomizeQuestions} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, randomizeQuestions: checked }))} />
              </label>
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Randomize Options</span>
                <Switch checked={draft.randomizeOptions} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, randomizeOptions: checked }))} />
              </label>
            </div>

            <Card className="bg-slate-50">
              <CardContent className="grid gap-2 pt-4 sm:grid-cols-3">
                <p className="text-sm"><span className="font-semibold">{questionSummary.totalQuestions}</span> total questions</p>
                <p className="text-sm"><span className="font-semibold">{questionSummary.totalMarks}</span> total marks</p>
                <p className="text-sm"><span className="font-semibold">{questionSummary.avgTimePerQuestion} min</span> avg time/question</p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Step 4: Rules & Security</CardTitle>
            <CardDescription>Configure exam behavior, result visibility, and anti-cheat controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Allow Back Navigation</span>
                <Switch checked={draft.rules.allowBackNav} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, rules: { ...prev.rules, allowBackNav: checked } }))} />
              </label>
              <label className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">Allow Skipping</span>
                <Switch checked={draft.rules.allowSkip} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, rules: { ...prev.rules, allowSkip: checked } }))} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Show Results</Label>
                <Select value={draft.rules.showResultsWhen} onValueChange={(value) => setDraft((prev) => ({ ...prev, rules: { ...prev.rules, showResultsWhen: value as typeof prev.rules.showResultsWhen } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediately">Immediately</SelectItem>
                    <SelectItem value="after_completion">After completion</SelectItem>
                    <SelectItem value="after_date">After date</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Show Correct Answers</Label>
                <Select value={draft.rules.showCorrectAnswersWhen} onValueChange={(value) => setDraft((prev) => ({ ...prev, rules: { ...prev.rules, showCorrectAnswersWhen: value as typeof prev.rules.showCorrectAnswersWhen } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediately">Immediately</SelectItem>
                    <SelectItem value="after_completion">After completion</SelectItem>
                    <SelectItem value="after_date">After date</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(draft.rules.showResultsWhen === "after_date" || draft.rules.showCorrectAnswersWhen === "after_date") && (
              <div className="grid gap-2 sm:max-w-sm">
                <Label>Release Date</Label>
                <Input
                  type="datetime-local"
                  value={draft.rules.releaseAt ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, rules: { ...prev.rules, releaseAt: e.target.value } }))}
                />
              </div>
            )}

            <div className="grid gap-2 sm:max-w-sm">
              <Label>Pass Mark % (optional)</Label>
              <Input
                type="number"
                value={draft.rules.passMarkPercent ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, rules: { ...prev.rules, passMarkPercent: e.target.value ? Number(e.target.value) : undefined } }))}
              />
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Security Preset</Label>
                <Select value={draft.security.preset} onValueChange={(value) => setDraft((prev) => ({ ...prev, security: { ...prev.security, preset: value as typeof prev.security.preset } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Trusted IP Enabled</span><Switch checked={draft.security.trustedIpEnabled} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, security: { ...prev.security, trustedIpEnabled: checked } }))} /></label>
              <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Watermark Enabled</span><Switch checked={draft.security.watermarkEnabled} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, security: { ...prev.security, watermarkEnabled: checked } }))} /></label>
              <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Proctoring Enabled</span><Switch checked={draft.security.proctoringEnabled} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, security: { ...prev.security, proctoringEnabled: checked } }))} /></label>
              <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Fullscreen Required</span><Switch checked={draft.security.fullscreenRequired} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, security: { ...prev.security, fullscreenRequired: checked } }))} /></label>
              <label className="flex items-center justify-between rounded-md border p-3 sm:col-span-2"><span className="text-sm">Disable Copy/Paste</span><Switch checked={draft.security.disableCopyPaste} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, security: { ...prev.security, disableCopyPaste: checked } }))} /></label>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Evidence Playback (candidate access after submit)</h3>
              <p className="text-xs text-muted-foreground">Control whether candidates can view or download their webcam/screen recordings. All access is logged in Evidence Audit.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Candidate can view webcam</span><Switch checked={draft.evidencePlayback?.candidateCanViewWebcam ?? true} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, evidencePlayback: { ...(prev.evidencePlayback ?? { candidateCanViewWebcam: true, candidateCanViewScreen: false, candidateCanDownload: false, visibleDelayMinutes: 0, hideProctorNotes: true, legalHold: false }), candidateCanViewWebcam: checked } }))} /></label>
                <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Candidate can view screen</span><Switch checked={draft.evidencePlayback?.candidateCanViewScreen ?? false} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, evidencePlayback: { ...(prev.evidencePlayback ?? { candidateCanViewWebcam: true, candidateCanViewScreen: false, candidateCanDownload: false, visibleDelayMinutes: 0, hideProctorNotes: true, legalHold: false }), candidateCanViewScreen: checked } }))} /></label>
                <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Candidate can download</span><Switch checked={draft.evidencePlayback?.candidateCanDownload ?? false} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, evidencePlayback: { ...(prev.evidencePlayback ?? { candidateCanViewWebcam: true, candidateCanViewScreen: false, candidateCanDownload: false, visibleDelayMinutes: 0, hideProctorNotes: true, legalHold: false }), candidateCanDownload: checked } }))} /></label>
                <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Hide proctor notes from candidate</span><Switch checked={draft.evidencePlayback?.hideProctorNotes ?? true} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, evidencePlayback: { ...(prev.evidencePlayback ?? { candidateCanViewWebcam: true, candidateCanViewScreen: false, candidateCanDownload: false, visibleDelayMinutes: 0, hideProctorNotes: true, legalHold: false }), hideProctorNotes: checked } }))} /></label>
                <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Legal hold (blocks all evidence access)</span><Switch checked={draft.evidencePlayback?.legalHold ?? false} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, evidencePlayback: { ...(prev.evidencePlayback ?? { candidateCanViewWebcam: true, candidateCanViewScreen: false, candidateCanDownload: false, visibleDelayMinutes: 0, hideProctorNotes: true, legalHold: false }), legalHold: checked } }))} /></label>
              </div>
              <div className="grid gap-2 sm:max-w-xs">
                <Label>Visibility delay (minutes after submit before evidence is available)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.evidencePlayback?.visibleDelayMinutes ?? 0}
                  onChange={(e) => setDraft((prev) => ({ ...prev, evidencePlayback: { ...(prev.evidencePlayback ?? { candidateCanViewWebcam: true, candidateCanViewScreen: false, candidateCanDownload: false, visibleDelayMinutes: 0, hideProctorNotes: true, legalHold: false }), visibleDelayMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) } }))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Advanced</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-md border p-3"><span className="text-sm">Webhook Enabled</span><Switch checked={draft.advanced.webhookEnabled} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, advanced: { ...prev.advanced, webhookEnabled: checked } }))} /></label>
              </div>
              <div className="grid gap-2 sm:max-w-sm">
                <Label>Certificate Template</Label>
                <Select
                  value={draft.advanced.certificateTemplateId ?? "none"}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, advanced: { ...prev.advanced, certificateTemplateId: value === "none" ? undefined : value } }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {lookups.certificateTemplates.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Step 5: Review & Publish</CardTitle>
            <CardDescription>Review all sections before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allStepErrors.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  Validation Errors
                </div>
                <ul className="list-disc pl-5">
                  {allStepErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Basics</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700">
                  <p>{draft.name || "--"}</p>
                  <p>Category: {draft.category || "Uncategorized"}</p>
                  <p>{draft.type} - {draft.durationMinutes} min</p>
                  <Button size="sm" variant="ghost" onClick={() => setStep(0)}>Edit</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Access</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700">
                  <p>Target: {draft.access.targetType}</p>
                  <p>{draft.access.groupIds.length} groups - {draft.access.candidateIds.length} candidates</p>
                  <Button size="sm" variant="ghost" onClick={() => setStep(1)}>Edit</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Questions</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700">
                  <p>Mode: {draft.questionsMode}</p>
                  <p>{questionSummary.totalQuestions} questions - {questionSummary.totalMarks} marks</p>
                  <Button size="sm" variant="ghost" onClick={() => setStep(2)}>Edit</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Security</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700">
                  <p>Preset: {draft.security.preset}</p>
                  <p>Proctoring: {draft.security.proctoringEnabled ? "Enabled" : "Disabled"}</p>
                  <Button size="sm" variant="ghost" onClick={() => setStep(3)}>Edit</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pricing</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-700">
                  <p>
                    Pricing:{" "}
                    {pricing.mode === "PAID"
                      ? `PAID (${pricing.currency} ${pricing.price ?? 0})`
                      : pricing.isDemo
                      ? "FREE Demo/Trial"
                      : "FREE"}
                  </p>
                  <p>Storefront: {pricing.showOnStorefront ? "Visible" : "Hidden"}</p>
                  <p>Validity: {pricing.mode === "PAID" ? (pricing.validityDays ? `${pricing.validityDays} days` : "Lifetime") : "N/A"}</p>
                  <Button size="sm" variant="ghost" onClick={() => setStep(0)}>Edit</Button>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
              <p>Last draft save target: {currentExamId ? `Exam #${currentExamId}` : "New exam draft"}</p>
              {draft.availability.startAt && (
                <p>Scheduled start: {format(new Date(draft.availability.startAt), "PPpp")}</p>
              )}
            </div>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              <Checkbox checked={pricingConfirmed} onCheckedChange={(checked) => setPricingConfirmed(checked === true)} />
              I confirm pricing and access rules are correct.
            </label>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Sparkles className="h-4 w-4 text-blue-500" />
            Wizard draft is persisted locally for resume editing.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={goBack} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {step < steps.length - 1 && (
              <Button variant="outline" onClick={goNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button onClick={() => void saveDraft()} disabled={saving}>
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button onClick={() => void publish()} disabled={publishing || allStepErrors.length > 0 || !pricingConfirmed}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {publishing ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
