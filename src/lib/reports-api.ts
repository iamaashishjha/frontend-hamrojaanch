import { get } from "@/lib/apiClient";

export interface ReportSummary {
  totalAttempts: number;
  totalExamsWithAttempts: number;
  passed: number;
  failed: number;
  underReview: number;
  overallPassRate: number | null;
}

export interface ExamReportRow {
  examId: string;
  title: string;
  status: string;
  passMarkPercent: number | null;
  totalAttempts: number;
  submitted: number;
  passed: number;
  failed: number;
  underReview: number;
  avgScore: number | null;
  avgPercentage: number | null;
  passRate: number | null;
}

export interface ReportsSummaryResponse {
  summary: ReportSummary;
  exams: ExamReportRow[];
}

export async function getReportsSummary(): Promise<ReportsSummaryResponse> {
  return get<ReportsSummaryResponse>("/admin/reports/summary");
}
