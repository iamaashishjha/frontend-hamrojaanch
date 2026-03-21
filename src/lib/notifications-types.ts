export type NotificationStatus =
  | "Draft"
  | "Scheduled"
  | "Sending"
  | "Sent"
  | "Failed"
  | "Cancelled";

export type NotificationAudience = "Candidates" | "Teachers" | "Both";
export type NotificationChannel = "in-app" | "email" | "sms";
export type NotificationTargetType = "all" | "groups" | "users";

export interface NotificationMetrics {
  delivered: number;
  deliveredPercent: number;
  openedPercent: number;
  clickedPercent: number;
  failed: number;
}

export interface NotificationItem {
  id: string;
  subject: string;
  body: string;
  audience: NotificationAudience;
  targetType: NotificationTargetType;
  groupIds: string[];
  userIds: string[];
  channels: NotificationChannel[];
  status: NotificationStatus;
  scheduledAt: string | null;
  timezone: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attachments: string[];
  emailTemplate?: string;
  smsTemplate?: string;
  deliveryProvider: "Default" | "SendGrid" | "Twilio" | "SES";
  recurrence: "none" | "daily" | "weekly";
  expireAfterDays: number | null;
  sendCopyToMyself: boolean;
  metrics: NotificationMetrics;
  targetEstimate: number;
}

export interface NotificationUser {
  id: string;
  role: "candidate" | "teacher";
  name: string;
  email: string;
  phone: string;
  groupIds: string[];
}

export interface NotificationGroup {
  id: string;
  name: string;
}

export interface NotificationRecipient {
  id: string;
  notificationId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  channel: NotificationChannel;
  status: "delivered" | "failed" | "pending";
  timestamp: string | null;
  errorMessage?: string;
}

export interface NotificationDeliveryLog {
  id: string;
  notificationId: string;
  timestamp: string;
  channel: NotificationChannel;
  status: "success" | "failed";
  endpoint: string;
  requestPayload: string;
  responsePayload: string;
  attempt: number;
}

export interface NotificationFilters {
  status?: "All" | NotificationStatus;
  audience?: "All" | NotificationAudience;
  channel?: "All" | "InApp" | "Email" | "SMS" | "Multi";
  highFailureOnly?: boolean;
  minFailed?: number;
  dateRange?: "last7" | "last30" | "custom";
  createdFrom?: string;
  createdTo?: string;
  query?: string;
  groupId?: string;
  examFilter?: "All" | "Only assigned to exam" | "Completed exam";
  createdBy?: string;
  hasAttachment?: "Any" | "Yes" | "No";
  deliveryProvider?: "All" | "Default" | "SendGrid" | "Twilio" | "SES";
}

export interface NotificationRetryHealthItem {
  notificationId: string;
  subject: string;
  status: string;
  failed: number;
  retried: number;
  deliveredPercent: number;
  maxRetryReached: number;
  lastAttemptAt: string | null;
}

export interface NotificationRetryHealth {
  windowHours: number;
  minFailed: number;
  totals: {
    failed: number;
    retried: number;
    sent: number;
    maxRetryReached: number;
    atRiskNotifications: number;
  };
  topAtRisk: NotificationRetryHealthItem[];
}

export interface NotificationFailureReasonSummary {
  reason: string;
  count: number;
  channels: string[];
}

export interface NotificationChannelFailureSummary {
  channel: string;
  failed: number;
  retried: number;
  sent: number;
}

export interface NotificationFailureSummary {
  notificationId: string;
  totals: {
    failed: number;
    retried: number;
    sent: number;
  };
  byChannel: NotificationChannelFailureSummary[];
  topReasons: NotificationFailureReasonSummary[];
}

export interface NotificationCreatePayload {
  subject: string;
  body: string;
  audience: NotificationAudience;
  targetType: NotificationTargetType;
  groupIds: string[];
  userIds: string[];
  channels: NotificationChannel[];
  attachments: string[];
  emailTemplate?: string;
  smsTemplate?: string;
  sendMode: "now" | "schedule" | "draft";
  scheduledAt: string | null;
  timezone: string;
  deliveryProvider: "Default" | "SendGrid" | "Twilio" | "SES";
  recurrence: "none" | "daily" | "weekly";
  expireAfterDays: number | null;
  sendCopyToMyself: boolean;
  createdBy: string;
}

