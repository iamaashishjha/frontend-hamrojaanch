import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  listCannedReplies,
  createCannedReply,
  updateCannedReply,
  deleteCannedReply,
  listSlaProfiles,
  createSlaProfile,
  updateSlaProfile,
  deleteSlaProfile,
  listEscalationTriggers,
  createEscalationTrigger,
  updateEscalationTrigger,
  deleteEscalationTrigger,
  runEscalation,
  type CannedReply,
  type SlaProfile,
  type EscalationTrigger,
} from "@/lib/support-api";
import { Switch } from "@/components/ui/switch";

export default function SupportSettingsPage() {
  const queryClient = useQueryClient();
  const [cannedDialogOpen, setCannedDialogOpen] = useState(false);
  const [slaDialogOpen, setSlaDialogOpen] = useState(false);
  const [escalationDialogOpen, setEscalationDialogOpen] = useState(false);
  const [editingCanned, setEditingCanned] = useState<CannedReply | null>(null);
  const [editingSla, setEditingSla] = useState<SlaProfile | null>(null);
  const [editingEscalation, setEditingEscalation] = useState<EscalationTrigger | null>(null);

  const { data: cannedData } = useQuery({
    queryKey: ["admin", "canned-replies"],
    queryFn: listCannedReplies,
  });
  const { data: slaData } = useQuery({
    queryKey: ["admin", "sla-profiles"],
    queryFn: listSlaProfiles,
  });
  const { data: escalationData } = useQuery({
    queryKey: ["admin", "escalation-triggers"],
    queryFn: listEscalationTriggers,
  });

  const runEscalationMutation = useMutation({
    mutationFn: runEscalation,
    onSuccess: (data) => {
      toast({ title: "Escalation run", description: `${data.escalated} ticket(s) escalated.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] });
    },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });

  const cannedItems = cannedData?.items ?? [];
  const slaItems = slaData?.items ?? [];
  const escalationItems = escalationData?.items ?? [];

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Support Settings</h1>
        <p className="text-muted-foreground">
          Canned replies, SLA profiles, and escalation triggers.
        </p>
      </div>

      <Tabs defaultValue="canned">
        <TabsList>
          <TabsTrigger value="canned">Canned Replies</TabsTrigger>
          <TabsTrigger value="sla">SLA Profiles</TabsTrigger>
          <TabsTrigger value="escalation">Escalation Triggers</TabsTrigger>
        </TabsList>

        <TabsContent value="canned">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Canned Replies
              </CardTitle>
              <Button onClick={() => { setEditingCanned(null); setCannedDialogOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {cannedItems.length === 0 ? (
                <p className="text-muted-foreground py-4">No canned replies yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Shortcut</TableHead>
                      <TableHead>Body</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cannedItems.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.shortcut ?? "—"}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">{r.body || "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingCanned(r); setCannedDialogOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await deleteCannedReply(r.id);
                                toast({ title: "Deleted" });
                                queryClient.invalidateQueries({ queryKey: ["admin", "canned-replies"] });
                              } catch (e) {
                                toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                SLA Profiles
              </CardTitle>
              <Button onClick={() => { setEditingSla(null); setSlaDialogOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {slaItems.length === 0 ? (
                <p className="text-muted-foreground py-4">No SLA profiles yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Response (hrs)</TableHead>
                      <TableHead>Resolution (hrs)</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slaItems.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.responseTimeHours}</TableCell>
                        <TableCell>{s.resolutionTimeHours}</TableCell>
                        <TableCell>{s.isDefault ? "Yes" : "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingSla(s); setSlaDialogOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await deleteSlaProfile(s.id);
                                toast({ title: "Deleted" });
                                queryClient.invalidateQueries({ queryKey: ["admin", "sla-profiles"] });
                              } catch (e) {
                                toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Escalation Triggers
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => runEscalationMutation.mutate()}
                  disabled={runEscalationMutation.isPending}
                >
                  <Play className="mr-1 h-4 w-4" />
                  Run now
                </Button>
                <Button onClick={() => { setEditingEscalation(null); setEscalationDialogOpen(true); }}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {escalationItems.length === 0 ? (
                <p className="text-muted-foreground py-4">No escalation triggers yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Value (hrs)</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escalationItems.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.condition.replace("_", " ")}</TableCell>
                        <TableCell>{e.conditionValue}</TableCell>
                        <TableCell>{e.action.replace("_", " ")}</TableCell>
                        <TableCell>{e.isActive ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingEscalation(e); setEscalationDialogOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await deleteEscalationTrigger(e.id);
                                toast({ title: "Deleted" });
                                queryClient.invalidateQueries({ queryKey: ["admin", "escalation-triggers"] });
                              } catch (err) {
                                toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed" });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Canned reply dialog */}
      <CannedReplyDialog
        open={cannedDialogOpen}
        onOpenChange={setCannedDialogOpen}
        editing={editingCanned}
        onSuccess={() => {
          setCannedDialogOpen(false);
          setEditingCanned(null);
          queryClient.invalidateQueries({ queryKey: ["admin", "canned-replies"] });
        }}
      />

      {/* SLA dialog */}
      <SlaProfileDialog
        open={slaDialogOpen}
        onOpenChange={setSlaDialogOpen}
        editing={editingSla}
        onSuccess={() => {
          setSlaDialogOpen(false);
          setEditingSla(null);
          queryClient.invalidateQueries({ queryKey: ["admin", "sla-profiles"] });
        }}
      />

      {/* Escalation dialog */}
      <EscalationDialog
        open={escalationDialogOpen}
        onOpenChange={setEscalationDialogOpen}
        editing={editingEscalation}
        onSuccess={() => {
          setEscalationDialogOpen(false);
          setEditingEscalation(null);
          queryClient.invalidateQueries({ queryKey: ["admin", "escalation-triggers"] });
        }}
      />
    </div>
  );
}

function CannedReplyDialog({
  open,
  onOpenChange,
  editing,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CannedReply | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [body, setBody] = useState("");

  const reset = () => {
    setName(editing?.name ?? "");
    setShortcut(editing?.shortcut ?? "");
    setBody(editing?.body ?? "");
  };

  useEffect(() => {
    if (open) reset();
  }, [open, editing?.id]);

  const createMutation = useMutation({
    mutationFn: createCannedReply,
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });
  const updateMutation = useMutation({
    mutationFn: (data: { name: string; shortcut?: string | null; body: string }) =>
      updateCannedReply(editing!.id, data),
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ name, shortcut: shortcut || null, body });
    } else {
      createMutation.mutate({ name, shortcut: shortcut || undefined, body });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} Canned Reply</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Shortcut (e.g. /refund)</Label>
            <Input value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="/refund" />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SlaProfileDialog({
  open,
  onOpenChange,
  editing,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SlaProfile | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [responseTimeHours, setResponseTimeHours] = useState(24);
  const [resolutionTimeHours, setResolutionTimeHours] = useState(72);
  const [isDefault, setIsDefault] = useState(false);

  const reset = () => {
    setName(editing?.name ?? "");
    setResponseTimeHours(editing?.responseTimeHours ?? 24);
    setResolutionTimeHours(editing?.resolutionTimeHours ?? 72);
    setIsDefault(editing?.isDefault ?? false);
  };

  useEffect(() => {
    if (open) reset();
  }, [open, editing?.id]);

  const createMutation = useMutation({
    mutationFn: createSlaProfile,
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });
  const updateMutation = useMutation({
    mutationFn: (data: { name: string; responseTimeHours: number; resolutionTimeHours: number; isDefault: boolean }) =>
      updateSlaProfile(editing!.id, data),
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ name, responseTimeHours, resolutionTimeHours, isDefault });
    } else {
      createMutation.mutate({ name, responseTimeHours, resolutionTimeHours, isDefault });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} SLA Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Response time (hours)</Label>
            <Input
              type="number"
              min={0}
              value={responseTimeHours}
              onChange={(e) => setResponseTimeHours(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div>
            <Label>Resolution time (hours)</Label>
            <Input
              type="number"
              min={0}
              value={resolutionTimeHours}
              onChange={(e) => setResolutionTimeHours(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <Label>Default profile</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EscalationDialog({
  open,
  onOpenChange,
  editing,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: EscalationTrigger | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [condition, setCondition] = useState<"open_hours" | "sla_breach">("open_hours");
  const [conditionValue, setConditionValue] = useState(24);
  const [action, setAction] = useState<"assign_admin" | "notify">("assign_admin");
  const [isActive, setIsActive] = useState(true);

  const reset = () => {
    setName(editing?.name ?? "");
    setCondition(editing?.condition ?? "open_hours");
    setConditionValue(editing?.conditionValue ?? 24);
    setAction(editing?.action ?? "assign_admin");
    setIsActive(editing?.isActive ?? true);
  };

  useEffect(() => {
    if (open) reset();
  }, [open, editing?.id]);

  const createMutation = useMutation({
    mutationFn: createEscalationTrigger,
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });
  const updateMutation = useMutation({
    mutationFn: (data: Partial<EscalationTrigger>) => updateEscalationTrigger(editing!.id, data),
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, condition, conditionValue, action, isActive };
    if (editing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} Escalation Trigger</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Condition</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              value={condition}
              onChange={(e) => setCondition(e.target.value as "open_hours" | "sla_breach")}
            >
              <option value="open_hours">Open for X hours</option>
              <option value="sla_breach">SLA breach</option>
            </select>
          </div>
          <div>
            <Label>Value (hours)</Label>
            <Input
              type="number"
              min={0}
              value={conditionValue}
              onChange={(e) => setConditionValue(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div>
            <Label>Action</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              value={action}
              onChange={(e) => setAction(e.target.value as "assign_admin" | "notify")}
            >
              <option value="assign_admin">Assign to admin</option>
              <option value="notify">Notify</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
