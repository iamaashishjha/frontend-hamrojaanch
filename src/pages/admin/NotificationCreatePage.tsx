import PageHeader from "@/components/admin/PageHeader";
import FormField from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function NotificationCreatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Notification"
        subtitle="Send updates to candidates and groups."
        actions={
          <>
            <Button variant="outline">Cancel</Button>
            <Button>Save</Button>
          </>
        }
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
        <FormField label="Subject" required>
          <Input placeholder="Notification subject" />
        </FormField>

        <FormField label="Message" required hint="Use the editor to format your message.">
          <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
            Notification message editor placeholder
            <div className="mt-3 text-xs text-primary">Attach files</div>
          </div>
        </FormField>

        <FormField label="Audience" required>
          <RadioGroup className="space-y-3" defaultValue="all">
            <label className="flex items-center gap-3 rounded-lg border p-3">
              <RadioGroupItem value="all" />
              <div>
                <p className="text-sm font-medium">All active candidates</p>
                <p className="text-xs text-muted-foreground">Send to everyone in the system.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-lg border p-3">
              <RadioGroupItem value="groups" />
              <div>
                <p className="text-sm font-medium">Selected groups</p>
                <p className="text-xs text-muted-foreground">Target specific candidate groups.</p>
              </div>
            </label>
          </RadioGroup>
        </FormField>

        <div className="flex items-center gap-3">
          <Checkbox id="send-email" />
          <label htmlFor="send-email" className="text-sm font-medium">
            Send via email
          </label>
        </div>
      </div>
    </div>
  );
}
