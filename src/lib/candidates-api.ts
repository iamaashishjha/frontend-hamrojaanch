/**
 * Admin candidate creation and list.
 * Backend: GET/POST /admin/candidates, GET /admin/candidates/groups.
 */
import { get, post } from "@/lib/apiClient";

export interface CreateCandidatePayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  forceResetOnFirstLogin?: boolean;
}

export interface CreatedCandidate {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
}

export async function createCandidate(payload: CreateCandidatePayload): Promise<CreatedCandidate> {
  const res = await post<{ candidate: CreatedCandidate }>("/admin/candidates", payload);
  return res.candidate;
}
