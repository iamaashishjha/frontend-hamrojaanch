import { get, post, patch } from "@/lib/apiClient";

export interface AttemptReviewItem {
  id: string;
  attemptId: string;
  status: string;
  assignedToUserId: string | null;
  notes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  attempt?: { id: string; exam?: { id: string; title: string }; user?: { email: string; name: string } };
  assignedTo?: { id: string; email: string; name: string };
}

export async function listReviewQueue(status?: string): Promise<AttemptReviewItem[]> {
  const { items } = await get<{ items: AttemptReviewItem[] }>("/admin/review-queue", status ? { status } : {});
  return items;
}

export async function addToReviewQueue(attemptId: string): Promise<{ review: AttemptReviewItem }> {
  return post("/admin/review-queue", { attemptId });
}

export async function updateReview(id: string, data: { status?: string; assignedToUserId?: string | null; notes?: string }): Promise<{ review: AttemptReviewItem }> {
  return patch(`/admin/review-queue/${id}`, data);
}
