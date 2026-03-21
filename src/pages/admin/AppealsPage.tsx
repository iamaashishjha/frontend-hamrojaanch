import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { listAppeals, decideAppeal, type AppealItem } from "@/lib/appeals-api";

export default function AppealsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [decideOpen, setDecideOpen] = useState(false);
  const [deciding, setDeciding] = useState<AppealItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["admin", "appeals", statusFilter],
    queryFn: () => listAppeals(statusFilter || undefined),
  });

  const handleDecide = async (status: "approved" | "rejected") => {
    if (!deciding) return;
    try {
      await decideAppeal(deciding.id, status, decisionNotes);
      toast({ title: "Decision saved" });
      queryClient.invalidateQueries({ queryKey: ["admin", "appeals"] });
      setDecideOpen(false);
      setDeciding(null);
      setDecisionNotes("");
    } catch (e) {
      toast({ variant: "destructive", title: e instanceof Error ? e.message : "Failed" });
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Appeals</h1>
        <p className="text-muted-foreground">Candidate appeals on results. Approve or reject.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Appeals
          </CardTitle>
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                    No appeals.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.attempt?.exam?.title ?? "—"}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={a.reason}>{a.reason}</TableCell>
                    <TableCell>{a.status}</TableCell>
                    <TableCell>
                      {a.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => { setDeciding(a); setDecideOpen(true); }}>
                          Decide
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={decideOpen} onOpenChange={(o) => !o && setDeciding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide appeal</DialogTitle>
          </DialogHeader>
          {deciding && (
            <>
              <p className="text-sm text-muted-foreground">{deciding.reason}</p>
              <Textarea
                placeholder="Decision notes (optional)"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={2}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => handleDecide("rejected")}>Reject</Button>
                <Button onClick={() => handleDecide("approved")}>Approve</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
