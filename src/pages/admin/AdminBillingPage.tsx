import { useEffect, useMemo, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  listAdminOrders,
  listPaymentProviders,
  simulateWebhook,
} from "@/lib/payments-api";
import type { Order, PaymentProvider, WebhookEventType } from "@/lib/payments-types";

export default function AdminBillingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [providers, setProviders] = useState<{ id: PaymentProvider; label: string }[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>("stripe");
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventType>("payment.succeeded");
  const [simulating, setSimulating] = useState(false);

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  const loadData = async () => {
    const [ordersData, providersData] = await Promise.all([listAdminOrders(), listPaymentProviders()]);
    setOrders(ordersData);
    setProviders(providersData.map((provider) => ({ id: provider.id, label: provider.label })));
    if (ordersData.length > 0 && !selectedOrderId) {
      setSelectedOrderId(ordersData[0].id);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const handleSimulate = async () => {
    if (!selectedOrder) {
      notifyError("Select an order to simulate.");
      return;
    }
    const orderWithIntents = selectedOrder as Order & { intents?: { id: string }[] };
    const intentId = orderWithIntents.intents?.[0]?.id;
    if (!intentId) {
      notifyError("This order has no payment intent. Create one via checkout, or use Webhook Simulator with an intent ID.");
      return;
    }
    setSimulating(true);
    try {
      await simulateWebhook({
        provider: selectedProvider,
        intentId,
        eventType: selectedEvent,
      });
      notifySuccess("Webhook simulation processed.");
      await loadData();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to simulate webhook.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
        <h1 className="text-2xl font-semibold text-foreground">Billing &amp; Plan</h1>
        <p className="text-muted-foreground">
          Review your plan, invoices, and payment methods.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Current Plan</h2>
          <div className="mt-4 rounded-xl border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="mt-2 text-xl font-semibold text-foreground">Growth</p>
            <p className="text-sm text-muted-foreground">Up to 5,000 candidates / month</p>
            <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Upgrade Plan
            </button>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-semibold text-foreground">Invoices</h3>
            <div className="mt-3 space-y-3">
              {[
                { id: "INV-2043", amount: "$450", date: "Jan 2025" },
                { id: "INV-1988", amount: "$420", date: "Dec 2024" },
                { id: "INV-1922", amount: "$400", date: "Nov 2024" },
              ].map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-xl border bg-muted/40 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{invoice.id}</p>
                    <p className="text-sm text-muted-foreground">{invoice.date}</p>
                  </div>
                  <button className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10">
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Payment Method</h2>
          <div className="mt-4 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Visa ending 2048</p>
                <p className="text-sm text-muted-foreground">Expires 08/26</p>
              </div>
            </div>
            <button className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
              Update Card
            </button>
          </div>

          <div className="mt-6 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              Secure billing with SSL encrypted payments.
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Webhook Simulator (Dev Only)</h2>
        <p className="text-sm text-muted-foreground">
          Trigger test payment webhooks to test entitlements and access gating.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet. Complete a checkout to simulate.</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className={`rounded-xl border p-3 text-sm ${order.id === selectedOrderId ? "border-primary/60 bg-primary/5" : "bg-muted/40"}`}
                    onClick={() => setSelectedOrderId(order.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setSelectedOrderId(order.id);
                      }
                    }}
                  >
                    <p className="font-medium text-foreground">{order.buyerName}</p>
                    <p className="text-xs text-muted-foreground">{order.buyerEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      Order {order.id} - {order.currency} {order.amount} - {order.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Order Selected</p>
              <p className="text-sm font-medium text-foreground">
                {selectedOrder ? `${selectedOrder.buyerName} (${selectedOrder.id})` : "None"}
              </p>
            </div>
            <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as PaymentProvider)}>
              <SelectTrigger>
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedEvent} onValueChange={(value) => setSelectedEvent(value as WebhookEventType)}>
              <SelectTrigger>
                <SelectValue placeholder="Webhook Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment.succeeded">payment.succeeded</SelectItem>
                <SelectItem value="payment.failed">payment.failed</SelectItem>
                <SelectItem value="payment.refunded">payment.refunded</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void handleSimulate()} disabled={!selectedOrderId || simulating}>
              {simulating ? "Simulating..." : "Run Simulation"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
