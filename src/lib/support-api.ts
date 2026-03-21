/**
 * Support: create ticket (public), list/update (admin), chatbot, canned replies, SLA, escalation.
 */
import { get, post, patch, del } from "@/lib/apiClient";

export interface SupportTicket {
  id: string;
  tenantId: string;
  requesterEmail: string;
  requesterName: string | null;
  subject: string;
  body: string;
  status: string;
  assignedToUserId: string | null;
  slaProfileId: string | null;
  userId: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; email: string; name: string } | null;
  slaProfile?: { id: string; name: string; responseTimeHours: number; resolutionTimeHours: number } | null;
  replies?: SupportTicketReply[];
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: { id: string; name: string; email: string };
}

export interface CannedReply {
  id: string;
  tenantId: string;
  name: string;
  shortcut: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlaProfile {
  id: string;
  tenantId: string;
  name: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationTrigger {
  id: string;
  tenantId: string;
  name: string;
  condition: "open_hours" | "sla_breach";
  conditionValue: number;
  action: "assign_admin" | "notify";
  targetUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketPayload {
  requesterEmail: string;
  requesterName?: string;
  subject: string;
  body?: string;
}

export async function createTicket(payload: CreateTicketPayload): Promise<{ ticket: SupportTicket }> {
  return post<{ ticket: SupportTicket }>("/support/tickets", payload);
}

export async function listSupportTickets(params?: {
  status?: string;
  tenantId?: string;
}): Promise<{ items: SupportTicket[] }> {
  return get<{ items: SupportTicket[] }>("/admin/support/tickets", params as Record<string, string> | undefined);
}

export async function updateSupportTicket(
  id: string,
  patch: { status?: string; assignedToUserId?: string | null; slaProfileId?: string | null }
): Promise<{ ticket: SupportTicket }> {
  return patch<{ ticket: SupportTicket }>(`/admin/support/tickets/${id}`, patch);
}

export interface SupportAssignee {
  id: string;
  name: string;
  email: string;
}

export async function listSupportAssignees(): Promise<{ items: SupportAssignee[] }> {
  return get<{ items: SupportAssignee[] }>("/admin/support/assignees");
}

export async function getSupportTicket(id: string): Promise<{ ticket: SupportTicket }> {
  return get<{ ticket: SupportTicket }>(`/admin/support/tickets/${id}`);
}

export async function addTicketReply(
  ticketId: string,
  body: string,
  isInternal?: boolean
): Promise<{ reply: SupportTicketReply }> {
  return post<{ reply: SupportTicketReply }>(`/admin/support/tickets/${ticketId}/replies`, {
    body,
    isInternal,
  });
}

// ── Canned replies ──
export async function listCannedReplies(): Promise<{ items: CannedReply[] }> {
  return get<{ items: CannedReply[] }>("/admin/support/canned-replies");
}

export async function createCannedReply(data: {
  name: string;
  shortcut?: string;
  body?: string;
}): Promise<{ item: CannedReply }> {
  return post<{ item: CannedReply }>("/admin/support/canned-replies", data);
}

export async function updateCannedReply(
  id: string,
  data: { name?: string; shortcut?: string | null; body?: string }
): Promise<{ item: CannedReply }> {
  return patch<{ item: CannedReply }>(`/admin/support/canned-replies/${id}`, data);
}

export async function deleteCannedReply(id: string): Promise<void> {
  await del(`/admin/support/canned-replies/${id}`);
}

// ── SLA profiles ──
export async function listSlaProfiles(): Promise<{ items: SlaProfile[] }> {
  return get<{ items: SlaProfile[] }>("/admin/support/sla-profiles");
}

export async function createSlaProfile(data: {
  name: string;
  responseTimeHours?: number;
  resolutionTimeHours?: number;
  isDefault?: boolean;
}): Promise<{ item: SlaProfile }> {
  return post<{ item: SlaProfile }>("/admin/support/sla-profiles", data);
}

export async function updateSlaProfile(
  id: string,
  data: {
    name?: string;
    responseTimeHours?: number;
    resolutionTimeHours?: number;
    isDefault?: boolean;
  }
): Promise<{ item: SlaProfile }> {
  return patch<{ item: SlaProfile }>(`/admin/support/sla-profiles/${id}`, data);
}

export async function deleteSlaProfile(id: string): Promise<void> {
  await del(`/admin/support/sla-profiles/${id}`);
}

// ── Escalation triggers ──
export async function listEscalationTriggers(): Promise<{ items: EscalationTrigger[] }> {
  return get<{ items: EscalationTrigger[] }>("/admin/support/escalation-triggers");
}

export async function createEscalationTrigger(data: {
  name: string;
  condition: "open_hours" | "sla_breach";
  conditionValue?: number;
  action?: "assign_admin" | "notify";
  targetUserId?: string | null;
  isActive?: boolean;
}): Promise<{ item: EscalationTrigger }> {
  return post<{ item: EscalationTrigger }>("/admin/support/escalation-triggers", data);
}

export async function updateEscalationTrigger(
  id: string,
  data: Partial<{
    name: string;
    condition: "open_hours" | "sla_breach";
    conditionValue: number;
    action: "assign_admin" | "notify";
    targetUserId: string | null;
    isActive: boolean;
  }>
): Promise<{ item: EscalationTrigger }> {
  return patch<{ item: EscalationTrigger }>(`/admin/support/escalation-triggers/${id}`, data);
}

export async function deleteEscalationTrigger(id: string): Promise<void> {
  await del(`/admin/support/escalation-triggers/${id}`);
}

export async function runEscalation(): Promise<{ escalated: number }> {
  return post<{ escalated: number }>("/admin/support/run-escalation");
}

export interface ChatbotResponse {
  answer: string;
  links: { title: string; url: string }[];
  policyHints?: boolean;
}

export async function supportChatbot(query: string, limit?: number): Promise<ChatbotResponse> {
  const params: Record<string, string | number> = { q: query };
  if (limit != null) params.limit = limit;
  return get<ChatbotResponse>("/support/chatbot", params);
}
