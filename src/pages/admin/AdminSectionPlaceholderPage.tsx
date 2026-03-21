import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Bell, CheckCircle2, FileText, ShieldCheck, Users } from "lucide-react";

const sectionInfo: Record<string, { title: string; subtitle: string }> = {
  teachers: {
    title: "Teachers",
    subtitle: "Manage teacher onboarding, access and assignments.",
  },
  blog: {
    title: "Blog & Articles",
    subtitle: "Create and manage articles. Submissions require admin approval before publish.",
  },
  submissions: {
    title: "Submissions & Approvals",
    subtitle: "Track your exam and article submissions and their approval status.",
  },
  evaluate: {
    title: "Evaluate",
    subtitle: "Track pending evaluations, rubric checks and review workflow.",
  },
  reports: {
    title: "Reports",
    subtitle: "Review exam performance, export summaries, and audit outcomes.",
  },
  integrations: {
    title: "Integrations",
    subtitle: "Configure third-party tools and data sync connections.",
  },
  "audit-log": {
    title: "Audit Log",
    subtitle: "Review historical system and admin activity.",
  },
  logs: {
    title: "System Log",
    subtitle: "Inspect security events and application logs.",
  },
};

export default function AdminSectionPlaceholderPage() {
  const { slug = "teachers" } = useParams();
  const info = useMemo(() => sectionInfo[slug] ?? sectionInfo.teachers, [slug]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
        <h1 className="text-2xl font-semibold text-foreground">{info.title}</h1>
        <p className="text-muted-foreground">{info.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <p className="font-semibold">Overview</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            This section is ready for workflow-specific features. Use this layout to add
            tables, filters and role actions.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <p className="font-semibold">Reports</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Export and monitor reports for this module with date and status filters.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <p className="font-semibold">Security</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Review permission history and policy controls relevant to this section.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Action Queue</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Pending approval tasks</span>
            </div>
            <span className="text-sm text-muted-foreground">12 items</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">Completed this week</span>
            </div>
            <span className="text-sm text-muted-foreground">37 actions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
