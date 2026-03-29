import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { StudentNavUser } from "@/components/StudentNavUser";
import { StudentNotificationsBell } from "@/components/StudentNotificationsBell";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { get } from "@/lib/apiClient";
import { getEvidenceAccess, recordEvidenceAccessAttempt } from "@/lib/exams-module-api";
import { toast } from "sonner";
import "./StudentResults.css";

const REFETCH_INTERVAL_MS = 45_000;

type AttemptRow = {
  id: string;
  examId: string;
  examTitle: string;
  durationMinutes: number | null;
  status: string;
  resultStatus: string | null;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number | null;
};

function useStudentAttempts() {
  return useQuery({
    queryKey: ["student-results", "my-attempts"],
    queryFn: async () => {
      const res = await get<{ items: AttemptRow[] }>("/students/me/attempts");
      return res.items ?? [];
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

type ResultItem = {
  attemptId: string;
  examId: string;
  title: string;
  date: string;
  submittedAt: string | null;
  duration: string;
  score: string;
  status: string;
};

function ResultCard({
  item,
  busyKey,
  onEvidenceAction,
}: {
  item: ResultItem;
  busyKey: string | null;
  onEvidenceAction: (attemptId: string, mode: "webcam" | "screen" | "download") => void;
}) {
  const { data: access, isLoading } = useQuery({
    queryKey: ["evidence-access", item.attemptId],
    queryFn: () => getEvidenceAccess(item.attemptId),
    staleTime: 60_000,
  });
  const webcamOk = access?.webcam ?? false;
  const screenOk = access?.screen ?? false;
  const downloadOk = access?.download ?? false;
  const reason = access?.reason;

  return (
    <div className="result-card">
      <div>
        <h3>{item.title}</h3>
        <span>{item.date}</span>
      </div>
      <div className="result-meta">
        <span>{item.duration}</span>
        <strong>{item.score}</strong>
        <em>{item.status}</em>
        <div className="evidence-actions">
          {reason && !webcamOk && !screenOk && !downloadOk && (
            <span className="evidence-reason" title={reason}>
              {reason}
            </span>
          )}
          <button
            type="button"
            onClick={() => void onEvidenceAction(item.attemptId, "webcam")}
            disabled={isLoading || !webcamOk || busyKey === `${item.attemptId}:webcam`}
            title={!webcamOk ? reason : undefined}
          >
            Webcam
          </button>
          <button
            type="button"
            onClick={() => void onEvidenceAction(item.attemptId, "screen")}
            disabled={isLoading || !screenOk || busyKey === `${item.attemptId}:screen`}
            title={!screenOk ? reason : undefined}
          >
            Screen
          </button>
          <button
            type="button"
            onClick={() => void onEvidenceAction(item.attemptId, "download")}
            disabled={isLoading || !downloadOk || busyKey === `${item.attemptId}:download`}
            title={!downloadOk ? reason : undefined}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentResults() {
  const { settings } = useSiteSettings();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const footerLinks = settings.footer.links.filter((link) => link.label && link.href);
  const { data: attempts = [] } = useStudentAttempts();

  const results = useMemo(
    () =>
      (attempts as AttemptRow[])
        .filter((a) => a.submittedAt)
        .map((a) => {
          const submitted = a.submittedAt ? new Date(a.submittedAt) : null;
          const percentage =
            a.totalMarks && a.totalMarks > 0 && a.score != null
              ? Math.round(((a.score || 0) / a.totalMarks) * 100)
              : null;
          return {
            attemptId: a.id,
            examId: a.examId,
            title: a.examTitle,
            date: submitted ? submitted.toLocaleDateString() : "—",
            submittedAt: a.submittedAt,
            duration: a.durationMinutes ? `${a.durationMinutes} Minutes` : "—",
            score: percentage != null ? `${percentage}%` : "—",
            status:
              a.resultStatus === "under_review"
                ? "Under Review"
                : a.resultStatus === "passed"
                ? "Passed"
                : a.resultStatus === "failed"
                ? "Failed"
                : "Completed",
          };
        }),
    [attempts],
  );

  const summary = useMemo(() => {
    if (results.length === 0) {
      return { avgScore: 0, completedCount: 0, passRate: 0 };
    }
    const scores = results
      .map((r) => parseFloat(String(r.score).replace("%", "")))
      .filter((n) => Number.isFinite(n));
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const completedCount = results.length;
    const passedCount = results.filter((r) => r.status === "Passed").length;
    const passRate = completedCount ? Math.round((passedCount / completedCount) * 100) : 0;
    return { avgScore, completedCount, passRate };
  }, [results]);

  const handleEvidenceAction = async (
    attemptId: string,
    mode: "webcam" | "screen" | "download"
  ) => {
    const action =
      mode === "download"
        ? "evidence.download"
        : mode === "screen"
        ? "evidence.view.screen"
        : "evidence.view.webcam";
    const busyId = `${attemptId}:${mode}`;
    setBusyKey(busyId);
    try {
      const { outcome, reason } = await recordEvidenceAccessAttempt(attemptId, action);
      if (outcome === "denied") {
        toast.error(reason ?? "Access denied.");
        return;
      }
      toast.success(
        mode === "download"
          ? "Download started (mock)."
          : `Opening ${mode} recording (mock).`
      );
    } catch {
      toast.error("Unable to process evidence request.");
    } finally {
      setBusyKey(null);
    }
  };
  return (
    <div className="student-results public-page-scale">
      <div className="student-results-shell">
        <header className="student-results-nav">
          <Link to="/" className="brand">
            <LogoMark className="h-9 w-9" />
            <BrandText />
          </Link>
          <nav className="results-nav-links" aria-label="Student navigation">
            <Link to="/student-dashboard">Dashboard</Link>
            <Link to="/all-exams">My Exams</Link>
            <Link to="/student-results" className="active">
              Results
            </Link>
            <a href="#support">Support</a>
          </nav>
          <div className="results-profile">
            <StudentNavUser />
            <StudentNotificationsBell triggerClassName="profile-icon" iconSize={18} />
          </div>
        </header>

        <section className="results-hero">
          <div>
            <h1>All Exam Results</h1>
            <p>Track performance, review scores, and download detailed reports.</p>
          </div>
          <div className="results-actions">
            <div className="search-input">
              <Search size={16} />
              <input type="text" placeholder="Search exams..." />
            </div>
            <Link to="/student-dashboard" className="btn btn-light">
              Back to Dashboard
            </Link>
          </div>
        </section>

        <section className="results-grid">
          <div className="results-summary">
            <div className="summary-card">
              <strong>{summary.avgScore}%</strong>
              <span>Average Score</span>
            </div>
            <div className="summary-card">
              <strong>{summary.completedCount}</strong>
              <span>Exams Completed</span>
            </div>
            <div className="summary-card">
              <strong>{summary.passRate}%</strong>
              <span>Pass Rate</span>
            </div>
          </div>

          <div className="results-list">
            <div className="list-header">
              <h2>Recent Results</h2>
              <button type="button">
                Download Report <FileText size={14} />
              </button>
            </div>
            {results.map((item) => (
              <ResultCard
                key={item.attemptId}
                item={item}
                busyKey={busyKey}
                onEvidenceAction={handleEvidenceAction}
              />
            ))}
            <Link to="/student-profile" className="result-link">
              View Profile Activity <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        <footer className="results-footer" id="support">
          <div className="footer-strip">
            <span>
              <ShieldCheck size={16} /> AI &amp; Live Proctoring
            </span>
            <span>
              <BadgeCheck size={16} /> Secure &amp; Private
            </span>
            <span>
              <CalendarDays size={16} /> 24/7 Support
            </span>
          </div>
          <div className="footer-links">
            {footerLinks.map((item) => (
              <a key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}

