// Real backend API calls. Replaces previous mock implementation.

import { get, post, patch, del } from "@/lib/apiClient";
import { backendToAdminExam, adminExamToBackend, type BackendExam } from "@/lib/examAdapter";
import type {
  AdminExam,
  ExamEvidencePlaybackConfig,
  ExamActivityLog,
  EvidenceAccessAction,
  EvidenceAccessAuditRecord,
  ExamCandidateStatusRow,
  ExamGroup,
  ExamListFilters,
  ExamLookups,
  ExamPurchase,
  ExamResultRow,
  UpsertExamPayload,
} from "@/lib/exams-module-types";

export type CursorPage<T> = {
  items: T[];
  hasMore?: boolean;
  nextCursor?: string | null;
  limit?: number;
  total?: number;
  page?: number;
  pageSize?: number;
};

type CursorMetricListKey =
  | "exam_candidates"
  | "exam_results"
  | "exam_activity"
  | "exam_purchases";

type CursorSessionState = {
  sessionId: string;
  pageDepth: number;
  hasMore: boolean;
  completed: boolean;
};

const cursorSessionState = new Map<string, CursorSessionState>();
let pagehideHookRegistered = false;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Backend category shape (has id + name; frontend uses name strings only). */
interface BackendCategory {
  id: string;
  name: string;
  slug?: string;
}

/** Look up a backend category by its display name so we can resolve its id. */
async function fetchCategoryByName(name: string): Promise<BackendCategory> {
  const { categories } = await get<{ categories: BackendCategory[] }>("/catalog/categories");
  const match = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!match) throw new Error(`Category "${name}" not found.`);
  return match;
}

