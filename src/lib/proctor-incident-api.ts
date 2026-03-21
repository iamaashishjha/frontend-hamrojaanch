import { get, post, patch } from "@/lib/apiClient";

export interface ProctorIncident {
  id: string;
  attemptId: string;
  createdBy: string;
  status: "open" | "under_review" | "resolved";
  summary: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  attempt?: {
    id: string;
    email: string;
    status: string;
    examId: string;
    exam?: { title: string };
  };
  creator?: { id: string; name: string; email: string };
}

export async function listProctorIncidents(status?: string): Promise<ProctorIncident[]> {
  const params = status ? { status } : {};
  const res = await get<{ incidents: ProctorIncident[] }>("/admin/proctor-incidents", params);
  return res.incidents ?? [];
}

export async function createProctorIncident(data: { attemptId: string; summary?: string }): Promise<ProctorIncident> {
  const res = await post<{ incident: ProctorIncident }>("/admin/proctor-incidents", data);
  return res.incident;
}

export async function updateProctorIncident(
  id: string,
  data: { status?: "open" | "under_review" | "resolved"; summary?: string; resolution?: string }
): Promise<ProctorIncident> {
  const res = await patch<{ incident: ProctorIncident }>(`/admin/proctor-incidents/${id}`, data);
  return res.incident;
}
