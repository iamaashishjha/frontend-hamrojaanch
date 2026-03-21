import { Mail, Phone, ShieldCheck, User } from "lucide-react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";

export default function AdminAccountPage() {
  const { settings } = useSiteSettings();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Admin Panel</p>
        <h1 className="text-2xl font-semibold text-foreground">My Account</h1>
        <p className="text-muted-foreground">
          Manage your profile, security, and organization details.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Administrator</h2>
              <p className="text-sm text-muted-foreground">{settings.branding.siteName} HQ</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Email</p>
              <p className="mt-2 flex items-center gap-2 font-medium text-foreground">
                <Mail className="h-4 w-4 text-primary" />
                {settings.contact.email ?? "admin@example.com"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Phone</p>
              <p className="mt-2 flex items-center gap-2 font-medium text-foreground">
                <Phone className="h-4 w-4 text-primary" />
                {settings.contact.phone ?? "+000 000-0000"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Role</p>
              <p className="mt-2 font-medium text-foreground">Super Admin</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs uppercase text-muted-foreground">Organization</p>
              <p className="mt-2 font-medium text-foreground">{settings.branding.siteName}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Security</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-4">
              <div>
                <p className="font-medium text-foreground">Two-factor authentication</p>
                <p className="text-sm text-muted-foreground">Enabled via authenticator app.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-success" />
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="font-medium text-foreground">Password</p>
              <p className="text-sm text-muted-foreground">Last updated 30 days ago.</p>
              <button className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                Update Password
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}