function normalizeCursorPage<T>(data: CursorPage<T>): CursorPage<T> {
  return {
    items: data.items ?? [],
    hasMore: Boolean(data.hasMore),
    nextCursor: data.nextCursor ?? null,
    limit: data.limit,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

function nowMs(): number {
  if (typeof performance !== "undefined") return performance.now();
  return Date.now();
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sessionStateKey(listKey: CursorMetricListKey, examId: string): string {
  return `${listKey}:${examId}`;
}

function reportCursorClientEvent(payload: {
  listKey: CursorMetricListKey;
  sessionId: string;
  eventType: "page_loaded" | "session_end";
  pageDepth?: number;
  hasMore?: boolean;
  clientLatencyMs?: number;
  endReason?: "completed" | "abandoned";
}) {
  void post("/metrics/cursor-pagination/events", payload).catch(() => undefined);
}

function endCursorSession(
  listKey: CursorMetricListKey,
  examId: string,
  state: CursorSessionState,
  endReason: "completed" | "abandoned",
) {
  if (state.completed) return;
  state.completed = true;
  reportCursorClientEvent({
    listKey,
    sessionId: state.sessionId,
    eventType: "session_end",
    pageDepth: state.pageDepth,
    hasMore: state.hasMore,
    endReason,
  });
  cursorSessionState.delete(sessionStateKey(listKey, examId));
}

function beginCursorSession(
  listKey: CursorMetricListKey,
  examId: string,
  cursor?: string,
): CursorSessionState {
  const key = sessionStateKey(listKey, examId);
  const current = cursorSessionState.get(key);
  const hasCursor = typeof cursor === "string" && cursor.trim().length > 0;

  if (!hasCursor) {
    if (current && !current.completed && current.hasMore) {
      endCursorSession(listKey, examId, current, "abandoned");
    }
    const fresh: CursorSessionState = {
      sessionId: createSessionId(),
      pageDepth: 1,
      hasMore: false,
      completed: false,
    };
    cursorSessionState.set(key, fresh);
    return fresh;
  }

  if (!current || current.completed) {
    const resumed: CursorSessionState = {
      sessionId: createSessionId(),
      // If we already have a cursor token, this is at least the second page.
      pageDepth: 2,
      hasMore: false,
      completed: false,
    };
    cursorSessionState.set(key, resumed);
    return resumed;
  }

  current.pageDepth += 1;
  return current;
}

function registerPageHideHook() {
  if (pagehideHookRegistered || typeof window === "undefined") return;
  pagehideHookRegistered = true;
  window.addEventListener("pagehide", () => {
    for (const [key, state] of cursorSessionState.entries()) {
      if (state.completed || !state.hasMore) continue;
      const [listKey, examId] = key.split(":");
      if (!listKey || !examId) continue;
      endCursorSession(listKey as CursorMetricListKey, examId, state, "abandoned");
    }
  });
}

async function fetchCursorPageWithMetrics<T>(params: {
  listKey: CursorMetricListKey;
  examId: string;
  path: string;
  cursor?: string;
  limit: number;
  extraParams?: Record<string, string | number | undefined>;
}): Promise<CursorPage<T>> {
  registerPageHideHook();
  const session = beginCursorSession(params.listKey, params.examId, params.cursor);
  const startedAt = nowMs();

  const data = await get<CursorPage<T>>(params.path, {
    ...(params.extraParams ?? {}),
    limit: params.limit,
    cursor: params.cursor,
    paginationSessionId: session.sessionId,
    paginationDepth: session.pageDepth,
  });
  const page = normalizeCursorPage(data);
  const clientLatencyMs = Math.max(0, nowMs() - startedAt);
  session.hasMore = Boolean(page.hasMore && page.nextCursor);

  reportCursorClientEvent({
    listKey: params.listKey,
    sessionId: session.sessionId,
    eventType: "page_loaded",
    pageDepth: session.pageDepth,
    hasMore: session.hasMore,
    clientLatencyMs,
  });

  if (!session.hasMore) {
    endCursorSession(params.listKey, params.examId, session, "completed");
  }
  return page;
}

async function collectCursorPages<T>(
  fetchPage: (cursor?: string | null) => Promise<CursorPage<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null | undefined = undefined;
  let guards = 0;
  while (guards < 1000) {
    guards += 1;
    const page = normalizeCursorPage(await fetchPage(cursor));
    all.push(...(page.items ?? []));
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

// ── Purchases ─────────────────────────────────────────────────────────────────

export async function recordExamPurchase(purchase: ExamPurchase): Promise<void> {
  await post(`/exams/${purchase.examId}/purchases`, purchase);
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function listExamGroups(): Promise<ExamGroup[]> {
  const { items } = await get<{ items: ExamGroup[] }>("/admin/candidates/groups");
  return items;
}

export async function createExamGroup(name: string): Promise<ExamGroup> {
  const { group } = await post<{ group: ExamGroup }>("/admin/candidates/groups", {
    name,
    size: 0,
  });
  return group;
}

export async function updateExamGroup(id: string, name: string): Promise<ExamGroup> {
  const { group } = await patch<{ group: ExamGroup }>(`/admin/candidates/groups/${id}`, { name });
  return group;
}

export async function deleteExamGroup(id: string): Promise<void> {
  await del(`/admin/candidates/groups/${id}`);
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listExamCategories(): Promise<string[]> {
  const { categories } = await get<{ categories: BackendCategory[] }>("/catalog/categories");
  return categories.map((c) => c.name);
}

/** Catalog categories with id (for storefront filter by category). */
export async function listCatalogCategoriesWithIds(): Promise<{ id: string; name: string }[]> {
  const { categories } = await get<{ categories: BackendCategory[] }>("/catalog/categories");
  return categories.map((c) => ({ id: c.id, name: c.name }));
}

/** Public storefront exam list (no auth). Uses GET /catalog/exams with category, pricing, q. */
export async function listStorefrontExams(filters: {
  categoryId?: string;
  pricing?: "FREE" | "PAID" | "DEMO";
  query?: string;
} = {}): Promise<AdminExam[]> {
  const params: Record<string, string | undefined> = {};
  if (filters.categoryId) params.category = filters.categoryId;
  if (filters.pricing) params.pricing = filters.pricing;
  if (filters.query?.trim()) params.q = filters.query.trim();
  const res = await get<{ items: BackendExam[] }>("/catalog/exams", params);
  const items = res.items ?? (res as unknown as { items?: BackendExam[] }).items ?? [];
  return items.map(backendToAdminExam);
}

export async function createExamCategory(name: string): Promise<string> {
  const { category } = await post<{ category: BackendCategory }>("/catalog/categories", { name });
  return category.name;
}

export async function updateExamCategory(oldName: string, newName: string): Promise<string> {
  const existing = await fetchCategoryByName(oldName);
  const { category } = await patch<{ category: BackendCategory }>(
    `/catalog/categories/${existing.id}`,
    { name: newName },
  );
  return category.name;
}

export async function deleteExamCategory(name: string): Promise<void> {
  const existing = await fetchCategoryByName(name);
  await del(`/catalog/categories/${existing.id}`);
}

// ── Lookups ───────────────────────────────────────────────────────────────────

export async function getExamLookups(): Promise<ExamLookups> {
  const [groupsRes, categoriesRes] = await Promise.all([
    get<{ items: ExamGroup[] }>("/admin/candidates/groups"),
    get<{ categories: BackendCategory[] }>("/catalog/categories"),
  ]);

  return {
    groups: groupsRes.items,
    candidates: [], // TODO: wire up when candidates endpoint is available
    sections: [], // TODO: wire up when sections endpoint is available
    certificateTemplates: [], // TODO: wire up when certificate templates endpoint is available
    categories: categoriesRes.categories.map((c) => c.name),
  };
}

// ── Exams CRUD ────────────────────────────────────────────────────────────────

export async function listExams(filters: ExamListFilters = {}): Promise<AdminExam[]> {
  const params: Record<string, string | number | boolean | undefined> = { page: 1, pageSize: 100 };
  if (filters.status && filters.status !== "all") params.status = filters.status;
  if (filters.type && filters.type !== "all") params.type = filters.type;
  if (filters.query) params.query = filters.query;
  if (filters.groupId) params.groupId = filters.groupId;
  if (filters.createdBy) params.createdBy = filters.createdBy;
  if (typeof filters.minDuration === "number") params.minDuration = filters.minDuration;
  if (typeof filters.maxDuration === "number") params.maxDuration = filters.maxDuration;
  if (filters.pricing && filters.pricing !== "all") params.pricing = filters.pricing;
  if (filters.storefront && filters.storefront !== "all") params.storefront = filters.storefront;
  if (filters.securityPreset && filters.securityPreset !== "all")
    params.securityPreset = filters.securityPreset;
  if (filters.schedule && filters.schedule !== "any") params.schedule = filters.schedule;

  const { items } = await get<{ items: BackendExam[]; total: number }>("/exams", params);
  return items.map(backendToAdminExam);
}

export async function getExam(id: string): Promise<AdminExam> {
  const { exam } = await get<{ exam: BackendExam }>(`/exams/${id}`);
  return backendToAdminExam(exam);
}

export async function createExam(payload: UpsertExamPayload): Promise<AdminExam> {
  const body = adminExamToBackend(payload);
  const { exam } = await post<{ exam: BackendExam }>("/exams", body);
  return backendToAdminExam(exam);
}

export async function updateExam(
  id: string,
  payload: Partial<UpsertExamPayload>,
): Promise<AdminExam> {
  const body = adminExamToBackend(payload);
  const { exam } = await patch<{ exam: BackendExam }>(`/exams/${id}`, body);
  return backendToAdminExam(exam);
}

export async function publishExam(id: string): Promise<AdminExam> {
  const { exam } = await post<{ exam: BackendExam }>(`/exams/${id}/publish`);
  return backendToAdminExam(exam);
}

export async function unpublishExam(id: string): Promise<AdminExam> {
  // No dedicated unpublish endpoint; PATCH status back to "draft"
  const { exam } = await patch<{ exam: BackendExam }>(`/exams/${id}`, { status: "draft" });
  return backendToAdminExam(exam);
}

export async function duplicateExam(id: string): Promise<AdminExam> {
  const { exam } = await post<{ exam: BackendExam }>(`/exams/${id}/duplicate`);
  return backendToAdminExam(exam);
}

export async function archiveExam(id: string): Promise<AdminExam> {
  const { exam } = await post<{ exam: BackendExam }>(`/exams/${id}/archive`);
  return backendToAdminExam(exam);
}

export async function deleteExam(id: string): Promise<void> {
  await del(`/exams/${id}`);
}

/**
 * Sync manually selected questions for an exam with the backend.
 * Replaces the existing question list (exam_question rows) for that exam.
 */
export async function syncManualExamQuestions(
  examId: string,
  questionIds: string[],
): Promise<void> {
  await post(`/exams/${examId}/questions/manual`, { questionIds });
}

// ── Assignment ────────────────────────────────────────────────────────────────

export async function assignGroups(_examId: string, _groupIds: string[]): Promise<void> {
  // TODO: POST /exams/:examId/assign-groups when backend endpoint is available
}

export async function assignCandidates(
  _examId: string,
  _candidateIds: string[],
): Promise<void> {
  // TODO: POST /exams/:examId/assign-candidates when backend endpoint is available
}

export async function regenerateLink(_examId: string): Promise<string> {
  // TODO: POST /exams/:examId/regenerate-link when backend endpoint is available
  return "";
}

// ── Candidates / Results / Activity / Purchases ──────────────────────────────

export async function listCandidatesForExam(
  examId: string,
  opts?: { includeAbandoned?: boolean },
): Promise<ExamCandidateStatusRow[]> {
  return collectCursorPages<ExamCandidateStatusRow>((cursor) =>
    listCandidatesForExamPage(examId, {
      includeAbandoned: opts?.includeAbandoned,
      limit: 200,
      cursor: cursor ?? undefined,
    }),
  );
}

export async function listCandidatesForExamPage(
  examId: string,
  opts?: { includeAbandoned?: boolean; cursor?: string; limit?: number },
): Promise<CursorPage<ExamCandidateStatusRow>> {
  const params: Record<string, string | number | undefined> = {};
  if (typeof opts?.includeAbandoned === "boolean") {
    params.includeAbandoned = opts.includeAbandoned ? "true" : "false";
  }
  return fetchCursorPageWithMetrics<ExamCandidateStatusRow>({
    listKey: "exam_candidates",
    examId,
    path: `/exams/${examId}/candidates`,
    cursor: opts?.cursor,
    limit: opts?.limit ?? 200,
    extraParams: params,
  });
}

/**
 * Ensure there is an active ExamAttempt for the current user.
 *
 * For now this simply POSTs /attempts with the examId and returns the newly
 * created attempt id. This id is then used:
 *  - on the candidate side as the room key for live proctoring
 *  - on the admin/proctor side to subscribe as a WebRTC viewer
 *  - for persisting proctor events against the attempt
 */
export async function ensureExamCandidateAttempt(
  examId: string,
  candidateEmail: string,
  options?: { consentGiven?: boolean },
): Promise<{ id: string; candidateId: string }> {
  void candidateEmail; // email is implied by the authenticated user on the backend
  const { attemptId } = await post<{ attemptId: string; status: string }>("/attempts", {
    examId,
    consentGiven: options?.consentGiven,
  });
  return { id: attemptId, candidateId: candidateEmail };
}

/**
 * Save an answer for a given attempt + question.
 * Used by the candidate exam UI so backend grading has data.
 */
export async function saveAttemptAnswer(
  attemptId: string,
  questionId: string,
  answer: string | string[],
): Promise<void> {
  await patch(`/attempts/${attemptId}/answer`, {
    questionId,
    answer,
  });
}

/**
 * Load previously saved answers for an attempt (used for reconnect/resume).
 */
export async function getAttemptAnswers(
  attemptId: string,
): Promise<Array<{ questionId: string; answer: string }>> {
  const { items } = await get<{ items: Array<{ questionId: string; answer: string }> }>(
    `/attempts/${attemptId}/answers`,
  );
  return items;
}

/**
 * Lightweight reconnect heartbeat for active attempt sessions.
 */
export async function sendAttemptHeartbeat(
  attemptId: string,
): Promise<{ ok: boolean; serverTime: string; status: string; answerCount: number }> {
  return post(`/attempts/${attemptId}/heartbeat`);
}

/**
 * Submit an attempt so it is graded and visible on student dashboards.
 */
export async function submitAttempt(
  attemptId: string,
): Promise<{
  status: string;
  summary: { score: number | null; totalMarks: number | null; percentage: number; resultStatus: string | null };
}> {
  return post(`/attempts/${attemptId}/submit`);
}

export async function listResults(examId: string): Promise<ExamResultRow[]> {
  return collectCursorPages<ExamResultRow>((cursor) =>
    listResultsPage(examId, {
      limit: 200,
      cursor: cursor ?? undefined,
    }),
  );
}

export async function listResultsPage(
  examId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<CursorPage<ExamResultRow>> {
  return fetchCursorPageWithMetrics<ExamResultRow>({
    listKey: "exam_results",
    examId,
    path: `/exams/${examId}/results`,
    cursor: opts?.cursor,
    limit: opts?.limit ?? 200,
  });
}

export async function listExamActivity(examId: string): Promise<ExamActivityLog[]> {
  return collectCursorPages<ExamActivityLog>((cursor) =>
    listExamActivityPage(examId, {
      limit: 200,
      cursor: cursor ?? undefined,
    }),
  );
}

export async function listExamActivityPage(
  examId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<CursorPage<ExamActivityLog>> {
  return fetchCursorPageWithMetrics<ExamActivityLog>({
    listKey: "exam_activity",
    examId,
    path: `/exams/${examId}/activity`,
    cursor: opts?.cursor,
    limit: opts?.limit ?? 200,
  });
}

export async function listPurchasesByExam(examId: string): Promise<ExamPurchase[]> {
  return collectCursorPages<ExamPurchase>((cursor) =>
    listPurchasesByExamPage(examId, {
      limit: 200,
      cursor: cursor ?? undefined,
    }),
  );
}

export async function listPurchasesByExamPage(
  examId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<CursorPage<ExamPurchase>> {
  return fetchCursorPageWithMetrics<ExamPurchase>({
    listKey: "exam_purchases",
    examId,
    path: `/exams/${examId}/purchases`,
    cursor: opts?.cursor,
    limit: opts?.limit ?? 200,
  });
}

export async function exportSalesCsv(_examId: string): Promise<string> {
  // TODO: GET /exams/:examId/sales/export when backend endpoint is available
  return "";
}

// ── Evidence playback ─────────────────────────────────────────────────────────

/** Proctor-only: use v1 so backend enforces assignment (proctor sees only assigned attempts). */
export async function getEvidenceAccessV1(attemptId: string): Promise<{
  webcam: boolean;
  screen: boolean;
  download: boolean;
}> {
  const data = await get<{ webcam: boolean; screen: boolean; download: boolean }>(
    `/v1/evidence/${attemptId}/access`,
  );
  return data;
}

/** Candidate/admin: get policy-based access for an attempt (backend enforces ownership). */
export async function getEvidenceAccess(attemptId: string): Promise<{
  webcam: boolean;
  screen: boolean;
  download: boolean;
  reason?: string;
}> {
  const data = await get<{
    webcam: boolean;
    screen: boolean;
    download: boolean;
    reason?: string;
  }>(`/evidence/${attemptId}/access`);
  return data;
}

/** @deprecated Use getEvidenceAccess(attemptId) and check webcam/screen/download. */
export async function evaluateEvidencePlaybackAccess(
  examId: string,
  action: EvidenceAccessAction,
): Promise<{ allowed: boolean; reason?: string }> {
  const data = await get<{ hasAccess: boolean; reason?: string }>(
    `/evidence/${examId}/access`,
    { action },
  );
  return { allowed: data.hasAccess, reason: data.reason };
}

export async function getExamEvidencePlaybackConfig(
  examId: string,
): Promise<ExamEvidencePlaybackConfig> {
  const exam = await getExam(examId);
  const defaults: ExamEvidencePlaybackConfig = {
    candidateCanViewWebcam: false,
    candidateCanViewScreen: false,
    candidateCanDownload: false,
    visibleDelayMinutes: 0,
    hideProctorNotes: true,
    legalHold: false,
  };
  return exam.evidencePlayback ?? defaults;
}

/** Record an evidence access attempt; backend computes outcome and logs. Returns outcome/reason. */
export async function recordEvidenceAccessAttempt(
  attemptId: string,
  action: EvidenceAccessAction,
): Promise<{ outcome: "allowed" | "denied"; reason?: string }> {
  const data = await post<{ outcome: "allowed" | "denied"; reason?: string }>(
    `/evidence/${attemptId}/audit`,
    { action },
  );
  return data;
}

export async function listEvidenceAccessAuditLogs(
  filters?: {
    examId?: string;
    actorId?: string;
    outcome?: string;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
  },
): Promise<EvidenceAccessAuditRecord[]> {
  const params: Record<string, string | undefined> = {};
  if (filters?.examId) params.examId = filters.examId;
  if (filters?.actorId) params.actorId = filters.actorId;
  if (filters?.outcome) params.outcome = filters.outcome;
  if (filters?.action) params.action = filters.action;
  if (filters?.resourceType) params.resourceType = filters.resourceType;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  const { items } = await get<{ items: EvidenceAccessAuditRecord[] }>(
    "/evidence/audit-logs",
    params,
  );
  return items;
}

export async function resetEvidenceAccessAuditStore(): Promise<void> {
  // No-op: the in-memory mock audit store no longer exists; nothing to reset.
}

/** Parse a simple CSV string into rows (header + data). Handles quoted fields. */
function parseCsvSimple(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let end = i + 1;
        while (end < line.length) {
          if (line[end] === '"' && line[end + 1] !== '"') break;
          if (line[end] === '"') end++;
          end++;
        }
        out.push(line.slice(i + 1, end).replace(/""/g, '"').trim());
        i = end + 1;
        if (line[i] === ",") i++;
      } else {
        const comma = line.indexOf(",", i);
        if (comma === -1) {
          out.push(line.slice(i).trim());
          break;
        }
        out.push(line.slice(i, comma).trim());
        i = comma + 1;
      }
    }
    return out;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

/** Import exams from CSV. Columns: title, type, durationMinutes, pricingMode, price, description. */
export async function importExamsFromCsv(csv: string): Promise<{ imported: number; failed: number; errors: string[] }> {
  const { headers, rows } = parseCsvSimple(csv.replace(/^\uFEFF/, ""));
  const col = (row: string[], name: string) => {
    const i = headers.findIndex((h) => h.toLowerCase().trim() === name.toLowerCase());
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };
  let imported = 0;
  const errors: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const title = col(row, "title") || col(row, "name");
    if (!title) {
      errors.push(`Row ${r + 2}: missing title`);
      continue;
    }
    const type = (col(row, "type") || "group").toLowerCase();
    const examType = type === "link" || type === "series" ? type : "group";
    const durationMinutes = Math.max(1, parseInt(col(row, "durationMinutes") || col(row, "duration") || "60", 10) || 60);
    const pricingMode = (col(row, "pricingMode") || "FREE").toUpperCase() === "PAID" ? "PAID" : "FREE";
    const price = pricingMode === "PAID" ? parseFloat(col(row, "price") || "0") || null : null;
    const description = col(row, "description") || undefined;
    try {
      await post<{ exam: BackendExam }>("/exams", {
        title,
        type: examType,
        durationMinutes,
        pricingMode,
        price: price ?? undefined,
        description: description || undefined,
      });
      imported++;
    } catch (e: unknown) {
      errors.push(`Row ${r + 2}: ${e instanceof Error ? e.message : "create failed"}`);
    }
  }
  return { imported, failed: rows.length - imported, errors };
}
