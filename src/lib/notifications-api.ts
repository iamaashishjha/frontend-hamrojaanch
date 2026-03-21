/**
 * Real backend API. Replaces previous mock implementation.
 */
import type {
  NotificationCreatePayload,
  NotificationDeliveryLog,
  NotificationFailureSummary,
  NotificationFilters,
  NotificationGroup,
  NotificationItem,
  NotificationRecipient,
  NotificationRetryHealth,
  NotificationUser,
} from "@/lib/notifications-types";
import { get, post, patch, del } from "@/lib/apiClient";

function parseChannels(value: unknown): Array<"in-app" | "email" | "sms"> {
  if (Array.isArray(value)) {
    return value.filter((v): v is "in-app" | "email" | "sms" => v === "in-app" || v === "email" || v === "sms");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v): v is "in-app" | "email" | "sms" => v === "in-app" || v === "email" || v === "sms"
        );
      }
    } catch {
      // Ignore parse failures and fallback below.
    }
  }
  return ["in-app"];
}

function toNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeNotificationItem(input: Partial<NotificationItem> & Record<string, unknown>): NotificationItem {
  const channels = parseChannels(input.channels);
  const metricsRaw = (input.metrics as Record<string, unknown> | undefined) ?? {};
  return {
    id: String(input.id ?? ""),
    subject: String(input.subject ?? ""),
    body: String(input.body ?? ""),
    audience:
      input.audience === "Candidates" || input.audience === "Teachers" || input.audience === "Both"
        ? input.audience
        : "Candidates",
    targetType:
      input.targetType === "all" || input.targetType === "groups" || input.targetType === "users"
        ? input.targetType
        : "all",
    groupIds: Array.isArray(input.groupIds) ? (input.groupIds as string[]) : [],
    userIds: Array.isArray(input.userIds) ? (input.userIds as string[]) : [],
    channels,
    status:
      input.status === "Draft" ||
      input.status === "Scheduled" ||
      input.status === "Sending" ||
      input.status === "Sent" ||
      input.status === "Failed" ||
      input.status === "Cancelled"
        ? input.status
        : "Draft",
    scheduledAt: (input.scheduledAt as string | null | undefined) ?? null,
    timezone: String(input.timezone ?? "Asia/Kathmandu"),
    createdBy: String(input.createdBy ?? "system"),
    createdAt: String(input.createdAt ?? new Date().toISOString()),
    updatedAt: String(input.updatedAt ?? new Date().toISOString()),
    attachments: Array.isArray(input.attachments) ? (input.attachments as string[]) : [],
    emailTemplate: (input.emailTemplate as string | undefined) ?? "",
    smsTemplate: (input.smsTemplate as string | undefined) ?? "",
    deliveryProvider:
      input.deliveryProvider === "Default" ||
      input.deliveryProvider === "SendGrid" ||
      input.deliveryProvider === "Twilio" ||
      input.deliveryProvider === "SES"
        ? input.deliveryProvider
        : "Default",
    recurrence:
      input.recurrence === "daily" || input.recurrence === "weekly" ? input.recurrence : "none",
    expireAfterDays:
      input.expireAfterDays == null ? null : toNumber(input.expireAfterDays, 0),
    sendCopyToMyself: Boolean(input.sendCopyToMyself),
    metrics: {
      delivered: toNumber(metricsRaw.delivered, 0),
      deliveredPercent: toNumber(metricsRaw.deliveredPercent, 0),
      openedPercent: toNumber(metricsRaw.openedPercent, 0),
      clickedPercent: toNumber(metricsRaw.clickedPercent, 0),
      failed: toNumber(metricsRaw.failed, 0),
    },
    targetEstimate: toNumber(input.targetEstimate, 0),
  };
}

// ── List / Read ──

