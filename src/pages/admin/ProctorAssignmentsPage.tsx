import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { toast } from "@/components/ui/use-toast";
import { listCandidatesForExam, listExams } from "@/lib/exams-module-api";
import type { ExamCandidateStatusRow } from "@/lib/exams-module-types";
import {
  buildTriageCandidateRows,
  getIdleMinutes,
  summarizeIdleBands,
} from "@/lib/idle-triage";
import { useIdleTriageShortcuts } from "@/hooks/useIdleTriageShortcuts";
import { useTriageSearchParams } from "@/hooks/useTriageSearchParams";
import { useIdleTriageController } from "@/hooks/useIdleTriageController";
import {
  assignProctor,
  getEligibleProctors,
  getProctorAssignments,
  type ProctorAssignmentItem,
  type EligibleProctor,
} from "@/lib/proctor-api";
import FileVaultQuickTriageCard from "@/components/admin/FileVaultQuickTriageCard";
import TriageShortcutHint from "@/components/admin/TriageShortcutHint";
import IdleQuickFilterCards from "@/components/admin/IdleQuickFilterCards";
import SessionFilterActionBar from "@/components/admin/SessionFilterActionBar";
import IdleSeverityValue from "@/components/admin/IdleSeverityValue";

function formatIdleSince(lastActivityAt?: string) {
  if (!lastActivityAt) return "—";
  const ms = Date.now() - new Date(lastActivityAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export default function ProctorAssignmentsPage() {
  const navigate = useNavigate();
  const triageParams = useTriageSearchParams();
  const queryClient = useQueryClient();
  const [selectedExamId, setSelectedExamId] = useState<string>(() =>
    triageParams.getString("examId", ""),
  );
  const [includeAbandoned, setIncludeAbandoned] = useState(() =>
    triageParams.getBoolean("includeAbandoned", false),
  );
  const [assignAttemptId, setAssignAttemptId] = useState<string | null>(null);
  const [assignProctorId, setAssignProctorId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const { data: exams = [] } = useQuery({
    queryKey: ["admin", "exams"],
    queryFn: () => listExams({}),
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["proctor", "assignments"],
    queryFn: getProctorAssignments,
  });

  const { data: eligibleProctors = [], isLoading: proctorsLoading } = useQuery({
    queryKey: ["proctor", "eligible"],
    queryFn: getEligibleProctors,
  });

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["exam", selectedExamId, "candidates", includeAbandoned],
    queryFn: () => listCandidatesForExam(selectedExamId, { includeAbandoned }),
    enabled: !!selectedExamId,
  });

  const assignmentByAttemptId = new Map<string, ProctorAssignmentItem>(
    assignments.map((a) => [a.attemptId, a])
  );

  const idleSummary = useMemo(() => summarizeIdleBands(candidates), [candidates]);

  const {
    idleFilter,
    setIdleFilter,
    applyIdleQuickFilter,
    resetAllFilters,
    activeFilterCount,
    hasAnyFilters,
  } = useIdleTriageController({
    initialIdleFilter: triageParams.getIdleBand("idle", "all"),
    includeAbandoned,
    extraActiveFilterCount: selectedExamId ? 1 : 0,
    onReset: () => {
      setSelectedExamId("");
      setIncludeAbandoned(false);
    },
  });

  const filteredCandidates = useMemo(
    () =>
      buildTriageCandidateRows(candidates, {
        idleFilter,
      }),
    [candidates, idleFilter],
  );

  useIdleTriageShortcuts({
    onCritical: () => applyIdleQuickFilter("critical"),
    onWarning: () => applyIdleQuickFilter("warning"),
    onHealthy: () => applyIdleQuickFilter("healthy"),
    onClearIdle: () => setIdleFilter("all"),
    onResetAll: resetAllFilters,
  });

  useEffect(() => {
    triageParams.setParams({
      examId: selectedExamId || undefined,
      includeAbandoned,
      idle: idleFilter !== "all" ? idleFilter : undefined,
    });
  }, [selectedExamId, includeAbandoned, idleFilter]);

  const handleAssign = async () => {
    if (!assignAttemptId || !assignProctorId) return;
    setAssigning(true);
    try {
      await assignProctor(assignAttemptId, assignProctorId);
      toast({ title: "Success", description: "Proctor assigned." });
      queryClient.invalidateQueries({ queryKey: ["proctor", "assignments"] });
      setAssignAttemptId(null);
      setAssignProctorId("");
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: e instanceof Error ? e.message : "Could not assign proctor.",
      });
    } finally {
      setAssigning(false);
    }
  };

  const openAssignModal = (row: ExamCandidateStatusRow) => {
    setAssignAttemptId(row.id);
    setAssignProctorId(eligibleProctors[0]?.id ?? "");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Proctor Assignments</h1>
        <p className="text-muted-foreground">
          Assign proctors to attempts. Proctors see only their assigned attempts on the Proctor dashboard.
        </p>
        <TriageShortcutHint />
        <div className="mt-2 flex flex-wrap gap-2">
          <SessionFilterActionBar
            activeFilterCount={activeFilterCount}
            hasAnyFilters={hasAnyFilters}
            includeAbandoned={includeAbandoned}
            onToggleIncludeAbandoned={() => setIncludeAbandoned((prev) => !prev)}
            onResetAllFilters={resetAllFilters}
            extraActions={(
              <Button variant="outline" size="sm" onClick={() => navigate("/admin/file-vault")}>
                Open File Vault
              </Button>
            )}
          />
        </div>
      </div>

      <IdleQuickFilterCards
        summary={idleSummary}
        activeBand={idleFilter}
        onSelect={applyIdleQuickFilter}
      />

      <Card>
        <CardHeader>
          <CardTitle>Current assignments</CardTitle>
          <CardDescription>Attempts that have a proctor assigned (v1 scoped)</CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-muted-foreground">No assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Proctor</TableHead>
                  <TableHead>Assigned at</TableHead>
                  <TableHead>Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.exam.title}</TableCell>
                    <TableCell>{a.candidate.name} ({a.candidate.email})</TableCell>
                    <TableCell>{a.proctor ? a.proctor.name : "—"}</TableCell>
                    <TableCell>{new Date(a.assignedAt).toLocaleString()}</TableCell>
                    <TableCell>{a.eventCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FileVaultQuickTriageCard
        title="Evidence file quick triage"
        description="Recent evidence videos from File Vault."
        kind="evidence_video"
        pageSize={6}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign proctor to attempt
          </CardTitle>
          <CardDescription>Select an exam, then choose a candidate attempt and assign a proctor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Exam</label>
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedExamId && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Candidates (attempts)</label>
                {idleFilter !== "all" && (
                  <Button size="sm" variant="outline" onClick={() => setIdleFilter("all")}>
                    Clear Idle Filter
                  </Button>
                )}
              </div>
              {candidatesLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-muted-foreground">No attempts for this exam.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Idle</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned proctor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCandidates.map((row) => {
                      const assigned = assignmentByAttemptId.get(row.id);
                      return (
                        <TableRow key={row.id}>
                          <TableCell>{row.candidateName} ({row.email})</TableCell>
                          <TableCell>
                            {row.lastActivityAt
                              ? new Date(row.lastActivityAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <IdleSeverityValue
                              status={row.status}
                              idleLabel={formatIdleSince(row.lastActivityAt)}
                              idleMinutes={getIdleMinutes(row.lastActivityAt)}
                              mode="text"
                            />
                          </TableCell>
                          <TableCell>
                            {row.status === "in_progress"
                              ? "In progress"
                              : row.status === "completed"
                                ? "Completed"
                                : row.status === "abandoned"
                                  ? "Abandoned"
                                  : "Not started"}
                          </TableCell>
                          <TableCell>{assigned?.proctor?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignModal(row)}
                              disabled={proctorsLoading || eligibleProctors.length === 0}
                            >
                              {assigned ? "Reassign" : "Assign"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!assignAttemptId} onOpenChange={(open) => !open && setAssignAttemptId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign proctor</DialogTitle>
            <DialogDescription>Choose who will proctor this attempt. They will see it on the Proctor dashboard.</DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium mb-2 block">Proctor</label>
            <Select value={assignProctorId} onValueChange={setAssignProctorId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select proctor" />
              </SelectTrigger>
              <SelectContent>
                {eligibleProctors.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.email}) — {p.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAttemptId(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !assignProctorId}>
              {assigning ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
