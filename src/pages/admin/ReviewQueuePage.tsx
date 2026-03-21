import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { listReviewQueue, updateReview, type AttemptReviewItem } from "@/lib/review-queue-api";
import { getEligibleProctors } from "@/lib/proctor-api";

export default function ReviewQueuePage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>("");

  const { data: items = [] } = useQuery({
    queryKey: ["admin", "review-queue", statusFilter],
    queryFn: () => listReviewQueue(statusFilter || undefined),
  });

  const { data: proctors = [] } = useQuery({
    queryKey: ["proctor", "eligible"],
    queryFn: getEligibleProctors,
  });

  const handleStatus = async (review: AttemptReviewItem, status: string) => {
    try {
      await updateReview(review.id, { status });
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "review-queue"] });
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    }
  };

  const handleAssign = async (review: AttemptReviewItem) => {
    if (!assignUserId) return;
    setAssigningId(review.id);
    try {
      await updateReview(review.id, { assignedToUserId: assignUserId });
      toast({ title: "Assigned" });
      queryClient.invalidateQueries({ queryKey: ["admin", "review-queue"] });
      setAssignUserId("");
      setAssigningId(null);
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
      setAssigningId(null);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <p className="text-muted-foreground">Attempts flagged for review. Assign and resolve.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Queue
          </CardTitle>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_review">In review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                    No items in review queue.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.attempt?.exam?.title ?? r.attemptId}</TableCell>
                    <TableCell>{r.attempt?.user?.email ?? "—"}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{r.assignedTo?.name ?? "—"}</TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      {r.status !== "in_review" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatus(r, "in_review")}>
                          In review
                        </Button>
                      )}
                      {r.status !== "resolved" && (
                        <Button size="sm" variant="outline" onClick={() => handleStatus(r, "resolved")}>
                          Resolve
                        </Button>
                      )}
                      <Select value={assigningId === r.id ? assignUserId : ""} onValueChange={(v) => { setAssignUserId(v); setAssigningId(r.id); }}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent>
                          {proctors.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assigningId === r.id && assignUserId && (
                        <Button size="sm" onClick={() => handleAssign(r)}>Save</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
