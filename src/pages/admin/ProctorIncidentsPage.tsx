/**
 * Phase 9: Proctor incident records — list, filter, update status.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  listProctorIncidents,
  updateProctorIncident,
  type ProctorIncident,
} from "@/lib/proctor-incident-api";

export default function ProctorIncidentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["admin", "proctor-incidents", statusFilter],
    queryFn: () =>
      listProctorIncidents(statusFilter === "all" ? undefined : statusFilter),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateProctorIncident>[1] }) =>
      updateProctorIncident(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "proctor-incidents"] });
      toast({ title: "Incident updated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const openCount = incidents.filter((i) => i.status === "open").length;
  const underReviewCount = incidents.filter((i) => i.status === "under_review").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proctor Incidents</h1>
          <p className="text-muted-foreground">
            Flagged attempts requiring review. Create from Exam Monitor when viewing a candidate.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Under review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{underReviewCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{resolvedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>
            Each incident is tied to an attempt. Use Exam Monitor to flag new incidents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : incidents.length === 0 ? (
            <p className="text-muted-foreground">No incidents match the filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attempt / Candidate</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs">{inc.attempt?.id?.slice(0, 8)}…</span>
                        <br />
                        <span className="text-sm">{inc.attempt?.email ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{inc.attempt?.exam?.title ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inc.status === "open"
                            ? "destructive"
                            : inc.status === "under_review"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {inc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{inc.creator?.name ?? inc.creator?.email ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(inc.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/exams/${inc.attempt?.examId}/monitor`}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          Monitor
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        {inc.status !== "resolved" && (
                          <Select
                            value={inc.status}
                            onValueChange={(v) =>
                              updateMutation.mutate({
                                id: inc.id,
                                data: { status: v as "open" | "under_review" | "resolved" },
                              })
                            }
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="under_review">Under review</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
