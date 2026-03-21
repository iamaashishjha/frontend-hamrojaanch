import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
const settingsGroups = [
  { title: "Exam Setup", items: ["Sections", "Difficulty", "Directions", "Exam Series"] },
  { title: "Users & Access", items: ["Groups", "Instructor Accounts", "Candidate Activity"] },
  { title: "Communication", items: ["Send Emails", "Send SMS", "Email Settings", "SMS Settings", "Templates"] },
  { title: "Evaluation & Monitoring", items: ["Assign Essay Marks", "Exam Monitor", "Feedback"] },
  { title: "Security", items: ["Exam Security", "Trusted IP Address", "Watermark"] },
  { title: "Certificates", items: ["Certificate Maker", "Certificate Authentication"] },
  { title: "Billing & Sales", items: ["My Sales", "Exam Packages", "Payment Gateway", "TransQ"] },
  { title: "System", items: ["Import Questions", "Import Candidates", "Export Data", "Webhook", "My Account"] },
];
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FormField from "@/components/admin/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Field =
  | { type: "text"; label: string; placeholder?: string; hint?: string }
  | { type: "textarea"; label: string; placeholder?: string; hint?: string }
  | { type: "toggle"; label: string; hint?: string }
  | { type: "select"; label: string; options: string[]; hint?: string };

const templates: Record<string, { description: string; fields: Field[] }> = {
  "send-emails": {
    description: "Configure outbound email settings and sender details.",
    fields: [
      { type: "toggle", label: "Enable email notifications" },
      { type: "text", label: "From name", placeholder: "Support Team" },
      { type: "text", label: "From email", placeholder: "support@example.com" },
    ],
  },
  "send-sms": {
    description: "Configure SMS notifications and sender identity.",
    fields: [
      { type: "toggle", label: "Enable SMS notifications" },
      { type: "text", label: "Sender ID", placeholder: "HAMROJ" },
      { type: "text", label: "Default country code", placeholder: "+977" },
    ],
  },
  "email-settings": {
    description: "SMTP and delivery configuration.",
    fields: [
      { type: "text", label: "SMTP host", placeholder: "smtp.mailprovider.com" },
      { type: "text", label: "SMTP port", placeholder: "587" },
      { type: "toggle", label: "Use TLS encryption" },
    ],
  },
  "sms-settings": {
    description: "SMS gateway configuration.",
    fields: [
      { type: "select", label: "Provider", options: ["Twilio", "Ncell", "Sparrow SMS"] },
      { type: "text", label: "API key", placeholder: "********" },
    ],
  },
  "exam-security": {
    description: "Lockdown and integrity controls.",
    fields: [
      { type: "toggle", label: "Enable secure browser mode" },
      { type: "toggle", label: "Disable copy/paste" },
      { type: "toggle", label: "Require camera on start" },
    ],
  },
  "trusted-ip-address": {
    description: "Allow access only from whitelisted IPs.",
    fields: [
      { type: "text", label: "Allowed IP ranges", placeholder: "192.168.1.0/24, 10.0.0.0/16" },
    ],
  },
  watermark: {
    description: "Add watermark to candidate screens.",
    fields: [
      { type: "text", label: "Watermark text", placeholder: "Organization - Confidential" },
      { type: "toggle", label: "Show on screenshots" },
    ],
  },
  sections: {
    description: "Define default sections for exams.",
    fields: [
      { type: "text", label: "New section name", placeholder: "Quantitative" },
      { type: "toggle", label: "Allow custom sections" },
    ],
  },
  difficulty: {
    description: "Default difficulty options.",
    fields: [
      { type: "select", label: "Default level", options: ["Easy", "Medium", "Hard"] },
      { type: "toggle", label: "Allow custom difficulty labels" },
    ],
  },
  webhook: {
    description: "Send events to your backend.",
    fields: [
      { type: "text", label: "Webhook URL", placeholder: "https://api.yoursite.com/webhook" },
      { type: "toggle", label: "Enable retries" },
    ],
  },
  "my-account": {
    description: "Organization profile details.",
    fields: [
      { type: "text", label: "Organization name", placeholder: "Organization Name" },
      { type: "text", label: "Support email", placeholder: "help@example.com" },
    ],
  },
};

const defaultTemplate = {
  description: "Configure settings for this section.",
  fields: [
    { type: "toggle", label: "Enable feature" },
    { type: "text", label: "Default value", placeholder: "Enter value" },
    { type: "textarea", label: "Notes", placeholder: "Add any notes for this configuration" },
  ] as Field[],
};

export default function SettingsDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const match = useMemo(() => {
    if (!slug) return null;
    const group = settingsGroups.find((item) => slugify(item.title) === slug);
    if (group) {
      return { type: "group" as const, title: group.title, items: group.items };
    }
    for (const groupItem of settingsGroups) {
      for (const item of groupItem.items) {
        if (slugify(item) === slug) {
          return { type: "item" as const, title: item, items: [item], group: groupItem.title };
        }
      }
    }
    return null;
  }, [slug]);

  const [enabledItems, setEnabledItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (match?.type === "group") {
      const initial = match.items.reduce<Record<string, boolean>>((acc, item) => {
        acc[item] = true;
        return acc;
      }, {});
      setEnabledItems(initial);
    }
  }, [match]);

  const template = match && match.type === "item" ? templates[slug ?? ""] ?? defaultTemplate : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={match ? match.title : "Settings"}
        subtitle={match ? "Configure this section and save updates." : "Settings section not found."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/settings")}>Back to Settings</Button>
            {match ? (
              <Button
                onClick={() =>
                  toast({
                    title: "Settings saved",
                    description: "Your configuration changes were saved.",
                  })
                }
              >
                Save Changes
              </Button>
            ) : null}
          </div>
        }
      />
      {match && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Preview-only changes</p>
          <p className="mt-1">Updates here are stored in demo mode for UX validation.</p>
        </div>
      )}

      {match ? (
        match.type === "group" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {match.items.map((item) => (
              <Card key={item} className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{item}</CardTitle>
                  <Switch
                    checked={enabledItems[item] ?? true}
                    onCheckedChange={() =>
                      setEnabledItems((prev) => ({ ...prev, [item]: !prev[item] }))
                    }
                  />
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Quick toggle for {item}. Configure full options below.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/settings/${slugify(item)}`}>Configure</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
              {template ? (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {template?.fields.map((field, index) => {
                if (field.type === "text") {
                  return (
                    <FormField key={`${field.label}-${index}`} label={field.label} hint={field.hint}>
                      <Input placeholder={field.placeholder} />
                    </FormField>
                  );
                }
                if (field.type === "textarea") {
                  return (
                    <FormField key={`${field.label}-${index}`} label={field.label} hint={field.hint}>
                      <Textarea rows={4} placeholder={field.placeholder} />
                    </FormField>
                  );
                }
                if (field.type === "select") {
                  return (
                    <FormField key={`${field.label}-${index}`} label={field.label} hint={field.hint}>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  );
                }
                return (
                  <FormField key={`${field.label}-${index}`} label={field.label} hint={field.hint}>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{field.label}</span>
                      <Switch defaultChecked />
                    </div>
                  </FormField>
                );
              })}
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-none shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            We couldn't find this settings section.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

