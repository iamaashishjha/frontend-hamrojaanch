import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Plus, Search, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import "./IntegrationsPage.css";

type TabKey = "overview" | "webhooks" | "api-keys" | "email-sms" | "payments" | "logs";
type WebhookStatus = "All" | "Active" | "Disabled" | "Failed";
type EventFilter = "All Events" | "Exam Events" | "Result Events" | "Candidate Events";

interface WebhookRow {
  id: string;
  name: string;
  endpoint: string;
  events: string[];
  status: "Active" | "Disabled" | "Failed";
  lastDelivery: string;
  failures: number;
  secret: string;
}

interface ApiKeyRow {
  id: string;
  name: string;
  type: "Server" | "Client";
  created: string;
  lastUsed: string;
  status: "Active" | "Disabled";
}

interface LogRow {
  id: string;
  timestamp: string;
  source: "Webhook" | "API" | "Email" | "SMS";
  action: string;
  status: "Success" | "Failed";
  details: string;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "webhooks", label: "Webhooks" },
  { key: "api-keys", label: "API Keys" },
  { key: "email-sms", label: "Email & SMS" },
  { key: "payments", label: "Payments" },
  { key: "logs", label: "Logs" },
];

const webhookEvents = [
  "exam.created",
  "exam.completed",
  "result.published",
  "candidate.created",
  "candidate.verified",
];

const scopes = [
  "read:exams",
  "write:exams",
  "read:candidates",
  "write:candidates",
  "read:results",
  "manage:webhooks",
];

const generateSecret = () => `whsec_${Math.random().toString(36).slice(2, 18)}`;
const generateKey = () => `hj_live_${Math.random().toString(36).slice(2, 24)}`;

function webhookStatusBadge(status: WebhookRow["status"]) {
  if (status === "Active") return <Badge variant="success-light">Active</Badge>;
  if (status === "Disabled") return <Badge variant="secondary">Disabled</Badge>;
  return <Badge variant="danger-light">Failed</Badge>;
}

const defaultLogs: LogRow[] = [
  {
    id: "log-1",
    timestamp: "2026-02-09 10:13",
    source: "Webhook",
    action: "result.published",
    status: "Success",
    details: "Delivered in 223ms.",
  },
  {
    id: "log-2",
    timestamp: "2026-02-09 09:46",
    source: "API",
    action: "GET /api/v1/exams",
    status: "Success",
    details: "LMS Connector key used.",
  },
  {
    id: "log-3",
    timestamp: "2026-02-09 09:21",
    source: "Webhook",
    action: "candidate.created",
    status: "Failed",
    details: "Endpoint returned HTTP 500.",
  },
];

