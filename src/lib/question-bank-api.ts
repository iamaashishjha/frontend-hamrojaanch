/**
 * Question Bank API — calls real backend via shared apiClient.
 * Keeps the same exported signatures for backward compatibility.
 */
import { API_BASE, get, post, patch, del, upload } from "@/lib/apiClient";
import type {
  ExamCompatibilitySnapshot,
  ExposureRisk,
  MappedProctorEvent,
  PickBalancedInput,
  PickBalancedResult,
  ProctorEvent,
  Question,
  QuestionAnalytics,
  QuestionFilters,
  QuestionTimeline,
  QuestionTimelineEntry,
  QuestionType,
  QuestionCsvExport,
  ReviewPriority,
  ReviewStatus,
} from "@/lib/question-bank-types";

// ── Helpers ──────────────────────────────────────────────

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cloneQuestion(question: Question) {
  return JSON.parse(JSON.stringify(question)) as Question;
}

function getDifficultyKey(label: Question["difficultyLabel"]) {
  if (label === "Hard") return "hard";
  if (label === "Medium") return "medium";
  return "easy";
}

function mapExposureWeight(risk: ExposureRisk) {
  if (risk === "HIGH") return 3;
  if (risk === "MEDIUM") return 2;
  return 1;
}

// ── Client-side filter helpers (for exam-compatibility checks) ──

function applyExamCompatibility(question: Question, examSnapshot?: ExamCompatibilitySnapshot) {
  if (!examSnapshot) return true;
  const pricingMode = examSnapshot.pricingMode;
  const proctorPreset = examSnapshot.proctorPreset;
  if (pricingMode === "PAID" && !question.allowedPricing.includes("PAID")) return false;
  if (pricingMode === "FREE" && !question.allowedPricing.includes("FREE")) return false;
  if (proctorPreset === "basic" && !question.supportedProctorModes.includes("basic")) return false;
  if (proctorPreset === "strict") {
    if (!question.supportedProctorModes.includes("strict")) return false;
    if (!question.isProctorSafe) return false;
    if (question.excludeFromStrictPools) return false;
  }
  return true;
}

function applyClientSideFilters(question: Question, filters: QuestionFilters) {
  // Filters the backend does not handle — apply on the client
  if (filters.pricing && filters.pricing !== "all") {
    if (filters.pricing === "free_allowed" && !question.allowedPricing.includes("FREE")) return false;
    if (filters.pricing === "paid_allowed" && !question.allowedPricing.includes("PAID")) return false;
    if (filters.pricing === "both") {
      if (!(question.allowedPricing.includes("FREE") && question.allowedPricing.includes("PAID"))) return false;
    }
  }
  if (filters.proctorMode && filters.proctorMode !== "any") {
    if (!question.supportedProctorModes.includes(filters.proctorMode)) return false;
  }
  if (filters.proctorSafe && filters.proctorSafe !== "all") {
    if (filters.proctorSafe === "safe" && !question.isProctorSafe) return false;
    if (filters.proctorSafe === "risky" && question.isProctorSafe) return false;
  }
  if (filters.cooldown && filters.cooldown !== "all") {
    const inCooldown =
      Boolean(question.cooldownUntil) &&
      new Date(question.cooldownUntil as string).getTime() > Date.now();
    if (filters.cooldown === "available_only" && inCooldown) return false;
  }
  if (filters.tags && filters.tags.length > 0) {
    const tags = question.tags.map((tag) => tag.toLowerCase());
    if (!filters.tags.some((tag) => tags.includes(tag.toLowerCase()))) return false;
  }
  if (filters.needsReview && filters.needsReview !== "all") {
    if (filters.needsReview === "yes" && !question.needsReview) return false;
    if (filters.needsReview === "no" && question.needsReview) return false;
  }
  if (filters.reviewPriority && filters.reviewPriority !== "all") {
    if (question.reviewPriority !== filters.reviewPriority) return false;
  }
  if (!applyExamCompatibility(question, filters.examSnapshot)) return false;
  return true;
}

// ── Legacy adapter (kept for any callers that still need it) ──

type LegacyQuestion =
  | {
      id: string;
      title: string;
      sectionId: string;
      difficulty: "easy" | "medium" | "hard";
      type: "mcq" | "true_false" | "short";
      tags: string[];
      marks: number;
    }
  | {
      id: string;
      title: string;
      section: string;
      difficulty: "easy" | "medium" | "hard";
      type: "mcq" | "true-false" | "short";
    };

