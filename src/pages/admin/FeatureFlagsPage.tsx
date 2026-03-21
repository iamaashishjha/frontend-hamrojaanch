/**
 * Phase 12: Feature flags per tenant. Admin list and set.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getFeatureFlags, setFeatureFlag, type FeatureFlagItem } from "@/lib/feature-flags-api";

export default function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState("default");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("true");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "feature-flags", tenantId],
    queryFn: () => getFeatureFlags(tenantId),
  });

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newKey.trim();
    if (!key) {
      toast.error("Key is required");
      return;
    }
    setSaving(true);
    try {
      await setFeatureFlag(tenantId, key, newValue.trim() || "true");
      toast.success(`Flag ${key} set`);
      setNewKey("");
      setNewValue("true");
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags", tenantId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set flag");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (item: FeatureFlagItem, value: string) => {
    setSaving(true);
    try {
      await setFeatureFlag(tenantId, item.key, value);
      toast.success(`Flag ${item.key} updated`);
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags", tenantId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const flags = data?.flags ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flag className="h-6 w-6" />
          Feature Flags
        </h1>
        <p className="text-muted-foreground mt-1">
          Per-tenant feature flags. Use keys like <code className="text-xs">live_proctoring_enabled</code>,{" "}
          <code className="text-xs">strict_ai_monitoring</code>. Value: <code className="text-xs">true</code> /{" "}
          <code className="text-xs">false</code> or any string.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
          <CardDescription>View and edit flags for this tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <Label>Tenant ID</Label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="default"
                className="w-40"
              />
            </div>
          </div>

          <form onSubmit={handleSet} className="flex flex-wrap gap-2 items-end">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. live_proctoring_enabled"
                className="w-56"
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="true"
                className="w-24"
              />
            </div>
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />
              Add / Set
            </Button>
          </form>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center py-8">
                      No flags for this tenant. Add one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  flags.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell className="font-mono text-sm">{item.key}</TableCell>
                      <TableCell className="font-mono text-sm">{item.value}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            handleUpdate(item, item.value === "true" ? "false" : "true")
                          }
                        >
                          Toggle
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
    </div>
  );
}
