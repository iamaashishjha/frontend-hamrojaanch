import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { getExam, listCandidatesForExam } from "@/lib/exams-module-api";
import {
  getAttemptTimeline,
  listAttemptProctorEvents,
  listQuestions,
  mapEventsToQuestions,
} from "@/lib/question-bank-api";
import type { MappedProctorEvent, Question, QuestionTimeline } from "@/lib/question-bank-types";
import type { AdminExam, ExamCandidateStatusRow } from "@/lib/exams-module-types";
import { createViewer, type LiveStatus } from "@/lib/live-proctoring";
import { sendProctorAction } from "@/lib/proctor-api";
import { createProctorIncident } from "@/lib/proctor-incident-api";
import {
  buildTriageCandidateRows,
  getIdleMinutes,
  summarizeIdleBands,
} from "@/lib/idle-triage";
import { useIdleTriageShortcuts } from "@/hooks/useIdleTriageShortcuts";
import { useTriageSearchParams } from "@/hooks/useTriageSearchParams";
import { useIdleTriageController } from "@/hooks/useIdleTriageController";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AlertCircle, AlertTriangle } from "lucide-react";
import TriageShortcutHint from "@/components/admin/TriageShortcutHint";
import IdleQuickFilterCards from "@/components/admin/IdleQuickFilterCards";
import SessionFilterActionBar from "@/components/admin/SessionFilterActionBar";
import IdleSeverityValue from "@/components/admin/IdleSeverityValue";

function formatIdleSince(lastActivityAt?: string) {
  if (!lastActivityAt) return "—";
  return formatDistanceToNowStrict(new Date(lastActivityAt), { addSuffix: true });
}