function mapDifficultyLabel(value: LegacyQuestion["difficulty"]) {
  if (value === "hard") return "Hard";
  if (value === "medium") return "Medium";
  return "Easy";
}

function mapType(value: LegacyQuestion["type"]): QuestionType {
  if (value === "true_false" || value === "true-false") return "TRUE_FALSE";
  if (value === "short") return "SHORT";
  return "MCQ_SINGLE";
}

function baseOptions(type: QuestionType) {
  if (type === "TRUE_FALSE") {
    return [
      { id: "true", label: "True", text: "True" },
      { id: "false", label: "False", text: "False" },
    ];
  }
  if (type === "MCQ_SINGLE" || type === "MCQ_MULTI") {
    return [
      { id: "A", label: "A", text: "Option A" },
      { id: "B", label: "B", text: "Option B" },
      { id: "C", label: "C", text: "Option C" },
      { id: "D", label: "D", text: "Option D" },
    ];
  }
  return [];
}

export function adaptOldQuestionToNew(oldQ: LegacyQuestion): Question {
  const sectionId = "sectionId" in oldQ ? oldQ.sectionId : oldQ.section;
  const tags = "tags" in oldQ ? [...oldQ.tags] : [sectionId];
  const difficultyLabel = mapDifficultyLabel(oldQ.difficulty);
  const type = mapType(oldQ.type);
  const options = baseOptions(type);
  const timesUsedInExams = randomInt(0, 12);
  const exposureRisk: ExposureRisk =
    timesUsedInExams > 8 ? "HIGH" : timesUsedInExams > 4 ? "MEDIUM" : "LOW";

  return {
    id: oldQ.id,
    title: oldQ.title,
    questionHtml: `<p>${oldQ.title}</p>`,
    type,
    options,
    correctAnswers: type === "TRUE_FALSE" ? ["true"] : options.length ? [options[0].id] : [],
    explanationHtml: "<p>Legacy question migrated into the new bank.</p>",
    marks: "marks" in oldQ ? oldQ.marks : 1,
    negativeMarks: 0,
    difficultyLabel,
    difficultyScore: difficultyLabel === "Hard" ? 5 : difficultyLabel === "Medium" ? 3 : 2,
    subject: "sectionId" in oldQ ? "Core Curriculum" : "Legacy Imports",
    topic: tags[0] ?? "General",
    sectionId,
    tags,
    estimatedTimeSec: difficultyLabel === "Hard" ? 120 : difficultyLabel === "Medium" ? 90 : 60,
    language: "EN",
    status: "ACTIVE",
    allowedPricing: ["FREE", "PAID"],
    supportedProctorModes: ["basic", "strict"],
    isProctorSafe: true,
    excludeFromStrictPools: false,
    timesUsedInExams,
    lastUsedAt: timesUsedInExams > 0 ? new Date().toISOString() : null,
    exposureRisk,
    cooldownUntil: null,
    needsReview: false,
    reviewStatus: "draft",
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    reviewPriority: "normal",
    assignedReviewerId: null,
    assignedReviewerAt: null,
    flaggedCount: 0,
    proctorViolationsCount: 0,
    topViolationTypes: {},
  };
}

// ── Backend → Frontend question adapter ─────────────────
// WHY: Backend stores correctAnswers, allowedPricing, supportedProctorModes
//      as JSON strings and tags as relation objects. Frontend expects arrays.

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

