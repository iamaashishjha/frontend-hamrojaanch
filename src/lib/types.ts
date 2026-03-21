export interface Exam {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  totalQuestions: number;
}

export interface ExamQuestionOption {
  id: string;
  text: string;
}

export interface ExamQuestion {
  id: number;
  questionId: string;
  text: string;
  options: ExamQuestionOption[];
}

export interface MonitoringLogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  severity: "info" | "warning" | "attention";
  description: string;
}

export interface ProctorStudent {
  id: string;
  /** Underlying exam attempt id used for live viewer signaling */
  attemptId: string;
  examId: string;
  examName: string;
  name: string;
  email: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  cameraStatus: boolean;
  micStatus: boolean;
  screenStatus: boolean;
  warningCount: number;
  status: "active" | "submitted" | "flagged";
}

export interface ProctorAlert {
  id: string;
  studentName: string;
  type: string;
  time: string;
  severity: "high" | "medium";
  /** For ISSUE_REPORTED: student's description */
  description?: string;
}

export interface ProctorAuditEntry {
  id: string;
  user: string;
  action: string;
  time: string;
}

export interface AdminExam {
  id: string;
  name: string;
  date: string;
  duration: string;
  students: number;
  status: "active" | "scheduled" | "completed";
}

export interface ExamReportRow {
  student: string;
  exam: string;
  score: string;
  aiEvents: number;
  status: "Passed" | "Review" | "Flagged";
}

export interface ExamReportSummary {
  totalStudents: number;
  passed: number;
  flagged: number;
  violations: number;
  rows: ExamReportRow[];
}
