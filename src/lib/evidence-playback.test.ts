/**
 * Evidence playback tests (Phase 6 TEST_PLAN).
 * - Visibility delay, legal hold, legacy defaults, audit logging, filter by exam (mocked backend).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExamEvidencePlaybackConfig,
  EvidenceAccessAction,
  EvidenceAccessAuditRecord,
} from "@/lib/exams-module-types";

vi.mock("@/lib/apiClient", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

describe("evidence playback types", () => {
  it("ExamEvidencePlaybackConfig has correct defaults shape", () => {
    const config: ExamEvidencePlaybackConfig = {
      candidateCanViewWebcam: true,
      candidateCanViewScreen: false,
      candidateCanDownload: false,
      visibleDelayMinutes: 0,
      hideProctorNotes: true,
      legalHold: false,
    };
    expect(config.candidateCanViewWebcam).toBe(true);
    expect(config.candidateCanDownload).toBe(false);
    expect(config.visibleDelayMinutes).toBe(0);
  });

  it("EvidenceAccessAction is a valid union type", () => {
    const actions: EvidenceAccessAction[] = [
      "evidence.view.webcam",
      "evidence.view.screen",
      "evidence.download",
    ];
    expect(actions).toHaveLength(3);
    expect(actions).toContain("evidence.view.webcam");
  });

  it("EvidenceAccessAuditRecord shape is correct", () => {
    const record = {
      id: "aud_1",
      actorId: "user_1",
      tenantId: "default",
      action: "evidence.view.webcam" as EvidenceAccessAction,
      resourceType: "exam_evidence" as const,
      resourceId: "ex_1",
      timestamp: new Date().toISOString(),
      ip: "127.0.0.1",
      userAgent: "vitest",
      outcome: "allowed" as const,
    };
    expect(record.action).toBe("evidence.view.webcam");
    expect(record.outcome).toBe("allowed");
  });
});

describe("evaluateEvidencePlaybackAccess (delay and legal hold)", () => {
  beforeEach(async () => {
    const { get } = await import("@/lib/apiClient");
    vi.mocked(get).mockReset();
  });

  it("visibility delay is enforced when backend denies access", async () => {
    const { get } = await import("@/lib/apiClient");
    const { evaluateEvidencePlaybackAccess } = await import("@/lib/exams-module-api");
    vi.mocked(get).mockResolvedValue({
      hasAccess: false,
      reason: "Evidence available after 2025-03-01T00:00:00.000Z",
    });
    const result = await evaluateEvidencePlaybackAccess("att_1", "evidence.view.webcam");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Evidence");
  });

  it("legal hold blocks candidate evidence access regardless of other toggles", async () => {
    const { get } = await import("@/lib/apiClient");
    const { evaluateEvidencePlaybackAccess } = await import("@/lib/exams-module-api");
    vi.mocked(get).mockResolvedValue({
      hasAccess: false,
      reason: "Evidence under legal hold",
    });
    const result = await evaluateEvidencePlaybackAccess("att_1", "evidence.download");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("legal hold");
  });

  it("allowed access when backend permits", async () => {
    const { get } = await import("@/lib/apiClient");
    const { evaluateEvidencePlaybackAccess } = await import("@/lib/exams-module-api");
    vi.mocked(get).mockResolvedValue({ hasAccess: true });
    const result = await evaluateEvidencePlaybackAccess("att_1", "evidence.view.webcam");
    expect(result.allowed).toBe(true);
  });
});

describe("getExamEvidencePlaybackConfig (legacy defaults)", () => {
  beforeEach(async () => {
    const { get } = await import("@/lib/apiClient");
    vi.mocked(get).mockReset();
  });

  it("legacy exams receive normalized evidence playback config from backend", async () => {
    const { get } = await import("@/lib/apiClient");
    const { getExamEvidencePlaybackConfig } = await import("@/lib/exams-module-api");
    const minimalBackend = {
      id: "ex_1",
      title: "Legacy Exam",
      type: "group",
      status: "published",
      durationMinutes: 60,
      attemptsAllowed: 1,
      totalQuestions: 10,
      pricingMode: "FREE",
      isDemo: false,
      currency: "NPR",
      requireLoginForFree: false,
      paymentRequiredBeforeStart: true,
      showOnStorefront: true,
      securityPreset: "basic",
      proctoringEnabled: false,
      fullscreenRequired: false,
      disableCopyPaste: false,
      watermarkEnabled: false,
      trustedIpEnabled: false,
      allowBackNav: true,
      allowSkip: true,
      showResultsWhen: "after_completion",
      showCorrectAnswersWhen: "never",
      candidateCanViewWebcam: false,
      candidateCanViewScreen: false,
      candidateCanDownload: false,
      visibleDelayMinutes: 0,
      hideProctorNotes: true,
      legalHold: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(get).mockResolvedValue({ exam: minimalBackend });
    const config = await getExamEvidencePlaybackConfig("ex_1");
    expect(config).toBeDefined();
    expect(config.candidateCanViewWebcam).toBe(false);
    expect(config.candidateCanViewScreen).toBe(false);
    expect(config.candidateCanDownload).toBe(false);
    expect(config.visibleDelayMinutes).toBe(0);
    expect(config.legalHold).toBe(false);
  });
});

describe("evidence audit (logging and filter by exam)", () => {
  beforeEach(async () => {
    const { get, post } = await import("@/lib/apiClient");
    vi.mocked(get).mockReset();
    vi.mocked(post).mockReset();
  });

  it("evidence access attempts are logged with audit metadata", async () => {
    const { post } = await import("@/lib/apiClient");
    const { recordEvidenceAccessAttempt } = await import("@/lib/exams-module-api");
    vi.mocked(post).mockResolvedValue({ outcome: "allowed" });
    const result = await recordEvidenceAccessAttempt("att_1", "evidence.view.webcam");
    expect(result.outcome).toBe("allowed");
    expect(vi.mocked(post).mock.calls[0][0]).toBe("/evidence/att_1/audit");
    expect(vi.mocked(post).mock.calls[0][1]).toEqual({ action: "evidence.view.webcam" });
  });

  it("audit logs can be filtered by exam and retrieved", async () => {
    const { get } = await import("@/lib/apiClient");
    const { listEvidenceAccessAuditLogs } = await import("@/lib/exams-module-api");
    const items: EvidenceAccessAuditRecord[] = [
      {
        id: "1",
        actorId: "u1",
        tenantId: "default",
        action: "evidence.view.webcam",
        resourceType: "exam_evidence",
        resourceId: "att_ex_1",
        timestamp: new Date().toISOString(),
        ip: "0",
        userAgent: "",
        outcome: "allowed",
      },
    ];
    vi.mocked(get).mockResolvedValue({ items });
    const list = await listEvidenceAccessAuditLogs({ examId: "ex_1" });
    expect(list).toHaveLength(1);
    expect(list[0].action).toBe("evidence.view.webcam");
    expect(vi.mocked(get).mock.calls[0][1]).toEqual({ examId: "ex_1" });
  });
});
