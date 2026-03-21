import { get, post, patch } from "@/lib/apiClient";

export type SubscriptionInterval = "monthly" | "yearly";
export type SubscriptionScope = "individual" | "institution";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  interval: SubscriptionInterval;
  scope: SubscriptionScope;
  maxExamsPerMonth?: number | null;
  maxCandidates?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithPlan {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: SubscriptionPlan;
}

// ── Admin APIs ───────────────────────────────────────────────────────────────

export async function listSubscriptionPlansAdmin(): Promise<SubscriptionPlan[]> {
  const { items } = await get<{ items: SubscriptionPlan[] }>("/admin/subscription-plans");
  return items;
}

export async function createSubscriptionPlan(
  input: Omit<SubscriptionPlan, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: string;
  },
): Promise<SubscriptionPlan> {
  const { plan } = await post<{ plan: SubscriptionPlan }>("/admin/subscription-plans", input);
  return plan;
}

export async function updateSubscriptionPlan(
  id: string,
  patchBody: Partial<Pick<SubscriptionPlan, "name" | "description" | "price" | "currency" | "interval" | "scope" | "maxExamsPerMonth" | "maxCandidates" | "status">>,
): Promise<SubscriptionPlan> {
  const { plan } = await patch<{ plan: SubscriptionPlan }>(`/admin/subscription-plans/${id}`, patchBody);
  return plan;
}

// ── Public / self-service APIs ──────────────────────────────────────────────

export async function listSubscriptionPlansPublic(): Promise<SubscriptionPlan[]> {
  const { items } = await get<{ items: SubscriptionPlan[] }>("/subscription-plans");
  return items;
}

export async function listMySubscriptions(): Promise<SubscriptionWithPlan[]> {
  const { items } = await get<{ items: SubscriptionWithPlan[] }>("/subscriptions/me");
  return items;
}

