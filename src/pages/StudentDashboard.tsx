import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Headphones,
  Laptop,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Wifi,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { StudentNavUser } from "@/components/StudentNavUser";
import { StudentNotificationsBell } from "@/components/StudentNotificationsBell";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { get } from "@/lib/apiClient";
import { getStoredUser } from "@/lib/auth-api";
import { createTicket } from "@/lib/support-api";
import { toast } from "sonner";
import "./StudentDashboard.css";

const REFETCH_INTERVAL_MS = 45_000;

const navItems = [
  { label: "Dashboard", href: "#dashboard" },
  { label: "My Exams", href: "#my-exams" },
  { label: "Purchased", href: "/student-orders" },
  { label: "Results", href: "/student-results" },
  { label: "Certificates", href: "/student-certificates" },
  { label: "Leaderboard", href: "#leaderboard" },
  { label: "Notifications", href: "/student-notifications" },
  { label: "Profile", href: "/student-profile" },
  { label: "Support", href: "#support" },
];

const quickTips = [
  { title: "Webcam ready", description: "Check your camera before the exam.", icon: Laptop },
  { title: "ID ready", description: "Keep identification handy for verification.", icon: BadgeCheck },
  { title: "Stable connection", description: "Use a reliable internet connection.", icon: Wifi },
];

