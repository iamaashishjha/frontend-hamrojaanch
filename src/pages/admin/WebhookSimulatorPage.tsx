/**
 * Dev tool: simulate payment webhook calls (e.g. payment.succeeded) for testing.
 * POSTs to the same backend webhook endpoint that payment providers use.
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { post } from "@/lib/apiClient";

const PROVIDERS = ["stripe", "paypal", "razorpay", "manual"] as const;
const EVENTS = [
  { value: "payment.succeeded", label: "payment.succeeded" },
  { value: "payment.failed", label: "payment.failed" },
  { value: "payment.refunded", label: "payment.refunded" },
] as const;

export default function WebhookSimulatorPage() {
  const [provider, setProvider] = useState<string>("manual");
  const [intentId, setIntentId] = useState("");
  const [event, setEvent] = useState<string>("payment.succeeded");
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<{ ok?: boolean; idempotent?: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intentId.trim()) {
      toast({ variant: "destructive", title: "Intent ID required" });
      return;
    }
    setLoading(true);
    setLastResponse(null);
    try {
      const res = await post<{ ok: boolean; idempotent?: boolean }>(
        `/orders/payments/webhook/${provider}`,
        { intentId: intentId.trim(), event }
      );
      setLastResponse(res);
      toast({
        title: res.idempotent ? "Already processed (idempotent)" : "Webhook sent",
        description: res.idempotent ? "No duplicate entitlements created." : "Check order and entitlements.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Webhook failed",
        description: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhook Simulator</h1>
        <p className="text-muted-foreground">
          Simulate payment provider webhooks for testing. Uses the same endpoint as Stripe/PayPal/Razorpay.
          Idempotent: duplicate events return 200 without double-granting entitlements.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send webhook</CardTitle>
          <CardDescription>
            Provide a valid PaymentIntent id from an existing order. Create an order and payment intent first if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="intentId">Intent ID (PaymentIntent id)</Label>
              <Input
                id="intentId"
                value={intentId}
                onChange={(e) => setIntentId(e.target.value)}
                placeholder="e.g. uuid from payment intent"
              />
            </div>
            <div>
              <Label>Event</Label>
              <Select value={event} onValueChange={setEvent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send webhook"}
            </Button>
            {lastResponse && (
              <pre className="text-sm bg-muted p-2 rounded">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
