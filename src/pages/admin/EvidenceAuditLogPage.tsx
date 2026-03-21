import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Eye, EyeOff, FileJson, ShieldAlert, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { getExportManifest } from "@/lib/evidence-assets-api";
import { listEvidenceAccessAuditLogs } from "@/lib/exams-module-api";
import type { EvidenceAccessAuditRecord } from "@/lib/exams-module-types";
import FileVaultQuickTriageCard from "@/components/admin/FileVaultQuickTriageCard";

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type OutcomeFilter = "all" | "allowed" | "denied";
type ActionFilter = "all" | "evidence.view.webcam" | "evidence.view.screen" | "evidence.download";
type ResourceTypeFilter = "all" | "exam_evidence" | "notification" | "file_asset" | "attempt";

export default function EvidenceAuditLogPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EvidenceAccessAuditRecord[]>([]);
  const [examFilter, setExamFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<ResourceTypeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [manifestAttemptId, setManifestAttemptId] = useState("");
  const [manifestLoading, setManifestLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await listEvidenceAccessAuditLogs({
          examId: examFilter.trim() || undefined,
          actorId: actorFilter.trim() || undefined,
          outcome: outcomeFilter !== "all" ? outcomeFilter : undefined,
          action: actionFilter !== "all" ? actionFilter : undefined,
          resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });
        setRows(result);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Load failed",
          description:
            error instanceof Error
              ? error.message
              : "Unable to load evidence audit logs.",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [examFilter, actorFilter, outcomeFilter, actionFilter, resourceTypeFilter, fromDate, toDate]);


  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (
        examFilter &&
        !row.resourceId.toLowerCase().includes(examFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        actorFilter &&
        !row.actorId.toLowerCase().includes(actorFilter.toLowerCase())
      ) {
        return false;
      }
      if (outcomeFilter !== "all" && row.outcome !== outcomeFilter) {
        return false;
      }
      if (actionFilter !== "all" && row.action !== actionFilter) {
        return false;
      }
      return true;
    });
  }, [rows, examFilter, actorFilter, outcomeFilter, actionFilter]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const allowed = filtered.filter((r) => r.outcome === "allowed").length;
    const denied = filtered.filter((r) => r.outcome === "denied").length;
    return { total, allowed, denied };
  }, [filtered]);

  const handleExport = () => {
    const csvRows = [
      [
        "ID",
        "Timestamp",
        "Actor",
        "Tenant",
        "Action",
        "Resource Type",
        "Resource ID",
        "Outcome",
        "Reason",
        "IP",
        "User Agent",
      ],
      ...filtered.map((row) => [
        row.id,
        row.timestamp,
        row.actorId,
        row.tenantId,
        row.action,
        row.resourceType ?? "",
        row.resourceId,
        row.outcome,
        row.reason ?? "",
        row.ip,
        row.userAgent,
      ]),
    ];
    downloadCsv("evidence-audit-log.csv", csvRows);
  };

  const handleDownloadManifest = async () => {
    const attemptId = manifestAttemptId.trim();
    if (!attemptId) {
      toast({ variant: "destructive", title: "Enter an attempt ID" });
      return;
    }
    setManifestLoading(true);
    try {
      const manifest = await getExportManifest(attemptId);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", `evidence-manifest-${attemptId.slice(0, 8)}.json`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Manifest downloaded", description: `${manifest.itemCount} asset(s). Hash: ${manifest.manifestHash.slice(0, 16)}…` });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not download manifest",
      });
    } finally {
      setManifestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Admin Panel</p>
          <h1 className="text-2xl font-semibold text-foreground">
            Evidence Access Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Every evidence view and download attempt is recorded here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/file-vault")}>
            Open File Vault
          </Button>
          <Button onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Events</CardDescription>
            <CardTitle>{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5 text-green-600" /> Allowed
            </CardDescription>
            <CardTitle className="text-green-700">{summary.allowed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <EyeOff className="h-3.5 w-3.5 text-red-600" /> Denied
            </CardDescription>
            <CardTitle className="text-red-700">{summary.denied}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Chain-of-custody export (Phase 8) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileJson className="h-4 w-4" />
            Chain-of-custody export
          </CardTitle>
          <CardDescription>
            Download a hash manifest (JSON) for an attempt’s evidence assets. Export is logged in this audit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <Input
            placeholder="Attempt ID"
            value={manifestAttemptId}
            onChange={(e) => setManifestAttemptId(e.target.value)}
            className="w-full sm:max-w-[280px] font-mono text-sm"
          />
          <Button onClick={handleDownloadManifest} disabled={manifestLoading || !manifestAttemptId.trim()}>
            <Download className="mr-1 h-4 w-4" />
            {manifestLoading ? "Downloading…" : "Download manifest"}
          </Button>
        </CardContent>
      </Card>

      {/* File Vault quick triage */}
      <FileVaultQuickTriageCard
        title="File Vault (evidence quick triage)"
        description="Recent evidence video assets with direct open and scan-status actions."
        kind="evidence_video"
        pageSize={8}
      />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Filter by exam ID..."
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="w-full sm:max-w-[200px]"
            />
            <Input
              placeholder="Filter by actor..."
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full sm:max-w-[200px]"
            />
            <Select
              value={outcomeFilter}
              onValueChange={(v) => setOutcomeFilter(v as OutcomeFilter)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="allowed">Allowed</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v as ActionFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="evidence.view.webcam">View Webcam</SelectItem>
                <SelectItem value="evidence.view.screen">View Screen</SelectItem>
                <SelectItem value="evidence.download">Download</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={resourceTypeFilter}
              onValueChange={(v) => setResourceTypeFilter(v as ResourceTypeFilter)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="exam_evidence">Exam Evidence</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="file_asset">File Asset</SelectItem>
                <SelectItem value="attempt">Attempt</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full sm:max-w-[150px]"
            />
            <Input
              type="date"
              placeholder="To"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full sm:max-w-[150px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit table / mobile list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Audit Records</CardTitle>
          <CardDescription>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""} shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop / tablet table with horizontal scroll if needed */}
          <div className="hidden md:block">
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource Type</TableHead>
                    <TableHead>Resource ID</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(row.timestamp), "PPp")}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {row.actorId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {row.action.replace("evidence.", "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {row.resourceType ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-mono">
                        {row.resourceId}
                      </TableCell>
                      <TableCell>
                        {row.outcome === "allowed" ? (
                          <Badge
                            variant="success-light"
                            className="inline-flex items-center gap-1 text-[11px]"
                          >
                            <ShieldCheck className="h-3 w-3" /> Allowed
                          </Badge>
                        ) : (
                          <Badge
                            variant="danger-light"
                            className="inline-flex items-center gap-1 text-[11px]"
                          >
                            <ShieldAlert className="h-3 w-3" /> Denied
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {row.ip}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No evidence access events recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile stacked cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border bg-card/80 p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {format(new Date(row.timestamp), "PPp")}
                  </span>
                  {row.outcome === "allowed" ? (
                    <Badge
                      variant="success-light"
                      className="inline-flex items-center gap-1 text-[10px]"
                    >
                      <ShieldCheck className="h-3 w-3" /> Allowed
                    </Badge>
                  ) : (
                    <Badge
                      variant="danger-light"
                      className="inline-flex items-center gap-1 text-[10px]"
                    >
                      <ShieldAlert className="h-3 w-3" /> Denied
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="font-semibold">{row.actorId}</span>
                  <span className="text-muted-foreground">·</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {row.action.replace("evidence.", "")}
                  </Badge>
                  {row.resourceType && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{row.resourceType}</span>
                    </>
                  )}
                </div>
                <div className="font-mono text-[11px] break-all">
                  {row.resourceId}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[60%]">
                    {row.reason ?? "—"}
                  </span>
                  <span className="font-mono">{row.ip}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                No evidence access events recorded yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
