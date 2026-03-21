/**
 * Admin: orders, payment intents, entitlements, and refund actions.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, FileCheck, Receipt, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import {
  getMissingEntitlements,
  listAdminEntitlements,
  listAdminOrders,
  regrantEntitlementsForOrder,
  refundOrder,
} from "@/lib/payments-api";
import type { Entitlement, Order, PaymentIntent } from "@/lib/payments-types";

type OrderWithIntents = Order & { intents?: PaymentIntent[] };

export default function PaymentsReconciliationPage() {
  const queryClient = useQueryClient();
  const [refundTarget, setRefundTarget] = useState<OrderWithIntents | null>(null);
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: listAdminOrders,
  });

  const refundMutation = useMutation({
    mutationFn: refundOrder,
    onSuccess: () => {
      setRefundTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "entitlements"] });
      toast({ title: "Order refunded. Entitlements revoked." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Refund failed", description: e.message }),
  });

  const { data: entitlements = [], isLoading: entitlementsLoading } = useQuery({
    queryKey: ["admin", "entitlements"],
    queryFn: listAdminEntitlements,
  });

  const { data: missingData, isLoading: missingLoading } = useQuery({
    queryKey: ["admin", "orders", "missing-entitlements"],
    queryFn: getMissingEntitlements,
  });
  const missing = missingData?.missing ?? [];
  const missingByOrder = missing.reduce((acc, row) => {
    if (!acc[row.orderId]) acc[row.orderId] = [];
    acc[row.orderId].push(row);
    return acc;
  }, {} as Record<string, typeof missing>);

  const regrantMutation = useMutation({
    mutationFn: regrantEntitlementsForOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "missing-entitlements"] });
      const msg = data.errors?.length
        ? `Regranted with some errors: ${data.granted + data.updated} processed. ${data.errors.join("; ")}`
        : `Entitlements regranted: ${data.granted} created, ${data.updated} updated.`;
      toast({ title: "Regrant complete", description: msg });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Regrant failed", description: e.message }),
  });

  const succeededByOrder = new Map<string, PaymentIntent[]>();
  for (const order of orders as OrderWithIntents[]) {
    const succeeded = (order.intents ?? []).filter((i) => i.status === "succeeded");
    if (succeeded.length) succeededByOrder.set(order.id, succeeded);
  }

  const entitlementsByEmailExam = new Map<string, Entitlement[]>();
  for (const e of entitlements) {
    const key = `${e.email}:${e.examId}`;
    if (!entitlementsByEmailExam.has(key)) entitlementsByEmailExam.set(key, []);
    entitlementsByEmailExam.get(key)!.push(e);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments Reconciliation</h1>
        <p className="text-muted-foreground">
          Read-only view of orders, payment intents, and entitlements to spot mismatches.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Total (last 500)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid orders</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(orders as OrderWithIntents[]).filter((o) => o.status === "paid").length}
            </div>
            <p className="text-xs text-muted-foreground">Status = paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entitlements</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entitlements.length}</div>
            <p className="text-xs text-muted-foreground">Active + expired + revoked</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders and intents</CardTitle>
          <CardDescription>Each paid order should have at least one succeeded intent; entitlements are created from webhook.</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <p className="text-muted-foreground">Loading orders…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Intents</TableHead>
                  <TableHead>Expected entitlements (exams in order)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders as OrderWithIntents[]).map((order) => {
                  const intents = order.intents ?? [];
                  const succeeded = intents.filter((i) => i.status === "succeeded");
                  const examIds = order.items?.map((i) => i.examId) ?? [];
                  const expectedCount = order.status === "paid" ? examIds.length : 0;
                  const actualCount = examIds.filter(
                    (examId) =>
                      (entitlementsByEmailExam.get(`${order.buyerEmail}:${examId}`) ?? []).some(
                        (e) => e.status === "active"
                      )
                  ).length;
                  const mismatch = order.status === "paid" && actualCount < expectedCount;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}…</TableCell>
                      <TableCell>{order.buyerEmail}</TableCell>
                      <TableCell>{order.status}</TableCell>
                      <TableCell>
                        {intents.length === 0
                          ? "—"
                          : `${succeeded.length} succeeded / ${intents.length} total`}
                      </TableCell>
                      <TableCell>
                        {order.status !== "paid" ? (
                          "—"
                        ) : (
                          <span className={mismatch ? "text-destructive" : ""}>
                            {actualCount} / {expectedCount} active
                            {mismatch && " (mismatch)"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.status === "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRefundTarget(order)}
                            disabled={refundMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Refund
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missing entitlements</CardTitle>
          <CardDescription>
            Paid orders where the buyer has no active entitlement for one or more items. Use Regrant to repair (idempotent).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missingLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : missing.length === 0 ? (
            <p className="text-muted-foreground">No missing entitlements.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(missingByOrder).map(([orderId, rows]) => (
                  <TableRow key={orderId}>
                    <TableCell className="font-mono text-xs">{orderId.slice(0, 8)}…</TableCell>
                    <TableCell>{rows[0].buyerEmail}</TableCell>
                    <TableCell>
                      {rows.map((r) => r.examName || r.examId.slice(0, 8)).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regrantMutation.mutate(orderId)}
                        disabled={regrantMutation.isPending}
                      >
                        <FileCheck className="h-4 w-4" />
                        Regrant
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the order status to refunded and revoke all entitlements for the purchased exams.
              {refundTarget && ` Order for ${refundTarget.buyerEmail} (${refundTarget.amount} ${refundTarget.currency}).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => refundTarget && refundMutation.mutate(refundTarget.id)}
            >
              Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Entitlements</CardTitle>
          <CardDescription>Recent entitlements (email, exam, status).</CardDescription>
        </CardHeader>
        <CardContent>
          {entitlementsLoading ? (
            <p className="text-muted-foreground">Loading entitlements…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Exam ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitlements.slice(0, 100).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.email}</TableCell>
                    <TableCell className="font-mono text-xs">{e.examId.slice(0, 8)}…</TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell>{e.validUntil ? new Date(e.validUntil).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {entitlements.length > 100 && (
            <p className="text-muted-foreground text-sm mt-2">Showing first 100 of {entitlements.length}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
