/**
 * README:
 * This page uses the real notifications API in `src/lib/notifications-api.ts`.
 * Keep these function signatures when swapping to real backend APIs.
 */
import { useEffect, useMemo, useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format, formatDistanceToNowStrict, isAfter, startOfDay, subDays } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  cancelNotification,
  createNotification,
  deleteNotification,
  duplicateNotification,
  getNotificationById,
  getNotificationFailureSummary,
  getNotificationRetryHealth,
  listNotificationGroups,
  listNotificationLogs,
  listNotificationRecipients,
  listNotifications,
  listNotificationUsers,
  retryFailedNotification,
  scheduleNotification,
  sendNow,
  updateNotification,
} from "@/lib/notifications-api";
import type {
  NotificationAudience,
  NotificationChannel,
  NotificationCreatePayload,
  NotificationDeliveryLog,
  NotificationFailureSummary,
  NotificationFilters,
  NotificationGroup,
  NotificationItem,
  NotificationRecipient,
  NotificationRetryHealth,
  NotificationStatus,
  NotificationTargetType,
  NotificationUser,
} from "@/lib/notifications-types";

type DateRangeFilter = "last7" | "last30" | "custom";
type ChannelFilter = "All" | "InApp" | "Email" | "SMS" | "Multi";
type BulkActionType = "duplicate" | "cancel" | "delete" | "export" | "to-draft" | null;

interface NotificationFilterForm {
  status: "All" | NotificationStatus;
  audience: "All" | NotificationAudience;
  channel: ChannelFilter;
  dateRange: DateRangeFilter;
  createdFrom: string;
  createdTo: string;
  query: string;
  groupId: string;
  examFilter: "All" | "Only assigned to exam" | "Completed exam";
  createdBy: string;
  hasAttachment: "Any" | "Yes" | "No";
  deliveryProvider: "All" | "Default" | "SendGrid" | "Twilio" | "SES";
}

interface NotificationFormState {
  subject: string;
  body: string;
  attachments: string[];
  audience: NotificationAudience;
  targetType: NotificationTargetType;
  groupIds: string[];
  userIds: string[];
  examFilter: "All" | "Only assigned to exam" | "Completed exam";
  channels: NotificationChannel[];
  emailTemplate: string;
  smsTemplate: string;
  sendCopyToMyself: boolean;
  sendMode: "now" | "schedule" | "draft";
  scheduleDate: Date | undefined;
  scheduleTime: string;
  timezone: string;
  recurrence: "none" | "daily" | "weekly";
  expireAfterDays: string;
  deliveryProvider: "Default" | "SendGrid" | "Twilio" | "SES";
}

const toBoolean = (value: CheckedState) => value === true;

const initialFilters: NotificationFilterForm = {
  status: "All",
  audience: "All",
  channel: "All",
  dateRange: "last7",
  createdFrom: "",
  createdTo: "",
  query: "",
  groupId: "",
  examFilter: "All",
  createdBy: "",
  hasAttachment: "Any",
  deliveryProvider: "All",
};

const createInitialForm = (): NotificationFormState => ({
  subject: "",
  body: "",
  attachments: [],
  audience: "Candidates",
  targetType: "all",
  groupIds: [],
  userIds: [],
  examFilter: "All",
  channels: ["in-app"],
  emailTemplate: "",
  smsTemplate: "",
  sendCopyToMyself: false,
  sendMode: "draft",
  scheduleDate: undefined,
  scheduleTime: "10:00",
  timezone: "Asia/Kathmandu",
  recurrence: "none",
  expireAfterDays: "",
  deliveryProvider: "Default",
});

function statusVariant(status: NotificationStatus) {
  if (status === "Sent") return "success-light";
  if (status === "Scheduled" || status === "Sending") return "warning-light";
  if (status === "Failed") return "danger-light";
  if (status === "Cancelled") return "secondary";
  return "outline";
}

function audienceVariant(audience: NotificationAudience) {
  if (audience === "Both") return "default";
  if (audience === "Teachers") return "secondary";
  return "outline";
}

