/**
 * P2: Policy engine admin — list, create, edit policies (global → category → exam).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  type Policy,
} from "@/lib/policies-api";

export default function PoliciesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [form, setForm] = useState({
    scope: "global" as "global" | "category" | "exam",
    scopeId: "",
    key: "",
    value: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["admin", "policies", scopeFilter],
    queryFn: () => listPolicies(scopeFilter ? { scope: scopeFilter } : undefined),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ scope: "global", scopeId: "", key: "", value: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Policy) => {
    setEditing(p);
    setForm({
      scope: p.scope as "global" | "category" | "exam",
      scopeId: p.scopeId ?? "",
      key: p.key,
      value: p.value,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key.trim()) {
      toast({ variant: "destructive", title: "Key is required" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updatePolicy(editing.id, { key: form.key.trim(), value: form.value });
        toast({ title: "Policy updated" });
      } else {
        await createPolicy({
          scope: form.scope,
          scopeId: form.scope === "global" ? undefined : (form.scopeId || undefined),
          key: form.key.trim(),
          value: form.value,
        });
        toast({ title: "Policy created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
      setDialogOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Policies</h1>
        <p className="text-muted-foreground">
          Configure policies at global, category, or exam level. Keys can be used by the system (e.g. proctoring.mode, evidence.retention_days).
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Policy list
            </CardTitle>
            <CardDescription>Scope: global → category → exam. Filter by scope below.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={scopeFilter || "all"} onValueChange={(v) => setScopeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All scopes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scopes</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New policy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Scope ID</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                      No policies. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  policies.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.scope}</TableCell>
                      <TableCell>{p.scopeId ?? "—"}</TableCell>
                      <TableCell>{p.key}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={p.value}>
                        {p.value || "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit policy" : "New policy"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update key or value. Scope cannot be changed."
                : "Create a policy at global, category, or exam level. Use scopeId for category or exam ID."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {!editing && (
                <>
                  <div>
                    <Label>Scope</Label>
                    <Select
                      value={form.scope}
                      onValueChange={(v: "global" | "category" | "exam") =>
                        setForm((f) => ({ ...f, scope: v, scopeId: v === "global" ? "" : f.scopeId }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="category">Category</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.scope !== "global" && (
                    <div>
                      <Label htmlFor="scopeId">Scope ID (category or exam ID)</Label>
                      <Input
                        id="scopeId"
                        value={form.scopeId}
                        onChange={(e) => setForm((f) => ({ ...f, scopeId: e.target.value }))}
                        placeholder="uuid"
                      />
                    </div>
                  )}
                </>
              )}
              <div>
                <Label htmlFor="policy-key">Key</Label>
                <Input
                  id="policy-key"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="e.g. proctoring.mode"
                />
              </div>
              <div>
                <Label htmlFor="policy-value">Value (JSON or text)</Label>
                <Textarea
                  id="policy-value"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder={'e.g. ai_only or {"retention_days": 90}'}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
