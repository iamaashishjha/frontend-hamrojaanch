import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/admin/PageHeader";
import DataTable, { ColumnDef } from "@/components/admin/DataTable";
import Modal from "@/components/admin/Modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { get } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, XAxis } from "recharts";

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  group: string;
  status: "active" | "invited" | "disabled";
  joined: string;
}

const statusBadge = (status: CandidateRow["status"]) => {
  if (status === "active") return <Badge variant="success-light">Active</Badge>;
  if (status === "invited") return <Badge variant="warning-light">Invited</Badge>;
  return <Badge variant="danger-light">Disabled</Badge>;
};

export default function CandidatesPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<{ items: Array<{ id: string; name: string; email: string; isActive: boolean; createdAt: string }>; total: number }>(
      "/admin/candidates"
    )
      .then((res) => {
        if (cancelled) return;
        setCandidates(
          res.items.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            group: "Default",
            status: u.isActive ? ("active" as const) : ("disabled" as const),
            joined: u.createdAt,
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to fetch candidates:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const statusData = useMemo(() => {
    const counts = candidates.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { active: 0, invited: 0, disabled: 0 }
    );
    return [
      { name: "Active", value: counts.active, color: "hsl(var(--success))" },
      { name: "Invited", value: counts.invited, color: "hsl(var(--warning))" },
      { name: "Disabled", value: counts.disabled, color: "hsl(var(--danger))" },
    ];
  }, [candidates]);

  const groupData = useMemo(() => {
    const grouped = candidates.reduce<Record<string, number>>((acc, item) => {
      acc[item.group] = (acc[item.group] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([group, value]) => ({
      group,
      value,
    }));
  }, [candidates]);

  const columns: ColumnDef<CandidateRow>[] = [
    { header: "Candidate", accessor: "name" },
    { header: "Email", accessor: "email" },
    { header: "Group", accessor: "group" },
    { header: "Joined", accessor: "joined" },
    { header: "Status", cell: (row) => statusBadge(row.status) },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/candidates/${row.id}/edit`}>Edit</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/candidates/${row.id}/activity`}>Activity</Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="Manage candidate access and onboarding."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import Candidates
            </Button>
            <Button asChild>
              <Link to="/candidates/new">Add Candidate</Link>
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading candidates…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <DataTable columns={columns} data={candidates} emptyMessage="No candidates yet." />
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Candidate Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Candidates by Group</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupData}>
                  <XAxis dataKey="group" tickLine={false} axisLine={false} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Grouped counts by candidate cohorts.</p>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Candidates"
        description="Upload CSV to invite candidates in bulk."
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button>Upload</Button>
          </>
        }
      >
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Drag & drop files here, or click to browse.
        </div>
      </Modal>
    </div>
  );
}
