/**
 * Proctor scheduling API — availability, workload, queue.
 */
import { get, post, del } from "@/lib/apiClient";

export interface ProctorAvailabilitySlot {
  id: string;
  proctorUserId: string;
  proctor?: { id: string; name: string; email: string };
  dayOfWeek: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface ProctorWorkloadItem {
  id: string;
  name: string;
  email: string;
  role: string;
  activeAssignments: number;
  inReviewQueue: number;
  totalWorkload: number;
}

export interface ProctorQueueItem {
  id: string;
  attemptId: string;
  status: string;
  attempt?: {
    id: string;
    exam?: { id: string; title: string };
    user?: { id: string; email: string; name: string };
  };
  assignedTo?: { id: string; email: string; name: string };
}

export interface ProctorQueueResponse {
  items: ProctorQueueItem[];
  summary: { pending: number; inReview: number };
}

export async function listProctorAvailability(
  proctorUserId?: string
): Promise<ProctorAvailabilitySlot[]> {
  const { items } = await get<{ items: ProctorAvailabilitySlot[] }>(
    "/admin/proctor-scheduling/availability",
    proctorUserId ? { proctorUserId } : {}
  );
  return items;
}

export async function addProctorAvailability(data: {
  proctorUserId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone?: string;
}): Promise<{ slot: ProctorAvailabilitySlot }> {
  return post("/admin/proctor-scheduling/availability", {
    ...data,
    timezone: data.timezone ?? "Asia/Kathmandu",
  });
}

export async function deleteProctorAvailability(id: string): Promise<void> {
  await del(`/admin/proctor-scheduling/availability/${id}`);
}

export async function listProctorWorkload(): Promise<ProctorWorkloadItem[]> {
  const { items } = await get<{ items: ProctorWorkloadItem[] }>(
    "/admin/proctor-scheduling/workload"
  );
  return items;
}

export async function listProctorQueue(
  status?: string
): Promise<ProctorQueueResponse> {
  return get<ProctorQueueResponse>("/admin/proctor-scheduling/queue", {
    status: status ?? "pending",
  });
}
