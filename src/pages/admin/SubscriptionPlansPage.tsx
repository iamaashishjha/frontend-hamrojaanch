import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/admin/PageHeader";
import DataTable, { ColumnDef } from "@/components/admin/DataTable";
import Modal from "@/components/admin/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  createSubscriptionPlan,
  listSubscriptionPlansAdmin,
  updateSubscriptionPlan,
  type SubscriptionPlan,
} from "@/lib/subscription-plans-api";
import { toast } from "@/components/ui/use-toast";

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`;
}

function statusBadge(status: string) {
  const label = status === "active" ? "Active" : "Archived";
  const variant = status === "active" ? "success-light" : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "0",
    currency: "NPR",
    interval: "monthly",
    scope: "individual",
    maxExamsPerMonth: "",
    maxCandidates: "",
  });

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      price: "0",
      currency: "NPR",
      interval: "monthly",
      scope: "individual",
      maxExamsPerMonth: "",
      maxCandidates: "",
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const items = await listSubscriptionPlansAdmin();
      setPlans(items);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "Unable to load subscription plans.";
      toast({
        variant: "destructive",
        title: "Failed to load plans",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo<ColumnDef<SubscriptionPlan>[]>(
    () => [
      { header: "Name", accessor: "name" },
      {
        header: "Price",
        cell: (row) => money(row.price, row.currency),
      },
      { header: "Interval", accessor: "interval" },
      { header: "Scope", accessor: "scope" },
      {
        header: "Limits",
        cell: (row) => (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {row.maxExamsPerMonth && <span>Exams / month: {row.maxExamsPerMonth}</span>}
            {row.maxCandidates && <span>Candidates: {row.maxCandidates}</span>}
            {!row.maxExamsPerMonth && !row.maxCandidates && <span>Unlimited</span>}
          </div>
        ),
      },
      {
        header: "Status",
        cell: (row) => statusBadge(row.status),
      },
      {
        header: "",
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(row);
                setForm({
                  name: row.name,
                  description: row.description ?? "",
                  price: String(row.price),
                  currency: row.currency,
                  interval: row.interval,
                  scope: row.scope,
                  maxExamsPerMonth: row.maxExamsPerMonth ? String(row.maxExamsPerMonth) : "",
                  maxCandidates: row.maxCandidates ? String(row.maxCandidates) : "",
                });
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const nextStatus = row.status === "active" ? "archived" : "active";
                  await updateSubscriptionPlan(row.id, { status: nextStatus });
                  await load();
                  toast({ title: "Plan updated", description: `Plan is now ${nextStatus}.` });
                } catch (error) {
                  toast({
                    variant: "destructive",
                    title: "Failed to update plan",
                    description: error instanceof Error ? error.message : "Unable to update plan.",
                  });
                }
              }}
            >
              {row.status === "active" ? "Archive" : "Activate"}
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const handleSubmit = async () => {
    const price = Number(form.price) || 0;
    const maxExamsPerMonth = form.maxExamsPerMonth ? Number(form.maxExamsPerMonth) : undefined;
    const maxCandidates = form.maxCandidates ? Number(form.maxCandidates) : undefined;

    try {
      if (editing) {
        await updateSubscriptionPlan(editing.id, {
          name: form.name,
          description: form.description || undefined,
          price,
          currency: form.currency,
          interval: form.interval as SubscriptionPlan["interval"],
          scope: form.scope as SubscriptionPlan["scope"],
          maxExamsPerMonth,
          maxCandidates,
        });
        toast({ title: "Plan updated", description: "Subscription plan changes were saved." });
      } else {
        await createSubscriptionPlan({
          name: form.name,
          description: form.description || undefined,
          price,
          currency: form.currency,
          interval: form.interval as SubscriptionPlan["interval"],
          scope: form.scope as SubscriptionPlan["scope"],
          maxExamsPerMonth: maxExamsPerMonth ?? null,
          maxCandidates: maxCandidates ?? null,
        } as any);
        toast({ title: "Plan created", description: "New subscription plan is now available." });
      }
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      await load();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to save plan",
        description: error instanceof Error ? error.message : "Unable to save subscription plan.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Plans"
        subtitle="Define pricing tiers for individuals and institutions."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              resetForm();
              setDialogOpen(true);
            }}
          >
            New Plan
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : (
          <DataTable
            columns={columns}
            data={plans}
            emptyMessage="No subscription plans yet. Create your first plan to get started."
          />
        )}
      </div>

      <Modal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Edit Subscription Plan" : "New Subscription Plan"}
        description="Configure pricing, billing interval, and limits."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editing ? "Save changes" : "Create plan"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Price</label>
              <Input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Currency</label>
              <Select
                value={form.currency}
                onValueChange={(value) => setForm((prev) => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NPR">NPR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Interval</label>
              <Select
                value={form.interval}
                onValueChange={(value) => setForm((prev) => ({ ...prev, interval: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Scope</label>
              <Select
                value={form.scope}
                onValueChange={(value) => setForm((prev) => ({ ...prev, scope: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="institution">Institution</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Max exams / month (optional)</label>
              <Input
                type="number"
                min="0"
                value={form.maxExamsPerMonth}
                onChange={(e) => setForm((prev) => ({ ...prev, maxExamsPerMonth: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Max candidates (optional)</label>
              <Input
                type="number"
                min="0"
                value={form.maxCandidates}
                onChange={(e) => setForm((prev) => ({ ...prev, maxCandidates: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