export async function listNotifications(filters: NotificationFilters = {}): Promise<NotificationItem[]> {
  const { items } = await get<{ items?: Array<Partial<NotificationItem> & Record<string, unknown>> }>("/admin/notifications", {
    status: filters.status && filters.status !== "All" ? filters.status : undefined,
    audience: filters.audience && filters.audience !== "All" ? filters.audience : undefined,
    channel: filters.channel && filters.channel !== "All" ? filters.channel : undefined,
    highFailureOnly: filters.highFailureOnly ? "true" : undefined,
    minFailed: typeof filters.minFailed === "number" ? String(filters.minFailed) : undefined,
  });
  return (items ?? []).map((item) => normalizeNotificationItem(item));
}

export async function getNotificationRetryHealth(
  opts: { windowHours?: number; minFailed?: number } = {}
): Promise<NotificationRetryHealth> {
  return get<NotificationRetryHealth>("/admin/notifications/retry-health", {
    windowHours: typeof opts.windowHours === "number" ? String(opts.windowHours) : undefined,
    minFailed: typeof opts.minFailed === "number" ? String(opts.minFailed) : undefined,
  });
}

export async function getNotificationFailureSummary(
  notificationId: string
): Promise<NotificationFailureSummary> {
  return get<NotificationFailureSummary>(`/admin/notifications/${notificationId}/failure-summary`);
}

export async function getNotificationById(id: string): Promise<NotificationItem | null> {
  try {
    const { notification } = await get<{ notification?: Partial<NotificationItem> & Record<string, unknown> }>(
      `/admin/notifications/${id}`
    );
    return notification ? normalizeNotificationItem(notification) : null;
  } catch {
    return null;
  }
}

// ── Create / Update / Delete ──

export async function createNotification(payload: NotificationCreatePayload): Promise<NotificationItem> {
  const { notification } = await post<{ notification: Partial<NotificationItem> & Record<string, unknown> }>(
    "/admin/notifications",
    {
    subject: payload.subject,
    body: payload.body,
    audience: payload.audience,
    targetType: payload.targetType,
    channels: payload.channels,
    scheduledAt: payload.sendMode === "schedule" ? payload.scheduledAt : undefined,
    groupIds: payload.groupIds,
    userIds: payload.userIds,
    attachments: payload.attachments,
    emailTemplate: payload.emailTemplate,
    smsTemplate: payload.smsTemplate,
    sendMode: payload.sendMode,
    timezone: payload.timezone,
    deliveryProvider: payload.deliveryProvider,
    recurrence: payload.recurrence,
    expireAfterDays: payload.expireAfterDays,
    sendCopyToMyself: payload.sendCopyToMyself,
    createdBy: payload.createdBy,
    }
  );
  return normalizeNotificationItem(notification);
}

export async function updateNotification(
  id: string,
  payload: Partial<Omit<NotificationItem, "id" | "createdAt">>
): Promise<NotificationItem> {
  const { notification } = await patch<{ notification: Partial<NotificationItem> & Record<string, unknown> }>(
    `/admin/notifications/${id}`,
    payload
  );
  return normalizeNotificationItem(notification);
}

export async function deleteNotification(id: string): Promise<void> {
  await del(`/admin/notifications/${id}`);
}

// ── Actions ──

export async function sendNow(id: string): Promise<NotificationItem> {
  const { notification } = await post<{ notification: Partial<NotificationItem> & Record<string, unknown> }>(
    `/admin/notifications/${id}/send`
  );
  return normalizeNotificationItem(notification);
}

export async function scheduleNotification(id: string, scheduledAt: string): Promise<NotificationItem> {
  return updateNotification(id, { status: "Scheduled", scheduledAt } as Partial<Omit<NotificationItem, "id" | "createdAt">>);
}

export async function cancelNotification(id: string): Promise<NotificationItem> {
  return updateNotification(id, { status: "Cancelled" } as Partial<Omit<NotificationItem, "id" | "createdAt">>);
}

