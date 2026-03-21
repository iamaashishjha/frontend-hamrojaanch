/**
 * Admin: Coupon CRUD for Phase 8 Ecommerce.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { createCoupon, deleteCoupon, listCoupons, type Coupon } from "@/lib/coupon-api";

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const { data: coupons = [], isLoading } = useQuery({ queryKey: ["admin", "coupons"], queryFn: listCoupons });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "percent" as "percent" | "fixed",
    value: "",
    minOrderAmount: "",
    maxUses: "",
  });

  const createMutation = useMutation({
    mutationFn: createCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      setCreateOpen(false);
      setForm({ code: "", type: "percent", value: "", minOrderAmount: "", maxUses: "" });
      toast({ title: "Coupon created" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast({ title: "Coupon deleted" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const handleCreate = () => {
    const value = Number(form.value);
    if (!form.code.trim()) {
      toast({ variant: "destructive", title: "Code is required" });
      return;
    }
    if (Number.isNaN(value) || value < 0) {
      toast({ variant: "destructive", title: "Valid value required" });
      return;
    }
    if (form.type === "percent" && value > 100) {
      toast({ variant: "destructive", title: "Percent cannot exceed 100" });
      return;
    }
    createMutation.mutate({
      code: form.code.trim(),
      type: form.type,
      value,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Coupons</h1>
          <p className="text-muted-foreground">Manage promo codes for checkout discounts.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Coupon
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
          <CardDescription>Percent or fixed-amount discounts applied at checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : coupons.length === 0 ? (
            <p className="text-muted-foreground">No coupons yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>{c.type === "percent" ? `${c.value}%` : `NPR ${c.value}`}</TableCell>
                    <TableCell>{c.minOrderAmount != null ? `NPR ${c.minOrderAmount}` : "—"}</TableCell>
                    <TableCell>{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ""}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Coupon</DialogTitle>
            <DialogDescription>Create a promo code for checkout. Code is case-insensitive.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input
                placeholder="SAVE10"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as "percent" | "fixed" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent off</SelectItem>
                  <SelectItem value="fixed">Fixed amount off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Value {form.type === "percent" ? "(0-100)" : "(NPR)"}</Label>
              <Input
                type="number"
                min={0}
                max={form.type === "percent" ? 100 : undefined}
                placeholder={form.type === "percent" ? "10" : "50"}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Min order amount (NPR, optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Optional"
                value={form.minOrderAmount}
                onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Max uses (optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Unlimited"
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