function formatWhen(value: string | null) {
  if (!value) return "Now";
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

function relativeTime(value: string) {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

function filterToApi(form: NotificationFilterForm): NotificationFilters {
  return {
    status: form.status,
    audience: form.audience,
    channel: form.channel,
    dateRange: form.dateRange,
    createdFrom: form.createdFrom || undefined,
    createdTo: form.createdTo || undefined,
    query: form.query || undefined,
    groupId: form.groupId || undefined,
    examFilter: form.examFilter,
    createdBy: form.createdBy || undefined,
    hasAttachment: form.hasAttachment,
    deliveryProvider: form.deliveryProvider,
  };
}

function targetLabel(item: NotificationItem, groupsById: Map<string, string>) {
  if (item.targetType === "all") return "All";
  if (item.targetType === "groups") {
    if (item.groupIds.length === 0) return "Selected Groups";
    if (item.groupIds.length === 1) return groupsById.get(item.groupIds[0]) ?? "Selected Group";
    return `${item.groupIds.length} groups`;
  }
  return `${item.userIds.length} selected users`;
}

function channelsLabel(item: NotificationItem) {
  if (item.channels.length > 1) return "Multi";
  if (item.channels.includes("email")) return "Email";
  if (item.channels.includes("sms")) return "SMS";
  return "InApp";
}

function combineScheduleDateTime(date: Date | undefined, time: string): string | null {
  if (!date) return null;
  const [hours, minutes] = time.split(":");
  const merged = new Date(date);
  merged.setHours(Number(hours || "0"), Number(minutes || "0"), 0, 0);
  return merged.toISOString();
}

const FALLBACK_METRICS = {
  delivered: 0,
  deliveredPercent: 0,
  openedPercent: 0,
  clickedPercent: 0,
  failed: 0,
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function metricsOf(item: NotificationItem | null | undefined) {
  const raw = item?.metrics;
  return {
    delivered: toFiniteNumber(raw?.delivered),
    deliveredPercent: toFiniteNumber(raw?.deliveredPercent),
    openedPercent: toFiniteNumber(raw?.openedPercent),
    clickedPercent: toFiniteNumber(raw?.clickedPercent),
    failed: toFiniteNumber(raw?.failed),
  };
}

function targetEstimateOf(item: NotificationItem | null | undefined) {
  return toFiniteNumber(item?.targetEstimate);
}

function exportNotificationsCsv(rows: NotificationItem[]) {
  const header = [
    "Subject",
    "Audience",
    "Channels",
    "Status",
    "Scheduled At",
    "Created By",
    "Created At",
    "Delivered %",
    "Open %",
    "Click %",
    "Failed #",
  ];
  const lines = rows.map((row) => [
    row.subject,
    row.audience,
    row.channels.join("|"),
    row.status,
    row.scheduledAt ?? "Now",
    row.createdBy,
    row.createdAt,
    `${metricsOf(row).deliveredPercent}`,
    `${metricsOf(row).openedPercent}`,
    `${metricsOf(row).clickedPercent}`,
    `${metricsOf(row).failed}`,
  ]);
  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "notifications.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { id: notificationIdParam } = useParams<{ id?: string }>();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [users, setUsers] = useState<NotificationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [retryHealth, setRetryHealth] = useState<NotificationRetryHealth | null>(null);

  const [filters, setFilters] = useState<NotificationFilterForm>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<NotificationFilters>(() => filterToApi(initialFilters));
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });

  const [bulkAction, setBulkAction] = useState<BulkActionType>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NotificationFormState>(createInitialForm());
  const [draftSaving, setDraftSaving] = useState(false);
  const [sendSaving, setSendSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [attachmentInput, setAttachmentInput] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<NotificationItem | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<NotificationRecipient[]>([]);
  const [detailLogs, setDetailLogs] = useState<NotificationDeliveryLog[]>([]);
  const [detailFailureSummary, setDetailFailureSummary] = useState<NotificationFailureSummary | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [recipientStatusFilter, setRecipientStatusFilter] = useState<"all" | "delivered" | "failed" | "pending">("all");
  const [logsFailedOnly, setLogsFailedOnly] = useState(false);
  const [logsChannelFilter, setLogsChannelFilter] = useState<"all" | "in-app" | "email" | "sms">("all");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);

  const filteredSelectableUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const byAudience = users.filter((user) => {
      if (form.audience === "Both") return true;
      if (form.audience === "Candidates") return user.role === "candidate";
      return user.role === "teacher";
    });
    if (!q) return byAudience;
    return byAudience.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.phone.toLowerCase().includes(q)
    );
  }, [users, userSearch, form.audience]);

  const selectedIds = useMemo(
    () => Object.entries(rowSelection).filter(([, selected]) => selected).map(([id]) => id),
    [rowSelection]
  );

  const counters = useMemo(() => {
    const total = notifications.length;
    const sent = notifications.filter((item) => item.status === "Sent").length;
    const scheduled = notifications.filter((item) => item.status === "Scheduled").length;
    const draft = notifications.filter((item) => item.status === "Draft").length;
    const failed = notifications.filter((item) => item.status === "Failed").length;
    const sentToday = notifications.filter(
      (item) => item.status === "Sent" && isAfter(new Date(item.updatedAt), startOfDay(new Date()))
    ).length;
    const unreadInApp = notifications.reduce(
      (sum, item) =>
        sum +
        (item.channels.includes("in-app")
          ? Math.max(0, targetEstimateOf(item) - metricsOf(item).delivered)
          : 0),
      0
    );
    return { total, sent, scheduled, draft, failed, sentToday, unreadInApp };
  }, [notifications]);

  const notifySuccess = (message: string) => toast({ title: "Success", description: message });
  const notifyError = (message: string) =>
    toast({ variant: "destructive", title: "Action failed", description: message });

  const refresh = () => setRefreshKey((prev) => prev + 1);

  const loadReferences = async () => {
    try {
      const [groupRows, userRows] = await Promise.all([listNotificationGroups(), listNotificationUsers()]);
      setGroups(groupRows);
      setUsers(userRows);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Unable to load groups and users.");
    }
  };

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listNotifications(appliedFilters);
      setNotifications(rows);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load notifications.";
      setError(message);
      notifyError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadRetryHealth = async () => {
    try {
      const data = await getNotificationRetryHealth({ windowHours: 24, minFailed: 3 });
      setRetryHealth(data);
    } catch {
      setRetryHealth(null);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const [item, recipients, logs, failureSummary] = await Promise.all([
        getNotificationById(id),
        listNotificationRecipients(id),
        listNotificationLogs(id),
        getNotificationFailureSummary(id),
      ]);
      if (!item) {
        notifyError("Notification not found.");
        navigate("/admin/notifications", { replace: true });
        return;
      }
      setDetailItem(item);
      setDetailRecipients(recipients);
      setDetailLogs(logs);
      setDetailFailureSummary(failureSummary);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Unable to load notification detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadReferences();
  }, []);

  useEffect(() => {
    void loadRows();
    void loadRetryHealth();
  }, [appliedFilters, refreshKey]);

  useEffect(() => {
    if (!notificationIdParam) {
      setDetailItem(null);
      setDetailRecipients([]);
      setDetailLogs([]);
      setDetailFailureSummary(null);
      return;
    }
    setDetailTab("overview");
    void loadDetail(notificationIdParam);
  }, [notificationIdParam, refreshKey]);

  const setFilterValue = <K extends keyof NotificationFilterForm>(key: K, value: NotificationFilterForm[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(createInitialForm());
    setAttachmentInput("");
    setUserSearch("");
    setDrawerOpen(true);
  };

  const openEditDrawer = (item: NotificationItem) => {
    const scheduleDate = item.scheduledAt ? new Date(item.scheduledAt) : undefined;
    const scheduleTime = scheduleDate ? format(scheduleDate, "HH:mm") : "10:00";
    setEditingId(item.id);
    setForm({
      subject: item.subject,
      body: item.body,
      attachments: [...item.attachments],
      audience: item.audience,
      targetType: item.targetType,
      groupIds: [...item.groupIds],
      userIds: [...item.userIds],
      examFilter: "All",
      channels: [...item.channels],
      emailTemplate: item.emailTemplate ?? "",
      smsTemplate: item.smsTemplate ?? "",
      sendCopyToMyself: item.sendCopyToMyself,
      sendMode: item.status === "Scheduled" ? "schedule" : item.status === "Sent" ? "now" : "draft",
      scheduleDate,
      scheduleTime,
      timezone: item.timezone,
      recurrence: item.recurrence,
      expireAfterDays: item.expireAfterDays ? String(item.expireAfterDays) : "",
      deliveryProvider: item.deliveryProvider,
    });
    setAttachmentInput("");
    setUserSearch("");
    setDrawerOpen(true);
  };

  const validateForm = (mode: "draft" | "schedule" | "now") => {
    if (!form.subject.trim()) return "Subject is required.";
    const usesBody = form.channels.includes("in-app") || form.channels.includes("email");
    if (usesBody && !form.body.trim()) return "Body is required for in-app/email channels.";
    if (form.channels.includes("sms") && form.body.length > 160) {
      return "SMS content exceeds 160 characters.";
    }
    if (form.channels.length === 0) return "Select at least one channel.";
    if (form.targetType === "groups" && form.groupIds.length === 0) {
      return "Select at least one group.";
    }
    if (form.targetType === "users" && form.userIds.length === 0) {
      return "Select at least one user.";
    }
    if (mode === "schedule") {
      const iso = combineScheduleDateTime(form.scheduleDate, form.scheduleTime);
      if (!iso) return "Select schedule date and time.";
      if (!isAfter(new Date(iso), new Date())) return "Scheduled time must be in the future.";
    }
    return null;
  };

  const buildPayload = (mode: "draft" | "schedule" | "now"): NotificationCreatePayload => ({
    subject: form.subject.trim(),
    body: form.body.trim(),
    audience: form.audience,
    targetType: form.targetType,
    groupIds: form.targetType === "groups" ? form.groupIds : [],
    userIds: form.targetType === "users" ? form.userIds : [],
    channels: form.channels,
    attachments: form.attachments,
    emailTemplate: form.emailTemplate || undefined,
    smsTemplate: form.smsTemplate || undefined,
    sendMode: mode,
    scheduledAt: mode === "schedule" ? combineScheduleDateTime(form.scheduleDate, form.scheduleTime) : null,
    timezone: form.timezone,
    deliveryProvider: form.deliveryProvider,
    recurrence: form.recurrence,
    expireAfterDays: form.expireAfterDays ? Number(form.expireAfterDays) : null,
    sendCopyToMyself: form.sendCopyToMyself,
    createdBy: "Admin",
  });

  const saveNotification = async (mode: "draft" | "schedule" | "now") => {
    const validationError = validateForm(mode);
    if (validationError) {
      notifyError(validationError);
      return;
    }
    const payload = buildPayload(mode);
    const isEdit = Boolean(editingId);
    if (mode === "draft") setDraftSaving(true);
    if (mode === "schedule" || mode === "now") setSendSaving(true);

    try {
      let entity: NotificationItem | null = null;
      if (isEdit && editingId) {
        entity = await updateNotification(editingId, {
          subject: payload.subject,
          body: payload.body,
          audience: payload.audience,
          targetType: payload.targetType,
          groupIds: payload.groupIds,
          userIds: payload.userIds,
          channels: payload.channels,
          attachments: payload.attachments,
          emailTemplate: payload.emailTemplate,
          smsTemplate: payload.smsTemplate,
          timezone: payload.timezone,
          recurrence: payload.recurrence,
          expireAfterDays: payload.expireAfterDays,
          sendCopyToMyself: payload.sendCopyToMyself,
          deliveryProvider: payload.deliveryProvider,
        });
      } else {
        entity = await createNotification(payload);
      }

      if (!entity) {
        throw new Error("Unable to persist notification.");
      }

      if (mode === "schedule") {
        await scheduleNotification(entity.id, payload.scheduledAt ?? new Date().toISOString());
        notifySuccess("Notification scheduled.");
      } else if (mode === "now") {
        await sendNow(entity.id);
        notifySuccess("Notification sent.");
      } else {
        notifySuccess("Draft saved.");
      }

      setDrawerOpen(false);
      setEditingId(null);
      setForm(createInitialForm());
      refresh();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Unable to save notification.");
    } finally {
      setDraftSaving(false);
      setSendSaving(false);
    }
  };

  const runRowAction = async (action: "duplicate" | "send-test" | "cancel" | "retry" | "delete", item: NotificationItem) => {
    try {
      if (action === "duplicate") {
        await duplicateNotification(item.id);
        notifySuccess("Notification duplicated.");
      } else if (action === "send-test") {
        notifySuccess(`Test notification queued for "${item.subject}".`);
      } else if (action === "cancel") {
        await cancelNotification(item.id);
        notifySuccess("Schedule cancelled.");
      } else if (action === "retry") {
        await retryFailedNotification(item.id);
        notifySuccess("Retry executed.");
      } else if (action === "delete") {
        setDeleteTargetId(item.id);
        setDeleteDialogOpen(true);
        return;
      }
      refresh();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Action failed.");
    }
  };

  const filteredDetailRecipients = useMemo(() => {
    if (recipientStatusFilter === "all") return detailRecipients;
    return detailRecipients.filter((row) => row.status === recipientStatusFilter);
  }, [detailRecipients, recipientStatusFilter]);

  const filteredDetailLogs = useMemo(() => {
    let rows = detailLogs;
    if (logsFailedOnly) rows = rows.filter((log) => log.status === "failed");
    if (logsChannelFilter !== "all") rows = rows.filter((log) => log.channel === logsChannelFilter);
    return rows;
  }, [detailLogs, logsFailedOnly, logsChannelFilter]);

  const columns = useMemo<ColumnDef<NotificationItem>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(toBoolean(value))}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(toBoolean(value))}
            aria-label={`Select ${row.original.subject}`}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "subject",
        header: "Title / Subject",
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">{row.original.subject}</p>
            <p className="text-xs text-slate-500">{row.original.body.slice(0, 72)}...</p>
          </div>
        ),
      },
      {
        accessorKey: "audience",
        header: "Audience",
        cell: ({ row }) => <Badge variant={audienceVariant(row.original.audience)}>{row.original.audience}</Badge>,
      },
      {
        id: "channels",
        header: "Channels",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.original.channels.includes("in-app") && <Badge variant="outline"><Bell className="mr-1 h-3 w-3" />InApp</Badge>}
            {row.original.channels.includes("email") && <Badge variant="outline"><Mail className="mr-1 h-3 w-3" />Email</Badge>}
            {row.original.channels.includes("sms") && <Badge variant="outline"><MessageSquare className="mr-1 h-3 w-3" />SMS</Badge>}
          </div>
        ),
      },
      {
        id: "target",
        header: "Target",
        cell: ({ row }) => <span className="text-sm text-slate-600">{targetLabel(row.original, groupsById)}</span>,
      },
      {
        id: "scheduledAt",
        header: "Scheduled At",
        accessorFn: (row) => row.scheduledAt ?? "",
        cell: ({ row }) => <span className="text-sm text-slate-600">{formatWhen(row.original.scheduledAt)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>,
      },
      { accessorKey: "createdBy", header: "Created By" },
      {
        id: "metrics",
        header: "Metrics",
        cell: ({ row }) => (
          <div className="text-xs text-slate-600">
            <p>D {metricsOf(row.original).deliveredPercent}%</p>
            <p>O {metricsOf(row.original).openedPercent}%</p>
            <p>C {metricsOf(row.original).clickedPercent}% - F {metricsOf(row.original).failed}</p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/admin/notifications/${item.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {(item.status === "Draft" || item.status === "Scheduled") && (
                  <DropdownMenuItem onClick={() => openEditDrawer(item)}>Edit</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => void runRowAction("duplicate", item)}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void runRowAction("send-test", item)}>Send Test</DropdownMenuItem>
                {item.status === "Scheduled" && (
                  <DropdownMenuItem onClick={() => void runRowAction("cancel", item)}>Cancel Schedule</DropdownMenuItem>
                )}
                {item.status === "Failed" && (
                  <DropdownMenuItem onClick={() => void runRowAction("retry", item)}>Retry Failed</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => exportNotificationsCsv([item])}>Export Recipients</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => void runRowAction("delete", item)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [groupsById, navigate]
  );

  const table = useReactTable({
    data: notifications,
    columns,
    state: { sorting, rowSelection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  const pageRows = table.getRowModel().rows;

  const applyBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) {
      notifyError("Select one or more notifications first.");
      return;
    }
    setBulkSubmitting(true);
    try {
      if (bulkAction === "duplicate") {
        for (const id of selectedIds) await duplicateNotification(id);
        notifySuccess(`Duplicated ${selectedIds.length} notifications.`);
      } else if (bulkAction === "cancel") {
        for (const id of selectedIds) {
          const row = notifications.find((item) => item.id === id);
          if (row?.status === "Scheduled") {
            await cancelNotification(id);
          }
        }
        notifySuccess("Schedules cancelled.");
      } else if (bulkAction === "delete") {
        for (const id of selectedIds) await deleteNotification(id);
        notifySuccess("Notifications deleted.");
      } else if (bulkAction === "export") {
        exportNotificationsCsv(notifications.filter((item) => selectedIds.includes(item.id)));
        notifySuccess("Export complete.");
      } else if (bulkAction === "to-draft") {
        for (const id of selectedIds) await updateNotification(id, { status: "Draft", scheduledAt: null });
        notifySuccess("Status changed to Draft.");
      }
      setBulkAction(null);
      setRowSelection({});
      refresh();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Bulk action failed.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteSubmitting(true);
    try {
      await deleteNotification(deleteTargetId);
      notifySuccess("Notification deleted.");
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      if (notificationIdParam === deleteTargetId) {
        navigate("/admin/notifications");
      }
      refresh();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Unable to delete notification.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage announcements sent to candidates and teachers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openCreateDrawer}>
            <Plus className="h-4 w-4" />
            New Notification
          </Button>
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            Templates
          </Button>
          <Button variant="outline" onClick={() => exportNotificationsCsv(notifications)}>
            Export
          </Button>
        </div>
      </div>

      {notificationIdParam && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detail View Active</CardTitle>
            <CardDescription>Notification ID: {notificationIdParam}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setDetailTab("logs")}>
              Open Delivery Logs
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admin/notifications", { replace: true })}>
              Close Detail
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base text-emerald-900">Delivery verification</CardTitle>
              <CardDescription>
                Last {retryHealth?.windowHours ?? 24}h delivery attempts (tenant-scoped). Per-notification delivery logs and at-risk list below.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { void loadRetryHealth(); }}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
          <div className="rounded-md border border-emerald-200 bg-white p-3">
            <span className="text-xs font-medium text-slate-500">Sent</span>
            <p className="text-xl font-semibold text-emerald-700">{retryHealth?.totals.sent ?? "—"}</p>
          </div>
          <div className="rounded-md border border-rose-200 bg-white p-3">
            <span className="text-xs font-medium text-slate-500">Failed</span>
            <p className="text-xl font-semibold text-rose-700">{retryHealth?.totals.failed ?? "—"}</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-white p-3">
            <span className="text-xs font-medium text-slate-500">Retried</span>
            <p className="text-xl font-semibold text-amber-700">{retryHealth?.totals.retried ?? "—"}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-3">
            <span className="text-xs font-medium text-slate-500">At risk</span>
            <p className="text-xl font-semibold text-slate-700">{retryHealth?.totals.atRiskNotifications ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle>{counters.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Sent</CardDescription><CardTitle className="text-emerald-700">{counters.sent}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Scheduled</CardDescription><CardTitle className="text-blue-700">{counters.scheduled}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Draft</CardDescription><CardTitle className="text-slate-700">{counters.draft}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Failed</CardDescription><CardTitle className="text-rose-700">{counters.failed}</CardTitle></CardHeader></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Sent Today</CardDescription><CardTitle>{counters.sentToday}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Scheduled</CardDescription><CardTitle>{counters.scheduled}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Unread In-app</CardDescription><CardTitle>{counters.unreadInApp}</CardTitle></CardHeader></Card>
      </div>

      <Card className="border-rose-200 bg-rose-50/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base text-rose-900">At Risk Notifications</CardTitle>
              <CardDescription>
                Last {retryHealth?.windowHours ?? 24}h • failed {'>='} {retryHealth?.minFailed ?? 3}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                setAppliedFilters((prev) => ({ ...prev, highFailureOnly: true, minFailed: 3 }))
              }
            >
              Show At Risk
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-md border bg-white p-2 text-sm">Failed: {retryHealth?.totals.failed ?? 0}</div>
            <div className="rounded-md border bg-white p-2 text-sm">Retried: {retryHealth?.totals.retried ?? 0}</div>
            <div className="rounded-md border bg-white p-2 text-sm">Max Retry Hit: {retryHealth?.totals.maxRetryReached ?? 0}</div>
            <div className="rounded-md border bg-white p-2 text-sm">At Risk: {retryHealth?.totals.atRiskNotifications ?? 0}</div>
          </div>
          {(retryHealth?.topAtRisk?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-600">No high-failure notifications in the selected window.</p>
          ) : (
            <div className="space-y-1">
              {retryHealth!.topAtRisk.map((row) => (
                <button
                  key={row.notificationId}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => navigate(`/admin/notifications/${row.notificationId}`)}
                >
                  <span className="text-sm font-medium text-slate-800">{row.subject}</span>
                  <span className="text-xs text-rose-700">
                    F {row.failed} • R {row.retried} • D {row.deliveredPercent}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-2 xl:grid-cols-6">
            <Select value={filters.status} onValueChange={(value) => setFilterValue("status", value as NotificationFilterForm["status"])}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Sending">Sending</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.audience} onValueChange={(value) => setFilterValue("audience", value as NotificationFilterForm["audience"])}>
              <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Candidates">Candidates</SelectItem>
                <SelectItem value="Teachers">Teachers</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.channel} onValueChange={(value) => setFilterValue("channel", value as ChannelFilter)}>
              <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="InApp">In-app</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="Multi">Multi</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value) => setFilterValue("dateRange", value as DateRangeFilter)}>
              <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last7">Last 7 days</SelectItem>
                <SelectItem value="last30">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Search subject, keyword, creator..."
              value={filters.query}
              onChange={(event) => setFilterValue("query", event.target.value)}
            />

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setAppliedFilters(filterToApi(filters))}>
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button variant="outline" onClick={() => setMoreFiltersOpen(true)}>
                More Filters
              </Button>
            </div>
          </div>

          {filters.dateRange === "custom" && (
            <div className="grid gap-2 md:grid-cols-3">
              <Input type="date" value={filters.createdFrom} onChange={(e) => setFilterValue("createdFrom", e.target.value)} />
              <Input type="date" value={filters.createdTo} onChange={(e) => setFilterValue("createdTo", e.target.value)} />
              <Button
                variant="outline"
                onClick={() => {
                  setFilterValue("createdFrom", "");
                  setFilterValue("createdTo", "");
                  setAppliedFilters(filterToApi({ ...filters, createdFrom: "", createdTo: "" }));
                }}
              >
                Reset custom range
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/60">
          <CardContent className="flex flex-wrap items-center gap-2 pt-5">
            <span className="mr-1 text-sm font-medium text-blue-900">{selectedIds.length} selected</span>
            <Button variant="outline" onClick={() => setBulkAction("duplicate")}><Copy className="h-4 w-4" />Duplicate</Button>
            <Button variant="outline" onClick={() => setBulkAction("cancel")}>Cancel Schedule</Button>
            <Button variant="outline" onClick={() => setBulkAction("to-draft")}>To Draft</Button>
            <Button variant="outline" onClick={() => setBulkAction("export")}>Export</Button>
            <Button variant="outline" onClick={() => setBulkAction("delete")}><Trash2 className="h-4 w-4" />Delete</Button>
            <Button variant="ghost" onClick={() => setRowSelection({})}>Clear</Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardContent className="pt-5">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="outline" onClick={() => void loadRows()}>Retry</Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-8 text-center">
              <Bell className="h-6 w-6 text-slate-500" />
              <p className="font-medium text-slate-700">No notifications found.</p>
              <p className="text-sm text-slate-500">Adjust your filters or create a new notification.</p>
              <Button onClick={openCreateDrawer}>
                <Plus className="h-4 w-4" />
                New Notification
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((group) => (
                      <TableRow key={group.id}>
                        {group.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getCanSort() && <ChevronDown className="h-3 w-3" />}
                              </button>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <div>
                  Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    notifications.length
                  )}{" "}
                  of {notifications.length} notifications
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>More Filters</SheetTitle>
            <SheetDescription>Filter by group, creator, attachment, and provider.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label>Group</Label>
              <Select value={filters.groupId || "all"} onValueChange={(value) => setFilterValue("groupId", value === "all" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Exam filter</Label>
              <Select value={filters.examFilter} onValueChange={(value) => setFilterValue("examFilter", value as NotificationFilterForm["examFilter"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Only assigned to exam">Only assigned to exam</SelectItem>
                  <SelectItem value="Completed exam">Completed exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Created by</Label>
              <Input value={filters.createdBy} onChange={(e) => setFilterValue("createdBy", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Has attachment</Label>
              <Select value={filters.hasAttachment} onValueChange={(value) => setFilterValue("hasAttachment", value as NotificationFilterForm["hasAttachment"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Any">Any</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Delivery provider</Label>
              <Select value={filters.deliveryProvider} onValueChange={(value) => setFilterValue("deliveryProvider", value as NotificationFilterForm["deliveryProvider"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Default">Default</SelectItem>
                  <SelectItem value="SendGrid">SendGrid</SelectItem>
                  <SelectItem value="Twilio">Twilio</SelectItem>
                  <SelectItem value="SES">SES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMoreFiltersOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  setAppliedFilters(filterToApi(filters));
                  setMoreFiltersOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(bulkAction)} onOpenChange={(open) => !open && setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Action</DialogTitle>
            <DialogDescription>
              Apply `{bulkAction ?? "action"}` to {selectedIds.length} notification(s).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>Cancel</Button>
            <Button onClick={() => void applyBulkAction()} disabled={bulkSubmitting}>
              {bulkSubmitting ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Notification</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleteSubmitting}>
              {deleteSubmitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
            <DialogDescription>Manage reusable Email and SMS templates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Email Templates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border p-2">Exam Reminder</div>
                <div className="rounded-md border p-2">Result Published</div>
                <div className="rounded-md border p-2">Payment Follow-up</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">SMS Templates</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="rounded-md border p-2">Exam starts in 30 mins</div>
                <div className="rounded-md border p-2">OTP Verification</div>
                <div className="rounded-md border p-2">Payment reminder</div>
              </CardContent>
            </Card>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Variables: <code>{"{{name}}"}</code>, <code>{"{{examName}}"}</code>, <code>{"{{scheduleTime}}"}</code>, <code>{"{{score}}"}</code>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Notification" : "New Notification"}</SheetTitle>
            <SheetDescription>Create, target, schedule, and deliver notifications.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">1) Basics</h3>
              <div className="grid gap-2">
                <Label>Subject*</Label>
                <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Message body*</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm">B</Button>
                  <Button type="button" variant="outline" size="sm">I</Button>
                  <Button type="button" variant="outline" size="sm">List</Button>
                </div>
                <Textarea
                  className="min-h-28"
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                />
                {form.channels.includes("sms") && (
                  <p className={cn("text-xs", form.body.length > 160 ? "text-red-600" : "text-slate-500")}>
                    SMS characters: {form.body.length}/160
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Attachments (UI-only)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type file name and add"
                    value={attachmentInput}
                    onChange={(e) => setAttachmentInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!attachmentInput.trim()) return;
                      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, attachmentInput.trim()] }));
                      setAttachmentInput("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.attachments.map((file) => (
                    <Badge key={file} variant="outline" className="gap-1">
                      {file}
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((x) => x !== file) }))}
                        aria-label={`Remove ${file}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">2) Audience & Targeting</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["Candidates", "Teachers", "Both"] as NotificationAudience[]).map((audience) => (
                  <button
                    key={audience}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      form.audience === audience ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"
                    )}
                    onClick={() => setForm((prev) => ({ ...prev, audience, userIds: [] }))}
                  >
                    {audience}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { key: "all", label: "All users in audience" },
                  { key: "groups", label: "Selected Groups" },
                  { key: "users", label: form.audience === "Candidates" ? "Selected Candidates" : form.audience === "Teachers" ? "Selected Teachers" : "Selected Users" },
                ] as Array<{ key: NotificationTargetType; label: string }>).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      form.targetType === option.key ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"
                    )}
                    onClick={() => setForm((prev) => ({ ...prev, targetType: option.key }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {form.targetType === "groups" && (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {groups.map((group) => (
                    <label key={group.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{group.name}</span>
                      <Checkbox
                        checked={form.groupIds.includes(group.id)}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            groupIds: toBoolean(checked)
                              ? prev.groupIds.includes(group.id)
                                ? prev.groupIds
                                : [...prev.groupIds, group.id]
                              : prev.groupIds.filter((id) => id !== group.id),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {form.targetType === "users" && (
                <div className="space-y-2 rounded-md border p-3">
                  <Input placeholder="Search candidates/teachers..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                  <div className="max-h-44 space-y-2 overflow-y-auto">
                    {filteredSelectableUsers.map((user) => (
                      <label key={user.id} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-slate-50">
                        <div>
                          <p className="text-sm">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        <Checkbox
                          checked={form.userIds.includes(user.id)}
                          onCheckedChange={(checked) =>
                            setForm((prev) => ({
                              ...prev,
                              userIds: toBoolean(checked)
                                ? prev.userIds.includes(user.id)
                                  ? prev.userIds
                                  : [...prev.userIds, user.id]
                                : prev.userIds.filter((id) => id !== user.id),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Exam participation</Label>
                  <Select value={form.examFilter} onValueChange={(value) => setForm((prev) => ({ ...prev, examFilter: value as NotificationFormState["examFilter"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Only assigned to exam">Only assigned to exam</SelectItem>
                      <SelectItem value="Completed exam">Completed exam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Group filter</Label>
                  <Select value={form.groupIds[0] ?? "all"} onValueChange={(value) => setForm((prev) => ({ ...prev, groupIds: value === "all" ? [] : [value] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All groups</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">3) Channels</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { key: "in-app", label: "In-app notification" },
                  { key: "email", label: "Email" },
                  { key: "sms", label: "SMS" },
                ] as Array<{ key: NotificationChannel; label: string }>).map((option) => (
                  <label key={option.key} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm">{option.label}</span>
                    <Checkbox
                      checked={form.channels.includes(option.key)}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          channels: toBoolean(checked)
                            ? prev.channels.includes(option.key)
                              ? prev.channels
                              : [...prev.channels, option.key]
                            : prev.channels.filter((channel) => channel !== option.key),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Email template</Label>
                  <Select value={form.emailTemplate || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, emailTemplate: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="Exam Reminder">Exam Reminder</SelectItem>
                      <SelectItem value="Result Published">Result Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>SMS template</Label>
                  <Select value={form.smsTemplate || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, smsTemplate: value === "none" ? "" : value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="Exam starts in 30 mins">Exam starts in 30 mins</SelectItem>
                      <SelectItem value="Payment reminder">Payment reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3">
                <Switch checked={form.sendCopyToMyself} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, sendCopyToMyself: checked }))} />
                <span className="text-sm">Send a copy to myself</span>
              </label>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">4) Scheduling</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={cn("rounded-md border px-3 py-2 text-sm", form.sendMode === "now" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200")}
                  onClick={() => setForm((prev) => ({ ...prev, sendMode: "now" }))}
                >
                  Send now
                </button>
                <button
                  type="button"
                  className={cn("rounded-md border px-3 py-2 text-sm", form.sendMode === "schedule" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200")}
                  onClick={() => setForm((prev) => ({ ...prev, sendMode: "schedule" }))}
                >
                  Schedule
                </button>
              </div>
              {form.sendMode === "schedule" && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.scheduleDate ? format(form.scheduleDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.scheduleDate}
                        onSelect={(date) => setForm((prev) => ({ ...prev, scheduleDate: date }))}
                        disabled={(date) => date < subDays(new Date(), 1)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={form.scheduleTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduleTime: e.target.value }))}
                  />
                  <Select value={form.timezone} onValueChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kathmandu">Asia/Kathmandu</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Recurrence</Label>
                  <Select value={form.recurrence} onValueChange={(value) => setForm((prev) => ({ ...prev, recurrence: value as NotificationFormState["recurrence"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Expire after (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Optional"
                    value={form.expireAfterDays}
                    onChange={(e) => setForm((prev) => ({ ...prev, expireAfterDays: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-blue-900">5) Review</h3>
              <div className="text-sm text-blue-900">
                <p><strong>Subject:</strong> {form.subject || "Untitled"}</p>
                <p><strong>Snippet:</strong> {form.body.slice(0, 80) || "No body yet"}</p>
                <p><strong>Audience:</strong> {form.audience} - <strong>Target:</strong> {form.targetType}</p>
                <p><strong>Channels:</strong> {form.channels.join(", ") || "None"}</p>
                <p><strong>Schedule:</strong> {form.sendMode === "schedule" ? `${form.scheduleDate ? format(form.scheduleDate, "PPP") : "No date"} ${form.scheduleTime}` : "Now / Draft"}</p>
              </div>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => void saveNotification("draft")} disabled={draftSaving}>
              {draftSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={() => void saveNotification(form.sendMode === "schedule" ? "schedule" : "now")}
              disabled={sendSaving}
            >
              {sendSaving ? "Processing..." : form.sendMode === "schedule" ? "Schedule" : "Send Now"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(notificationIdParam)}
        onOpenChange={(open) => {
          if (!open) navigate("/admin/notifications");
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Notification Details</SheetTitle>
            <SheetDescription>Track delivery status, recipients, and logs.</SheetDescription>
          </SheetHeader>

          {detailLoading || !detailItem ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <Card>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-800">{detailItem.subject}</h3>
                      <p className="text-sm text-slate-600">{detailItem.body.slice(0, 120)}...</p>
                    </div>
                    <Badge variant={statusVariant(detailItem.status)}>{detailItem.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Scheduled: {formatWhen(detailItem.scheduledAt)}</span>
                    <span>Created by {detailItem.createdBy}</span>
                    <span>{relativeTime(detailItem.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void runRowAction("duplicate", detailItem)}>Duplicate</Button>
                    <Button variant="outline" onClick={() => setDetailTab("logs")}>Open Delivery Logs</Button>
                    {(detailItem.status === "Draft" || detailItem.status === "Scheduled") && (
                      <Button variant="outline" onClick={() => openEditDrawer(detailItem)}>Edit</Button>
                    )}
                    {detailItem.status === "Scheduled" && (
                      <Button variant="outline" onClick={() => void runRowAction("cancel", detailItem)}>Cancel schedule</Button>
                    )}
                    {detailItem.status === "Failed" && (
                      <Button variant="outline" onClick={() => void runRowAction("retry", detailItem)}>Retry failed</Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="recipients">Recipients</TabsTrigger>
                  <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Target</CardDescription><CardTitle>{targetLabel(detailItem, groupsById)}</CardTitle></CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Channels</CardDescription><CardTitle>{channelsLabel(detailItem)}</CardTitle></CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Delivered</CardDescription><CardTitle className="text-emerald-700">{metricsOf(detailItem).deliveredPercent}%</CardTitle></CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Failed</CardDescription><CardTitle className="text-rose-700">{metricsOf(detailItem).failed}</CardTitle></CardHeader>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="recipients">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Recipients</CardTitle>
                        <Select value={recipientStatusFilter} onValueChange={(value) => setRecipientStatusFilter(value as typeof recipientStatusFilter)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email / Phone</TableHead>
                              <TableHead>Channel</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Timestamp</TableHead>
                              <TableHead>Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDetailRecipients.length === 0 ? (
                              <TableRow><TableCell colSpan={6} className="text-center text-sm text-slate-500">No recipients.</TableCell></TableRow>
                            ) : (
                              filteredDetailRecipients.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell>{row.name}</TableCell>
                                  <TableCell className="text-xs">{row.email}<br />{row.phone}</TableCell>
                                  <TableCell>{row.channel}</TableCell>
                                  <TableCell>
                                    <Badge variant={row.status === "delivered" ? "success-light" : row.status === "failed" ? "danger-light" : "secondary"}>
                                      {row.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{row.timestamp ? formatWhen(row.timestamp) : "Pending"}</TableCell>
                                  <TableCell className="text-xs text-rose-600">{row.errorMessage ?? "-"}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="logs">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => void runRowAction("retry", detailItem)}>
                        Retry failed
                      </Button>
                      <div className="flex flex-wrap items-center gap-1.5 border-l pl-3">
                        <span className="text-xs font-medium text-slate-500">Logs:</span>
                        <button
                          type="button"
                          onClick={() => setLogsFailedOnly((prev) => !prev)}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                            logsFailedOnly
                              ? "bg-rose-100 text-rose-800 ring-1 ring-rose-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          Failed only
                        </button>
                        {(["all", "in-app", "email", "sms"] as const).map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => setLogsChannelFilter(ch)}
                            className={cn(
                              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                              logsChannelFilter === ch
                                ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            {ch === "all" ? "All" : ch === "in-app" ? "In-app" : ch.charAt(0).toUpperCase() + ch.slice(1)}
                          </button>
                        ))}
                        {(logsFailedOnly || logsChannelFilter !== "all") && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogsFailedOnly(false);
                              setLogsChannelFilter("all");
                            }}
                            className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Failure Breakdown</CardTitle>
                        <CardDescription>Grouped by channel and reason.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="rounded-md border bg-slate-50 p-2 text-sm">Failed: {detailFailureSummary?.totals.failed ?? 0}</div>
                          <div className="rounded-md border bg-slate-50 p-2 text-sm">Retried: {detailFailureSummary?.totals.retried ?? 0}</div>
                          <div className="rounded-md border bg-slate-50 p-2 text-sm">Sent: {detailFailureSummary?.totals.sent ?? 0}</div>
                        </div>
                        {(detailFailureSummary?.byChannel.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            {detailFailureSummary!.byChannel.map((row) => (
                              <div key={row.channel} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                                <span className="font-medium">{row.channel}</span>
                                <span>F {row.failed} • R {row.retried} • S {row.sent}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(detailFailureSummary?.topReasons.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-600">Top failure reasons</p>
                            {detailFailureSummary!.topReasons.map((row) => (
                              <div key={row.reason} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                                <span>{row.reason}</span>
                                <span>{row.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {filteredDetailLogs.length === 0 ? (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
                        {detailLogs.length === 0
                          ? "No delivery logs yet."
                          : "No logs match the current filter. Try adjusting Failed only or Channel."}
                      </p>
                    ) : (
                      filteredDetailLogs.map((log) => (
                        <Card key={log.id}>
                          <CardContent className="space-y-2 pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-medium">
                                {log.channel.toUpperCase()} attempt #{log.attempt}
                              </div>
                              <Badge variant={log.status === "success" ? "success-light" : "danger-light"}>
                                {log.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">{formatWhen(log.timestamp)} - {log.endpoint}</p>
                            <div className="grid gap-2 md:grid-cols-2">
                              <pre className="overflow-auto rounded-md bg-slate-50 p-2 text-xs">{log.requestPayload}</pre>
                              <pre className="overflow-auto rounded-md bg-slate-50 p-2 text-xs">{log.responsePayload}</pre>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="content">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Rendered Content Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{detailItem.body}</p>
                      <div className="flex flex-wrap gap-2">
                        {detailItem.channels.includes("in-app") && <Badge variant="outline">In-app</Badge>}
                        {detailItem.channels.includes("email") && <Badge variant="outline">Email</Badge>}
                        {detailItem.channels.includes("sms") && <Badge variant="outline">SMS</Badge>}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500">Attachments</p>
                        {detailItem.attachments.length === 0 ? (
                          <p className="text-xs text-slate-500">No attachments.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {detailItem.attachments.map((file) => (
                              <Badge key={file} variant="outline">{file}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
