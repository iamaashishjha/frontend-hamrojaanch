// Real backend API. Replaces previous mock implementation.

import { get, post } from "@/lib/apiClient";
import { paymentProviders, getPaymentProviderMeta } from "@/lib/payments-providers";
import type {
  AccessDecision,
  Entitlement,
  Order,
  OrderItem,
  PaymentIntent,
  PaymentProvider,
  WebhookEventType,
} from "@/lib/payments-types";

export interface CouponValidation {
  valid: boolean;
  error?: string;
  couponId?: string;
  code?: string;
  discountAmount?: number;
  finalAmount?: number;
}

export async function validateCoupon(code: string, orderAmount: number): Promise<CouponValidation> {
  const res = await post<CouponValidation>("/coupons/validate", { code, orderAmount });
  return res;
}

export async function createOrder(input: {
  examId: string;
  buyerName: string;
  buyerEmail: string;
  couponCode?: string;
}): Promise<Order> {
  const body: Record<string, unknown> = {
    items: [{ examId: input.examId }],
    buyer: { name: input.buyerName, email: input.buyerEmail },
  };
  if (input.couponCode?.trim()) body.couponCode = input.couponCode.trim();

  const res = await post<{ orderId: string; amount: number; currency: string; status: string }>(
    "/orders",
    body,
  );

  // The backend returns a summary; fetch the full order object.
  const full = await get<{ order: Order }>(`/orders/${res.orderId}`);
  return full.order;
}

export async function createPaymentIntent(input: {
  orderId: string;
  provider: PaymentProvider;
}): Promise<PaymentIntent> {
  const res = await post<{ intentId: string; status: string }>(
    "/orders/payments/intents",
    { orderId: input.orderId, provider: input.provider },
  );

  // Build a PaymentIntent from the response and known input data.
  return {
    id: res.intentId,
    orderId: input.orderId,
    provider: input.provider,
    status: res.status as PaymentIntent["status"],
    amount: 0,
    currency: "NPR",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Confirm a payment intent.
 * No direct endpoint exists — use the manual webhook as a workaround.
 */
export async function confirmPayment(intentId: string): Promise<{
  order: Order;
  entitlement: Entitlement | null;
}> {
  const res = await post<{ order: Order; intent: PaymentIntent | null; entitlement: Entitlement | null }>(
    "/orders/payments/webhook/manual",
    { intentId, event: "payment.succeeded" },
  );
  return { order: res.order, entitlement: res.entitlement ?? null };
}

export async function listEntitlementsByEmail(_email: string): Promise<Entitlement[]> {
  // Backend uses auth token — the email param is kept for signature compat.
  const res = await get<{ items: Entitlement[] }>("/entitlements/me");
  return res.items;
}

/** Current user's orders (student purchase history). */
export async function listOrders(): Promise<Order[]> {
  const res = await get<Order[] | { orders: Order[] }>("/orders");
  return Array.isArray(res) ? res : res.orders;
}

/** All orders (admin billing page). Requires admin role. Includes intents for reconciliation. */
export async function listAdminOrders(): Promise<(Order & { intents?: PaymentIntent[] })[]> {
  const res = await get<{ orders: (Order & { intents?: PaymentIntent[] })[] }>("/admin/orders");
  return res.orders ?? [];
}

/** All entitlements (admin). For reconciliation. */
export async function listAdminEntitlements(): Promise<Entitlement[]> {
  const res = await get<{ entitlements: Entitlement[] }>("/admin/entitlements");
  return res.entitlements ?? [];
}

/** Admin-initiated refund. Revokes entitlements and sets order status to refunded. */
export async function refundOrder(orderId: string): Promise<{ ok: boolean; orderId: string; status: string }> {
  return post<{ ok: boolean; orderId: string; status: string }>(`/admin/orders/${orderId}/refund`, {});
}

/** Paid orders with missing or inactive entitlements (read-only report). For reconciliation. */
export interface MissingEntitlementRow {
  orderId: string;
  buyerEmail: string;
  examId: string;
  examName: string;
}

export async function getMissingEntitlements(): Promise<{
  missing: MissingEntitlementRow[];
  count: number;
}> {
  const res = await get<{ missing: MissingEntitlementRow[]; count: number }>(
    "/admin/orders/missing-entitlements",
  );
  return { missing: res.missing ?? [], count: res.count ?? 0 };
}

/** Regrant entitlements for a paid order (idempotent). Use when webhook did not create them. */
export async function regrantEntitlementsForOrder(
  orderId: string,
): Promise<{ ok: boolean; orderId: string; granted: number; updated: number; errors: string[] }> {
  return post<{ ok: boolean; orderId: string; granted: number; updated: number; errors: string[] }>(
    `/admin/orders/${orderId}/regrant-entitlements`,
    {},
  );
}

export async function listPaymentIntents(): Promise<PaymentIntent[]> {
  // Assumes the backend returns an array or { intents: PaymentIntent[] }.
  const res = await get<PaymentIntent[] | { intents: PaymentIntent[] }>("/orders/payments/intents");
  return Array.isArray(res) ? res : res.intents;
}

export async function listPaymentProviders() {
  return paymentProviders.map((provider) => ({
    ...provider,
    supports: { ...provider.supports },
  }));
}

/** Backend expects intentId (PaymentIntent id), not order id. */
export async function simulateWebhook(input: {
  provider: PaymentProvider;
  /** PaymentIntent id (use order.intents?.[0]?.id when simulating from an order). */
  intentId: string;
  eventType: WebhookEventType;
}): Promise<{ ok?: boolean; idempotent?: boolean }> {
  return post<{ ok?: boolean; idempotent?: boolean }>(
    `/orders/payments/webhook/${input.provider}`,
    { intentId: input.intentId, event: input.eventType },
  );
}

export async function getExamAccessDecision(
  examId: string,
  _email: string | null,
  _isLoggedIn: boolean,
): Promise<AccessDecision> {
  // Backend determines access via auth token + exam config.
  return get<AccessDecision>(`/exams/${examId}/access`);
}

/** No-op — real data lives on the server. */
export async function resetPaymentsStore(): Promise<void> {
  // Nothing to reset on the client side.
}
