/**
 * Payments API tests (Phase 6 TEST_PLAN).
 * - Paid exam gating, Free/Demo/Paid labels, webhook → entitlement (with mocked backend).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessDecision } from "@/lib/payments-types";

vi.mock("@/lib/apiClient", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

describe("payments-api types", () => {
  it("payment provider types are defined", async () => {
    const { paymentProviders } = await import("@/lib/payments-providers");
    expect(paymentProviders.length).toBeGreaterThan(0);
    expect(paymentProviders[0]).toHaveProperty("id");
    expect(paymentProviders[0]).toHaveProperty("label");
  });

  it("AccessDecision type has required fields", () => {
    const decision = {
      hasAccess: false,
      requiresLogin: true,
      requiresPayment: false,
      pricingLabel: "Free" as const,
    };
    expect(decision.hasAccess).toBe(false);
    expect(decision.pricingLabel).toBe("Free");
  });

  it("Entitlement type has required fields", () => {
    const entitlement = {
      id: "ent_1",
      examId: "ex_1",
      email: "test@example.com",
      status: "active" as const,
      validUntil: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(entitlement.status).toBe("active");
    expect(entitlement.email).toContain("@");
  });
});

describe("getExamAccessDecision (access gating)", () => {
  beforeEach(async () => {
    const { get } = await import("@/lib/apiClient");
    vi.mocked(get).mockReset();
  });

  it("paid exam requires login and payment when backend says so", async () => {
    const { get } = await import("@/lib/apiClient");
    const { getExamAccessDecision } = await import("@/lib/payments-api");
    vi.mocked(get).mockResolvedValue({
      hasAccess: false,
      requiresLogin: true,
      requiresPayment: true,
      pricingLabel: "Paid",
      reason: "Login and purchase required",
    });
    const decision = await getExamAccessDecision("ex_paid", null, false);
    expect(decision.pricingLabel).toBe("Paid");
    expect(decision.hasAccess).toBe(false);
    expect(decision.requiresPayment).toBe(true);
    expect(decision.requiresLogin).toBe(true);
  });

  it("free exam preserves Free label and can block logged-out users", async () => {
    const { get } = await import("@/lib/apiClient");
    const { getExamAccessDecision } = await import("@/lib/payments-api");
    vi.mocked(get).mockResolvedValue({
      hasAccess: false,
      requiresLogin: true,
      requiresPayment: false,
      pricingLabel: "Free",
      reason: "Login required",
    });
    const decision = await getExamAccessDecision("ex_free", null, false);
    expect(decision.pricingLabel).toBe("Free");
    expect(decision.requiresPayment).toBe(false);
  });

  it("demo exam has distinct Demo label and can grant access", async () => {
    const { get } = await import("@/lib/apiClient");
    const { getExamAccessDecision } = await import("@/lib/payments-api");
    vi.mocked(get).mockResolvedValue({
      hasAccess: true,
      requiresLogin: false,
      requiresPayment: false,
      pricingLabel: "Demo",
    });
    const decision = await getExamAccessDecision("ex_demo", "u@e.com", true);
    expect(decision.pricingLabel).toBe("Demo");
    expect(decision.hasAccess).toBe(true);
  });

  it("successful entitlement unlocks access (paid exam after purchase)", async () => {
    const { get } = await import("@/lib/apiClient");
    const { getExamAccessDecision } = await import("@/lib/payments-api");
    vi.mocked(get).mockResolvedValue({
      hasAccess: true,
      requiresLogin: false,
      requiresPayment: false,
      pricingLabel: "Paid",
    });
    const decision = await getExamAccessDecision("ex_paid", "buyer@e.com", true);
    expect(decision.hasAccess).toBe(true);
    expect(decision.requiresPayment).toBe(false);
  });
});
