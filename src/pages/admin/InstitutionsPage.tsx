/**
 * P2: Tenants & Institutions admin — list, create, edit (institutions).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import {
  listTenants,
  listInstitutions,
  createTenant,
  createInstitution,
  updateInstitution,
  type Tenant,
  type Institution,
} from "@/lib/institutions-api";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function InstitutionsPage() {
  const queryClient = useQueryClient();
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [institutionDialogOpen, setInstitutionDialogOpen] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [tenantForm, setTenantForm] = useState({ name: "", slug: "", isActive: true });
  const [institutionForm, setInstitutionForm] = useState({
    tenantId: "",
    name: "",
    slug: "",
    isActive: true,
  });
  const [filterTenantId, setFilterTenantId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: listTenants,
  });

  const { data: institutions = [], isLoading: institutionsLoading } = useQuery({
    queryKey: ["admin", "institutions", filterTenantId || "all"],
    queryFn: () => listInstitutions(filterTenantId || undefined),
  });

  const openNewTenant = () => {
    setTenantForm({ name: "", slug: "", isActive: true });
    setTenantDialogOpen(true);
  };

  const openNewInstitution = () => {
    setInstitutionForm({
      tenantId: tenants[0]?.id ?? "",
      name: "",
      slug: "",
      isActive: true,
    });
    setEditingInstitution(null);
    setInstitutionDialogOpen(true);
  };

  const openEditInstitution = (inst: Institution) => {
    setEditingInstitution(inst);
    setInstitutionForm({
      tenantId: inst.tenantId,
      name: inst.name,
      slug: inst.slug,
      isActive: inst.isActive,
    });
    setInstitutionDialogOpen(true);
  };

  const handleTenantNameChange = (name: string) => {
    setTenantForm((f) => ({ ...f, name, slug: f.slug || slugFromName(name) }));
  };

  const handleInstitutionNameChange = (name: string) => {
    setInstitutionForm((f) => ({ ...f, name, slug: f.slug || (editingInstitution ? f.slug : slugFromName(name)) }));
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantForm.name.trim() || !tenantForm.slug.trim()) {
      toast({ variant: "destructive", title: "Name and slug required" });
      return;
    }
    setSaving(true);
    try {
      await createTenant({
        name: tenantForm.name.trim(),
        slug: tenantForm.slug.trim().toLowerCase(),
        isActive: tenantForm.isActive,
      });
      toast({ title: "Tenant created" });
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      setTenantDialogOpen(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: err instanceof Error ? err.message : "Create failed",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionForm.name.trim() || !institutionForm.slug.trim()) {
      toast({ variant: "destructive", title: "Name and slug required" });
      return;
    }
    if (!editingInstitution && !institutionForm.tenantId) {
      toast({ variant: "destructive", title: "Select a tenant" });
      return;
    }
    setSaving(true);
    try {
      if (editingInstitution) {
        await updateInstitution(editingInstitution.id, {
          name: institutionForm.name.trim(),
          slug: institutionForm.slug.trim().toLowerCase(),
          isActive: institutionForm.isActive,
        });
        toast({ title: "Institution updated" });
      } else {
        await createInstitution({
          tenantId: institutionForm.tenantId,
          name: institutionForm.name.trim(),
          slug: institutionForm.slug.trim().toLowerCase(),
          isActive: institutionForm.isActive,
        });
        toast({ title: "Institution created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "institutions"] });
      setInstitutionDialogOpen(false);
      setEditingInstitution(null);
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

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Tenants & Institutions</h1>
        <p className="text-muted-foreground">
          Manage tenants (organizations) and institutions per tenant. P2 onboarding.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Tenants
            </CardTitle>
            <CardDescription>Organizations that can have multiple institutions.</CardDescription>
          </div>
          <Button onClick={openNewTenant}>
            <Plus className="h-4 w-4 mr-2" />
            New tenant
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-center py-6">
                    No tenants yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.slug}</TableCell>
                    <TableCell>{t.isActive ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Institutions
            </CardTitle>
            <CardDescription>Institutions belong to a tenant. Filter by tenant below.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterTenantId || "all"} onValueChange={(v) => setFilterTenantId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openNewInstitution} disabled={tenants.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              New institution
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {institutionsLoading ? (
            <p className="text-muted-foreground py-4">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institutions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                      No institutions. Create a tenant first, then add institutions.
                    </TableCell>
                  </TableRow>
                ) : (
                  institutions.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell>{inst.name}</TableCell>
                      <TableCell>{inst.slug}</TableCell>
                      <TableCell>{tenantName(inst.tenantId)}</TableCell>
                      <TableCell>{inst.isActive ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEditInstitution(inst)}>
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

      <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tenant</DialogTitle>
            <DialogDescription>Create an organization (tenant). Slug must be unique and lowercase with hyphens.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTenant}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="tenant-name">Name</Label>
                <Input
                  id="tenant-name"
                  value={tenantForm.name}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label htmlFor="tenant-slug">Slug</Label>
                <Input
                  id="tenant-slug"
                  value={tenantForm.slug}
                  onChange={(e) => setTenantForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  placeholder="acme-corp"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="tenant-active"
                  checked={tenantForm.isActive}
                  onCheckedChange={(v) => setTenantForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="tenant-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTenantDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={institutionDialogOpen} onOpenChange={(open) => !open && setEditingInstitution(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInstitution ? "Edit institution" : "New institution"}</DialogTitle>
            <DialogDescription>
              {editingInstitution
                ? "Update name, slug, or active status."
                : "Create an institution under a tenant. Slug must be unique within the tenant."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveInstitution}>
            <div className="space-y-4 py-4">
              {!editingInstitution && (
                <div>
                  <Label>Tenant</Label>
                  <Select
                    value={institutionForm.tenantId}
                    onValueChange={(v) => setInstitutionForm((f) => ({ ...f, tenantId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="inst-name">Name</Label>
                <Input
                  id="inst-name"
                  value={institutionForm.name}
                  onChange={(e) => handleInstitutionNameChange(e.target.value)}
                  placeholder="Main Campus"
                />
              </div>
              <div>
                <Label htmlFor="inst-slug">Slug</Label>
                <Input
                  id="inst-slug"
                  value={institutionForm.slug}
                  onChange={(e) => setInstitutionForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  placeholder="main-campus"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="inst-active"
                  checked={institutionForm.isActive}
                  onCheckedChange={(v) => setInstitutionForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="inst-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInstitutionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingInstitution ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