export async function duplicateNotification(id: string): Promise<NotificationItem> {
  const original = await getNotificationById(id);
  if (!original) throw new Error("Notification not found.");
  const { notification } = await post<{ notification: NotificationItem }>("/admin/notifications", {
    subject: `${original.subject} (Copy)`,
    body: original.body,
    audience: original.audience,
    targetType: original.targetType,
    channels: original.channels,
    groupIds: original.groupIds,
    userIds: original.userIds,
    attachments: original.attachments,
    emailTemplate: original.emailTemplate,
    smsTemplate: original.smsTemplate,
    timezone: original.timezone,
    deliveryProvider: original.deliveryProvider,
    recurrence: original.recurrence,
    expireAfterDays: original.expireAfterDays,
    sendCopyToMyself: original.sendCopyToMyself,
    createdBy: original.createdBy,
  });
  return normalizeNotificationItem(notification as Partial<NotificationItem> & Record<string, unknown>);
}

export async function retryFailedNotification(id: string): Promise<NotificationItem> {
  const { notification } = await post<{ notification: Partial<NotificationItem> & Record<string, unknown> }>(
    `/admin/notifications/${id}/retry-failed`
  );
  return normalizeNotificationItem(notification);
}

// ── Recipients / Logs / Users / Groups ──

export async function listNotificationRecipients(
  notificationId: string
): Promise<NotificationRecipient[]> {
  const { items } = await get<{ items: NotificationRecipient[] }>(
    `/admin/notifications/${notificationId}/recipients`
  );
  return items;
}

/** Load delivery logs for a notification (GET /admin/notifications/:id/delivery-logs). */
export async function listNotificationLogs(
  notificationId: string
): Promise<NotificationDeliveryLog[]> {
  const items = await listNotificationDeliveryLogs(notificationId);
  return items.map((log, index) => ({
    id: log.id,
    notificationId: log.notificationId,
    timestamp: log.sentAt ?? log.createdAt,
    channel: log.channel as NotificationDeliveryLog["channel"],
    status: log.status === "sent" ? "success" : "failed",
    endpoint: "-",
    requestPayload: "-",
    responsePayload: log.errorMessage ?? "OK",
    attempt: index + 1,
  }));
}

export async function listNotificationUsers(): Promise<NotificationUser[]> {
  const { items } = await get<{ items: NotificationUser[] }>("/admin/notifications/users");
  return items;
}

export async function listNotificationGroups(): Promise<NotificationGroup[]> {
  const { items } = await get<{ items: NotificationGroup[] }>("/admin/notifications/groups");
  return items;
}

// ── P0: Notification templates (backend: GET/POST /admin/notifications/templates, etc.) ──

export interface NotificationTemplateItem {
  id: string;
  name: string;
  channel: string;
  subjectTemplate: string;
  bodyTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export async function listNotificationTemplates(): Promise<NotificationTemplateItem[]> {
  const { items } = await get<{ items: NotificationTemplateItem[] }>("/admin/notifications/templates");
  return items;
}

export async function getNotificationTemplate(id: string): Promise<NotificationTemplateItem | null> {
  try {
    const { template } = await get<{ template: NotificationTemplateItem }>(`/admin/notifications/templates/${id}`);
    return template;
  } catch {
    return null;
  }
}

export async function createNotificationTemplate(data: {
  name: string;
  channel: "email" | "sms" | "in-app";
  subjectTemplate?: string;
  bodyTemplate: string;
}): Promise<NotificationTemplateItem> {
  const { template } = await post<{ template: NotificationTemplateItem }>("/admin/notifications/templates", data);
  return template;
}

export async function updateNotificationTemplate(
  id: string,
  data: Partial<Pick<NotificationTemplateItem, "name" | "channel" | "subjectTemplate" | "bodyTemplate">>
): Promise<NotificationTemplateItem> {
  const { template } = await patch<{ template: NotificationTemplateItem }>(`/admin/notifications/templates/${id}`, data);
  return template;
}

export interface NotificationDeliveryLogItem {
  id: string;
  notificationId: string;
  channel: string;
  status: string;
  recipientRef: string;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export async function listNotificationDeliveryLogs(notificationId: string): Promise<NotificationDeliveryLogItem[]> {
  const { items } = await get<{ items: NotificationDeliveryLogItem[] }>(`/admin/notifications/${notificationId}/delivery-logs`);
  return items;
}
