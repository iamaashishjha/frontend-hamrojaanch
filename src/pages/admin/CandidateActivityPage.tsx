import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import PageHeader from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { get } from "@/lib/apiClient";

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  group: string;
  status: "active" | "invited" | "disabled";
  joined: string;
}

interface ActivityEntry {
  id: string;
  label: string;
  time: string;
}

export default function CandidateActivityPage() {
  const { candidateId } = useParams();
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      get<{ items: Array<{ id: string; name: string; email: string; isActive: boolean; createdAt: string }>; total: number }>(
        "/admin/candidates"
      ),
      candidateId
        ? get<{ items: Array<{ id: string; label: string; time: string }> }>(`/admin/candidates/${candidateId}/activity`)
        : Promise.resolve({ items: [] as ActivityEntry[] }),
    ])
      .then(([res, activityRes]) => {
        if (cancelled) return;
        const user = res.items.find((u) => u.id === candidateId);
        if (user) {
          setCandidate({
            id: user.id,
            name: user.name,
            email: user.email,
            group: "Default",
            status: user.isActive ? "active" : "disabled",
            joined: user.createdAt,
          });
        }
        setActivities(activityRes.items.map((a) => ({ ...a, time: formatDistanceToNow(new Date(a.time), { addSuffix: true }) })));
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to fetch candidate:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [candidateId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Activity" subtitle="Loading…" />
        <p className="py-8 text-center text-sm text-muted-foreground">Loading activity…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={candidate ? `Activity: ${candidate.name}` : "Candidate Activity"}
        subtitle="View recent actions and session history."
        actions={<Button variant="outline">Export Log</Button>}
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge variant="success-light">{candidate?.status ?? "active"}</Badge>
        </div>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <div className="font-medium">{activity.label}</div>
                <div className="text-xs text-muted-foreground">{activity.time}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
