/**
 * P0: Notification templates admin — list, create, edit.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
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
  createNotificationTemplate,
  listNotificationTemplates,
  updateNotificationTemplate,
  type NotificationTemplateItem,
} from "@/lib/notifications-api";

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplateItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    channel: "email" as "email" | "sms" | "in-app",
    subjectTemplate: "",
    bodyTemplate: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: listNotificationTemplates,
  });

  const resetForm = () => {
    setForm({
      name: "",
      channel: "email",
      subjectTemplate: "",
      bodyTemplate: "",
    });
    setEditing(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.bodyTemplate.trim()) {
      toast({ variant: "destructive", title: "Name and body required" });
      return;
    }
    setSaving(true);
    try {
      await createNotificationTemplate({
        name: form.name.trim(),
        channel: form.channel,
        subjectTemplate: form.subjectTemplate.trim() || undefined,
        bodyTemplate: form.bodyTemplate.trim(),
      });
      toast({ title: "Template created" });
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : "Create failed" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t: NotificationTemplateItem) => {
    setEditing(t);
    setForm({
      name: t.name,
      channel: t.channel as "email" | "sms" | "in-app",
      subjectTemplate: t.subjectTemplate || "",
      bodyTemplate: t.bodyTemplate,
    });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !form.name.trim() || !form.bodyTemplate.trim()) return;
    setSaving(true);
    try {
      await updateNotificationTemplate(editing.id, {
        name: form.name.trim(),
        channel: form.channel,
        subjectTemplate: form.subjectTemplate.trim() || undefined,
        bodyTemplate: form.bodyTemplate.trim(),
      });
      toast({ title: "Template updated" });
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setEditOpen(false);
      resetForm();
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification Templates</h1>
        <p className="text-muted-foreground">
          Reusable templates for email, SMS, and in-app notifications. Use these when creating campaigns.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Templates
            </CardTitle>
            <CardDescription>Create and edit notification templates by channel.</CardDescription>
          </div>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New template
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground">No templates yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.channel}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{t.subjectTemplate || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Edit</Button>
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
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>Create a reusable notification template.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Exam reminder"
              />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v as "email" | "sms" | "in-app" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="sms">sms</SelectItem>
                  <SelectItem value="in-app">in-app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject (optional, for email)</Label>
              <Input
                value={form.subjectTemplate}
                onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
                placeholder="Subject line"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={form.bodyTemplate}
                onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                placeholder="Body content (supports placeholders later)"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) resetForm(); setEditOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>Update the template.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v as "email" | "sms" | "in-app" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="sms">sms</SelectItem>
                  <SelectItem value="in-app">in-app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject (optional)</Label>
              <Input
                value={form.subjectTemplate}
                onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={form.bodyTemplate}
                onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