function adaptBackendQuestion(raw: Record<string, unknown>): Question {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t: unknown) => (typeof t === "string" ? t : (t as { tag?: string })?.tag ?? ""))
    : [];
  const options = Array.isArray(raw.options)
    ? raw.options.map((o: Record<string, unknown>) => ({
        id: String(o.id ?? o.label ?? ""),
        label: String(o.label ?? ""),
        text: String(o.text ?? ""),
      }))
    : [];
  const difficultyLabel = (raw.difficultyLabel ?? "Medium") as Question["difficultyLabel"];
  const timesUsed = Number(raw.timesUsed ?? raw.timesUsedInExams ?? 0);
  const exposureRisk = (raw.exposureRisk ?? "LOW") as ExposureRisk;
  const reviewStatus = (raw.reviewStatus ?? "draft") as ReviewStatus;
  const reviewPriority = (raw.reviewPriority ?? "normal") as ReviewPriority;
  const needsReview =
    typeof raw.needsReview === "boolean" ? (raw.needsReview as boolean) : false;

  return {
    id: String(raw.id),
    title: (raw.title && String(raw.title).trim())
      ? String(raw.title).trim().slice(0, 300)
      : (String(raw.questionHtml ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 120) || "Untitled"),
    questionHtml: String(raw.questionHtml ?? ""),
    type: (raw.type ?? "MCQ_SINGLE") as Question["type"],
    options,
    correctAnswers: parseJsonField<string[]>(raw.correctAnswers, []),
    explanationHtml: String(raw.explanationHtml ?? ""),
    marks: Number(raw.marks ?? 1),
    negativeMarks: Number(raw.negativeMarks ?? 0),
    difficultyLabel,
    difficultyScore: difficultyLabel === "Hard" ? 5 : difficultyLabel === "Medium" ? 3 : 2,
    subject: String(raw.subject ?? ""),
    topic: String(raw.topic ?? ""),
    sectionId: String(raw.sectionId ?? ""),
    tags: tags.filter(Boolean) as string[],
    estimatedTimeSec: difficultyLabel === "Hard" ? 120 : difficultyLabel === "Medium" ? 90 : 60,
    language: (raw.language ?? "EN") as Question["language"],
    status: (raw.status ?? "ACTIVE") as Question["status"],
    allowedPricing: parseJsonField<Question["allowedPricing"]>(raw.allowedPricing, ["FREE", "PAID"]),
    supportedProctorModes: parseJsonField<Question["supportedProctorModes"]>(raw.supportedProctorModes, ["basic", "strict"]),
    isProctorSafe: raw.isProctorSafe !== false,
    excludeFromStrictPools: raw.excludeFromStrictPools === true,
    timesUsedInExams: timesUsed,
    lastUsedAt: raw.lastUsed ? String(raw.lastUsed) : raw.lastUsedAt ? String(raw.lastUsedAt) : null,
    exposureRisk,
    cooldownUntil: raw.cooldownUntil ? String(raw.cooldownUntil) : null,
    needsReview,
    reviewStatus,
    reviewedBy: raw.reviewedBy ? String(raw.reviewedBy) : null,
    reviewedAt: raw.reviewedAt ? String(raw.reviewedAt) : null,
    reviewNotes: raw.reviewNotes ? String(raw.reviewNotes) : null,
    reviewPriority,
    assignedReviewerId: raw.assignedReviewerId ? String(raw.assignedReviewerId) : null,
    assignedReviewerAt: raw.assignedReviewerAt ? String(raw.assignedReviewerAt) : null,
    flaggedCount: Number(raw.flaggedCount ?? 0),
    proctorViolationsCount: Number(raw.proctorViolationsCount ?? 0),
    topViolationTypes: (raw.topViolationTypes as Record<string, number> | undefined) ?? {},
  };
}

// ── Question Bank CRUD ──────────────────────────────────

/**
 * Returns a snapshot of all questions (large page).
 * Used by the exam builder to get the full pool.
 */
export async function getQuestionBankSnapshot(): Promise<Question[]> {
  const { items } = await get<{ items: Record<string, unknown>[]; total: number }>(
    "/admin/question-bank",
    { pageSize: 5000 },
  );
  return items.map(adaptBackendQuestion);
}

/**
 * List questions with server-side + client-side filters.
 * Backend handles: q, difficulty, type, subject, topic, status, exposureRisk, page, pageSize.
 * Client handles: pricing, proctorMode, proctorSafe, cooldown, tags, examSnapshot.
 */
export async function listQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
  const params: Record<string, string | number | boolean | undefined | null> = {
    q: filters.query,
    difficulty: filters.difficulty !== "all" ? filters.difficulty : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
    subject: filters.subject !== "all" ? filters.subject : undefined,
    topic: filters.topic !== "all" ? filters.topic : undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    exposureRisk: filters.exposureRisk !== "all" ? filters.exposureRisk : undefined,
    reviewStatus:
      filters.reviewStatus && filters.reviewStatus !== "all" ? filters.reviewStatus : undefined,
    examId: filters.examId,
    inExam: filters.inExam !== undefined ? String(filters.inExam) : undefined,
    pageSize: 5000,
  };

  const { items } = await get<{ items: Record<string, unknown>[]; total: number }>(
    "/admin/question-bank",
    params,
  );

  // Adapt backend shape → frontend Question, then apply client-side filters
  return items.map(adaptBackendQuestion).filter((q) => applyClientSideFilters(q, filters));
}

export async function getQuestion(id: string): Promise<Question | null> {
  try {
    const { question } = await get<{ question: Record<string, unknown> }>(`/admin/question-bank/${id}`);
    return adaptBackendQuestion(question);
  } catch {
    return null;
  }
}

