import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExamTopBar } from "@/components/exam/ExamTopBar";
import { QuestionNavStrip } from "@/components/exam/QuestionNavStrip";
import { AIMonitoringPanel, type MonitoringStatus } from "@/components/exam/AIMonitoringPanel";
import { MonitoringLogDrawer } from "@/components/exam/MonitoringLogDrawer";
import { AlertBanner, AlertBannerTitle, AlertBannerDescription } from "@/components/ui/alert-banner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Flag,
  Calculator as CalculatorIcon,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Calculator } from "@/components/exam/Calculator";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getExam, getExamQuestions, getMonitoringLog } from "@/lib/api";
import { useExamSession } from "@/hooks/useExamSession";
import { recordProctorEvent, reportExamIssue, upsertAttemptTimelineEntry } from "@/lib/question-bank-api";
import { getExamAccessDecision } from "@/lib/payments-api";
import {
  ensureExamCandidateAttempt,
  getAttemptAnswers,
  saveAttemptAnswer,
  sendAttemptHeartbeat,
  submitAttempt,
} from "@/lib/exams-module-api";
import type { AccessDecision } from "@/lib/payments-types";
import { createPublisher, type LiveStatus } from "@/lib/live-proctoring";
import { getStoredUser } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

export default function LiveExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state: session, update, switchExam } = useExamSession();
  const examIdFromQuery = searchParams.get("examId");
  // Default to seeded demo exam with questions if nothing is provided.
  const examId = examIdFromQuery || session.examId || "ex_003";
  const isBackendAttemptId = Boolean(
    session.attemptId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        session.attemptId
      )
  );
  const attemptIdRef = useRef<string | null>(session.attemptId ?? null);
  const candidateIdRef = useRef<string | null>(null);
  const liveSessionKeyRef = useRef<string | null>(null);
  const publisherRef = useRef<Awaited<ReturnType<typeof createPublisher>> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const questionStartRef = useRef<string | null>(null);
  const questionIdRef = useRef<string | null>(null);
  const hydratedAttemptRef = useRef<string | null>(null);
  const pendingAnswerQueueRef = useRef<Record<string, string>>({});
  const flushingAnswersRef = useRef(false);
  const [accessDecision, setAccessDecision] = useState<AccessDecision | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [attemptStartError, setAttemptStartError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "offline" | "error">("idle");
  // WHY: Store stream in state (not just ref) so the AIMonitoringPanel re-renders with it
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>({
    face: "not-detected",
    gaze: "focused",
    noise: "quiet",
    screen: "normal",
  });
  const [warningCount, setWarningCount] = useState(0);
  const tabSwitchCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const noiseRafRef = useRef<number | null>(null);
  const accessBlocked = accessDecision ? !accessDecision.hasAccess : false;
  const { data: exam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => getExam(examId),
  });
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["exam", examId, "questions", session.attemptId],
    enabled: Boolean(examId && isBackendAttemptId && session.attemptId),
    queryFn: () => getExamQuestions(examId, session.attemptId!),
  });
  const { data: logEntries = [] } = useQuery({
    queryKey: ["exam", examId, "monitoring-log"],
    queryFn: () => getMonitoringLog(examId),
  });

  // Hydrate exam session with logged-in user so backend attempt and live room match proctor
  useEffect(() => {
    const user = getStoredUser();
    if (user?.email && !session.email) {
      update({ email: user.email });
    }
  }, [session.email, update]);

  useEffect(() => {
    if (examIdFromQuery && examIdFromQuery !== session.examId) {
      switchExam(examIdFromQuery);
    }
  }, [examIdFromQuery, session.examId, switchExam]);

  useEffect(() => {
    const loadDecision = async () => {
      setAccessLoading(true);
      try {
        const isLoggedIn =
          typeof window !== "undefined" && window.localStorage.getItem("hj_registered") === "true";
        const decision = await getExamAccessDecision(examId, session.email || null, isLoggedIn);
        setAccessDecision(decision);
      } finally {
        setAccessLoading(false);
      }
    };
    void loadDecision();
  }, [examId, session.email]);

  useEffect(() => {
    let cancelled = false;
    const resolveAttempt = async () => {
      if (!examId) return;
      try {
        // WHY: Use backend attempt id whenever possible so proctor/admin dashboards see live data.
        const row = await ensureExamCandidateAttempt(examId, session.email || "guest", {
          consentGiven: session.consentGiven,
        });
        if (cancelled) return;
        attemptIdRef.current = row.id;
        candidateIdRef.current = row.candidateId;
        setAttemptStartError(null);
        if (session.attemptId !== row.id) {
          // New backend attempt -> start with a fresh sheet for this exam
          update({
            examId,
            attemptId: row.id,
            currentQuestion: 1,
            selectedAnswers: {},
            flaggedQuestions: [],
            startedAt: new Date().toISOString(),
            lastSavedAt: undefined,
            consentGiven: undefined, // consumed; do not reuse for future attempts
          });
        }
      } catch {
        attemptIdRef.current = null;
        update({
          attemptId: undefined,
          selectedAnswers: {},
          flaggedQuestions: [],
        });
        const message =
          "A secure attempt could not be started. Please sign in again or contact support.";
        setAttemptStartError(message);
      }
    };
    void resolveAttempt();
    return () => {
      cancelled = true;
    };
  }, [examId, session.email, session.attemptId, update]);

  useEffect(() => {
    if (session.attemptId) {
      attemptIdRef.current = session.attemptId;
    }
  }, [session.attemptId]);

  // Stream/save only when we have a backend attempt id (UUID).

  const flushPendingAnswers = useCallback(async () => {
    const attemptId = attemptIdRef.current ?? session.attemptId;
    if (!attemptId || !isBackendAttemptId || flushingAnswersRef.current) return;
    const queued = Object.entries(pendingAnswerQueueRef.current);
    if (queued.length === 0) return;

    flushingAnswersRef.current = true;
    setSyncStatus("syncing");
    try {
      for (const [questionId, answer] of queued) {
        await saveAttemptAnswer(attemptId, questionId, answer);
        delete pendingAnswerQueueRef.current[questionId];
      }
      setSyncStatus("synced");
    } catch {
      // Keep remaining queued answers for next retry tick/online event.
      setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "error" : "offline");
    } finally {
      flushingAnswersRef.current = false;
    }
  }, [isBackendAttemptId, session.attemptId]);

  // Retry queued autosaves periodically and when browser regains network.
  useEffect(() => {
    const interval = setInterval(() => {
      void flushPendingAnswers();
    }, 5000);
    const handleOnline = () => {
      setSyncStatus("syncing");
      void flushPendingAnswers();
    };
    const handleOffline = () => {
      setSyncStatus("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushPendingAnswers]);

  // Heartbeat to validate attempt ownership/session and show reconnect state.
  useEffect(() => {
    const attemptId = attemptIdRef.current ?? session.attemptId;
    if (!attemptId || !isBackendAttemptId) return;
    let cancelled = false;

    const beat = async () => {
      if (cancelled) return;
      try {
        if (pendingAnswerQueueRef.current && Object.keys(pendingAnswerQueueRef.current).length > 0) {
          setSyncStatus("syncing");
        }
        await sendAttemptHeartbeat(attemptId);
        if (!cancelled && Object.keys(pendingAnswerQueueRef.current).length === 0) {
          setSyncStatus("synced");
        }
      } catch {
        if (!cancelled) {
          setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "error" : "offline");
        }
      }
    };

    void beat();
    const interval = setInterval(() => {
      void beat();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isBackendAttemptId, session.attemptId]);

  // Resume-safe hydration: pull saved backend answers when reconnecting to an active attempt.
  useEffect(() => {
    const hydrateAnswers = async () => {
      const attemptId = attemptIdRef.current ?? session.attemptId;
      if (!attemptId || !isBackendAttemptId || questions.length === 0) return;
      if (hydratedAttemptRef.current === attemptId) return;
      try {
        const items = await getAttemptAnswers(attemptId);
        const nextAnswers: Record<string, string> = {};
        for (const row of items) {
          const raw = row.answer;
          let parsed: string | null = null;
          if (typeof raw === "string") {
            try {
              const maybeJson = JSON.parse(raw);
              parsed = Array.isArray(maybeJson) ? String(maybeJson[0] ?? "") : String(maybeJson ?? "");
            } catch {
              parsed = raw;
            }
          }
          if (!parsed) continue;
          const matched = questions.find((q) => q.questionId === String(row.questionId));
          if (!matched) continue;
          nextAnswers[String(matched.id)] = parsed;
        }
        hydratedAttemptRef.current = attemptId;
        if (Object.keys(nextAnswers).length > 0) {
          update({
            selectedAnswers: nextAnswers,
            lastSavedAt: new Date().toISOString(),
          });
          toast.info("Recovered saved answers", {
            description: "Your previous in-progress answers were restored.",
            duration: 3000,
          });
        }
      } catch {
        // Non-blocking: local session can still continue.
      }
    };
    void hydrateAnswers();
  }, [isBackendAttemptId, questions.length, session.attemptId, update]);

  // Request camera for local AI monitoring as soon as exam is available (so we're not "Offline" while waiting for attempt)
  useEffect(() => {
    if (accessLoading || accessBlocked || !examId) return;
    let cancelled = false;
    if (!navigator?.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setCameraStream(stream);
      // Do NOT set face to "detected" here — wait for canvas analysis so empty room shows "Face Not Visible"
    }).catch(() => {});
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setCameraStream(null);
    };
  }, [accessBlocked, accessLoading, examId]);

  useEffect(() => {
    if (accessLoading || accessBlocked || !session.attemptId || !isBackendAttemptId) return;
    const key = `${examId}:${session.attemptId}`;
    if (liveSessionKeyRef.current === key) return;
    liveSessionKeyRef.current = key;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const ensureStream = async (): Promise<MediaStream | null> => {
      // Reuse existing stream if tracks are still alive
      if (localStreamRef.current) {
        const alive = localStreamRef.current.getTracks().some((t) => t.readyState === "live");
        if (alive) return localStreamRef.current;
      }
      if (!navigator?.mediaDevices?.getUserMedia) return null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return null; }
        localStreamRef.current = stream;
        setCameraStream(stream);
        // Face status comes from canvas analysis only, not from camera grant
        return stream;
      } catch {
        return null;
      }
    };

    const connectPublisher = async () => {
      if (cancelled) return;
      const attemptId = attemptIdRef.current ?? session.attemptId;
      if (!attemptId) { setLiveStatus("error"); scheduleRetry(); return; }
      setLiveStatus("connecting");
      const stream = await ensureStream();
      if (!stream || cancelled) { setLiveStatus("error"); scheduleRetry(); return; }
      try {
        const publisher = await createPublisher({
          examId,
          attemptId,
          stream,
          role: "candidate",
          onStatus: (s) => {
            if (cancelled) return;
            setLiveStatus(s);
            // WHY: Auto-reconnect when the WebSocket drops
            if (s === "offline" || s === "error") {
              scheduleRetry();
            }
          },
          onProctorCommand: (command, reason) => {
            if (cancelled) return;
            if (command === "warn") {
              toast.warning("Proctor warning", {
                description: reason || "Please follow exam rules.",
                duration: 8000,
              });
            } else {
              publisherRef.current?.close();
              publisherRef.current = null;
              setProctorTerminated(true);
            }
          },
        });
        if (cancelled) { publisher.close(); return; }
        publisherRef.current = publisher;
      } catch {
        // Publisher failed — local monitoring continues, retry connection
        setLiveStatus("error");
        scheduleRetry();
      }
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer) return;
      // WHY: Retry after 5 seconds — keeps trying until connected
      retryTimer = setTimeout(() => {
        retryTimer = null;
        publisherRef.current?.close();
        publisherRef.current = null;
        void connectPublisher();
      }, 5000);
    };

    void connectPublisher();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      liveSessionKeyRef.current = null;
      publisherRef.current?.close();
      publisherRef.current = null;
      // Do not stop the camera stream here; the camera effect owns it for AI monitoring
    };
  }, [accessBlocked, accessLoading, examId, session.attemptId, isBackendAttemptId]);

  const currentQuestion = session.currentQuestion || 1;
  const selectedAnswers = session.selectedAnswers || {};
  const flaggedQuestions = session.flaggedQuestions || [];
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [showWarningBanner, setShowWarningBanner] = useState(true);
  const [aiStatus, setAiStatus] = useState<"Normal" | "Warning" | "Review">("Warning");
  const [proctorTerminated, setProctorTerminated] = useState(false);

  // ── Real countdown timer ────────────────────────────────
  const durationMinutes = exam?.durationMinutes ?? 45;
  const [secondsLeft, setSecondsLeft] = useState<number>(durationMinutes * 60);
  const autoSubmittedRef = useRef(false);

  // Reset timer when exam data loads or changes. If time already expired (stale startedAt), reset so timer runs.
  useEffect(() => {
    if (!exam) return;
    const totalSec = exam.durationMinutes * 60;
    if (session.startedAt) {
      const elapsed = Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000);
      const remaining = Math.max(0, totalSec - elapsed);
      if (remaining === 0) {
        // Stale session (e.g. from a previous attempt or long-ago start): reset so timer shows and runs
        update({ startedAt: new Date().toISOString() });
        setSecondsLeft(totalSec);
      } else {
        setSecondsLeft(remaining);
      }
    } else {
      setSecondsLeft(totalSec);
    }
  }, [exam, session.startedAt, update]);

  // Tick every second
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when time runs out
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmittedRef.current && session.attemptId) {
      autoSubmittedRef.current = true;
      toast.error("Time's up!", {
        description: "Your exam has been automatically submitted.",
        duration: 5000,
      });
      void recordEvent("TIME_EXPIRED", "high");
      setTimeout(() => handleSubmit(), 1500);
    }
  }, [secondsLeft, session.attemptId]);

  // Format seconds → "MM:SS" or "H:MM:SS"
  const formatTime = (totalSec: number): string => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${mm}:${ss}`;
  };

  const timeRemaining = formatTime(secondsLeft);

  const totalQuestions = questions.length > 0 ? questions.length : exam?.totalQuestions ?? 0;
  const answeredQuestions = Object.keys(selectedAnswers)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value));
  const remainingQuestions = Math.max(0, totalQuestions - answeredQuestions.length);

  const question = questions.find((q) => q.id === currentQuestion) || questions[0];
  const recordEvent = useCallback(
    async (eventType: string, severity: "low" | "medium" | "high", questionId?: number) => {
      if (!attemptIdRef.current) return;
      try {
        await recordProctorEvent({
          examAttemptId: attemptIdRef.current,
          candidateId: candidateIdRef.current ?? (session.email || "guest"),
          eventType,
          severity,
          timestamp: new Date().toISOString(),
          questionId: questionId !== undefined ? String(questionId) : null,
        });
      } catch {
        // Ignore mock event capture failures.
      }
    },
    [session.email]
  );

  // ── 1. Tab / Visibility + Window blur + Clipboard + Keyboard monitoring ──
  // WHY: Detect tab switches, window blur, copy/paste, and suspicious shortcuts
  useEffect(() => {
    // Tab visibility (hidden/visible)
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchCountRef.current += 1;
        setMonitoringStatus((prev) => ({ ...prev, screen: "tab-switch" }));
        setWarningCount((prev) => prev + 1);
        void recordEvent("TAB_SWITCH", "medium");
        toast.warning("Tab switch detected", {
          description: "Please stay on the exam window. This has been logged.",
          duration: 4000,
        });
      } else {
        setTimeout(() => {
          setMonitoringStatus((prev) =>
            prev.screen === "tab-switch" ? { ...prev, screen: "normal" } : prev,
          );
        }, 3000);
      }
    };

    // Window blur — user clicked outside the exam window
    const handleBlur = () => {
      setMonitoringStatus((prev) => {
        if (prev.screen === "tab-switch") return prev; // already flagged
        return { ...prev, screen: "warning" };
      });
      setWarningCount((prev) => prev + 1);
      void recordEvent("WINDOW_BLUR", "medium");
      toast.warning("Focus lost", {
        description: "You clicked outside the exam window. This has been logged.",
        duration: 3000,
      });
    };

    const handleFocus = () => {
      setTimeout(() => {
        setMonitoringStatus((prev) =>
          prev.screen !== "normal" ? { ...prev, screen: "normal" } : prev,
        );
      }, 2000);
    };

    // Clipboard — copy/cut/paste
    const handleClipboard = (e: ClipboardEvent) => {
      setWarningCount((prev) => prev + 1);
      void recordEvent(`CLIPBOARD_${e.type.toUpperCase()}`, "high");
      toast.error(`${e.type.charAt(0).toUpperCase() + e.type.slice(1)} detected`, {
        description: "Clipboard activity is not allowed during the exam.",
        duration: 4000,
      });
      setMonitoringStatus((prev) => ({ ...prev, screen: "warning" }));
      e.preventDefault(); // block the action
    };

    // Keyboard shortcuts — Ctrl+C, Ctrl+V, Ctrl+A, PrintScreen etc.
    const handleKeydown = (e: KeyboardEvent) => {
      const blocked =
        (e.ctrlKey && ["c", "v", "x", "a", "u", "s", "p"].includes(e.key.toLowerCase())) ||
        e.key === "PrintScreen" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase())); // DevTools
      if (blocked) {
        setWarningCount((prev) => prev + 1);
        void recordEvent("BLOCKED_SHORTCUT", "high", undefined);
        toast.error("Blocked shortcut", {
          description: `${e.ctrlKey ? "Ctrl+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key} is not allowed.`,
          duration: 3000,
        });
        setMonitoringStatus((prev) => ({ ...prev, screen: "warning" }));
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      void recordEvent("RIGHT_CLICK", "low");
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [recordEvent]);

  // ── 2. Audio noise-level monitoring ────────────────────────
  // WHY: Detect background noise / talking via the audio track
  useEffect(() => {
    if (!cameraStream) return;
    const audioTracks = cameraStream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) return;

    let rafId: number | null = null;
    let audioCtx: AudioContext | null = null;

    // AudioContext may be suspended until a user gesture — resume it
    const setup = async () => {
      try {
        audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        const source = audioCtx.createMediaStreamSource(cameraStream);
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkNoise = () => {
          analyser.getByteFrequencyData(dataArray);
          // Use frequency data (0-255 range) for better noise detection
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length; // 0-255 scale

          // Thresholds calibrated for real environments:
          // avg > 30 = some noise, > 60 = noisy, > 90 = warning
          if (avg > 90) {
            setMonitoringStatus((prev) => (prev.noise !== "warning" ? { ...prev, noise: "warning" } : prev));
          } else if (avg > 30) {
            setMonitoringStatus((prev) => (prev.noise !== "noisy" ? { ...prev, noise: "noisy" } : prev));
          } else {
            setMonitoringStatus((prev) => (prev.noise !== "quiet" ? { ...prev, noise: "quiet" } : prev));
          }
          rafId = requestAnimationFrame(checkNoise);
        };
        rafId = requestAnimationFrame(checkNoise);
      } catch {
        // AudioContext not supported — leave noise as "quiet"
      }
    };
    void setup();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      audioCtx?.close().catch(() => {});
    };
  }, [cameraStream]);

  // ── 3. Canvas-based face / presence / gaze detection ───────
  // WHY: Use center-region brightness, variance (face has texture; empty wall is flat),
  //      left/right split for multiple faces, and frame-to-frame motion for gaze.
  useEffect(() => {
    if (!cameraStream) return;
    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") return;

    const offscreenVideo = document.createElement("video");
    offscreenVideo.srcObject = cameraStream;
    offscreenVideo.muted = true;
    offscreenVideo.playsInline = true;
    offscreenVideo.play().catch(() => {});

    const W = 160;
    const H = 120;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const x0 = Math.floor(W * 0.25);
    const x1 = Math.floor(W * 0.75);
    const y0 = Math.floor(H * 0.15);
    const y1 = Math.floor(H * 0.75);
    const centerW = x1 - x0;
    const centerH = y1 - y0;
    const centerCount = centerW * centerH;

    let prevPixels: Uint8ClampedArray | null = null;
    let noMotionFrames = 0;
    let notDetectedFrames = 0;

    const interval = setInterval(() => {
      if (offscreenVideo.readyState < 2) return;

      ctx.drawImage(offscreenVideo, 0, 0, W, H);
      const imageData = ctx.getImageData(0, 0, W, H);
      const pixels = imageData.data;

      // Center region: brightness + variance (face has eyes/nose/shadows = higher variance; empty = flat)
      const centerValues: number[] = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          centerValues.push((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
        }
      }

      const avgBrightness = centerValues.reduce((a, b) => a + b, 0) / centerCount;
      const variance =
        centerValues.reduce((sum, v) => sum + (v - avgBrightness) ** 2, 0) / centerCount;
      // Face present: need enough brightness AND enough texture (variance). Empty/wall = low variance.
      const brightnessOk = avgBrightness >= 35;
      const varianceOk = variance >= 180; // stricter: real face has strong shadows/features; room/wall often < 180
      const facePresent = brightnessOk && varianceOk;

      // Only "detected" or "not-detected" from this heuristic. No "multiple" — it caused false positives (one face shown as multiple).
      if (!facePresent) {
        notDetectedFrames++;
        if (notDetectedFrames >= 2) {
          setMonitoringStatus((prev) =>
            prev.face !== "not-detected"
              ? { ...prev, face: "not-detected", gaze: "warning" }
              : prev,
          );
        }
      } else {
        notDetectedFrames = 0;
        setMonitoringStatus((prev) =>
          prev.face !== "detected" ? { ...prev, face: "detected" } : prev,
        );
      }

      // Gaze: only when we think a face is present
      if (prevPixels && facePresent) {
        let diffSum = 0;
        for (let i = 0; i < pixels.length; i += 16) {
          diffSum += Math.abs(pixels[i] - prevPixels[i]);
        }
        const avgDiff = diffSum / (pixels.length / 16);
        if (avgDiff < 4) {
          noMotionFrames++;
        } else {
          noMotionFrames = 0;
        }
        if (noMotionFrames >= 3) {
          setMonitoringStatus((prev) =>
            prev.gaze !== "away" ? { ...prev, gaze: "away" } : prev,
          );
        } else {
          setMonitoringStatus((prev) =>
            prev.gaze !== "focused" ? { ...prev, gaze: "focused" } : prev,
          );
        }
      } else if (facePresent) {
        setMonitoringStatus((prev) =>
          prev.gaze !== "focused" ? { ...prev, gaze: "focused" } : prev,
        );
      } else {
        setMonitoringStatus((prev) =>
          prev.gaze !== "warning" ? { ...prev, gaze: "warning" } : prev,
        );
      }

      prevPixels = new Uint8ClampedArray(pixels);
    }, 1000); // Check every 1s for quicker response when leaving frame

    return () => {
      clearInterval(interval);
      offscreenVideo.srcObject = null;
    };
  }, [cameraStream]);

  // ── 4. Camera track health check ───────────────────────────
  // WHY: If the camera track ends (device unplugged, permission revoked), update status
  useEffect(() => {
    if (!cameraStream) return;
    const videoTrack = cameraStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const handleEnded = () => {
      setMonitoringStatus((prev) => ({ ...prev, face: "not-detected", gaze: "warning" }));
      setWarningCount((prev) => prev + 1);
      void recordEvent("CAMERA_LOST", "high");
      toast.error("Camera disconnected", {
        description: "Your camera feed was lost. Please reconnect to continue.",
        duration: 6000,
      });
    };

    videoTrack.addEventListener("ended", handleEnded);
    return () => videoTrack.removeEventListener("ended", handleEnded);
  }, [cameraStream, recordEvent]);

  useEffect(() => {
    if (!session.startedAt && exam && session.attemptId) {
      update({ startedAt: new Date().toISOString() });
    }
  }, [exam, session.attemptId, session.startedAt, update]);

  useEffect(() => {
    if (!session.startedAt || !exam || !session.attemptId) return;
    void recordEvent("SESSION_STARTED", "low");
  }, [session.startedAt, exam, session.attemptId, recordEvent]);

  useEffect(() => {
    if (totalQuestions <= 0) return;
    if (currentQuestion > totalQuestions) {
      update({ currentQuestion: totalQuestions });
    } else if (currentQuestion < 1) {
      update({ currentQuestion: 1 });
    }
  }, [currentQuestion, totalQuestions, update]);

  useEffect(() => {
    if (!question || !attemptIdRef.current) return;
    const now = new Date().toISOString();
    if (questionIdRef.current !== null && questionStartRef.current) {
      void upsertAttemptTimelineEntry(attemptIdRef.current, {
        questionId: questionIdRef.current,
        startAt: questionStartRef.current,
        endAt: now,
      });
    }
    questionIdRef.current = question.questionId;
    questionStartRef.current = now;
    void upsertAttemptTimelineEntry(attemptIdRef.current, {
      questionId: question.questionId,
      startAt: now,
      endAt: now,
    });
  }, [question?.id, session.attemptId]);

  const toggleFlag = () => {
    update({
      flaggedQuestions: flaggedQuestions.includes(currentQuestion)
        ? flaggedQuestions.filter((q) => q !== currentQuestion)
        : [...flaggedQuestions, currentQuestion],
    });
    void recordEvent("QUESTION_FLAGGED", "low", question?.questionId ?? String(currentQuestion));
  };

  const handleSubmit = async () => {
    setShowSubmitDialog(false);
    const submittedAt = new Date().toISOString();
    const durationSeconds = session.startedAt
      ? Math.max(0, Math.floor((Date.parse(submittedAt) - Date.parse(session.startedAt)) / 1000))
      : undefined;

    const attemptId = attemptIdRef.current ?? session.attemptId;

    // If we have a real backend attempt id, submit to backend so results appear on dashboard.
    if (attemptId && isBackendAttemptId) {
      try {
        await flushPendingAnswers();
        if (Object.keys(pendingAnswerQueueRef.current).length > 0) {
          toast.error("Connection issue", {
            description: "Some answers are not synced yet. Please wait a few seconds and try again.",
          });
          return;
        }
        await submitAttempt(attemptId);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "We could not submit your attempt to the server.";
        // If backend says "Already submitted", treat as idempotent success: the attempt is already submitted.
        if (!/already submitted/i.test(message)) {
          toast.error("Exam submission failed", {
            description: message,
          });
          return;
        }
      }
    }

    update({
      lastSubmission: {
        examId,
        examName: exam?.name,
        answered: answeredQuestions.length,
        flagged: flaggedQuestions.length,
        totalQuestions,
        durationSeconds,
        submittedAt,
      },
    });
    void recordEvent("EXAM_SUBMITTED", "low", question?.questionId ?? String(currentQuestion));
    navigate("/success");
  };

  const handleSelectAnswer = (optionId: string) => {
    update({
      selectedAnswers: {
        ...selectedAnswers,
        [String(currentQuestion)]: optionId,
      },
      lastSavedAt: new Date().toISOString(),
    });
    void recordEvent("ANSWER_SAVED", "low", question?.questionId ?? String(currentQuestion));

    const attemptId = attemptIdRef.current ?? session.attemptId;
    // Persist answer to backend when we have a real attempt id (logged-in candidate).
    if (attemptId && isBackendAttemptId && question) {
      pendingAnswerQueueRef.current[String(question.questionId)] = optionId;
      void flushPendingAnswers();
    }

    toast.success("Answer saved", {
      description: `Question ${currentQuestion} saved`,
      duration: 2000,
    });
  };

  const savedLabel = (() => {
    if (!session.lastSavedAt) return "Not saved yet";
    const diffSeconds = Math.max(
      0,
      Math.floor((Date.now() - Date.parse(session.lastSavedAt)) / 1000)
    );
    if (diffSeconds < 60) return `Saved ${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Saved ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `Saved ${diffHours}h ago`;
  })();

  const setCurrentQuestion = (nextQuestion: number) => {
    update({ currentQuestion: nextQuestion });
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="exam-card p-6 text-center">
          <p className="font-semibold">Checking access...</p>
          <p className="text-sm text-muted-foreground">Please wait while we verify your access.</p>
        </div>
      </div>
    );
  }

  if (proctorTerminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="exam-card p-6 text-center max-w-md space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <p className="font-semibold">Exam terminated by proctor</p>
          <p className="text-sm text-muted-foreground">
            Your exam session has been ended by the proctor. Contact support if you have questions.
          </p>
          <Button onClick={() => navigate("/student")}>Return to dashboard</Button>
        </div>
      </div>
    );
  }

  if (accessBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="exam-card p-6 text-center max-w-md">
          <p className="font-semibold">Access required</p>
          <p className="text-sm text-muted-foreground">
            {accessDecision?.reason ?? "You need access before starting this exam."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {accessDecision?.requiresPayment && (
              <Button onClick={() => navigate(`/checkout?examId=${examId}`)}>Go to Checkout</Button>
            )}
            {accessDecision?.requiresLogin && (
              <Button
                variant="outline"
                onClick={() => navigate(`/auth?next=${encodeURIComponent(`/exam?examId=${examId}`)}`)}
              >
                Log In
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (attemptStartError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="exam-card p-6 text-center max-w-md space-y-4">
          <p className="font-semibold">Could not start a new attempt</p>
          <p className="text-sm text-muted-foreground">{attemptStartError}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => navigate("/student")}>
              Return to Dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col public-page-scale exam-page-root">
      {/* Top Bar – exam mode header (UI-only) */}
      <ExamTopBar
        examName={exam?.name || "Exam Session"}
        timeRemaining={timeRemaining}
        aiStatus={aiStatus}
        syncStatus={syncStatus}
        warningCount={warningCount}
        maxWarnings={3}
      />

      {/* Warning Banner */}
      {showWarningBanner && aiStatus === "Warning" && (
        <AlertBanner
          variant="warning"
          closable
          onClose={() => setShowWarningBanner(false)}
          className="mx-3 mt-3"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertBannerTitle>Activity Logged</AlertBannerTitle>
          <AlertBannerDescription>
            Please keep your face visible and minimize looking away from the screen.
          </AlertBannerDescription>
        </AlertBanner>
      )}

      {/* Main Content – responsive single block (stacks on mobile, 3-column on large) */}
      <div className="flex-1 flex px-3 pt-0 pb-4">
        <div className="exam-single-block flex-1 flex flex-col lg:flex-row min-h-0 w-full max-w-[1600px] mx-auto">
          {/* LEFT: Question Navigator (light box, center-aligned) – second on mobile, first on desktop */}
          <aside className="order-2 lg:order-1 w-full lg:w-[22%] lg:min-w-[200px] lg:max-w-xs flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-slate-50/95 rounded-none lg:rounded-r-lg shadow-sm">
            <div className="p-3 h-full flex flex-col min-h-0 w-full">
              <QuestionNavStrip
              totalQuestions={totalQuestions}
              currentQuestion={currentQuestion}
              answeredQuestions={answeredQuestions}
              flaggedQuestions={flaggedQuestions}
              // NOTE: AI flagged per-question indicators could be wired here later.
              aiFlaggedQuestions={[]}
              onQuestionSelect={setCurrentQuestion}
            />
            </div>
          </aside>

          {/* CENTER: Question + actions + submit – third on mobile */}
          <main className="order-3 lg:order-2 w-full lg:flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-card/30">
            <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0">
            <div className="max-w-3xl mx-auto">
              {/* Question Card */}
              <div className="exam-card p-4 sm:p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Question {currentQuestion}</Badge>
                    {flaggedQuestions.includes(currentQuestion) && (
                      <Badge variant="warning-light">
                        <Flag className="h-3 w-3 mr-1" />
                        Flagged
                      </Badge>
                    )}
                  </div>
                  <span className="text-[13px] text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 inline mr-1 text-success" />
                    {savedLabel}
                  </span>
                </div>

                {questionsLoading && (
                  <p className="text-[13px] text-muted-foreground">Loading questions...</p>
                )}

                {!questionsLoading && question && (
                  <div key={question.id} className="space-y-4 animate-fade-in">
                    <h2 className="text-[17px] font-medium">{question.text}</h2>

                    {/* Options */}
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-[13px] ${
                            selectedAnswers[String(currentQuestion)] === option.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-secondary/50"
                          }`}
                        >
                          <Checkbox
                            checked={selectedAnswers[String(currentQuestion)] === option.id}
                            onCheckedChange={() => handleSelectAnswer(option.id)}
                            className="rounded-full"
                          />
                          <span className="font-medium text-muted-foreground mr-2">
                            {option.id.toUpperCase()}.
                          </span>
                          <span>{option.text}</span>
                        </label>
                      ))}
                    </div>

                    {/* Mark for review toggle – shares same flag state */}
                    <div className="flex items-center justify-between pt-2 border-t mt-1.5">
                      <button
                        type="button"
                        onClick={toggleFlag}
                        className="inline-flex items-center gap-2 text-[11px] sm:text-[13px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Checkbox
                          checked={flaggedQuestions.includes(currentQuestion)}
                          onCheckedChange={toggleFlag}
                          className="rounded-sm"
                        />
                        <span>Mark for review</span>
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        Question {currentQuestion} of {totalQuestions || "?"}
                      </span>
                    </div>
                  </div>
                )}

                {!questionsLoading && !question && (
                  <p className="text-[13px] text-muted-foreground">
                    No questions available for this exam.
                  </p>
                )}
              </div>

              {/* Single row: Previous | Next | Flag | Calculator | Report Issue (−1pt text, −2% height, −1% width) */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--btn-secondary-border)]">
                <button
                  type="button"
                  onClick={() => setCurrentQuestion(Math.max(1, currentQuestion - 1))}
                  disabled={currentQuestion === 1 || totalQuestions === 0}
                  className="inline-flex items-center gap-1.5 px-[15.84px] py-[9.8px] rounded-[var(--radius-button)] bg-[var(--btn-secondary-bg)] text-xs font-medium text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentQuestion(Math.min(totalQuestions || 1, currentQuestion + 1))}
                  disabled={totalQuestions === 0 || currentQuestion === totalQuestions}
                  className="inline-flex items-center gap-1.5 px-[15.84px] py-[9.8px] rounded-[var(--radius-button)] bg-[var(--btn-primary-bg)] text-xs font-medium text-[var(--btn-primary-text)] border border-[var(--nav-active-border)] hover:bg-[var(--btn-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={toggleFlag}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-[15.84px] py-[9.8px] rounded-[var(--radius-button)] text-xs font-medium border transition-colors",
                    flaggedQuestions.includes(currentQuestion)
                      ? "bg-[var(--nav-flagged-bg)] text-[var(--nav-flagged-text)] border-[var(--nav-flagged-border)] hover:opacity-90"
                      : "bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover)]"
                  )}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flaggedQuestions.includes(currentQuestion) ? "Flagged" : "Flag"}
                </button>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-[15.84px] py-[9.8px] rounded-[var(--radius-button)] bg-[var(--btn-secondary-bg)] text-xs font-medium text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover)] transition-colors"
                    >
                      <CalculatorIcon className="h-3.5 w-3.5" />
                      Calculator
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Calculator</DialogTitle>
                    </DialogHeader>
                    <Calculator />
                  </DialogContent>
                </Dialog>
                <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-[15.84px] py-[9.8px] rounded-[var(--radius-button)] bg-[var(--btn-secondary-bg)] text-xs font-medium text-[var(--btn-secondary-text)] border border-[var(--btn-secondary-border)] hover:bg-[var(--btn-secondary-hover)] transition-colors"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Report Issue
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report an Issue</DialogTitle>
                      <DialogDescription>
                        Let us know if you're experiencing any problems
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Textarea
                        placeholder="Describe your issue..."
                        rows={4}
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          const attemptId = attemptIdRef.current ?? session.attemptId;
                          if (!attemptId) {
                            toast.error("Cannot send report", {
                              description: "Start the exam and try again.",
                            });
                            return;
                          }
                          setShowReportDialog(false);
                          try {
                            await reportExamIssue({
                              attemptId,
                              examId,
                              questionId: question?.questionId ?? undefined,
                              description: reportDescription.trim() || undefined,
                            });
                            setReportDescription("");
                            toast.success("Issue reported", {
                              description: "Admin and proctor have been notified.",
                            });
                          } catch {
                            toast.error("Report could not be sent", {
                              description: "Make sure you're logged in and try again.",
                            });
                          }
                        }}
                      >
                        Submit Report
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Single block: Answer Summary + Submit/End Exam */}
              <div className="exam-card p-3 mt-3 space-y-3">
                <div>
                  <p className="text-center text-sm font-semibold text-muted-foreground mb-1.5">Answer Summary</p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-navigator)] bg-[var(--nav-answered-bg)] border border-[var(--nav-answered-border)] text-[11px] font-medium text-[var(--nav-answered-text)]">
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--nav-answered-border)] bg-white flex items-center justify-center text-[9px]">✓</span>
                      Answered <span className="font-semibold tabular-nums">({answeredQuestions.length})</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-navigator)] bg-[var(--nav-unanswered-bg)] border border-[var(--nav-unanswered-border)] text-[11px] font-medium text-[var(--nav-unanswered-text)]">
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--nav-unanswered-border)] bg-white" />
                      Unanswered <span className="font-semibold tabular-nums">({remainingQuestions})</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-navigator)] bg-[var(--nav-flagged-bg)] border border-[var(--nav-flagged-border)] text-[11px] font-medium text-[var(--nav-flagged-text)]">
                      <span className="w-3.5 h-3.5 rounded-full border border-[var(--nav-flagged-border)] bg-white flex items-center justify-center">
                        <Flag className="h-2.5 w-2.5" />
                      </span>
                      Flagged <span className="font-semibold tabular-nums">({flaggedQuestions.length})</span>
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground text-center">
                    Review your answers before submitting. You cannot change them after submission.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:w-[57%] sm:mx-auto">
                    <Button
                      className="flex-1 exam-submit-button h-[31.5px] min-h-[31.5px] py-1 px-3 text-[13px]"
                      onClick={() => setShowSubmitDialog(true)}
                      disabled={accessBlocked || accessLoading || questionsLoading || totalQuestions === 0}
                    >
                      Submit Exam
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 exam-end-button h-[31.5px] min-h-[31.5px] py-1 px-3 text-[13px]"
                      onClick={() => setShowSubmitDialog(true)}
                    >
                      End Exam
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </main>

          {/* RIGHT: AI Monitoring – first on mobile, sticky column on large screens */}
          <aside className="order-1 lg:order-3 w-full lg:w-[26%] lg:min-w-[240px] lg:max-w-sm flex flex-col justify-start bg-card/50 px-3 pt-2 pb-3 gap-2 overflow-visible lg:overflow-y-auto lg:sticky lg:top-16">
          <AIMonitoringPanel
            stream={cameraStream}
            status={monitoringStatus}
            warningCount={warningCount}
            maxWarnings={3}
            onViewLog={() => setShowLogDrawer(true)}
            topSlot={
              <div
                className={cn(
                  "rounded-lg border p-2 text-[10px]",
                  liveStatus === "connected"
                    ? "border-success/30 bg-success/5"
                    : liveStatus === "connecting"
                    ? "border-primary/30 bg-primary/5"
                    : liveStatus === "error" || liveStatus === "offline"
                    ? "border-warning/30 bg-warning/5"
                    : "border-muted bg-muted/30"
                )}
              >
                <p
                  className={cn(
                    "font-medium",
                    liveStatus === "connected"
                      ? "text-success"
                      : liveStatus === "error" || liveStatus === "offline"
                      ? "text-warning"
                      : "text-muted-foreground"
                  )}
                >
                  Live Proctor Feed
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {liveStatus === "connected" && "Connected — streaming to proctor"}
                  {liveStatus === "connecting" && "Connecting to proctor server..."}
                  {liveStatus === "error" && "Reconnecting to proctor server..."}
                  {liveStatus === "offline" && "Proctor server offline — retrying..."}
                  {liveStatus === "idle" && (isBackendAttemptId ? "Initializing..." : "Log in and start the exam to stream to proctor.")}
                </p>
              </div>
            }
          />
          </aside>
        </div>
      </div>

      {/* Submit confirmation dialog – behavior unchanged, now opened from right panel */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Your Exam?</DialogTitle>
            <DialogDescription>
              Please review your progress before submitting.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-success-light rounded-lg">
                <p className="text-2xl font-bold text-success">
                  {answeredQuestions.length}
                </p>
                <p className="text-sm text-muted-foreground">Answered</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <p className="text-2xl font-bold">{remainingQuestions}</p>
                <p className="text-sm text-muted-foreground">Unanswered</p>
              </div>
              <div className="p-4 bg-warning-light rounded-lg">
                <p className="text-2xl font-bold text-warning">
                  {flaggedQuestions.length}
                </p>
                <p className="text-sm text-muted-foreground">Flagged</p>
              </div>
            </div>
            <div className="text-center p-3 bg-secondary rounded-lg">
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              <p
                className={cn(
                  "text-xl font-mono font-bold",
                  secondsLeft <= 300
                    ? "text-danger"
                    : secondsLeft <= 900
                    ? "text-warning"
                    : ""
                )}
              >
                {timeRemaining}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Go Back
            </Button>
            <Button onClick={handleSubmit}>
              Submit Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monitoring Log Drawer */}
      <MonitoringLogDrawer
        isOpen={showLogDrawer}
        onClose={() => setShowLogDrawer(false)}
        entries={logEntries}
      />
    </div>
  );
}
