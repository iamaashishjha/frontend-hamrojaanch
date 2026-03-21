/**
 * Adapter: transforms flat backend Exam data ↔ nested frontend AdminExam type.
 *
 * WHY: Backend (Prisma) stores exam fields flat (e.g. pricingMode, price, currency)
 *      Frontend UI components expect nested objects (pricing: { mode, price, currency }).
 *      This adapter bridges both shapes without touching either side.
 */
import type {
  AdminExam,
  ExamEvidencePlaybackConfig,
  ExamPricingConfig,
  ExamSecurityConfig,
  ExamRulesConfig,
  ExamAccessConfig,
  NegativeMarkingConfig,
  AvailabilityConfig,
  ExamAdvancedConfig,
  UpsertExamPayload,
  SectionConfig,
} from "@/lib/exams-module-types";

/** Raw exam shape from the backend (flat Prisma columns) */
export interface BackendExam {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  durationMinutes: number;
  attemptsAllowed: number;
  totalQuestions: number;
  categoryId?: string | null;
  category?: { id: string; name: string; slug: string } | null;
   thumbnailUrl?: string | null;
  pricingMode: string;
  isDemo: boolean;
  price?: number | null;
  currency: string;
  discountPrice?: number | null;
  validityDays?: number | null;
  requireLoginForFree: boolean;
  paymentRequiredBeforeStart: boolean;
  showOnStorefront: boolean;
  securityPreset: string;
  proctoringEnabled: boolean;
  fullscreenRequired: boolean;
  disableCopyPaste: boolean;
  watermarkEnabled: boolean;
  trustedIpEnabled: boolean;
  allowBackNav: boolean;
  allowSkip: boolean;
  showResultsWhen: string;
  showCorrectAnswersWhen: string;
  releaseAt?: string | null;
  passMarkPercent?: number | null;
  candidateCanViewWebcam: boolean;
  candidateCanViewScreen: boolean;
  candidateCanDownload: boolean;
  visibleDelayMinutes: number;
  hideProctorNotes: boolean;
  legalHold: boolean;
  linkVisibility?: string | null;
  linkPin?: string | null;
  linkExpiryMode?: string | null;
  linkExpiresAt?: string | null;
  linkAttemptsPerUser?: number | null;
  shareLink?: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: { id: string; sectionId: string; questionCount: number; marksPerQuestion: number; negativeOverrideMode: string; negativeOverrideValue: number }[];
  _count?: { attempts?: number };
}

/** Transform flat backend exam → nested AdminExam for frontend UI */
export function backendToAdminExam(raw: BackendExam): AdminExam {
  const pricing: ExamPricingConfig = {
    mode: raw.pricingMode as ExamPricingConfig["mode"],
    isDemo: raw.isDemo,
    requireLoginForFree: raw.requireLoginForFree,
    price: raw.price ?? null,
    currency: (raw.currency || "NPR") as ExamPricingConfig["currency"],
    discountPrice: raw.discountPrice ?? null,
    validityDays: raw.validityDays ?? null,
    paymentRequiredBeforeStart: raw.paymentRequiredBeforeStart,
    showOnStorefront: raw.showOnStorefront,
  };

  const security: ExamSecurityConfig = {
    preset: raw.securityPreset as ExamSecurityConfig["preset"],
    trustedIpEnabled: raw.trustedIpEnabled,
    watermarkEnabled: raw.watermarkEnabled,
    proctoringEnabled: raw.proctoringEnabled,
    fullscreenRequired: raw.fullscreenRequired,
    disableCopyPaste: raw.disableCopyPaste,
  };

  const rules: ExamRulesConfig = {
    allowBackNav: raw.allowBackNav,
    allowSkip: raw.allowSkip,
    showResultsWhen: raw.showResultsWhen as ExamRulesConfig["showResultsWhen"],
    showCorrectAnswersWhen: raw.showCorrectAnswersWhen as ExamRulesConfig["showCorrectAnswersWhen"],
    releaseAt: raw.releaseAt ?? undefined,
    passMarkPercent: raw.passMarkPercent ?? undefined,
  };

  const evidencePlayback: ExamEvidencePlaybackConfig = {
    candidateCanViewWebcam: raw.candidateCanViewWebcam,
    candidateCanViewScreen: raw.candidateCanViewScreen,
    candidateCanDownload: raw.candidateCanDownload,
    visibleDelayMinutes: raw.visibleDelayMinutes,
    hideProctorNotes: raw.hideProctorNotes,
    legalHold: raw.legalHold,
  };

  const negativeMarking: NegativeMarkingConfig = { mode: "none" };
  const availability: AvailabilityConfig = { mode: "always" };
  const access: ExamAccessConfig = {
    targetType: "all",
    groupIds: [],
    candidateIds: [],
    linkSettings: raw.shareLink
      ? {
          visibility: (raw.linkVisibility as "anyone" | "require_login" | "require_pin") || "anyone",
          pin: raw.linkPin ?? undefined,
          expiryMode: (raw.linkExpiryMode as "never" | "datetime") || "never",
          expiresAt: raw.linkExpiresAt ?? undefined,
          attemptsPerUser: raw.linkAttemptsPerUser ?? 1,
          shareLink: raw.shareLink,
        }
      : undefined,
  };
  const advanced: ExamAdvancedConfig = { webhookEnabled: false };

  const sectionsConfig: SectionConfig[] = (raw.sections ?? []).map((s) => ({
    id: s.id,
    sectionId: s.sectionId,
    questionCount: s.questionCount,
    marksPerQuestion: s.marksPerQuestion,
    negativeOverrideMode: s.negativeOverrideMode as SectionConfig["negativeOverrideMode"],
    negativeOverrideValue: s.negativeOverrideValue,
  }));

  return {
    id: raw.id,
    name: raw.title,
    thumbnailUrl: raw.thumbnailUrl ?? null,
    category: raw.category?.name,
    type: raw.type as AdminExam["type"],
    status: raw.status as AdminExam["status"],
    durationMinutes: raw.durationMinutes,
    negativeMarking,
    availability,
    attemptsAllowed: raw.attemptsAllowed,
    allowEarlySubmit: true,
    showCountdown: true,
    access,
    questionsMode: "manual",
    sectionsConfig,
    selectedQuestionIds: [],
    randomizeQuestions: false,
    randomizeOptions: false,
    rules,
    security,
    pricing,
    advanced,
    evidencePlayback,
    candidateMetrics: {
      invited: 0,
      attempted: raw._count?.attempts ?? 0,
    },
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: "admin",
  };
}

