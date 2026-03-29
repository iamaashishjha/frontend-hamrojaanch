export type PaymentProvider = "stripe" | "paypal" | "razorpay" | "manual" | "esewa" | "khalti";
export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";
export type PaymentStatus = "created" | "processing" | "succeeded" | "failed";
export type EntitlementStatus = "active" | "expired" | "revoked";
export type WebhookEventType = "payment.succeeded" | "payment.failed" | "payment.refunded";

export interface OrderItem {
  examId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
}

export interface Order {
  id: string;
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  amount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  nextAction?: {
    type: "redirect_form";
    provider: "esewa";
    method: "POST";
    url: string;
    fields: Record<string, string>;
  } | {
    type: "redirect_url";
    provider: "khalti";
    method: "GET";
    url: string;
  };
}

export interface Entitlement {
  id: string;
  examId: string;
  email: string;
  status: EntitlementStatus;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessDecision {
  hasAccess: boolean;
  requiresLogin: boolean;
  requiresPayment: boolean;
  pricingLabel: "Free" | "Demo" | "Paid";
  reason?: string;
  validUntil?: string | null;
}
