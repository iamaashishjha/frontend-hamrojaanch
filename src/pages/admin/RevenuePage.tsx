/**
 * P2: Revenue summary — paid/refunded/pending totals and links to reconciliation & billing.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CreditCard, Receipt, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRevenueSummary } from "@/lib/revenue-api";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: currency || "NPR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RevenuePage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["admin", "revenue", "summary"],
    queryFn: getRevenueSummary,
  });

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Revenue</h1>
        <p className="text-muted-foreground">
          Order revenue summary. Use Payments Reconciliation for detailed matching; Billing for webhooks.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-6">Loading…</p>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total paid</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalPaid, summary.currency)}</div>
                <p className="text-xs text-muted-foreground">{summary.paidCount} orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total refunded</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalRefunded, summary.currency)}</div>
                <p className="text-xs text-muted-foreground">{summary.refundedCount} orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.pendingCount}</div>
                <p className="text-xs text-muted-foreground">orders awaiting payment</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Net revenue
              </CardTitle>
              <CardDescription>Paid minus refunded. Tenant-scoped when X-Tenant-ID is set.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalPaid - summary.totalRefunded, summary.currency)}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-4">
            <Button asChild variant="outline">
              <Link to="/admin/payments-reconciliation" className="flex items-center gap-2">
                Payments reconciliation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/billing" className="flex items-center gap-2">
                Billing &amp; plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground py-6">No summary available.</p>
      )}
    </div>
  );
}
