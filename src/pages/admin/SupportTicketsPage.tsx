import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headphones, Mail, MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  listSupportTickets,
  updateSupportTicket,
  getSupportTicket,
  addTicketReply,
  listCannedReplies,
  listSlaProfiles,
  listSupportAssignees,
  type SupportTicket,
} from "@/lib/support-api";
import { format } from "date-fns";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"] as const;

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-tickets", statusFilter],
    queryFn: () => listSupportTickets(statusFilter ? { status: statusFilter } : undefined),
  });

  const items = data?.items ?? [];

  const handleStatusChange = async (ticket: SupportTicket, newStatus: string) => {
    try {
      await updateSupportTicket(ticket.id, { status: newStatus });
      toast({ title: "Ticket updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] });
      if (selectedId === ticket.id) {
        queryClient.invalidateQueries({ queryKey: ["admin", "support-ticket", ticket.id] });
      }
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Update failed" });
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Headphones className="h-6 w-6" />
          Support Tickets
        </h1>
        <p className="text-muted-foreground">In-app support requests. Update status or assign.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Tickets
          </CardTitle>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                      No support tickets yet. Tickets are created from the Contact page or in-app forms.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(t.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{t.requesterEmail}</div>
                        {t.requesterName && <div className="text-xs text-muted-foreground">{t.requesterName}</div>}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={t.subject}>{t.subject}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "open" ? "default" : "secondary"}>{t.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{t.slaProfile?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(t.createdAt), "PPp")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={t.status}
                          onValueChange={(v) => handleStatusChange(t, v)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <TicketDetailSheet
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "support-tickets"] });
          }}
        />
      )}
    </div>
  );
}

function TicketDetailSheet({
  ticketId,
  onClose,
  onUpdate,
}: {
  ticketId: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "support-ticket", ticketId],
    queryFn: () => getSupportTicket(ticketId),
    enabled: !!ticketId,
  });

  const { data: cannedData } = useQuery({
    queryKey: ["admin", "canned-replies"],
    queryFn: listCannedReplies,
  });
  const { data: slaData } = useQuery({
    queryKey: ["admin", "sla-profiles"],
    queryFn: listSlaProfiles,
  });
  const { data: assigneesData } = useQuery({
    queryKey: ["admin", "support-assignees"],
    queryFn: listSupportAssignees,
  });

  const ticket = data?.ticket;
  const cannedItems = cannedData?.items ?? [];
  const slaItems = slaData?.items ?? [];
  const assignees = assigneesData?.items ?? [];

  const handleAssign = async (userId: string | null) => {
    if (!ticket) return;
    try {
      await updateSupportTicket(ticket.id, { assignedToUserId: userId });
      toast({ title: "Assignee updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "support-ticket", ticketId] });
      onUpdate();
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Update failed" });
    }
  };

  const handleSlaChange = async (slaId: string | null) => {
    if (!ticket) return;
    try {
      await updateSupportTicket(ticket.id, { slaProfileId: slaId });
      toast({ title: "SLA updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "support-ticket", ticketId] });
      onUpdate();
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Update failed" });
    }
  };

  const handleReply = async () => {
    if (!ticket || !replyBody.trim()) return;
    try {
      await addTicketReply(ticket.id, replyBody.trim(), isInternal);
      toast({ title: "Reply added" });
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["admin", "support-ticket", ticketId] });
      onUpdate();
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Reply failed" });
    }
  };

  const insertCannedReply = (body: string) => {
    setReplyBody((prev) => (prev ? prev + "\n\n" + body : body));
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    try {
      await updateSupportTicket(ticket.id, { status: newStatus });
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "support-ticket", ticketId] });
      onUpdate();
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Update failed" });
    }
  };

  return (
    <Sheet open={!!ticketId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ticket #{ticketId.slice(0, 8)}
          </SheetTitle>
        </SheetHeader>
        {isLoading || !ticket ? (
          <p className="text-muted-foreground py-4">Loading…</p>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge>{ticket.status}</Badge>
                {ticket.escalatedAt && <Badge variant="secondary">Escalated</Badge>}
              </div>
              <h2 className="font-semibold mt-2">{ticket.subject}</h2>
              <p className="text-sm text-muted-foreground">
                {ticket.requesterEmail} {ticket.requesterName && `• ${ticket.requesterName}`}
              </p>
              <p className="text-sm mt-2">{ticket.body || "—"}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Created {format(new Date(ticket.createdAt), "PPp")}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Assignee</label>
                <Select
                  value={ticket.assignedToUserId ?? "none"}
                  onValueChange={(v) => handleAssign(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {assignees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">SLA</label>
                <Select
                  value={ticket.slaProfileId ?? "none"}
                  onValueChange={(v) => handleSlaChange(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No SLA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No SLA</SelectItem>
                    {slaItems.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.responseTimeHours}h / {s.resolutionTimeHours}h)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ticket.replies && ticket.replies.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Replies</h3>
                <div className="space-y-2">
                  {ticket.replies.map((r) => (
                    <div key={r.id} className="rounded border p-3 text-sm">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{r.author?.name ?? "Unknown"} • {format(new Date(r.createdAt), "PPp")}</span>
                        {r.isInternal && <Badge variant="outline">Internal</Badge>}
                      </div>
                      <p className="whitespace-pre-wrap">{r.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Add reply</label>
                {cannedItems.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">Insert canned reply</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {cannedItems.map((c) => (
                        <DropdownMenuItem key={c.id} onClick={() => insertCannedReply(c.body)}>
                          {c.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <Textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Type your reply..."
                rows={4}
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                  Internal note (not visible to requester)
                </label>
                <Button onClick={handleReply} disabled={!replyBody.trim()}>
                  Send reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
