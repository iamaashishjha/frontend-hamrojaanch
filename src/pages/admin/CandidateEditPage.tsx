import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import FormField from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { get } from "@/lib/apiClient";

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  group: string;
  status: "active" | "invited" | "disabled";
  joined: string;
}

export default function CandidateEditPage() {
  const { candidateId } = useParams();
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<{ items: Array<{ id: string; name: string; email: string; isActive: boolean; createdAt: string }>; total: number }>(
      "/admin/candidates"
    )
      .then((res) => {
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
        <PageHeader title="Edit Candidate" subtitle="Loading…" />
        <p className="py-8 text-center text-sm text-muted-foreground">Loading candidate…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={candidate ? `Edit Candidate: ${candidate.name}` : "Edit Candidate"}
        subtitle="Update candidate profile and access."
        actions={
          <>
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </>
        }
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-2">
          <FormField label="Full Name" required>
            <Input defaultValue={candidate?.name} placeholder="Full name" />
          </FormField>
          <FormField label="Email" required>
            <Input defaultValue={candidate?.email} placeholder="name@example.com" />
          </FormField>
          <FormField label="Group" required>
            <Select defaultValue={candidate?.group ?? "DIT 2026"}>
              <SelectTrigger>
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIT 2026">DIT 2026</SelectItem>
                <SelectItem value="Evening Batch">Evening Batch</SelectItem>
                <SelectItem value="Remote Learners">Remote Learners</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Status" required>
            <Select defaultValue={candidate?.status ?? "active"}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Joined">
            <Input defaultValue={candidate?.joined} placeholder="Join date" />
          </FormField>
        </div>
      </div>
    </div>
  );
}
