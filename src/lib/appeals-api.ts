import { get, post, patch } from "@/lib/apiClient";

export interface AppealItem {
  id: string;
  attemptId: string;
  email: string;
  reason: string;
  status: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  attempt?: { exam?: { id: string; title: string } };
}

export async function listAppeals(status?: string): Promise<AppealItem[]> {
  const { items } = await get<{ items: AppealItem[] }>("/admin/appeals", status ? { status } : {});
  return items;
}

export async function createAppeal(attemptId: string, email: string, reason: string): Promise<{ appeal: AppealItem }> {
  return post("/admin/appeals", { attemptId, email, reason });
}

export async function decideAppeal(id: string, status: "approved" | "rejected", decisionNotes?: string): Promise<{ appeal: AppealItem }> {
  return patch(`/admin/appeals/${id}`, { status, decisionNotes });
}
