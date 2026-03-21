/**
 * Student notification inbox — teacher and admin announcements delivered to this user.
 * Read status tracking can be added later (read_at).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { StudentNavUser } from "@/components/StudentNavUser";
import { get } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentNotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ items: any[] }>("/students/me/notifications")
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/student-dashboard" className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <BrandText />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student-dashboard">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <StudentNavUser />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Bell className="h-6 w-6 text-slate-600" />
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No notifications</CardTitle>
              <CardDescription>
                When teachers or admins send you announcements, they will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/student-dashboard">Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <Card key={n.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{n.subject}</CardTitle>
                  <CardDescription>
                    {n.sentAt ? new Date(n.sentAt).toLocaleString() : "—"}
                    {n.read !== undefined && !n.read && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">New</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
