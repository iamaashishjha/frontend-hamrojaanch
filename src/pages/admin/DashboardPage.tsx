import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Megaphone,
  Monitor,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { get } from "@/lib/apiClient";
import { getStoredUser } from "@/lib/auth-api";
import "./DashboardPage.css";

/* quickActions are static UI links; actionsNeeded and activities derived from fetched data */
const quickActions = [
  { title: "Create Exam", icon: ClipboardList },
  { title: "Add Candidate", icon: Users },
  { title: "Add Teacher", icon: GraduationCap },
  { title: "Import Questions", icon: FileText },
  { title: "Import Candidates", icon: Users },
  { title: "Send Notification", icon: Megaphone },
  { title: "Settings", icon: Settings },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({ exams: 0, candidates: 0, teachers: 0, questions: 0, notifications: 0 });
  const [exams, setExams] = useState<any[]>([]);
  const user = getStoredUser();

  useEffect(() => {
    Promise.all([
      get<any>("/exams").catch(() => ({ items: [], total: 0 })),
      get<any>("/admin/candidates").catch(() => ({ items: [], total: 0 })),
      get<any>("/admin/teachers").catch(() => ({ items: [] })),
      get<any>("/admin/question-bank").catch(() => ({ items: [], total: 0 })),
      get<any>("/admin/notifications").catch(() => ({ items: [] })),
    ]).then(([examRes, candRes, teachRes, qRes, notifRes]) => {
      setStats({
        exams: examRes.total || examRes.items?.length || 0,
        candidates: candRes.total || candRes.items?.length || 0,
        teachers: teachRes.items?.length || 0,
        questions: qRes.total || qRes.items?.length || 0,
        notifications: notifRes.items?.length || 0,
      });
      setExams(examRes.items || []);
    });
  }, []);

  // Derive rows and dynamic dashboard data from fetched exams and stats
  const runningExams = exams.filter((e: any) => e.status === "running");
  const publishedExams = exams.filter((e: any) => e.status === "published");
  const draftExams = exams.filter((e: any) => e.status === "draft");

  const actionsNeeded = [
    { count: String(draftExams.length), text: "Draft exams" },
    { count: String(runningExams.length), text: "Exams running now" },
    { count: String(stats.candidates), text: "Total candidates" },
    { count: String(stats.questions), text: "Questions in bank" },
    { count: String(stats.notifications), text: "Recent notifications" },
  ];

  const activities: { name: string; message: string; time: string }[] = [];

  const analyticsBars = [
    stats.exams,
    stats.candidates,
    stats.teachers,
    stats.questions,
    stats.notifications,
    runningExams.length,
    publishedExams.length,
    draftExams.length,
  ].map((n) => Math.min(n, 100));

  const liveExamCards = [
    {
      title: "Live Exams",
      subtitle: `${runningExams.length} running now`,
      value: String(runningExams.length),
      meta: "today",
      tone: "green",
      icon: Monitor,
    },
    {
      title: "Upcoming Exams",
      subtitle: `${publishedExams.length} scheduled`,
      value: String(stats.exams),
      meta: "",
      tone: "blue",
      icon: CalendarDays,
    },
    {
      title: "Questions",
      subtitle: `${stats.questions} in bank`,
      value: String(stats.questions),
      meta: "",
      tone: "amber",
      icon: ClipboardList,
    },
    {
      title: "Notifications",
      subtitle: `${stats.notifications} recent`,
      value: String(stats.notifications),
      meta: "",
      tone: "red",
      icon: FileText,
    },
  ];

  const monitorRows = runningExams.map((e: any) => ({
    exam: e.title || e.name || "Untitled Exam",
    started: e.startTime ? new Date(e.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
    online: "-",
    flags: "-",
  }));

  const scheduledRows = publishedExams.slice(0, 5).map((e: any) => ({
    name: e.title || e.name || "Untitled Exam",
    date: e.scheduledAt ? new Date(e.scheduledAt).toLocaleString() : "-",
    candidates: "-",
    status: e.status || "-",
    cta: "Manage",
  }));

  const upcomingRows = publishedExams.slice(0, 5).map((e: any) => ({
    name: e.title || e.name || "Untitled Exam",
    date: e.scheduledAt ? new Date(e.scheduledAt).toLocaleString() : "-",
    candidates: "-",
    status: e.status || "-",
    cta: "Manage",
  }));
  return (
    <div className="admin-dashboard">
      <section className="admin-welcome">
        <h1>Welcome back, {user?.name || "Admin"}</h1>
        <p>Here&apos;s an overview of your exam operations.</p>
      </section>

      <section className="admin-dashboard-grid">
        <div className="admin-main-column">
          <article className="dash-panel">
            <div className="dash-panel-header">
              <h2>Live Exams</h2>
              <button type="button" className="dash-panel-control">
                All
              </button>
            </div>

            <div className="live-exam-grid">
              {liveExamCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className={`live-card tone-${card.tone}`}>
                    <div className="live-card-left">
                      <span className="live-icon">
                        <Icon size={18} />
                      </span>
                      <div>
                        <h3>{card.title}</h3>
                        <p>{card.subtitle}</p>
                      </div>
                    </div>
                    <div className="live-card-right">
                      <strong>{card.value}</strong>
                      {card.meta && <span>{card.meta}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="live-summary-row">
              <div className="summary-item">
                <div className="summary-icon">
                  <Users size={18} />
                </div>
                <div>
                  <p>Total Candidates</p>
                  <strong>{stats.candidates}</strong>
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-icon">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <p>Total Teachers</p>
                  <strong>{stats.teachers}</strong>
                </div>
              </div>
              <div className="summary-alert">
                <div>
                  <h4>System Alerts</h4>
                  <p>Low credits, plan nearing usage limit.</p>
                </div>
                <button type="button" className="upgrade-btn">
                  Upgrade Now
                </button>
              </div>
            </div>
          </article>

          <section className="mid-grid">
            <article className="dash-panel">
              <div className="dash-panel-header">
                <h2>Live Exams Monitor</h2>
                <div className="dash-filters">
                  <button type="button">Today</button>
                  <button type="button">All Exams</button>
                </div>
              </div>

              <div className="monitor-table">
                <div className="dash-table-head">
                  <span>Exam</span>
                  <span>Started</span>
                  <span>Online / Invited</span>
                  <span>Flags</span>
                </div>
                {monitorRows.map((row) => (
                  <div key={row.exam} className="dash-table-row">
                    <span>{row.exam}</span>
                    <span>{row.started}</span>
                    <span>{row.online}</span>
                    <div className="monitor-actions">
                      <span className="flag-pill">{row.flags}</span>
                      <button type="button">Monitor</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="dash-panel">
              <div className="dash-panel-header">
                <h2>Admin Actions Needed</h2>
              </div>
              <div className="actions-list">
                {actionsNeeded.map((item) => (
                  <div key={item.text} className="action-item">
                    <div>
                      <strong>{item.count}</strong>
                      <span>{item.text}</span>
                    </div>
                    {item.action ? (
                      <button type="button">{item.action}</button>
                    ) : (
                      <span className="action-dot">0</span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          </section>

          <article className="dash-panel">
            <div className="dash-panel-header">
              <h2>Quick Actions</h2>
              <div className="dash-filters">
                <button type="button">This Week</button>
                <button type="button">Next 30 Days</button>
              </div>
            </div>
            <div className="quick-action-grid">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.title} type="button" className="quick-action-card">
                    <span>
                      <Icon size={18} />
                    </span>
                    <p>{action.title}</p>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="dash-panel">
            <div className="dash-panel-header">
              <h2>Exam Schedule</h2>
              <div className="dash-filters">
                <button type="button">This Week</button>
                <button type="button">Last 30 Days</button>
              </div>
            </div>
            <div className="schedule-table">
              <div className="dash-table-head">
                <span>Exam Name</span>
                <span>Date</span>
                <span>Candidates</span>
                <span>Status</span>
              </div>
              {scheduledRows.map((row) => (
                <div key={row.name} className="dash-table-row compact">
                  <span>{row.name}</span>
                  <span>{row.date}</span>
                  <span>{row.candidates}</span>
                  <div className="schedule-actions">
                    <em>{row.status}</em>
                    <button type="button">{row.cta}</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="dash-panel">
            <div className="dash-panel-header">
              <h2>Upcoming Exams</h2>
              <div className="dash-filters">
                <button type="button">This Week</button>
                <button type="button">Last 30 Days</button>
              </div>
            </div>
            <div className="schedule-table">
              <div className="dash-table-head">
                <span>Exam Name</span>
                <span>Date</span>
                <span>Candidates</span>
                <span>Status</span>
              </div>
              {upcomingRows.map((row) => (
                <div key={row.name} className="dash-table-row compact">
                  <span>{row.name}</span>
                  <span>{row.date}</span>
                  <span>{row.candidates}</span>
                  <div className="schedule-actions">
                    <em>{row.status}</em>
                    <button type="button">{row.cta}</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="admin-side-column">
          <article className="dash-panel">
            <h2>Analytics Overview</h2>
            <div className="analytics-chart">
              {analyticsBars.map((height, idx) => (
                <span key={idx} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="analytics-stats">
              <div>
                <strong>64%</strong>
                <span>Pass Rate</span>
              </div>
              <div>
                <strong>72%</strong>
                <span>Avg Score</span>
              </div>
              <div>
                <strong>$320</strong>
                <span>Revenue</span>
              </div>
            </div>
          </article>

          <article className="dash-panel">
            <h2>Recent Activity</h2>
            <div className="recent-list">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No recent activity.</p>
              ) : (
                activities.map((item) => (
                  <div key={item.name + item.time} className="recent-item">
                    <div className="activity-avatar">{item.name.charAt(0)}</div>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.message}</p>
                      <span>{item.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="dash-panel help-panel">
            <h2>Need help?</h2>
            <p>Access the knowledge base or chat with support.</p>
            <button type="button" className="dash-help-btn">
              Get Help
            </button>
          </article>
        </aside>
      </section>

      <footer className="admin-footer-links">
        <div>
          <span>
            <CheckCircle2 size={14} /> Terms of Use
          </span>
          <span>Privacy Policy</span>
          <span>Refund Policy</span>
        </div>
        <div>
          <Search size={14} />
          <Bell size={14} />
        </div>
      </footer>
    </div>
  );
}
