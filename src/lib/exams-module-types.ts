/**
 * README:
 * Exams module mock contracts for Admin UI.
 * Replace the API helpers in `exams-module-api.ts` with real backend calls later.
 */
export type ExamType = "group" | "link" | "series";
export type ExamStatus = "draft" | "published" | "running" | "completed" | "archived";
export type ExamPricingMode = "FREE" | "PAID";
export type ExamCurrency = "NPR" | "USD" | "INR";
export type NegativeMarkingMode = "none" | "fixed" | "percent";
export type AvailabilityMode = "always" | "scheduled" | "dailySlot";
export type AccessTargetType = "all" | "groups" | "candidates";
export type QuestionsMode = "auto" | "manual";
export type ResultsVisibilityRule = "immediately" | "after_completion" | "after_date" | "never";
export type SecurityPreset = "basic" | "strict";
export type LinkVisibility = "anyone" | "require_login" | "require_pin";

export interface ExamGroup {
  id: string;
  name: string;
  membersCount: number;
}

export interface ExamCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  groupId?: string;
}

export interface QuestionBankQuestion {
  id: string;
  title: string;
  sectionId: string;
  difficulty: "easy" | "medium" | "hard";
  type: "mcq" | "true_false" | "short";
  tags: string[];
  marks: number;
}

export interface ExamSectionCatalogItem {
  id: string;
  name: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
}

export interface SectionConfig {
  id: string;
  sectionId: string;
  questionCount: number;
  marksPerQuestion: number;
  negativeOverrideMode?: NegativeMarkingMode;
  negativeOverrideValue?: number;
}

export interface NegativeMarkingConfig {
  mode: NegativeMarkingMode;
  value?: number;
}

export interface AvailabilityConfig {
  mode: AvailabilityMode;
  startAt?: string;
  endAt?: string;
  startTime?: string;
  endTime?: string;
}

export interface LinkSettings {
  visibility: LinkVisibility;
  pin?: string;
  expiryMode: "never" | "datetime";
  expiresAt?: string;
  attemptsPerUser: number;
  shareLink: string;
}

export interface ExamAccessConfig {
  targetType: AccessTargetType;
  groupIds: string[];
  candidateIds: string[];
  linkSettings?: LinkSettings;
}

export interface ExamRulesConfig {
  allowBackNav: boolean;
  allowSkip: boolean;
  showResultsWhen: ResultsVisibilityRule;
  showCorrectAnswersWhen: ResultsVisibilityRule;
  releaseAt?: string;
  passMarkPercent?: number;
}

export interface ExamSecurityConfig {
  preset: SecurityPreset;
  trustedIpEnabled: boolean;
  watermarkEnabled: boolean;
  proctoringEnabled: boolean;
  fullscreenRequired: boolean;
  disableCopyPaste: boolean;
}

export interface ExamPricingConfig {
  mode: ExamPricingMode;
  isDemo: boolean;
  requireLoginForFree: boolean;
  price: number | null;
  currency: ExamCurrency;
  discountPrice: number | null;
  validityDays: number | null;
  paymentRequiredBeforeStart: boolean;
  showOnStorefront: boolean;
}

export interface ExamAdvancedConfig {
  certificateTemplateId?: string;
  webhookEnabled: boolean;
}

export interface ExamEvidencePlaybackConfig {
  candidateCanViewWebcam: boolean;
  candidateCanViewScreen: boolean;
  candidateCanDownload: boolean;
  visibleDelayMinutes: number;
  hideProctorNotes: boolean;
  legalHold: boolean;
}

export type EvidenceAccessAction =
  | "evidence.view.webcam"
  | "evidence.view.screen"
  | "evidence.download";

export interface EvidenceAccessAuditRecord {
  id: string;
  actorId: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  outcome: "allowed" | "denied";
  reason?: string;
}

export interface ExamCandidateMetrics {
  invited: number;
  attempted: number;
}

export interface AdminExam {
  id: string;
  name: string;
  thumbnailUrl?: string | null;
  category?: string;
  type: ExamType;
  status: ExamStatus;
  durationMinutes: number;
  negativeMarking: NegativeMarkingConfig;
  availability: AvailabilityConfig;
  attemptsAllowed: number;
  allowEarlySubmit: boolean;
  showCountdown: boolean;
  access: ExamAccessConfig;
  questionsMode: QuestionsMode;
  sectionsConfig: SectionConfig[];
  selectedQuestionIds: string[];
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  rules: ExamRulesConfig;
  security: ExamSecurityConfig;
  pricing: ExamPricingConfig;
  advanced: ExamAdvancedConfig;
  evidencePlayback?: ExamEvidencePlaybackConfig;
  candidateMetrics: ExamCandidateMetrics;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ExamListFilters {
  status?: "all" | ExamStatus;
  type?: "all" | ExamType;
  schedule?: "any" | "today" | "next_7_days" | "next_30_days" | "completed_last_30_days";
  groupId?: string;
  query?: string;
  createdBy?: string;
  minDuration?: number;
  maxDuration?: number;
  pricing?: "all" | "free" | "demo" | "paid";
  storefront?: "all" | "visible" | "hidden";
  securityPreset?: "all" | SecurityPreset;
}

export interface ExamPurchase {
  id: string;
  examId: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  currency: ExamCurrency;
  status: "paid" | "refunded";
  purchasedAt: string;
}

export interface ExamCandidateStatusRow {
  id: string;
  candidateId: string;
  candidateName: string;
  email: string;
  startTime?: string;
  lastActivityAt?: string;
  timeLeftMinutes?: number;
  status: "not_started" | "in_progress" | "completed" | "abandoned";
  flags: number;
}

export interface ExamResultRow {
  id: string;
  candidateId: string;
  candidateName: string;
  score: number;
  status: "passed" | "failed" | "review";
  timeTakenMinutes: number;
  submittedAt: string;
}

export interface ExamActivityLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export type UpsertExamPayload = Omit<AdminExam, "id" | "createdAt" | "updatedAt" | "candidateMetrics"> & {
  candidateMetrics?: ExamCandidateMetrics;
};

export interface ExamLookups {
  groups: ExamGroup[];
  candidates: ExamCandidate[];
  sections: ExamSectionCatalogItem[];
  certificateTemplates: CertificateTemplate[];
  categories: string[];
}
