export type QuestionType =
  | "MCQ_SINGLE"
  | "MCQ_MULTI"
  | "TRUE_FALSE"
  | "SHORT"
  | "LONG"
  | "NUMERIC"
  | "CODING";

export type QuestionDifficultyLabel = "Easy" | "Medium" | "Hard";
export type QuestionLanguage = "EN" | "NE" | "MIXED";
export type QuestionStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type ExposureRisk = "LOW" | "MEDIUM" | "HIGH";
export type PricingMode = "FREE" | "PAID";
export type ProctorMode = "basic" | "strict";
export type ProctorSeverity = "low" | "medium" | "high";
export type ReviewStatus = "draft" | "under_review" | "approved" | "rejected" | "archived" | "deprecated";
export type ReviewPriority = "low" | "normal" | "high";

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface Question {
  id: string;
  title: string;
  questionHtml: string;
  type: QuestionType;
  options: QuestionOption[];
  correctAnswers: string[];
  explanationHtml: string;
  marks: number;
  negativeMarks: number;
  difficultyLabel: QuestionDifficultyLabel;
  difficultyScore: number;
  subject: string;
  topic: string;
  sectionId: string;
  tags: string[];
  estimatedTimeSec: number;
  language: QuestionLanguage;
  status: QuestionStatus;
  allowedPricing: PricingMode[];
  supportedProctorModes: ProctorMode[];
  isProctorSafe: boolean;
  excludeFromStrictPools: boolean;
  timesUsedInExams: number;
  lastUsedAt: string | null;
  exposureRisk: ExposureRisk;
  cooldownUntil?: string | null;
  needsReview: boolean;
  reviewStatus: ReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  reviewPriority: ReviewPriority;
  assignedReviewerId?: string | null;
  assignedReviewerAt?: string | null;
  flaggedCount: number;
  proctorViolationsCount: number;
  topViolationTypes: Record<string, number>;
}

export interface QuestionFilters {
  query?: string;
  pricing?: "all" | "free_allowed" | "paid_allowed" | "both";
  proctorMode?: "any" | ProctorMode;
  proctorSafe?: "all" | "safe" | "risky";
  difficulty?: "all" | QuestionDifficultyLabel;
  type?: "all" | QuestionType;
  subject?: "all" | string;
  topic?: "all" | string;
  sectionId?: "all" | string;
  tags?: string[];
  status?: "all" | QuestionStatus;
  exposureRisk?: "all" | ExposureRisk;
  cooldown?: "all" | "available_only" | "include_cooldown";
  examSnapshot?: ExamCompatibilitySnapshot;
  /** Filter by exam: inExam=true => questions in this exam; inExam=false => questions not in this exam */
  examId?: string;
  inExam?: boolean;
  needsReview?: "all" | "yes" | "no";
  reviewStatus?: "all" | ReviewStatus;
  reviewPriority?: "all" | ReviewPriority;
}

export interface ExamCompatibilitySnapshot {
  pricingMode: PricingMode;
  proctorPreset: ProctorMode;
}

export interface QuestionAnalytics {
  totals: {
    total: number;
    usedInExams: number;
    highExposure: number;
    needsReview: number;
    highProctorViolations: number;
  };
  usageTrend: { date: string; used: number }[];
  accuracyByDifficulty: { difficulty: QuestionDifficultyLabel; accuracy: number }[];
  proctorViolationsTrend: { date: string; violations: number }[];
  exposureDistribution: { risk: ExposureRisk; count: number }[];
  highRiskQuestions: Question[];
}

export interface ProctorEvent {
  id: string;
  examAttemptId: string;
  candidateId: string;
  eventType: string;
  severity: ProctorSeverity;
  timestamp: string;
  questionId?: string | null;
}

export interface QuestionTimelineEntry {
  questionId: string;
  startAt: string;
  endAt: string;
}

export interface QuestionTimeline {
  examAttemptId: string;
  entries: QuestionTimelineEntry[];
}

export interface MappedProctorEvent extends ProctorEvent {
  mappedQuestionId: string | null;
  isMapped: boolean;
}

export interface PickBalancedInput {
  pool: Question[];
  count: number;
  mixPercent: { easy: number; medium: number; hard: number };
  constraints?: {
    preferLowExposure?: boolean;
  };
}

export interface PickBalancedResult {
  selectedIds: string[];
  warnings: string[];
  breakdown: { easy: number; medium: number; hard: number };
  exposureScore: number;
}

export interface QuestionCsvExport {
  fileName: string;
  rows: string[][];
}
