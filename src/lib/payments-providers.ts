import type { PaymentProvider } from "@/lib/payments-types";

export interface PaymentProviderMeta {
  id: PaymentProvider;
  label: string;
  description: string;
  supports: {
    refunds: boolean;
    webhooks: boolean;
    asyncCapture: boolean;
  };
}

export const paymentProviders: PaymentProviderMeta[] = [
  {
    id: "stripe",
    label: "Card (Stripe)",
    description: "Primary card processor with instant capture.",
    supports: { refunds: true, webhooks: true, asyncCapture: false },
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Redirect flow with asynchronous confirmation.",
    supports: { refunds: true, webhooks: true, asyncCapture: true },
  },
  {
    id: "razorpay",
    label: "Razorpay",
    description: "Regional wallets and UPI with async capture.",
    supports: { refunds: true, webhooks: true, asyncCapture: true },
  },
  {
    id: "esewa",
    label: "eSewa",
    description: "Nepal wallet redirect flow with server-side verification.",
    supports: { refunds: false, webhooks: false, asyncCapture: true },
  },
  {
    id: "manual",
    label: "Manual",
    description: "Offline payments confirmed by admin.",
    supports: { refunds: false, webhooks: false, asyncCapture: true },
  },
];

export function getPaymentProviderMeta(id: PaymentProvider) {
  return paymentProviders.find((provider) => provider.id === id) ?? paymentProviders[0];
}
