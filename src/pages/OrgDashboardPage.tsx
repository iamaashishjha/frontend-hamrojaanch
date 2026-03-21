import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Building2, FileText, Users, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { get } from "@/lib/apiClient";
import { format } from "date-fns";

interface OrgDashboard {
  tenant: { id: string; name: string; slug: string } | null;
  institutions: { id: string; name: string; slug: string }[];
  stats: { exams: number; users: number; attempts: number };
  recentAttempts: {
    id: string;
    examTitle: string;
    email: string;
    status: string;
    startedAt: string;
  }[];
}

export default function OrgDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["org", "dashboard"],
    queryFn: () => get<OrgDashboard>("/org/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading organization dashboard…</p>
      </div>
    );
  }

  const { tenant, institutions, stats, recentAttempts } = data ?? {
    tenant: null,
    institutions: [],
    stats: { exams: 0, users: 0, attempts: 0 },
    recentAttempts: [],
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Organization Dashboard
        </h1>
        <p className="text-muted-foreground">
          {tenant ? `${tenant.name}` : "Your organization"} — overview and activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Exams</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.exams}</div>
            <Link to="/admin/exams" className="text-xs text-primary hover:underline">
              View exams
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
            <Link to="/candidates" className="text-xs text-primary hover:underline">
              View candidates
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Attempts</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attempts}</div>
            <p className="text-xs text-muted-foreground">Total exam attempts</p>
          </CardContent>
        </Card>
      </div>

      {institutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Institutions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Institutions in your organization.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {institutions.map((i) => (
                <li key={i.id} className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {i.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Attempts</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest exam attempts.
          </p>
        </CardHeader>
        <CardContent>
          {recentAttempts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent attempts.</p>
          ) : (
            <div className="space-y-2">
              {recentAttempts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.examTitle}</p>
                    <p className="text-muted-foreground text-xs">{a.email}</p>
                  </div>
                  <div className="text-right">
                    <span className="capitalize">{a.status}</span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.startedAt), "PPp")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