function useCatalogExams() {
  return useQuery({
    queryKey: ["student-dashboard", "catalog-exams"],
    queryFn: async () => {
      const res = await get<{ items?: any[] }>("/catalog/exams");
      const items: any[] = res?.items ?? [];
      return items.map((exam: any) => {
        const canStart =
          exam.status === "running" ||
          (exam.status === "published" && (exam.isDemo || exam.pricingMode === "FREE"));
        return {
          id: exam.id,
          title: exam.title || exam.name || "Untitled Exam",
          time: exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleString() : exam.releaseAt ? new Date(exam.releaseAt).toLocaleString() : "TBD",
          duration: exam.durationMinutes ? `${exam.durationMinutes} min` : "—",
          mode: exam.proctoringEnabled ? "Proctored" : "Standard",
          cta: canStart ? "Start" : "Scheduled",
          status: canStart ? "ready" : "scheduled",
          pricingMode: exam.pricingMode ?? "FREE",
          proctoringEnabled: exam.proctoringEnabled,
        };
      });
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

function useStudentAttempts() {
  return useQuery({
    queryKey: ["student-dashboard", "my-attempts"],
    queryFn: async () => {
      const res = await get<{ items: any[] }>("/students/me/attempts");
      return res.items ?? [];
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

function useStudentCertificates() {
  return useQuery({
    queryKey: ["student-dashboard", "my-certificates"],
    queryFn: async () => {
      const res = await get<{ items: any[] }>("/students/me/certificates");
      return res.items ?? [];
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

function useEntitlements() {
  return useQuery({
    queryKey: ["student-dashboard", "entitlements"],
    queryFn: async () => {
      const res = await get<{ items: any[] }>("/entitlements/me");
      return res.items ?? [];
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

function useMyExams() {
  return useQuery({
    queryKey: ["student-dashboard", "my-exams"],
    queryFn: async () => {
      const res = await get<{
        items: {
          examId: string;
          examTitle: string;
          durationMinutes: number | null;
          examStatus: string;
          proctoringEnabled: boolean;
          pricingMode: string;
          attemptsAllowed: number;
          hasUnlimitedAttempts: boolean;
          attemptsUsed: number;
          attemptsRemaining: number | null;
          hasActiveAttempt: boolean;
          lastResultStatus: string | null;
        }[];
      }>("/students/me/my-exams");
      return res.items ?? [];
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const { settings } = useSiteSettings();
  const footerLinks = (settings?.footer?.links ?? []).filter((link) => link?.label && link?.href);
  const tagline = settings?.branding?.tagline ?? "Secure online proctored exams";
  const supportEmail = settings?.contact?.email?.trim() || null;

  const [leaderboard] = useState<{ name: string; score: string; rank: number }[]>([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const { data: catalogExams = [], isLoading: catalogLoading } = useCatalogExams();
  const { data: myAttempts = [], isLoading: attemptsLoading } = useStudentAttempts();
  const { data: certificates = [], isLoading: certsLoading } = useStudentCertificates();
  const { data: entitlements = [], isLoading: entitlementsLoading } = useEntitlements();
  const { data: myExams = [], isLoading: myExamsLoading } = useMyExams();

  const upcomingExams = catalogExams;
  const pastResults = (myAttempts as any[])
    .filter((a: any) => a.submittedAt)
    .map((a: any) => ({
      title: a.examTitle,
      date: a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—",
      score: a.totalMarks ? `${Math.round(((a.score || 0) / a.totalMarks) * 100)}%` : "—",
      status: a.resultStatus === "under_review" ? "Under Review" : a.resultStatus === "passed" ? "Passed" : "Failed",
      examId: a.examId,
    }));
  const certificatesCount = certificates.length;

  const hasAccessToExam = (examId: string) =>
    entitlements.some((e: any) => (e.exam?.id ?? e.examId) === examId);

  const handleRaiseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = user?.email?.trim();
    if (!email) {
      toast.error("Please sign in so we can reply.");
      return;
    }
    if (!ticketMessage.trim()) {
      toast.error("Please enter your message.");
      return;
    }
    setTicketSubmitting(true);
    try {
      await createTicket({
        requesterEmail: email,
        requesterName: user?.name ?? undefined,
        subject: ticketSubject.trim() || "Support request from dashboard",
        body: ticketMessage.trim(),
      });
      toast.success("Ticket sent. We'll get back soon.");
      setTicketSubject("");
      setTicketMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send. Try the Contact page.");
    } finally {
      setTicketSubmitting(false);
    }
  };

  const avgScore =
    pastResults.length > 0
      ? Math.round(
          pastResults.reduce((acc: number, r: any) => {
            const pct = parseFloat(String(r.score).replace("%", ""));
            return acc + (Number.isFinite(pct) ? pct : 0);
          }, 0) / pastResults.length
        )
      : 0;
  const inProgress = myAttempts.filter((a: any) => a.status === "started").length;
  const completed = pastResults.length;
  const totalActivities = Math.max(upcomingExams.length + completed, 1);
  const progressPct = Math.min(100, Math.round((completed / totalActivities) * 100));

  return (
    <div className="sd-root public-page-scale" id="dashboard">
      {/* ─── Top bar: minimal, distraction-free ─── */}
      <header className="sd-header">
        <Link to="/" className="sd-brand">
          <LogoMark className="sd-brand-icon" />
          <BrandText />
        </Link>
        <nav className="sd-nav" aria-label="Main">
          {navItems.map((item) => {
            const isPath = item.href.startsWith("/");
            const isActive = isPath
              ? location.pathname === item.href
              : item.href === "#support"
                ? location.hash === "#support"
                : item.href === "#dashboard"
                  ? !location.hash || location.hash === "#dashboard"
                  : location.hash === item.href;
            return isPath ? (
              <Link key={item.label} to={item.href} className={isActive ? "sd-nav-link active" : "sd-nav-link"}>
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className={isActive ? "sd-nav-link active" : "sd-nav-link"}>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="sd-header-actions">
          <StudentNotificationsBell triggerClassName="sd-icon-btn" iconSize={20} />
          <StudentNavUser />
        </div>
      </header>

      <main className="sd-main">
        {/* ─── Welcome + primary CTA ─── */}
        <section className="sd-hero">
          <div className="sd-hero-text">
            <h1 className="sd-hero-title">Hi, {user?.name || "Student"}</h1>
            <p className="sd-hero-subtitle">{tagline} — Your exams and progress in one place.</p>
            <Link to="/all-exams" className="sd-btn sd-btn-primary">
              Browse exams
              <ChevronRight size={18} />
            </Link>
          </div>
        </section>

        {/* ─── Stats: scannable blocks with progress ─── */}
        <section className="sd-stats">
          <div className="sd-stat-card">
            <div className="sd-stat-icon-wrap sd-stat-icon--blue">
              <Calendar size={20} />
            </div>
            <div className="sd-stat-content">
              <span className="sd-stat-value">{catalogLoading ? "—" : upcomingExams.length}</span>
              <span className="sd-stat-label">Upcoming</span>
            </div>
          </div>
          <div className="sd-stat-card">
            <div className="sd-stat-icon-wrap sd-stat-icon--amber">
              <Target size={20} />
            </div>
            <div className="sd-stat-content">
              <span className="sd-stat-value">{attemptsLoading ? "—" : inProgress}</span>
              <span className="sd-stat-label">In progress</span>
            </div>
          </div>
          <div className="sd-stat-card">
            <div className="sd-stat-icon-wrap sd-stat-icon--green">
              <Trophy size={20} />
            </div>
            <div className="sd-stat-content">
              <span className="sd-stat-value">{attemptsLoading ? "—" : completed}</span>
              <span className="sd-stat-label">Completed</span>
            </div>
          </div>
          <div className="sd-stat-card">
            <div className="sd-stat-icon-wrap sd-stat-icon--violet">
              <Award size={20} />
            </div>
            <div className="sd-stat-content">
              <span className="sd-stat-value">{certsLoading ? "—" : certificatesCount}</span>
              <span className="sd-stat-label">Certificates</span>
            </div>
          </div>
          <div className="sd-stat-card sd-stat-card--accent">
            <div className="sd-stat-icon-wrap sd-stat-icon--white">
              <Sparkles size={20} />
            </div>
            <div className="sd-stat-content">
              <span className="sd-stat-value">{attemptsLoading ? "—" : avgScore > 0 ? `${avgScore}%` : "—"}</span>
              <span className="sd-stat-label">Average score</span>
            </div>
          </div>
        </section>

        {/* ─── Progress bar ─── */}
        <section className="sd-progress-block">
          <div className="sd-progress-header">
            <span className="sd-progress-title">Your progress</span>
            <span className="sd-progress-pct">{progressPct}%</span>
          </div>
          <div className="sd-progress-track">
            <div className="sd-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="sd-progress-hint">{completed} exam{completed !== 1 ? "s" : ""} completed</p>
        </section>

        {/* ─── Upcoming schedule ─── */}
        <section className="sd-section" id="my-exams">
          <div className="sd-section-head">
            <h2 className="sd-section-title">My exams</h2>
            <p className="sd-section-subtitle">
              Exams you have access to, with attempts based on exam rules.
            </p>
          </div>
          <div className="sd-schedule-list">
            {myExamsLoading ? (
              <div className="sd-empty sd-empty--sm">
                <p>Loading your exams…</p>
              </div>
            ) : myExams.length === 0 ? (
              <div className="sd-empty">
                <BookOpen size={32} />
                <p>No exams yet. After you enroll or purchase an exam, it will appear here.</p>
                <Link to="/all-exams" className="sd-btn sd-btn-outline">
                  Browse exams
                </Link>
              </div>
            ) : (
              myExams.map((exam) => {
                const unlimited = exam.hasUnlimitedAttempts;
                const attemptsLabel = unlimited
                  ? "Unlimited attempts"
                  : `${exam.attemptsUsed}/${exam.attemptsAllowed} attempts used`;
                const canStart =
                  exam.examStatus === "running" || exam.examStatus === "published";
                const statusLabel = exam.hasActiveAttempt
                  ? "In progress"
                  : exam.lastResultStatus === "passed"
                    ? "Passed"
                    : exam.lastResultStatus === "failed"
                      ? "Completed"
                      : "Ready";
                let ctaLabel: string;
                if (exam.hasActiveAttempt) {
                  ctaLabel = "Continue exam";
                } else if (unlimited || (exam.attemptsRemaining ?? 0) > 0) {
                  ctaLabel = exam.attemptsUsed > 0 ? "Retake exam" : "Start exam";
                } else {
                  ctaLabel = "View results";
                }
                const ctaDisabled =
                  !canStart || (!exam.hasActiveAttempt && !unlimited && (exam.attemptsRemaining ?? 0) <= 0);

                return (
                  <div key={exam.examId} className="sd-schedule-card sd-schedule-card--elevated">
                    <div className="sd-schedule-main">
                      <h3 className="sd-schedule-title">{exam.examTitle}</h3>
                      <div className="sd-schedule-meta">
                        <span>
                          <Clock size={14} />{" "}
                          {exam.durationMinutes ? `${exam.durationMinutes} min` : "Flexible"}
                        </span>
                        <span>
                          <ShieldCheck size={14} />{" "}
                          {exam.proctoringEnabled ? "Proctored" : "Standard"}
                        </span>
                        <span className="sd-badge sd-badge--soft">{attemptsLabel}</span>
                      </div>
                    </div>
                    <div className="sd-schedule-cta">
                      <span className="sd-status-pill">{statusLabel}</span>
                      {ctaDisabled ? (
                        <button
                          type="button"
                          className="sd-btn sd-btn-ghost sd-btn-sm"
                          disabled
                        >
                          {ctaLabel}
                        </button>
                      ) : (
                        <Link
                          to={
                            ctaLabel === "View results"
                              ? "/student-results"
                              : `/system-check?examId=${exam.examId}`
                          }
                          className="sd-btn sd-btn-primary sd-btn-sm"
                        >
                          {ctaLabel}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ─── Upcoming schedule (from catalog) ─── */}
        <section className="sd-section">
          <div className="sd-section-head">
            <h2 className="sd-section-title">Upcoming schedule</h2>
            <Link to="/all-exams" className="sd-section-link">
              View all
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="sd-schedule-list">
            {catalogLoading ? (
              <div className="sd-empty sd-empty--sm">
                <p>Loading exams…</p>
              </div>
            ) : upcomingExams.length === 0 ? (
              <div className="sd-empty">
                <Calendar size={32} />
                <p>No upcoming exams. Browse the catalog to get started.</p>
                <Link to="/all-exams" className="sd-btn sd-btn-outline">Browse exams</Link>
              </div>
            ) : (
              upcomingExams.slice(0, 5).map((exam) => {
                const hasAccess = exam.pricingMode !== "PAID" || hasAccessToExam(exam.id);
                const canStart = exam.status === "ready" && hasAccess;
                return (
                  <div key={exam.id ?? exam.title} className="sd-schedule-card">
                    <div className="sd-schedule-main">
                      <h3 className="sd-schedule-title">{exam.title}</h3>
                      <div className="sd-schedule-meta">
                        <span><Clock size={14} /> {exam.time}</span>
                        <span><ShieldCheck size={14} /> {exam.duration}</span>
                        <span className="sd-badge sd-badge--proctor">{exam.mode}</span>
                      </div>
                    </div>
                    {canStart ? (
                      <Link to={`/system-check?examId=${exam.id}`} className="sd-btn sd-btn-primary sd-btn-sm">
                        Start
                      </Link>
                    ) : (
                      <button type="button" className="sd-btn sd-btn-ghost sd-btn-sm" disabled title={exam.pricingMode === "PAID" && !hasAccess ? "Purchase required" : undefined}>
                        {exam.cta}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ─── Recommendations (available exams) ─── */}
        <section className="sd-section">
          <div className="sd-section-head">
            <h2 className="sd-section-title">Recommended for you</h2>
            <Link to="/all-exams" className="sd-section-link">
              See all
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="sd-recommend-grid">
            {(catalogLoading ? [] : upcomingExams.slice(0, 3)).map((exam) => {
              const hasAccess = exam.pricingMode !== "PAID" || hasAccessToExam(exam.id);
              const canStart = exam.status === "ready" && hasAccess;
              return (
                <div key={exam.id} className="sd-recommend-card">
                  <div className="sd-recommend-body">
                    <span className="sd-badge sd-badge--soft">{exam.mode}</span>
                    <h3 className="sd-recommend-title">{exam.title}</h3>
                    <p className="sd-recommend-meta">{exam.duration}</p>
                  </div>
                  {canStart ? (
                    <Link to={`/system-check?examId=${exam.id}`} className="sd-btn sd-btn-primary sd-btn-sm sd-btn-block">
                      Start exam
                    </Link>
                  ) : (
                    <Link to="/all-exams" className="sd-btn sd-btn-outline sd-btn-sm sd-btn-block">
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Recent results + Leaderboard ─── */}
        <div className="sd-two-col">
          <section className="sd-section" id="results">
            <div className="sd-section-head">
              <h2 className="sd-section-title">Recent results</h2>
              <button type="button" className="sd-section-link" onClick={() => navigate("/student-results")}>
                View all
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="sd-results-list">
              {attemptsLoading ? (
                <div className="sd-empty sd-empty--sm">
                  <p>Loading results…</p>
                </div>
              ) : pastResults.length === 0 ? (
                <div className="sd-empty sd-empty--sm">
                  <p>No results yet. Complete an exam to see scores here.</p>
                </div>
              ) : (
                pastResults.slice(0, 4).map((r, i) => (
                  <div key={`${r.examId}-${i}`} className="sd-result-row">
                    <div>
                      <span className="sd-result-title">{r.title}</span>
                      <span className="sd-result-date">{r.date}</span>
                    </div>
                    <div className="sd-result-right">
                      <span className="sd-result-score">{r.score}</span>
                      <span className={`sd-result-status sd-result-status--${r.status === "Passed" ? "pass" : r.status === "Failed" ? "fail" : "review"}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="sd-section" id="leaderboard">
            <div className="sd-section-head">
              <h2 className="sd-section-title">Leaderboard</h2>
            </div>
            <div className="sd-leaderboard">
              {leaderboard.length === 0 ? (
                <div className="sd-empty sd-empty--sm">
                  <Trophy size={28} />
                  <p>Rankings appear after results are published.</p>
                </div>
              ) : (
                leaderboard.map((item) => (
                  <div key={item.name} className={`sd-leader-row ${item.name === (user?.name || "") ? "highlight" : ""}`}>
                    <span className="sd-leader-rank">{item.rank}</span>
                    <span className="sd-leader-name">{item.name}</span>
                    <strong>{item.score}</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* ─── Quick tips ─── */}
        <section className="sd-section">
          <h2 className="sd-section-title">Before you start</h2>
          <div className="sd-tips-grid">
            {quickTips.map(({ title, description, icon: Icon }) => (
              <div key={title} className="sd-tip-card">
                <Icon size={22} className="sd-tip-icon" />
                <h4 className="sd-tip-title">{title}</h4>
                <p className="sd-tip-desc">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Support (driven by site settings) ─── */}
        <section className="sd-support" id="support">
          <div className="sd-support-inner">
            <div className="sd-support-header">
              <Headphones size={24} />
              <h2 className="sd-support-title">Need help?</h2>
              <p className="sd-support-subtitle">
                {supportEmail
                  ? `Raise a ticket or contact us at ${supportEmail}. We typically respond within 24 hours.`
                  : "Raise a ticket or browse the help center. We typically respond within 24 hours."}
              </p>
            </div>
            <div className="sd-support-grid">
              <div className="sd-support-card sd-support-form">
                <h3 className="sd-support-card-title">Send a message</h3>
                <form onSubmit={handleRaiseTicket} className="sd-ticket-form">
                  <input
                    type="text"
                    className="sd-input"
                    placeholder="Subject (optional)"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                  />
                  <textarea
                    className="sd-input sd-textarea"
                    placeholder="Your message *"
                    rows={3}
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    required
                  />
                  <button type="submit" className="sd-btn sd-btn-primary" disabled={ticketSubmitting}>
                    {ticketSubmitting ? "Sending…" : <><Send size={18} /> Send ticket</>}
                  </button>
                </form>
              </div>
              <Link to="/pages/faq" className="sd-support-card sd-support-link">
                <BookOpen size={22} />
                <span>Help Center & FAQs</span>
                <ChevronRight size={18} />
              </Link>
              <Link to="/pages/contact" className="sd-support-card sd-support-link">
                <Mail size={22} />
                <span>{supportEmail ? `Contact us (${supportEmail})` : "Contact us"}</span>
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        <footer className="sd-footer">
          <div className="sd-footer-badges">
            <span><ShieldCheck size={14} /> Proctored</span>
            <span><BadgeCheck size={14} /> Secure</span>
            <span><Headphones size={14} /> Support</span>
          </div>
          {footerLinks.length > 0 && (
            <div className="sd-footer-links">
              {footerLinks.map((item) => (
                <a key={item.href} href={item.href}>{item.label}</a>
              ))}
            </div>
          )}
          {settings?.footer?.footerText && (
            <p className="sd-footer-text">{settings.footer.footerText}</p>
          )}
          {settings?.footer?.copyright && (
            <p className="sd-footer-copyright">{settings.footer.copyright}</p>
          )}
        </footer>
      </main>
    </div>
  );
}