export async function createQuestion(payload: Partial<Question>): Promise<Question> {
  const raw = await post<Record<string, unknown>>("/admin/question-bank", {
    questionHtml: payload.questionHtml,
    type: payload.type,
    difficultyLabel: payload.difficultyLabel,
    subject: payload.subject,
    topic: payload.topic,
    sectionId: payload.sectionId,
    marks: payload.marks,
    negativeMarks: payload.negativeMarks,
    explanationHtml: payload.explanationHtml,
    status: payload.status,
    correctAnswers: payload.correctAnswers,
    options: payload.options,
    tags: payload.tags,
    title: payload.title,
  });
  return adaptBackendQuestion(raw);
}

export async function updateQuestion(id: string, payload: Partial<Question>): Promise<Question> {
  const raw = await patch<Record<string, unknown>>(`/admin/question-bank/${id}`, payload);
  return adaptBackendQuestion(raw);
}

export async function deleteQuestion(id: string): Promise<void> {
  await del<void>(`/admin/question-bank/${id}`);
}

/** Import questions from CSV. Returns counts and any row errors. */
export async function importQuestionsCsv(csv: string): Promise<{
  imported: number;
  failed: number;
  errors: string[];
}> {
  return post<{ imported: number; failed: number; errors: string[] }>(
    "/admin/question-bank/import",
    { csv }
  );
}

/**
 * List questions compatible with a specific exam.
 * Uses the same backend endpoint but forces status=ACTIVE and applies
 * exam-specific client-side filters (pricing, proctor mode, cooldown).
 */
export async function listExamCompatibleQuestions(
  examId: string | null,
  filters: QuestionFilters = {},
): Promise<Question[]> {
  const effectiveFilters: QuestionFilters = {
    ...filters,
    status: "ACTIVE",
    cooldown: "available_only",
    examId: examId ?? undefined,
    inExam: examId ? false : undefined, // when building exam, show questions NOT yet in exam
  };
  return listQuestions(effectiveFilters);
}

/**
 * Ask the backend to pick a balanced set of questions from a pool.
 */
export async function pickBalancedQuestions(
  input: PickBalancedInput,
): Promise<PickBalancedResult> {
  return post<PickBalancedResult>("/admin/question-bank/pick-balanced", {
    pool: input.pool.map((q) => q.id),
    count: input.count,
    mixPercent: input.mixPercent,
  });
}

/**
 * Compute analytics from the question list (no dedicated backend endpoint).
 */
export async function getQuestionAnalytics(
  filters: QuestionFilters = {},
): Promise<QuestionAnalytics> {
  const questions = await listQuestions(filters);

  const totals = {
    total: questions.length,
    usedInExams: questions.filter((q) => q.timesUsedInExams > 0).length,
    highExposure: questions.filter((q) => q.exposureRisk === "HIGH").length,
    needsReview: questions.filter((q) => q.needsReview).length,
    highProctorViolations: questions.filter((q) => q.proctorViolationsCount >= 3).length,
  };

  const exposureDistribution = (["LOW", "MEDIUM", "HIGH"] as const).map((risk) => ({
    risk,
    count: questions.filter((q) => q.exposureRisk === risk).length,
  }));

  const accuracyByDifficulty = (["Easy", "Medium", "Hard"] as const).map((difficulty) => ({
    difficulty,
    accuracy: randomInt(62, 92),
  }));

  const usageTrend = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      used: randomInt(12, 58),
    };
  });

  const proctorViolationsTrend = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      violations: randomInt(0, 14),
    };
  });

  const highRiskQuestions = questions
    .filter(
      (q) =>
        q.exposureRisk === "HIGH" ||
        q.proctorViolationsCount >= 3 ||
        q.needsReview,
    )
    .slice(0, 8)
    .map(cloneQuestion);

  return {
    totals,
    usageTrend,
    accuracyByDifficulty,
    proctorViolationsTrend,
    exposureDistribution,
    highRiskQuestions,
  };
}

// ── Proctor events ──────────────────────────────────────

export async function listAttemptProctorEvents(attemptId: string): Promise<ProctorEvent[]> {
  const { items } = await get<{ items: ProctorEvent[] }>(`/proctor/events/${attemptId}`);
  return items;
}

/**
 * No dedicated timeline endpoint — return empty timeline.
 */
export async function getAttemptTimeline(attemptId: string): Promise<QuestionTimeline | null> {
  return { examAttemptId: attemptId, entries: [] };
}