/** Transform nested AdminExam (or payload) → flat backend fields for create/update */
export function adminExamToBackend(
  exam: Partial<UpsertExamPayload> & { name?: string }
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  if (exam.name !== undefined) flat.title = exam.name;
  if (exam.thumbnailUrl !== undefined) flat.thumbnailUrl = exam.thumbnailUrl;
  if (exam.type !== undefined) flat.type = exam.type;
  if (exam.status !== undefined) flat.status = exam.status;
  if (exam.durationMinutes !== undefined) flat.durationMinutes = exam.durationMinutes;
  if (exam.attemptsAllowed !== undefined) flat.attemptsAllowed = exam.attemptsAllowed;
  if (exam.category !== undefined) flat.categoryId = exam.category || null;

  // Pricing
  if (exam.pricing) {
    if (exam.pricing.mode !== undefined) flat.pricingMode = exam.pricing.mode;
    if (exam.pricing.isDemo !== undefined) flat.isDemo = exam.pricing.isDemo;
    if (exam.pricing.price !== undefined) flat.price = exam.pricing.price;
    if (exam.pricing.currency !== undefined) flat.currency = exam.pricing.currency;
    if (exam.pricing.discountPrice !== undefined) flat.discountPrice = exam.pricing.discountPrice;
    if (exam.pricing.validityDays !== undefined) flat.validityDays = exam.pricing.validityDays;
    if (exam.pricing.requireLoginForFree !== undefined) flat.requireLoginForFree = exam.pricing.requireLoginForFree;
    if (exam.pricing.paymentRequiredBeforeStart !== undefined) flat.paymentRequiredBeforeStart = exam.pricing.paymentRequiredBeforeStart;
    if (exam.pricing.showOnStorefront !== undefined) flat.showOnStorefront = exam.pricing.showOnStorefront;
  }

  // Security
  if (exam.security) {
    if (exam.security.preset !== undefined) flat.securityPreset = exam.security.preset;
    if (exam.security.proctoringEnabled !== undefined) flat.proctoringEnabled = exam.security.proctoringEnabled;
    if (exam.security.fullscreenRequired !== undefined) flat.fullscreenRequired = exam.security.fullscreenRequired;
    if (exam.security.disableCopyPaste !== undefined) flat.disableCopyPaste = exam.security.disableCopyPaste;
    if (exam.security.watermarkEnabled !== undefined) flat.watermarkEnabled = exam.security.watermarkEnabled;
    if (exam.security.trustedIpEnabled !== undefined) flat.trustedIpEnabled = exam.security.trustedIpEnabled;
  }

  // Rules
  if (exam.rules) {
    if (exam.rules.allowBackNav !== undefined) flat.allowBackNav = exam.rules.allowBackNav;
    if (exam.rules.allowSkip !== undefined) flat.allowSkip = exam.rules.allowSkip;
    if (exam.rules.showResultsWhen !== undefined) flat.showResultsWhen = exam.rules.showResultsWhen;
    if (exam.rules.showCorrectAnswersWhen !== undefined) flat.showCorrectAnswersWhen = exam.rules.showCorrectAnswersWhen;
    if (exam.rules.passMarkPercent !== undefined) flat.passMarkPercent = exam.rules.passMarkPercent;
  }

  // Evidence Playback
  if (exam.evidencePlayback) {
    if (exam.evidencePlayback.candidateCanViewWebcam !== undefined) flat.candidateCanViewWebcam = exam.evidencePlayback.candidateCanViewWebcam;
    if (exam.evidencePlayback.candidateCanViewScreen !== undefined) flat.candidateCanViewScreen = exam.evidencePlayback.candidateCanViewScreen;
    if (exam.evidencePlayback.candidateCanDownload !== undefined) flat.candidateCanDownload = exam.evidencePlayback.candidateCanDownload;
    if (exam.evidencePlayback.visibleDelayMinutes !== undefined) flat.visibleDelayMinutes = exam.evidencePlayback.visibleDelayMinutes;
    if (exam.evidencePlayback.hideProctorNotes !== undefined) flat.hideProctorNotes = exam.evidencePlayback.hideProctorNotes;
    if (exam.evidencePlayback.legalHold !== undefined) flat.legalHold = exam.evidencePlayback.legalHold;
  }

  return flat;
}
