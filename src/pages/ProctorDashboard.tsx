/**
 * Proctor Dashboard — UI modeled on reference: dark sidebar, top bar with search,
 * status strip, metric cards, Live Exam Sessions table, Suspicious Activities,
 * Proctor Efficiency, Real-Time Alerts, Audit Log.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Bell,
  Mail,
  LayoutDashboard,
  Radio,
  Flag,
  Film,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  UserPlus,
  FileWarning,
  Settings,
  LogOut,
  CheckCircle2,
  Activity,
  Cloud,
  TrendingUp,
  Camera,
  Mic,
  Monitor,
  AlertTriangle,
  Play,
  Video,
  VideoOff,
  MicOff,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getProctorAlerts, getProctorAuditLog, getProctorStudents } from "@/lib/api";
import type { ProctorStudent } from "@/lib/types";
import { createViewer } from "@/lib/live-proctoring";
import { sendProctorAction } from "@/lib/proctor-api";
import { getStoredUser } from "@/lib/auth-api";
import { logout } from "@/lib/auth-api";
import { toast } from "sonner";
import "./ProctorDashboard.css";

function RiskBadge({ level }: { level: string }) {
  const c = level === "high" ? "pd-risk-high" : level === "medium" ? "pd-risk-medium" : "pd-risk-low";
  const label = level === "high" ? "High Risk" : level === "medium" ? "Medium Risk" : "Low Risk";
  return <span className={`pd-badge ${c}`}>{label}</span>;
}

export default function ProctorDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const mainRef = useRef<HTMLElement | null>(null);
  const [searchSessions, setSearchSessions] = useState("");
  const [filterRisk, setFilterRisk] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<ProctorStudent | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>("idle");
  const [supportOpen, setSupportOpen] = useState(false);
  const [liveMonitoringOpen, setLiveMonitoringOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [viewAllSessions, setViewAllSessions] = useState(false);
  const [proctorActionLoading, setProctorActionLoading] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveViewerRef = useRef<Awaited<ReturnType<typeof createViewer>> | null>(null);

  const scrollToSection = useCallback((id: string) => {
    if (id === "dashboard" || id === "top") {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["proctor", "students"],
    queryFn: getProctorStudents,
    refetchInterval: 15_000,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["proctor", "alerts"],
    queryFn: getProctorAlerts,
    refetchInterval: 15_000,
  });
  const { data: auditLog = [] } = useQuery({
    queryKey: ["proctor", "audit-log"],
    queryFn: getProctorAuditLog,
    refetchInterval: 15_000,
  });

  const searchQuery = searchSessions.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    const matchSearch =
      !searchQuery ||
      [s.name, s.examName, s.email].some((x) => x.toLowerCase().includes(searchQuery));
    const matchRisk = filterRisk === "all" || s.riskLevel === filterRisk;
    return matchSearch && matchRisk;
  });
  const sessionsToShow = viewAllSessions ? filteredStudents : filteredStudents.slice(0, 8);

  const activeCount = students.filter((s) => s.status === "active").length;
  const flaggedCount = students.filter((s) => s.status === "flagged").length;
  const suspiciousStudents = students.filter((s) => s.riskLevel === "high" || s.status === "flagged");

  useEffect(() => {
    if (liveVideoRef.current) liveVideoRef.current.srcObject = liveStream;
  }, [liveStream]);

  useEffect(() => {
    if (!selectedStudent) return;
    let cancelled = false;
    const run = async () => {
      setLiveStatus("connecting");
      setLiveStream(null);
      try {
        const viewer = await createViewer({
          examId: selectedStudent.examId,
          attemptId: selectedStudent.attemptId,
          role: "proctor",
          onStream: (stream) => {
            if (!cancelled) setLiveStream(stream);
          },
          onStatus: (status) => {
            if (!cancelled) setLiveStatus(status);
          },
        });
        if (!cancelled) liveViewerRef.current = viewer;
      } catch {
        if (!cancelled) setLiveStatus("error");
      }
    };
    run();
    return () => {
      cancelled = true;
      liveViewerRef.current?.close();
      liveViewerRef.current = null;
      setLiveStream(null);
      setLiveStatus("idle");
    };
  }, [selectedStudent?.attemptId, selectedStudent?.examId]);

  const handleWarn = async () => {
    if (!selectedStudent) return;
    setProctorActionLoading(true);
    try {
      await sendProctorAction(selectedStudent.attemptId, "warn");
      liveViewerRef.current?.sendProctorCommand?.("warn");
      toast.success("Warning sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setProctorActionLoading(false);
    }
  };

  const handleTerminate = async () => {
    if (!selectedStudent || !confirm("End this candidate's exam now?")) return;
    setProctorActionLoading(true);
    try {
      await sendProctorAction(selectedStudent.attemptId, "terminate");
      liveViewerRef.current?.sendProctorCommand?.("terminate");
      toast.success("Exam terminated");
      setSelectedStudent(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setProctorActionLoading(false);
    }
  };

  return (
    <div className="pd-root">
      {/* ─── Top header (full width) ─── */}
      <header className="pd-header">
        <div className="pd-header-left">
          <Link to="/" className="pd-brand">
            <LogoMark className="pd-brand-icon" />
            <BrandText />
          </Link>
        </div>
        <div className="pd-header-center">
          <Search className="pd-search-icon" />
          <input
            type="text"
            className="pd-search-input"
            placeholder="Search sessions..."
            value={searchSessions}
            onChange={(e) => setSearchSessions(e.target.value)}
          />
        </div>
        <div className="pd-header-right">
          <button
            type="button"
            className="pd-header-btn"
            aria-label="Notifications"
            onClick={() => scrollToSection("alerts")}
          >
            <Bell size={20} />
            <span className="pd-badge-dot">{alerts.length > 0 ? alerts.length : 0}</span>
          </button>
          <button type="button" className="pd-header-btn" aria-label="Messages">
            <Mail size={20} />
          </button>
          <div className="pd-header-avatar" title={user?.name || "Proctor"}>
            {user?.name?.charAt(0) ?? "P"}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="pd-body">
        {/* ─── Left sidebar ─── */}
        <aside className="pd-sidebar">
          <div className="pd-sidebar-user">
            <div className="pd-sidebar-avatar">{user?.name?.charAt(0) ?? "P"}</div>
            <div className="pd-sidebar-user-info">
              <span className="pd-sidebar-name">{user?.name || "Proctor"}</span>
              <span className="pd-sidebar-role">Proctor</span>
            </div>
          </div>
          <nav className="pd-sidebar-nav">
            <button type="button" className="pd-nav-item active" onClick={() => scrollToSection("dashboard")}>
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <div className="pd-nav-group">
              <button
                type="button"
                className="pd-nav-item pd-nav-trigger"
                onClick={() => setLiveMonitoringOpen(!liveMonitoringOpen)}
              >
                <Radio size={20} />
                Live Monitoring
                {liveMonitoringOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className={`pd-nav-sub ${liveMonitoringOpen ? "open" : ""}`}>
                <button type="button" className="pd-nav-item" onClick={() => scrollToSection("sessions")}>
                  Active Sessions
                  {activeCount > 0 && <span className="pd-nav-badge">{activeCount}</span>}
                </button>
                <button type="button" className="pd-nav-item" onClick={() => { setFilterRisk("high"); scrollToSection("sessions"); }}>
                  Flagged Sessions
                </button>
                <button type="button" className="pd-nav-item" onClick={() => scrollToSection("sessions")}>
                  Recording Review
                </button>
              </div>
            </div>
            <div className="pd-nav-group">
              <button
                type="button"
                className="pd-nav-item pd-nav-trigger"
                onClick={() => setReportsOpen(!reportsOpen)}
              >
                Reports
                {reportsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className={`pd-nav-sub ${reportsOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="pd-nav-item"
                  onClick={() => { navigate("/admin/review-queue"); }}
                >
                  Review queue
                </button>
              </div>
            </div>
            <button type="button" className="pd-nav-item" onClick={() => scrollToSection("alerts")}>
              Notifications
              {alerts.length > 0 && <span className="pd-nav-badge pd-nav-badge--red">{alerts.length}</span>}
            </button>
            <div className="pd-nav-group">
              <button type="button" className="pd-nav-item pd-nav-trigger" onClick={() => setSupportOpen(!supportOpen)}>
                Support
                {supportOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className={`pd-nav-sub ${supportOpen ? "open" : ""}`}>
                <Link to="/pages/contact" className="pd-nav-item">Contact Admin</Link>
                <Link to="/pages/contact?subject=teacher" className="pd-nav-item">Contact Assigned Teacher</Link>
                <Link to="/pages/contact?subject=incident" className="pd-nav-item">Raise Incident Report</Link>
              </div>
            </div>
            <button type="button" className="pd-nav-item" onClick={() => scrollToSection("dashboard")}>
              <Settings size={20} />
              Settings
            </button>
          </nav>
          <div className="pd-sidebar-footer">
            <button type="button" className="pd-nav-item pd-logout" onClick={() => logout("/auth")}>
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main className="pd-main" ref={mainRef}>
          {/* Status strip */}
          <section className="pd-status-strip">
            <div className="pd-status-item">
              <CheckCircle2 size={18} className="pd-status-ok" />
              System: Operational
            </div>
            <div className="pd-status-item">
              <CheckCircle2 size={18} className="pd-status-ok" />
              AI Monitoring: Active
            </div>
            <div className="pd-status-item">
              <CheckCircle2 size={18} className="pd-status-ok" />
              Recording Server: Stable
            </div>
            <div className="pd-status-item">
              <Activity size={18} />
              Avg Latency: 120ms
            </div>
          </section>

          {/* Metric cards */}
          <section className="pd-metrics">
            <div className="pd-metric-card">
              <span className="pd-metric-value">{activeCount}</span>
              <span className="pd-metric-label">Active Sessions</span>
              <span className="pd-metric-trend pd-metric-trend--up">+2 from last hour</span>
            </div>
            <div className="pd-metric-card">
              <span className="pd-metric-value">15</span>
              <span className="pd-metric-label">Completed Exams</span>
            </div>
            <div className="pd-metric-card pd-metric-card--warning">
              <span className="pd-metric-value">{flaggedCount}</span>
              <span className="pd-metric-label">Flagged Exams</span>
              <span className="pd-metric-trend pd-metric-trend--danger">+40% from yesterday</span>
            </div>
            <div className="pd-metric-card">
              <Cloud size={24} className="pd-metric-icon" />
              <span className="pd-metric-value">27</span>
              <span className="pd-metric-label">Total sessions</span>
            </div>
          </section>

          {/* Live Exam Sessions + Suspicious Activities row */}
          <div className="pd-two-col">
            <section className="pd-card pd-card--sessions" id="sessions">
              <div className="pd-card-head">
                <h2 className="pd-card-title">Live Exam Sessions</h2>
                <div className="pd-card-actions">
                  <div className="pd-input-wrap">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchSessions}
                      onChange={(e) => setSearchSessions(e.target.value)}
                      className="pd-input-sm"
                    />
                  </div>
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="pd-select"
                  >
                    <option value="all">Filters</option>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                  <Button
                    size="sm"
                    variant="default"
                    className="pd-btn-focus"
                    onClick={() => scrollToSection("sessions")}
                  >
                    Enter Focus Monitoring Mode
                  </Button>
                </div>
              </div>
              <div className="pd-table-wrap">
                {studentsLoading ? (
                  <p className="pd-muted">Loading sessions...</p>
                ) : filteredStudents.length === 0 ? (
                  <p className="pd-muted">No active sessions.</p>
                ) : (
                  <table className="pd-table">
                    <thead>
                      <tr>
                        <th>Student / Exam</th>
                        <th>Exam Start / Proctor Type</th>
                        <th>Risk</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsToShow.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <div className="pd-cell-student">
                              <div className="pd-avatar pd-avatar--sm">{student.name.charAt(0)}</div>
                              <div>
                                <span className="pd-name">{student.name}</span>
                                <span className="pd-muted"> — {student.examName}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="pd-muted">09:30 AM</span>
                            <span className="pd-badge pd-badge--soft">AI Proctored</span>
                          </td>
                          <td>
                            <RiskBadge level={student.riskLevel} />
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant={student.riskLevel === "high" ? "destructive" : "default"}
                              onClick={() => setSelectedStudent(student)}
                            >
                              {student.riskLevel === "high" ? "Join" : "Monitor"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="pd-card-footer">
                <button
                  type="button"
                  className="pd-link"
                  style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
                  onClick={() => {
                    setViewAllSessions(true);
                    scrollToSection("sessions");
                  }}
                >
                  View All Sessions
                </button>
                <span className="pd-muted">{filteredStudents.length}</span>
              </div>
            </section>

            <section className="pd-card" id="suspicious">
              <h2 className="pd-card-title">Suspicious Activities</h2>
              <div className="pd-suspicious-list">
                {suspiciousStudents.length === 0 ? (
                  <p className="pd-muted pd-p-3">No suspicious activities.</p>
                ) : (
                  suspiciousStudents.slice(0, 3).map((student) => (
                    <div key={student.id} className="pd-suspicious-card">
                      <div className="pd-suspicious-head">
                        <div className="pd-cell-student">
                          <div className="pd-avatar pd-avatar--sm">{student.name.charAt(0)}</div>
                          <div>
                            <span className="pd-name">{student.name}</span>
                            <span className="pd-muted"> — {student.examName}</span>
                            <div className="pd-muted pd-text-xs">0:0:29</div>
                          </div>
                        </div>
                        <RiskBadge level="high" />
                      </div>
                      <div className="pd-suspicious-video">
                        <div className="pd-video-placeholder">
                          {selectedStudent?.id === student.id && liveStream ? (
                            <video
                              ref={liveVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="pd-video-feed"
                              style={{ transform: "scaleX(-1)" }}
                            />
                          ) : (
                            <span>{student.name.charAt(0)}</span>
                          )}
                        </div>
                      </div>
                      <div className="pd-suspicious-issues">
                        <span className="pd-issue-tag">Multiple Face detected</span>
                        <span className="pd-issue-tag">Possible phone use</span>
                        <span className="pd-issue-tag">Tab Switch</span>
                      </div>
                      <div className="pd-suspicious-actions">
                        <Button size="sm" variant="ghost">
                          <Play size={14} />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Video size={14} />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <MicOff size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSelectedStudent(student)}
                        >
                          Join
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Proctor Efficiency + Alerts + Audit row */}
          <div className="pd-three-col">
            <section className="pd-card pd-card--efficiency">
              <div className="pd-card-head">
                <h2 className="pd-card-title">Proctor Efficiency</h2>
                <Button size="sm" variant="outline" onClick={() => scrollToSection("sessions")}>
                  Enter Focus Monitoring
                </Button>
              </div>
              <div className="pd-efficiency-metrics">
                <div className="pd-eff-row">
                  <span className="pd-muted">6s Avg. Response Time</span>
                  <TrendingUp size={14} className="pd-trend-up" />
                </div>
                <div className="pd-eff-row">
                  <span className="pd-muted">8 Alerts Handled today</span>
                </div>
                <div className="pd-eff-row">
                  <span className="pd-muted">4% False Flag Rate</span>
                </div>
              </div>
              <div className="pd-chart-bar">
                <div className="pd-chart-bar-label">Total alerts</div>
                <div className="pd-chart-bar-track">
                  <div className="pd-chart-bar-fill" style={{ width: "70%" }} />
                </div>
                <span className="pd-muted pd-text-xs">347 Sessions</span>
              </div>
              <div className="pd-chart-donut-wrap">
                <div className="pd-chart-donut" style={{ background: "conic-gradient(#10b981 0% 70%, #f59e0b 70% 89%, #e2e8f0 89% 100%)" }} />
                <div className="pd-chart-donut-center">
                  <span className="pd-chart-donut-pct">92%</span>
                  <span className="pd-muted pd-text-xs">Intervention Accuracy</span>
                </div>
              </div>
              <div className="pd-chart-legend">
                <span><i className="pd-legend-dot pd-legend--green" /> Clean 70%</span>
                <span><i className="pd-legend-dot pd-legend--orange" /> Flagged 19%</span>
              </div>
            </section>

            <section className="pd-card" id="alerts">
              <div className="pd-card-head">
                <h2 className="pd-card-title">Real-Time Alerts</h2>
                <button
                  type="button"
                  className="pd-link"
                  style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
                  onClick={() => scrollToSection("alerts")}
                >
                  View All
                </button>
              </div>
              <div className="pd-alerts-list">
                {alerts.length === 0 ? (
                  <p className="pd-muted pd-text-sm pd-p-2">No recent alerts.</p>
                ) : (
                  alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="pd-alert-item">
                      <MessageSquare size={16} className="pd-alert-icon" />
                      <div>
                        <div className="pd-alert-title">{alert.type}: {alert.studentName}</div>
                        <div className="pd-muted pd-text-xs">
                          {alert.type === "ISSUE REPORTED"
                            ? (alert.description ? `"${alert.description}"` : "Student reported an issue")
                            : `Suspect attempt — ${alert.type.toLowerCase()}`}
                        </div>
                        <div className="pd-muted pd-text-xs">{alert.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="pd-card" id="all-audit">
              <div className="pd-card-head">
                <h2 className="pd-card-title">Audit Log</h2>
                <button
                  type="button"
                  className="pd-link"
                  style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
                  onClick={() => scrollToSection("all-audit")}
                >
                  View All
                </button>
              </div>
              <div className="pd-audit-list">
                {auditLog.length === 0 ? (
                  <p className="pd-muted pd-text-sm pd-p-2">No recent proctor actions.</p>
                ) : (
                  auditLog.map((entry) => (
                    <div key={entry.id} className="pd-audit-item">
                      <div className="pd-avatar pd-avatar--xs">{entry.user.charAt(0)}</div>
                      <div>
                        <span className="pd-name">{entry.user}</span>
                        <span className="pd-muted"> — {entry.action}</span>
                        <div className="pd-muted pd-text-xs">{entry.time}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Student detail / Join modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="pd-modal pd-modal--wide">
          <DialogHeader>
            <DialogTitle className="pd-modal-title">
              {selectedStudent?.name}
              {selectedStudent && <RiskBadge level={selectedStudent.riskLevel} />}
            </DialogTitle>
            <DialogDescription>{selectedStudent?.email}</DialogDescription>
          </DialogHeader>
          <div className="pd-modal-grid">
            <div className="pd-modal-video">
              <div className="pd-video-container">
                {liveStream ? (
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="pd-video-feed-full"
                    style={{ transform: "scaleX(-1)" }}
                  />
                ) : (
                  <div className="pd-video-placeholder pd-video-placeholder--lg">
                    {liveStatus === "connecting" ? "Connecting..." : liveStatus === "error" ? "Unable to load" : "Live feed"}
                  </div>
                )}
                {liveStatus === "connected" && (
                  <span className="pd-live-pill"><span className="pd-dot" /> Live</span>
                )}
              </div>
              <div className="pd-modal-status">
                <span><Camera size={14} /> {selectedStudent?.cameraStatus ? "On" : "Off"}</span>
                <span><Mic size={14} /> {selectedStudent?.micStatus ? "On" : "Off"}</span>
                <span><Monitor size={14} /> {selectedStudent?.screenStatus ? "On" : "Off"}</span>
              </div>
            </div>
            <div className="pd-modal-actions">
              <Textarea placeholder="Add observation notes..." rows={3} className="pd-textarea" />
              <Button variant="outline" className="w-full" disabled={proctorActionLoading} onClick={handleWarn}>
                <AlertTriangle size={16} />
                Send Warning
              </Button>
              <Button variant="destructive" className="w-full" disabled={proctorActionLoading} onClick={handleTerminate}>
                Terminate exam
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