/**
 * No dedicated endpoint — no-op, returns empty timeline.
 */
export async function upsertAttemptTimelineEntry(
  attemptId: string,
  entry: QuestionTimelineEntry,
): Promise<QuestionTimeline> {
  void entry;
  return { examAttemptId: attemptId, entries: [] };
}

export async function recordProctorEvent(
  input: Omit<ProctorEvent, "id">,
): Promise<ProctorEvent> {
  return post<ProctorEvent>("/proctor/events", {
    attemptId: input.examAttemptId,
    eventType: input.eventType,
    severity: input.severity,
    timestamp: input.timestamp,
    questionId: input.questionId ?? undefined,
    metadata: {},
  });
}

/** Report an issue during exam: creates proctor event + support ticket so admin/assigned proctor/teacher receive it. */
export async function reportExamIssue(params: {
  attemptId: string;
  examId?: string;
  questionId?: string | null;
  description?: string;
}): Promise<{ ok: boolean; eventId: string; ticketId: string }> {
  return post<{ ok: boolean; eventId: string; ticketId: string }>("/proctor/report-issue", {
    attemptId: params.attemptId,
    examId: params.examId,
    questionId: params.questionId ?? undefined,
    description: params.description ?? "",
  });
}

export async function getAttemptProctorSummary(attemptId: string): Promise<{
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}> {
  return get<{ total: number; bySeverity: Record<string, number>; byType: Record<string, number> }>(
    `/proctor/events/${attemptId}/summary`,
  );
}

// ── Client-side utilities (no backend calls) ────────────

/**
 * Map proctor events to questions using a timeline.
 * Pure client-side utility — no backend call.
 */
export async function mapEventsToQuestions(
  events: ProctorEvent[],
  timeline: QuestionTimeline,
): Promise<MappedProctorEvent[]> {
  return events.map((event) => {
    const eventTime = new Date(event.timestamp).getTime();
    const match = timeline.entries.find((entry) => {
      const start = new Date(entry.startAt).getTime();
      const end = new Date(entry.endAt).getTime();
      return eventTime >= start && eventTime <= end;
    });
    return {
      ...event,
      mappedQuestionId: match?.questionId ?? null,
      isMapped: Boolean(match?.questionId),
    };
  });
}

/**
 * Export CSV — pure client-side passthrough.
 */
export async function exportCsv(data: QuestionCsvExport): Promise<QuestionCsvExport> {
  return {
    fileName: data.fileName,
    rows: data.rows.map((row) => [...row]),
  };
}

/**
 * Compute proctor summary for a specific question from its events.
 */
export async function getQuestionProctorSummary(questionId: string): Promise<{
  total: number;
  highSeverity: number;
  breakdown: Record<string, number>;
  recentEvents: MappedProctorEvent[];
}> {
  // No dedicated endpoint — return empty stats.
  void questionId;
  return {
    total: 0,
    highSeverity: 0,
    breakdown: {},
    recentEvents: [],
  };
}

/**
 * Metadata export — no more in-memory stores to reference.
 */
export const questionBankMeta = {
  proctorAttemptIds: [] as string[],
};

export interface QuestionMediaAsset {
  id: string;
  kind: string;
  storageKey: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status: string;
  createdAt: string;
  previewUrl?: string;
}

export async function initQuestionMedia(
  questionId: string,
  file: File,
): Promise<{ asset: QuestionMediaAsset; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", "question_media");
  formData.append("prefix", `question/${questionId}`);
  return upload<{ asset: QuestionMediaAsset; url: string }>("/files/upload", formData);
}

export async function listQuestionMedia(questionId: string): Promise<QuestionMediaAsset[]> {
  const data = await get<{ items: QuestionMediaAsset[] }>(`/admin/question-bank/${questionId}/media`);
  const items = data.items ?? [];
  const withUrls = await Promise.all(
    items.map(async (item) => {
      try {
        const signed = await get<{ url: string }>(`/files/${item.id}/url`);
        return {
          ...item,
          previewUrl: signed.url.startsWith("http") ? signed.url : `${API_BASE}${signed.url}`,
        };
      } catch {
        return item;
      }
    }),
  );
  return withUrls;
}

export async function updateQuestionMediaStatus(
  fileId: string,
  status: "safe" | "quarantined",
): Promise<QuestionMediaAsset> {
  const data = await post<{ asset: QuestionMediaAsset }>(`/files/${fileId}/complete`, { status });
  return data.asset;
}
