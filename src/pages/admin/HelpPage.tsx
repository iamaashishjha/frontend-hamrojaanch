import PageHeader from "@/components/admin/PageHeader";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

const supportData = [
  { name: "Resolved", value: 58, color: "hsl(var(--success))" },
  { name: "In Progress", value: 24, color: "hsl(var(--warning))" },
  { name: "New", value: 12, color: "hsl(var(--primary))" },
];

export default function HelpPage() {
  const { settings } = useSiteSettings();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & Support"
        subtitle={`Find answers or reach the ${settings.branding.siteName} support team.`}
        actions={<Button>Contact Support</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">Knowledge Base</p>
            <p className="text-sm text-muted-foreground">
              Browse best practices for exam setup, monitoring, and evaluation.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">Live Chat</p>
            <p className="text-sm text-muted-foreground">
              Available Monday to Friday, 9am - 6pm.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">System Status</p>
            <p className="text-sm text-muted-foreground">
              No incidents reported in the last 24 hours.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Support Requests</p>
            <Badge variant="outline">Last 30 days</Badge>
          </div>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[160px_1fr]">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={supportData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65}>
                    {supportData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {supportData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Snapshot of ticket resolution status for the support team.
          </p>
        </div>
      </div>
    </div>
  );
}



