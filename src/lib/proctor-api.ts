/**
 * Proctor assignment (v1) API — for admin UI.
 */
import { get, post } from "@/lib/apiClient";

export interface ProctorAssignmentItem {
  id: string;
  attemptId: string;
  assignedAt: string;
  status: string;
  proctor: { id: string; name: string; email: string } | null;
  exam: { id: string; title: string };
  candidate: { id: string | null; name: string; email: string };
  eventCount: number;
}

export interface EligibleProctor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function getProctorAssignments(): Promise<ProctorAssignmentItem[]> {
  const { items } = await get<{ items: ProctorAssignmentItem[] }>("/v1/proctor/my-assignments");
  return items;
}

export async function getEligibleProctors(): Promise<EligibleProctor[]> {
  const { items } = await get<{ items: EligibleProctor[] }>("/v1/proctor/eligible");
  return items;
}

export async function assignProctor(
  attemptId: string,
  proctorUserId: string
): Promise<{ assignment: { id: string }; updated?: boolean }> {
  return post<{ assignment: { id: string }; updated?: boolean }>("/v1/proctor/assignments", {
    attemptId,
    proctorUserId,
  });
}

/** Send proctor action (warn or terminate) to candidate; logs to audit and optionally ends attempt. */
export async function sendProctorAction(
  attemptId: string,
  action: "warn" | "terminate",
  reason?: string
): Promise<{ ok: boolean; action: string }> {
  return post<{ ok: boolean; action: string }>("/v1/proctor/actions", {
    attemptId,
    action,
    ...(reason ? { reason } : {}),
  });
}