export default function IntegrationsPage() {
  const { settings } = useSiteSettings();
  const [tab, setTab] = useState<TabKey>("overview");
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState<WebhookStatus>("All");
  const [eventFilter, setEventFilter] = useState<EventFilter>("All Events");
  const [webhookSearch, setWebhookSearch] = useState("");
  const [logSource, setLogSource] = useState<"All" | "Webhook" | "API" | "Email" | "SMS">("All");
  const [logStatus, setLogStatus] = useState<"All" | "Success" | "Failed">("All");
  const [logSearch, setLogSearch] = useState("");

  const [showWebhookDrawer, setShowWebhookDrawer] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookRow[]>([
    {
      id: "wh-1",
      name: "HR Sync",
      endpoint: "https://app.example.com/hr-webhook",
      events: ["exam.created", "exam.completed", "candidate.created"],
      status: "Active",
      lastDelivery: "2 min ago",
      failures: 0,
      secret: generateSecret(),
    },
    {
      id: "wh-2",
      name: "CRM Sync",
      endpoint: "https://app.example.com/crm-sync",
      events: ["candidate.created", "result.published"],
      status: "Failed",
      lastDelivery: "1 hr ago",
      failures: 4,
      secret: generateSecret(),
    },
  ]);

  const [keys, setKeys] = useState<ApiKeyRow[]>([
    {
      id: "key-1",
      name: "LMS Connector",
      type: "Server",
      created: "2026-01-20",
      lastUsed: "2 mins ago",
      status: "Active",
    },
    {
      id: "key-2",
      name: "Export Client",
      type: "Client",
      created: "2025-12-19",
      lastUsed: "1 day ago",
      status: "Disabled",
    },
  ]);

  const [webhookForm, setWebhookForm] = useState({
    name: "",
    endpoint: "",
    events: ["exam.created"] as string[],
    method: "POST",
    contentType: "application/json",
    secret: generateSecret(),
    headers: "",
    retryPolicy: "Exponential (5 attempts)",
    active: true,
  });

  const [apiKeyForm, setApiKeyForm] = useState({
    name: "",
    scopes: ["read:exams"] as string[],
    expiry: "",
  });

  const [emailForm, setEmailForm] = useState({
    provider: "SMTP",
    host: "smtp.mailprovider.com",
    apiKey: "",
    connected: true,
  });

  const [smsForm, setSmsForm] = useState({
    gateway: "Twilio",
    accountId: "",
    token: "",
    connected: false,
  });

  const [paymentForm, setPaymentForm] = useState({
    provider: "Stripe",
    publicKey: "",
    secretKey: "",
    connected: false,
  });

  const logs = useMemo(() => defaultLogs, []);

  const notifySuccess = (text: string) => {
    setAlert({ type: "success", text });
    toast({ title: "Success", description: text });
  };

  const notifyError = (text: string) => {
    setAlert({ type: "error", text });
    toast({ variant: "destructive", title: "Error", description: text });
  };

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifySuccess(message);
    } catch {
      notifyError("Clipboard unavailable.");
    }
  };

  const webhookColumns: ColumnDef<WebhookRow>[] = useMemo(
    () => [
      { header: "Name", accessor: "name" },
      { header: "Endpoint", accessor: "endpoint" },
      {
        header: "Events",
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.events.slice(0, 3).map((eventName) => (
              <Badge key={eventName} variant="outline" className="text-xs font-normal">
                {eventName}
              </Badge>
            ))}
            {row.events.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{row.events.length - 3}
              </Badge>
            )}
          </div>
        ),
      },
      { header: "Status", cell: (row) => webhookStatusBadge(row.status) },
      { header: "Last Delivery", accessor: "lastDelivery" },
      { header: "Failures", accessor: "failures" },
      {
        header: "Actions",
        cell: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => notifySuccess(`Viewing ${row.name}`)}>
              View
            </Button>
            <Button size="sm" variant="outline" onClick={() => notifySuccess(`Editing ${row.name}`)}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggleWebhook(row.id)}>
              {row.status === "Disabled" ? "Enable" : "Disable"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => rotateSecret(row.id)}>
              Rotate
            </Button>
            <Button size="sm" variant="outline" onClick={() => notifySuccess("Test webhook sent.")}>
              Test
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteWebhook(row.id)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [webhooks]
  );

  const filteredWebhooks = useMemo(() => {
    return webhooks.filter((item) => {
      const matchStatus = statusFilter === "All" || item.status === statusFilter;
      const matchEvent =
        eventFilter === "All Events" ||
        (eventFilter === "Exam Events" && item.events.some((e) => e.startsWith("exam."))) ||
        (eventFilter === "Result Events" && item.events.some((e) => e.startsWith("result."))) ||
        (eventFilter === "Candidate Events" && item.events.some((e) => e.startsWith("candidate.")));
      const q = webhookSearch.trim().toLowerCase();
      const matchSearch =
        q.length === 0 || item.name.toLowerCase().includes(q) || item.endpoint.toLowerCase().includes(q);
      return matchStatus && matchEvent && matchSearch;
    });
  }, [eventFilter, statusFilter, webhookSearch, webhooks]);

  const filteredLogs = useMemo(() => {
    return logs.filter((row) => {
      const sourceOk = logSource === "All" || row.source === logSource;
      const statusOk = logStatus === "All" || row.status === logStatus;
      const q = logSearch.trim().toLowerCase();
      const searchOk =
        q.length === 0 ||
        row.action.toLowerCase().includes(q) ||
        row.details.toLowerCase().includes(q) ||
        row.source.toLowerCase().includes(q);
      return sourceOk && statusOk && searchOk;
    });
  }, [logSearch, logSource, logStatus, logs]);

  const saveWebhook = () => {
    if (!webhookForm.name.trim() || !webhookForm.endpoint.trim()) {
      notifyError("Webhook name and endpoint are required.");
      return;
    }
    if (!/^https?:\/\//.test(webhookForm.endpoint)) {
      notifyError("Endpoint must start with http:// or https://.");
      return;
    }
    setWebhooks((prev) => [
      {
        id: `wh-${Date.now()}`,
        name: webhookForm.name.trim(),
        endpoint: webhookForm.endpoint.trim(),
        events: webhookForm.events,
        status: webhookForm.active ? "Active" : "Disabled",
        lastDelivery: "Never",
        failures: 0,
        secret: webhookForm.secret,
      },
      ...prev,
    ]);
    setShowWebhookDrawer(false);
    setWebhookForm({
      name: "",
      endpoint: "",
      events: ["exam.created"],
      method: "POST",
      contentType: "application/json",
      secret: generateSecret(),
      headers: "",
      retryPolicy: "Exponential (5 attempts)",
      active: true,
    });
    notifySuccess("Webhook created.");
  };

  const saveApiKey = () => {
    if (!apiKeyForm.name.trim()) {
      notifyError("API key name is required.");
      return;
    }
    if (apiKeyForm.scopes.length === 0) {
      notifyError("Select at least one scope.");
      return;
    }
    const keyValue = generateKey();
    setKeys((prev) => [
      {
        id: `key-${Date.now()}`,
        name: apiKeyForm.name.trim(),
        type: "Server",
        created: new Date().toISOString().slice(0, 10),
        lastUsed: "Never",
        status: "Active",
      },
      ...prev,
    ]);
    setNewKeyVisible(keyValue);
    setShowApiKeyModal(false);
    setApiKeyForm({ name: "", scopes: ["read:exams"], expiry: "" });
    notifySuccess("API key generated. Copy it now.");
  };

  const toggleWebhook = (id: string) => {
    setWebhooks((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, status: row.status === "Disabled" ? "Active" : "Disabled" } : row
      )
    );
    notifySuccess("Webhook status updated.");
  };

  const rotateSecret = (id: string) => {
    setWebhooks((prev) =>
      prev.map((row) => (row.id === id ? { ...row, secret: generateSecret() } : row))
    );
    notifySuccess("Webhook secret rotated.");
  };

  const deleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((row) => row.id !== id));
    notifySuccess("Webhook deleted.");
  };

  const updateKeyStatus = (id: string) => {
    setKeys((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, status: row.status === "Active" ? "Disabled" : "Active" } : row
      )
    );
    notifySuccess("API key status updated.");
  };

  return (
    <div className="integrations-page">
      <div className="integrations-header">
        <h1>Integrations</h1>
        <p>Connect {settings.branding.siteName} with your tools and automate workflows.</p>
      </div>

      {alert && (
        <div className={`integration-alert ${alert.type}`}>
          <span>{alert.text}</span>
          <button type="button" onClick={() => setAlert(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="integrations-card">
        <div className="integration-tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? "active" : ""}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="integration-body">
          {tab === "overview" && (
            <div className="integration-overview">
              <article className="overview-card">
                <div className="overview-row">
                  <h3>Webhooks</h3>
                  <span className="status-dot healthy">Active</span>
                </div>
                <strong>{webhooks.filter((w) => w.status === "Active").length} active</strong>
                <p>Last delivery status: success</p>
                <button type="button" onClick={() => setTab("webhooks")}>
                  Manage
                </button>
              </article>
              <article className="overview-card">
                <div className="overview-row">
                  <h3>API Keys</h3>
                  <span className="status-dot healthy">Healthy</span>
                </div>
                <strong>{keys.filter((k) => k.status === "Active").length} active keys</strong>
                <p>Use scoped keys for integrations.</p>
                <button type="button" onClick={() => setTab("api-keys")}>
                  Manage
                </button>
              </article>
              <article className="overview-card">
                <div className="overview-row">
                  <h3>Email Provider</h3>
                  <span className={`status-dot ${emailForm.connected ? "healthy" : "warning"}`}>
                    {emailForm.connected ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <strong>{emailForm.provider}</strong>
                <p>SMTP/API provider status and tests.</p>
                <button type="button" onClick={() => setTab("email-sms")}>
                  Configure
                </button>
              </article>
              <article className="overview-card">
                <div className="overview-row">
                  <h3>SMS Gateway</h3>
                  <span className={`status-dot ${smsForm.connected ? "healthy" : "warning"}`}>
                    {smsForm.connected ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <strong>{smsForm.gateway}</strong>
                <p>Gateway credentials and test SMS.</p>
                <button type="button" onClick={() => setTab("email-sms")}>
                  Configure
                </button>
              </article>
              <article className="overview-card">
                <div className="overview-row">
                  <h3>Payment Gateway</h3>
                  <span className={`status-dot ${paymentForm.connected ? "healthy" : "warning"}`}>
                    {paymentForm.connected ? "Connected" : "Not Configured"}
                  </span>
                </div>
                <strong>{paymentForm.provider}</strong>
                <p>Payment webhooks and key config.</p>
                <button type="button" onClick={() => setTab("payments")}>
                  Configure
                </button>
              </article>
              <article className="overview-card">
                <div className="overview-row">
                  <h3>External Integrations</h3>
                  <span className="status-dot healthy">2 Enabled</span>
                </div>
                <strong>Zapier / LMS</strong>
                <p>Automation and LMS sync running.</p>
                <button type="button" onClick={() => setTab("logs")}>
                  View Logs
                </button>
              </article>
            </div>
          )}

          {tab === "webhooks" && (
            <div className="space-y-6">
              <PageHeader
                title="Webhooks"
                subtitle="Outbound event delivery to your endpoints. Manage endpoints and event subscriptions."
                actions={
                  <Button onClick={() => setShowWebhookDrawer(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Webhook
                  </Button>
                }
              />

              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="flex gap-2">
                    {(["All", "Active", "Disabled", "Failed"] as WebhookStatus[]).map((status) => (
                      <Button
                        key={status}
                        variant={statusFilter === status ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                  <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as EventFilter)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Events">All Events</SelectItem>
                      <SelectItem value="Exam Events">Exam Events</SelectItem>
                      <SelectItem value="Result Events">Result Events</SelectItem>
                      <SelectItem value="Candidate Events">Candidate Events</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={webhookSearch}
                      onChange={(e) => setWebhookSearch(e.target.value)}
                      placeholder="Search webhook name or endpoint..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border">
                  <DataTable
                    columns={webhookColumns}
                    data={filteredWebhooks}
                    emptyMessage="No webhooks found for current filters."
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "api-keys" && (
            <div className="tab-section">
              <div className="section-head">
                <h2>API Keys</h2>
                <button type="button" className="primary-btn" onClick={() => setShowApiKeyModal(true)}>
                  <Plus size={14} />
                  Create Key
                </button>
              </div>

              {newKeyVisible && (
                <div className="generated-key">
                  <div>
                    <strong>New API Key</strong>
                    <p>Copy this key now. It will not be shown again.</p>
                    <code>{newKeyVisible}</code>
                  </div>
                  <button type="button" onClick={() => copyText(newKeyVisible, "API key copied.")}>
                    <Copy size={14} />
                    Copy
                  </button>
                </div>
              )}

              <div className="table-wrap">
                <table className="integration-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Created</th>
                      <th>Last Used</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.type}</td>
                        <td>{row.created}</td>
                        <td>{row.lastUsed}</td>
                        <td>
                          <span className={`pill ${row.status.toLowerCase()}`}>{row.status}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => notifySuccess(`Viewing ${row.name}`)}>
                              View
                            </button>
                            <button type="button" onClick={() => notifySuccess("Key rotated.")}>
                              Rotate
                            </button>
                            <button type="button" onClick={() => updateKeyStatus(row.id)}>
                              {row.status === "Active" ? "Disable" : "Enable"}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => {
                                setKeys((prev) => prev.filter((item) => item.id !== row.id));
                                notifySuccess("API key deleted.");
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "email-sms" && (
            <div className="tab-section provider-layout">
              <article className="provider-card">
                <h3>Email Provider</h3>
                <span className={`pill ${emailForm.connected ? "active" : "failed"}`}>
                  {emailForm.connected ? "Connected" : "Not Connected"}
                </span>
                <label>
                  Provider
                  <input
                    value={emailForm.provider}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, provider: event.target.value }))}
                  />
                </label>
                <label>
                  SMTP/API Host
                  <input
                    value={emailForm.host}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, host: event.target.value }))}
                  />
                </label>
                <label>
                  API Key
                  <input
                    type="password"
                    value={emailForm.apiKey}
                    onChange={(event) => setEmailForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                  />
                </label>
                <div className="provider-actions">
                  <button type="button" onClick={() => notifySuccess("Email test passed.")}>
                    Test Connection
                  </button>
                  <button type="button" className="primary-btn" onClick={() => notifySuccess("Email provider configured.")}>
                    Configure Provider
                  </button>
                </div>
              </article>

              <article className="provider-card">
                <h3>SMS Gateway</h3>
                <span className={`pill ${smsForm.connected ? "active" : "failed"}`}>
                  {smsForm.connected ? "Connected" : "Not Connected"}
                </span>
                <label>
                  Gateway
                  <input
                    value={smsForm.gateway}
                    onChange={(event) => setSmsForm((prev) => ({ ...prev, gateway: event.target.value }))}
                  />
                </label>
                <label>
                  Account ID
                  <input
                    value={smsForm.accountId}
                    onChange={(event) => setSmsForm((prev) => ({ ...prev, accountId: event.target.value }))}
                  />
                </label>
                <label>
                  API Token
                  <input
                    type="password"
                    value={smsForm.token}
                    onChange={(event) => setSmsForm((prev) => ({ ...prev, token: event.target.value }))}
                  />
                </label>
                <div className="provider-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (!smsForm.token.trim()) {
                        notifyError("Add SMS API token to test.");
                        return;
                      }
                      setSmsForm((prev) => ({ ...prev, connected: true }));
                      notifySuccess("Test SMS sent.");
                    }}
                  >
                    Test SMS
                  </button>
                  <button type="button" className="primary-btn" onClick={() => notifySuccess("SMS gateway configured.")}>
                    Configure Gateway
                  </button>
                </div>
              </article>
            </div>
          )}

          {tab === "payments" && (
            <div className="tab-section provider-layout one">
              <article className="provider-card">
                <h3>Payment Gateway</h3>
                <span className={`pill ${paymentForm.connected ? "active" : "failed"}`}>
                  {paymentForm.connected ? "Connected" : "Not Configured"}
                </span>
                <label>
                  Provider
                  <input
                    value={paymentForm.provider}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, provider: event.target.value }))}
                  />
                </label>
                <label>
                  Public Key
                  <input
                    value={paymentForm.publicKey}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, publicKey: event.target.value }))}
                  />
                </label>
                <label>
                  Secret Key
                  <input
                    type="password"
                    value={paymentForm.secretKey}
                    onChange={(event) => setPaymentForm((prev) => ({ ...prev, secretKey: event.target.value }))}
                  />
                </label>
                <div className="provider-actions">
                  <button type="button" onClick={() => notifySuccess("Payment webhook test sent.")}>
                    Test webhook
                  </button>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      if (!paymentForm.publicKey.trim() || !paymentForm.secretKey.trim()) {
                        notifyError("Public and secret keys are required.");
                        return;
                      }
                      setPaymentForm((prev) => ({ ...prev, connected: true }));
                      notifySuccess("Payment gateway configured.");
                    }}
                  >
                    Configure provider
                  </button>
                </div>
              </article>
            </div>
          )}

          {tab === "logs" && (
            <div className="tab-section">
              <div className="toolbar">
                <select
                  value={logSource}
                  onChange={(event) =>
                    setLogSource(event.target.value as "All" | "Webhook" | "API" | "Email" | "SMS")
                  }
                >
                  <option>All</option>
                  <option>Webhook</option>
                  <option>API</option>
                  <option>Email</option>
                  <option>SMS</option>
                </select>
                <select
                  value={logStatus}
                  onChange={(event) => setLogStatus(event.target.value as "All" | "Success" | "Failed")}
                >
                  <option>All</option>
                  <option>Success</option>
                  <option>Failed</option>
                </select>
                <label className="search-field">
                  <Search size={15} />
                  <input
                    value={logSearch}
                    onChange={(event) => setLogSearch(event.target.value)}
                    placeholder="Search log details..."
                  />
                </label>
              </div>
              <div className="table-wrap">
                <table className="integration-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Source</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th>Details</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((row) => (
                      <tr key={row.id}>
                        <td>{row.timestamp}</td>
                        <td>{row.source}</td>
                        <td>{row.action}</td>
                        <td>
                          <span className={`pill ${row.status === "Success" ? "active" : "failed"}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.details}</td>
                        <td>
                          <button type="button" onClick={() => notifySuccess("Log details opened.")}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      <Sheet open={showWebhookDrawer} onOpenChange={setShowWebhookDrawer}>
        <SheetContent side="right" className="integration-sheet sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Create Webhook</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                value={webhookForm.name}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. HR Sync"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-endpoint">Endpoint URL</Label>
              <Input
                id="webhook-endpoint"
                value={webhookForm.endpoint}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, endpoint: e.target.value }))}
                placeholder="https://your-app.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3">
                {webhookEvents.map((eventName) => (
                  <label key={eventName} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={webhookForm.events.includes(eventName)}
                      onChange={(e) =>
                        setWebhookForm((prev) => ({
                          ...prev,
                          events: e.target.checked
                            ? [...prev.events, eventName]
                            : prev.events.filter((item) => item !== eventName),
                        }))
                      }
                    />
                    {eventName}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={webhookForm.method}
                  onValueChange={(v) => setWebhookForm((prev) => ({ ...prev, method: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                  value={webhookForm.contentType}
                  onValueChange={(v) => setWebhookForm((prev) => ({ ...prev, contentType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application/json">application/json</SelectItem>
                    <SelectItem value="application/x-www-form-urlencoded">
                      application/x-www-form-urlencoded
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Signing Secret</Label>
              <div className="flex gap-2">
                <Input value={webhookForm.secret} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWebhookForm((prev) => ({ ...prev, secret: generateSecret() }))}
                >
                  Generate
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => copyText(webhookForm.secret, "Secret copied.")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-headers">Custom Headers</Label>
              <textarea
                id="webhook-headers"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={webhookForm.headers}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, headers: e.target.value }))}
                placeholder={"Authorization: Bearer token\nX-HJ-Source: admin"}
              />
            </div>
            <div className="space-y-2">
              <Label>Retry Policy</Label>
              <Select
                value={webhookForm.retryPolicy}
                onValueChange={(v) => setWebhookForm((prev) => ({ ...prev, retryPolicy: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Exponential (5 attempts)">Exponential (5 attempts)</SelectItem>
                  <SelectItem value="Linear (3 attempts)">Linear (3 attempts)</SelectItem>
                  <SelectItem value="No retry">No retry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={webhookForm.active}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, active: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowWebhookDrawer(false)}>
                Cancel
              </Button>
              <Button onClick={saveWebhook}>Save</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="integration-dialog">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="sheet-body">
            <label>
              Name
              <input
                value={apiKeyForm.name}
                onChange={(event) => setApiKeyForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Scopes / Permissions
              <div className="checkbox-grid">
                {scopes.map((scope) => (
                  <label key={scope} className="check-inline">
                    <input
                      type="checkbox"
                      checked={apiKeyForm.scopes.includes(scope)}
                      onChange={(event) =>
                        setApiKeyForm((prev) => ({
                          ...prev,
                          scopes: event.target.checked
                            ? [...prev.scopes, scope]
                            : prev.scopes.filter((item) => item !== scope),
                        }))
                      }
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </label>
            <label>
              Expiry Date
              <input
                type="date"
                value={apiKeyForm.expiry}
                onChange={(event) => setApiKeyForm((prev) => ({ ...prev, expiry: event.target.value }))}
              />
            </label>
            <div className="sheet-actions">
              <button type="button" onClick={() => setShowApiKeyModal(false)}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={saveApiKey}>
                Create Key
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}




