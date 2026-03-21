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
import { Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage configuration across exams, users, and system tools."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Settings saved",
                description: "Your configuration changes were saved.",
              })
            }
          >
            Save Changes
          </Button>
        }
      />
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Demo mode</p>
        <p className="mt-1">Changes are saved to the server and apply to the site.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsGroups.map((group) => (
          <div key={group.title} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{group.title}</h3>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/settings/${slugify(group.title)}`}>Manage</Link>
              </Button>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {group.items.map((item) => (
                <li key={item}>
                  <Link
                    to={`/settings/${slugify(item)}`}
                    className="block rounded-lg border bg-muted/40 px-3 py-2 transition hover:bg-muted"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