export default function ExamMonitorPage() {
  const navigate = useNavigate();
  const { examId } = useParams<{ examId: string }>();
  const triageParams = useTriageSearchParams();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<AdminExam | null>(null);
  const [rows, setRows] = useState<ExamCandidateStatusRow[]>([]);
  const [includeAbandoned, setIncludeAbandoned] = useState(() =>
    triageParams.getBoolean("includeAbandoned", false),
  );
  const [statusFilter, setStatusFilter] = useState(() =>
    triageParams.getString("status", "all"),
  );
  const [flagsFilter, setFlagsFilter] = useState(() =>
    triageParams.getString("flags", "all"),
  );
  const [search, setSearch] = useState(() => triageParams.getString("q", ""));
  const [endRowId, setEndRowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("candidates");
  const [proctorEvents, setProctorEvents] = useState<MappedProctorEvent[]>([]);
  const [proctorLoading, setProctorLoading] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [mappedFilter, setMappedFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<MappedProctorEvent | null>(null);
  const [questionCatalog, setQuestionCatalog] = useState<Question[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ExamCandidateStatusRow | null>(null);
  const [candidateEvents, setCandidateEvents] = useState<MappedProctorEvent[]>([]);
  const [candidateTimeline, setCandidateTimeline] = useState<QuestionTimeline | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveViewerRef = useRef<Awaited<ReturnType<typeof createViewer>> | null>(null);
  const [proctorActionLoading, setProctorActionLoading] = useState(false);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentSummary, setIncidentSummary] = useState("");
  const [incidentCreating, setIncidentCreating] = useState(false);

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  const openCandidateView = useCallback(
    async (row: ExamCandidateStatusRow) => {
      setSelectedCandidate(row);
      setCandidateLoading(true);
      try {
        const [events, timeline] = await Promise.all([
          listAttemptProctorEvents(row.id),
          getAttemptTimeline(row.id),
        ]);
        if (!timeline) {
          setCandidateTimeline(null);
          setCandidateEvents(
            events
              .map((event) => ({
                ...event,
                mappedQuestionId: null,
                isMapped: false,
              }))
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          );
          return;
        }
        const mapped = await mapEventsToQuestions(events, timeline);
        setCandidateTimeline(timeline);
        setCandidateEvents(
          mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load candidate session.");
      } finally {
        setCandidateLoading(false);
      }
    },
    [notifyError]
  );

  useEffect(() => {
    if (!liveVideoRef.current) return;
    liveVideoRef.current.srcObject = liveStream;
  }, [liveStream]);

  useEffect(() => {
    if (!selectedCandidate || !examId) return;
    let cancelled = false;
    const roleRaw = typeof window !== "undefined" ? window.localStorage.getItem("hj_admin_role") : null;
    const roleNormalized = roleRaw?.toLowerCase();
    const role: "admin" | "teacher" | "proctor" =
      roleNormalized === "teacher"
        ? "teacher"
        : roleNormalized === "proctor"
        ? "proctor"
        : "admin";

    const startViewer = async () => {
      setLiveStatus("connecting");
      setLiveStream(null);
      try {
        const viewer = await createViewer({
          examId,
          attemptId: selectedCandidate.id,
          role,
          onStream: (stream) => {
            if (!cancelled) {
              setLiveStream(stream);
            }
          },
          onStatus: (status) => {
            if (!cancelled) {
              setLiveStatus(status);
            }
          },
        });
        if (cancelled) {
          viewer.close();
          return;
        }
        liveViewerRef.current = viewer;
      } catch {
        setLiveStatus("error");
      }
    };

    void startViewer();

    return () => {
      cancelled = true;
      liveViewerRef.current?.close();
      liveViewerRef.current = null;
      setLiveStream(null);
      setLiveStatus("idle");
    };
  }, [examId, selectedCandidate?.id]);

  useEffect(() => {
    const load = async () => {
      if (!examId) return;
      setLoading(true);
      try {
        const [examRow, candidateRows] = await Promise.all([
          getExam(examId),
          listCandidatesForExam(examId, { includeAbandoned }),
        ]);
        if (!examRow) {
          notifyError("Exam not found.");
          navigate("/admin/exams", { replace: true });
          return;
        }
        setExam(examRow);
        setRows(candidateRows);
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load monitoring data.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [examId, includeAbandoned]);

  useEffect(() => {
    if (rows.length === 0) {
      setProctorEvents([]);
      return;
    }
    const loadProctor = async () => {
      setProctorLoading(true);
      try {
        const catalog = await listQuestions();
        setQuestionCatalog(catalog);
        const mappedByAttempt = await Promise.all(
          rows.map(async (row) => {
            const [events, timeline] = await Promise.all([
              listAttemptProctorEvents(row.id),
              getAttemptTimeline(row.id),
            ]);
            if (!timeline) {
              return events.map((event) => ({
                ...event,
                mappedQuestionId: null,
                isMapped: false,
              }));
            }
            return mapEventsToQuestions(events, timeline);
          })
        );
        const merged = mappedByAttempt
          .flat()
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setProctorEvents(merged);
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Unable to load proctor logs.");
      } finally {
        setProctorLoading(false);
      }
    };
    void loadProctor();
  }, [rows]);

  const idleSummary = useMemo(() => summarizeIdleBands(rows), [rows]);

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
    extraActiveFilterCount:
      (statusFilter !== "all" ? 1 : 0) +
      (flagsFilter !== "all" ? 1 : 0) +
      (search.trim().length > 0 ? 1 : 0),
    onQuickFilter: () => setStatusFilter("in_progress"),
    onReset: () => {
      setIncludeAbandoned(false);
      setStatusFilter("all");
      setFlagsFilter("all");
      setSearch("");
    },
  });

  const filteredRows = useMemo(
    () =>
      buildTriageCandidateRows(rows, {
        statusFilter,
        idleFilter,
        flagsFilter,
        searchQuery: search,
      }),
    [rows, statusFilter, idleFilter, flagsFilter, search],
  );

  useEffect(() => {
    triageParams.setParams({
      includeAbandoned,
      status: statusFilter !== "all" ? statusFilter : undefined,
      idle: idleFilter !== "all" ? idleFilter : undefined,
      flags: flagsFilter !== "all" ? flagsFilter : undefined,
      q: search.trim() || undefined,
    });
  }, [includeAbandoned, statusFilter, idleFilter, flagsFilter, search]);

  useIdleTriageShortcuts({
    onCritical: () => applyIdleQuickFilter("critical"),
    onWarning: () => applyIdleQuickFilter("warning"),
    onHealthy: () => applyIdleQuickFilter("healthy"),
    onClearIdle: () => setIdleFilter("all"),
    onResetAll: resetAllFilters,
  });

  const candidateLookup = useMemo(() => {
    return new Map(rows.map((row) => [row.candidateId, row.candidateName]));
  }, [rows]);

  const questionLookup = useMemo(() => {
    return new Map(questionCatalog.map((question) => [question.id, question]));
  }, [questionCatalog]);

  const candidateCurrentQuestion = useMemo(() => {
    if (!candidateTimeline?.entries?.length) return null;
    const sorted = [...candidateTimeline.entries].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
    );
    const latest = sorted[0];
    if (!latest) return null;
    const question = questionLookup.get(latest.questionId);
    return {
      id: latest.questionId,
      title: question?.title ?? latest.questionId,
      startedAt: latest.startAt,
    };
  }, [candidateTimeline, questionLookup]);

  const filteredEvents = useMemo(() => {
    return proctorEvents.filter((event) => {
      if (eventTypeFilter !== "all" && event.eventType !== eventTypeFilter) return false;
      if (severityFilter !== "all" && event.severity !== severityFilter) return false;
      if (mappedFilter === "mapped" && !event.isMapped) return false;
      if (mappedFilter === "unmapped" && event.isMapped) return false;
      return true;
    });
  }, [proctorEvents, eventTypeFilter, severityFilter, mappedFilter]);

  const eventTypeOptions = useMemo(
    () => Array.from(new Set(proctorEvents.map((event) => event.eventType))),
    [proctorEvents]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Live Monitor</h1>
          <p className="mt-1 text-sm text-slate-600">{exam.name}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/admin/exams/${exam.id}`)}>
          Back to Detail
        </Button>
      </div>

      <div className="flex justify-end">
        <SessionFilterActionBar
          activeFilterCount={activeFilterCount}
          hasAnyFilters={hasAnyFilters}
          includeAbandoned={includeAbandoned}
          onToggleIncludeAbandoned={() => setIncludeAbandoned((prev) => !prev)}
          onResetAllFilters={resetAllFilters}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>In Progress</CardDescription><CardTitle>{rows.filter((row) => row.status === "in_progress").length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Completed</CardDescription><CardTitle>{rows.filter((row) => row.status === "completed").length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Abandoned</CardDescription><CardTitle>{rows.filter((row) => row.status === "abandoned").length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Flags</CardDescription><CardTitle>{rows.reduce((sum, row) => sum + row.flags, 0)}</CardTitle></CardHeader></Card>
      </div>
      <IdleQuickFilterCards
        summary={idleSummary}
        activeBand={idleFilter}
        onSelect={applyIdleQuickFilter}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="proctor">Proctor Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Filters</CardTitle>
                  <TriageShortcutHint className="text-xs text-muted-foreground mt-1" />
                </div>
                {idleFilter !== "all" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIdleFilter("all")}
                  >
                    Clear Idle Filter
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={flagsFilter} onValueChange={setFlagsFilter}>
                <SelectTrigger><SelectValue placeholder="Flags" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="has_flags">Has Flags</SelectItem>
                  <SelectItem value="no_flags">No Flags</SelectItem>
                </SelectContent>
              </Select>
              <div className="sm:col-span-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search candidate..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Candidate Sessions</CardTitle>
              <CardDescription>Live and historical attempt rows with actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Idle</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Time Left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium text-slate-800">{row.candidateName}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                        </TableCell>
                        <TableCell>
                          {row.lastActivityAt ? format(new Date(row.lastActivityAt), "PPp") : "-"}
                        </TableCell>
                        <TableCell>
                          <IdleSeverityValue
                            status={row.status}
                            idleLabel={formatIdleSince(row.lastActivityAt)}
                            idleMinutes={getIdleMinutes(row.lastActivityAt)}
                            mode="badge"
                          />
                        </TableCell>
                        <TableCell>{row.startTime ? format(new Date(row.startTime), "PPp") : "-"}</TableCell>
                        <TableCell>
                          {typeof row.timeLeftMinutes === "number"
                            ? `${row.timeLeftMinutes} min`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {row.status === "in_progress" && <Badge variant="warning-light">In Progress</Badge>}
                          {row.status === "completed" && <Badge variant="success-light">Completed</Badge>}
                          {row.status === "abandoned" && <Badge variant="warning-light">Abandoned</Badge>}
                          {row.status === "not_started" && <Badge variant="outline">Not Started</Badge>}
                        </TableCell>
                        <TableCell>{row.flags}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void openCandidateView(row)}
                            >
                              View
                            </Button>
                            {row.status === "in_progress" && (
                              <Button variant="outline" size="sm" onClick={() => setEndRowId(row.id)}>
                                End Exam
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-slate-500">
                          No candidates match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Last refreshed {formatDistanceToNowStrict(new Date(), { addSuffix: true })}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proctor" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Proctor Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3">
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Event type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {eventTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severity</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mappedFilter} onValueChange={setMappedFilter}>
                <SelectTrigger><SelectValue placeholder="Mapping" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="mapped">Mapped</SelectItem>
                  <SelectItem value="unmapped">Unmapped</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Proctor Logs</CardTitle>
              <CardDescription>Events mapped to candidate question timelines.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                      const question = event.mappedQuestionId
                        ? questionLookup.get(event.mappedQuestionId)
                        : null;
                      return (
                        <TableRow key={event.id}>
                          <TableCell>{format(new Date(event.timestamp), "PPp")}</TableCell>
                          <TableCell>{event.eventType}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                event.severity === "high"
                                  ? "danger-light"
                                  : event.severity === "medium"
                                  ? "warning-light"
                                  : "outline"
                              }
                            >
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {question ? question.title : event.mappedQuestionId ? event.mappedQuestionId : "Unmapped"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setSelectedEvent(event)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                          {proctorLoading ? "Loading proctor events..." : "No proctor events found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(selectedCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCandidate(null);
            setCandidateEvents([]);
            setCandidateTimeline(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Candidate Live View</DialogTitle>
            <DialogDescription>Live session details tied to the attempt ID.</DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.25fr,1fr]">
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-md border bg-slate-950/90">
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                      {liveStatus === "connected"
                        ? "Live"
                        : liveStatus === "connecting"
                        ? "Connecting"
                        : liveStatus === "offline"
                        ? "Offline"
                        : liveStatus === "error"
                        ? "Error"
                        : "Idle"}
                    </div>
                    <div className="absolute right-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                      Attempt {selectedCandidate.id}
                    </div>
                    <div className="aspect-video">
                      {liveStream ? (
                        <video
                          ref={liveVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-slate-200">
                          {liveStatus === "connecting"
                            ? "Waiting for live video..."
                            : "Live feed unavailable."}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Live video requires an active candidate session with camera permissions.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Candidate</CardDescription>
                      <CardTitle className="text-base">{selectedCandidate.candidateName}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      <p>{selectedCandidate.email}</p>
                      <p className="mt-1">Attempt ID: {selectedCandidate.id}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Status</CardDescription>
                      <CardTitle className="text-base">
                        {selectedCandidate.status === "in_progress" && <Badge variant="warning-light">In Progress</Badge>}
                        {selectedCandidate.status === "completed" && <Badge variant="success-light">Completed</Badge>}
                        {selectedCandidate.status === "abandoned" && <Badge variant="warning-light">Abandoned</Badge>}
                        {selectedCandidate.status === "not_started" && <Badge variant="outline">Not Started</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      <p>Flags: {selectedCandidate.flags}</p>
                      <p className="mt-1">
                        Time Left: {typeof selectedCandidate.timeLeftMinutes === "number" ? `${selectedCandidate.timeLeftMinutes} min` : "-"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Started</CardDescription>
                      <CardTitle className="text-base">
                        {selectedCandidate.startTime ? format(new Date(selectedCandidate.startTime), "PPp") : "-"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      <p>Events captured: {candidateEvents.length}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md border p-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!examId) return;
                    setProctorActionLoading(true);
                    try {
                      await sendProctorAction(selectedCandidate.id, "warn");
                      liveViewerRef.current?.sendProctorCommand?.("warn");
                      notifySuccess("Warning sent to candidate");
                    } catch (e) {
                      notifyError(e instanceof Error ? e.message : "Failed to send warning");
                    } finally {
                      setProctorActionLoading(false);
                    }
                  }}
                  disabled={proctorActionLoading}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Send Warning
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!examId) return;
                    if (!confirm("End this candidate’s exam now? They will see a termination message.")) return;
                    setProctorActionLoading(true);
                    try {
                      await sendProctorAction(selectedCandidate.id, "terminate");
                      liveViewerRef.current?.sendProctorCommand?.("terminate");
                      notifySuccess("Exam terminated");
                      setSelectedCandidate(null);
                    } catch (e) {
                      notifyError(e instanceof Error ? e.message : "Failed to terminate");
                    } finally {
                      setProctorActionLoading(false);
                    }
                  }}
                  disabled={proctorActionLoading}
                >
                  Terminate exam
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIncidentSummary("");
                    setIncidentDialogOpen(true);
                  }}
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Flag as incident
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openCandidateView(selectedCandidate)}
                  disabled={candidateLoading}
                >
                  {candidateLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Flag as incident</DialogTitle>
                    <DialogDescription>
                      Create a proctor incident for this attempt. It will appear in Proctor Incidents for review.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 py-2">
                    <label className="text-sm font-medium">Summary (optional)</label>
                    <Input
                      placeholder="e.g. Multiple tab switches, face not detected"
                      value={incidentSummary}
                      onChange={(e) => setIncidentSummary(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIncidentDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={async () => {
                        if (!selectedCandidate) return;
                        setIncidentCreating(true);
                        try {
                          await createProctorIncident({
                            attemptId: selectedCandidate.id,
                            summary: incidentSummary.trim() || undefined,
                          });
                          notifySuccess("Incident created");
                          setIncidentDialogOpen(false);
                        } catch (e) {
                          notifyError(e instanceof Error ? e.message : "Failed to create incident");
                        } finally {
                          setIncidentCreating(false);
                        }
                      }}
                      disabled={incidentCreating}
                    >
                      {incidentCreating ? "Creating…" : "Create incident"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Current Question</p>
                    <p className="text-xs text-muted-foreground">Latest timeline entry for this attempt.</p>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-700">
                  {candidateLoading ? (
                    <Skeleton className="h-6 w-40" />
                  ) : candidateCurrentQuestion ? (
                    <div>
                      <p className="font-medium">{candidateCurrentQuestion.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Started {format(new Date(candidateCurrentQuestion.startedAt), "PPp")}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No question timeline available yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Question</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                          Loading candidate events...
                        </TableCell>
                      </TableRow>
                    )}
                    {!candidateLoading && candidateEvents.map((event) => {
                      const question = event.mappedQuestionId
                        ? questionLookup.get(event.mappedQuestionId)
                        : null;
                      return (
                        <TableRow key={event.id}>
                          <TableCell>{format(new Date(event.timestamp), "PPp")}</TableCell>
                          <TableCell>{event.eventType}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                event.severity === "high"
                                  ? "danger-light"
                                  : event.severity === "medium"
                                  ? "warning-light"
                                  : "outline"
                              }
                            >
                              {event.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {question ? question.title : event.mappedQuestionId ? event.mappedQuestionId : "Unmapped"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!candidateLoading && candidateEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                          No proctor events recorded for this candidate yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Proctor Event Detail</SheetTitle>
            <SheetDescription>Mapped to a question timeline when possible.</SheetDescription>
          </SheetHeader>
          {selectedEvent && (
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-md border p-3">
                <p className="font-semibold">{selectedEvent.eventType}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(selectedEvent.timestamp), "PPp")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={selectedEvent.severity === "high" ? "danger-light" : selectedEvent.severity === "medium" ? "warning-light" : "outline"}>
                    {selectedEvent.severity}
                  </Badge>
                  <Badge variant="outline">
                    {selectedEvent.isMapped ? "Mapped" : "Unmapped"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Candidate</p>
                <p className="font-medium">
                  {candidateLookup.get(selectedEvent.candidateId) ?? selectedEvent.candidateId}
                </p>
                <p className="text-xs text-muted-foreground">Attempt ID: {selectedEvent.examAttemptId}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Mapped Question</p>
                {selectedEvent.mappedQuestionId ? (
                  <div>
                    <p className="font-medium">
                      {questionLookup.get(selectedEvent.mappedQuestionId)?.title ?? selectedEvent.mappedQuestionId}
                    </p>
                    <div
                      className="mt-2 rounded-md border bg-muted/30 p-2 text-xs text-slate-700"
                      dangerouslySetInnerHTML={{
                        __html:
                          questionLookup.get(selectedEvent.mappedQuestionId)?.questionHtml ??
                          "<p>Question content unavailable.</p>",
                      }}
                    />
                  </div>
                ) : (
                  <p>Unmapped event</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(endRowId)} onOpenChange={(open) => !open && setEndRowId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Candidate Exam</DialogTitle>
            <DialogDescription>Are you sure you want to force end this candidate session?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndRowId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!endRowId) return;
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === endRowId ? { ...row, status: "completed", timeLeftMinutes: 0 } : row
                  )
                );
                setEndRowId(null);
                notifySuccess("Candidate session ended.");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
