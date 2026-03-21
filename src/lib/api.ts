/**
 * General API helpers — calls real backend via shared apiClient.
 * Functions without a dedicated backend endpoint return sensible defaults.
 */
import { get } from "@/lib/apiClient";
import type {
  AdminExam,
  Exam,
  ExamQuestion,
  ExamReportSummary,
  MonitoringLogEntry,
  ProctorAlert,
  ProctorAuditEntry,
  ProctorStudent,
} from "@/lib/types";

// ── Exam ────────────────────────────────────────────────

export async function getExam(examId: string): Promise<Exam> {
  const data = await get<{ exam: Exam }>(`/exams/${examId}`);
  return data.exam;
}

// ── Exam questions (managed via question-bank module) ───

export async function getExamQuestions(
  examId: string,
  attemptId?: string
): Promise<ExamQuestion[]> {
  const data = await get<{ questions: any[] }>(`/exams/${examId}/questions`, {
    attemptId,
  });
  return data.questions.map((q, idx) => ({
    id: idx + 1, // local numeric id for navigation
    questionId: String(q.id ?? idx + 1), // backend question id for answer persistence/scoring
    text: (() => {
      const raw = q.questionHtml ?? q.text ?? "";
      const stripped = typeof raw === "string" ? raw.replace(/<[^>]*>/g, "").trim() : "";
      return stripped || raw || "";
    })(),
    options: (q.options ?? []).map((o: any, optIdx: number) => ({
      id: String(optIdx + 1),
      text: o.text ?? o.label ?? "",
    })),
  }));
}

// ── Monitoring log (no direct endpoint) ─────────────────

export async function getMonitoringLog(examId: string): Promise<MonitoringLogEntry[]> {
  void examId;
  return [];
}

// ── Proctor students (live active attempts) ─────────────
// Uses v1 so backend scopes by role: proctors see only assigned attempts; admin/teacher see all.

export async function getProctorStudents(): Promise<ProctorStudent[]> {
  const { items } = await get<{ items: ProctorStudent[] }>("/v1/proctor/active-students");
  return items;
}

// ── Proctor alerts (from ProctorEvent, scoped by role) ───

export async function getProctorAlerts(): Promise<ProctorAlert[]> {
  const { items } = await get<{ items: ProctorAlert[] }>("/v1/proctor/alerts");
  return items ?? [];
}

// ── Proctor audit log (proctor actions: warn/terminate) ──

export async function getProctorAuditLog(): Promise<ProctorAuditEntry[]> {
  const { items } = await get<{ items: ProctorAuditEntry[] }>("/v1/proctor/audit-log");
  return items ?? [];
}

// ── Admin exams ─────────────────────────────────────────

export async function getAdminExams(): Promise<AdminExam[]> {
  const data = await get<{ items: AdminExam[] }>("/exams");
  return data.items;
}

// ── Exam report (no analytics endpoint yet — returns empty default) ──

export async function getExamReport(examId?: string): Promise<ExamReportSummary> {
  void examId;
  return { totalStudents: 0, passed: 0, flagged: 0, violations: 0, rows: [] };
}
