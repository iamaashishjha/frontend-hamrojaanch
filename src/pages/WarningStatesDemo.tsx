import { AlertBanner, AlertBannerTitle, AlertBannerDescription } from "@/components/ui/alert-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { useState } from "react";
import { toast } from "sonner";

export default function WarningStatesDemo() {
  const [showBanner, setShowBanner] = useState(true);

  const showToast = (type: "soft" | "strong" | "critical") => {
    switch (type) {
      case "soft":
        toast("Activity Logged", {
          description: "Brief moment looking away detected. Please stay focused.",
          duration: 5000,
        });
        break;
      case "strong":
        toast.warning("Attention Required", {
          description: "Extended period looking away from screen. Please keep your face visible.",
          duration: 8000,
        });
        break;
      case "critical":
        toast.error("Event Logged for Review", {
          description: "Multiple instances detected. This has been logged for review.",
          duration: 10000,
        });
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background public-page-scale">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <BrandText className="font-bold text-xl" />
            </div>
            <Badge variant="secondary">Warning States Demo</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">AI Warning UI States</h1>
        <p className="text-muted-foreground mb-8">
          Examples of calm, respectful warning states used during AI monitoring.
        </p>

        <div className="space-y-8">
          {/* Toast Notifications */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">1. Toast Notifications</h2>
            <p className="text-muted-foreground">
              Non-intrusive notifications that appear briefly. Used for minor events.
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => showToast("soft")}>
                <Info className="h-4 w-4 mr-2" />
                Soft Warning Toast
              </Button>
              <Button variant="warning" onClick={() => showToast("strong")}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Strong Warning Toast
              </Button>
              <Button variant="danger" onClick={() => showToast("critical")}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Critical Toast
              </Button>
            </div>
          </section>

          {/* Banner Warnings */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">2. Banner Warnings</h2>
            <p className="text-muted-foreground">
              Persistent banners that appear under the top bar for important notices.
            </p>

            <div className="space-y-4">
              {/* Info Banner */}
              <AlertBanner variant="info">
                <Info className="h-4 w-4" />
                <AlertBannerTitle>Tip</AlertBannerTitle>
                <AlertBannerDescription>
                  Keep your face centered in the frame for the best experience.
                </AlertBannerDescription>
              </AlertBanner>

              {/* Warning Banner */}
              {showBanner && (
                <AlertBanner variant="warning" closable onClose={() => setShowBanner(false)}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertBannerTitle>Activity Logged</AlertBannerTitle>
                  <AlertBannerDescription>
                    Please keep your face visible and minimize looking away from the screen.
                  </AlertBannerDescription>
                </AlertBanner>
              )}

              {/* Danger Banner */}
              <AlertBanner variant="danger">
                <AlertCircle className="h-4 w-4" />
                <AlertBannerTitle>Event Logged for Review</AlertBannerTitle>
                <AlertBannerDescription>
                  This event has been recorded. Please remain focused to avoid further logging.
                </AlertBannerDescription>
              </AlertBanner>
            </div>

            {!showBanner && (
              <Button variant="outline" onClick={() => setShowBanner(true)}>
                Show warning banner again
              </Button>
            )}
          </section>

          {/* Status Badges */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">3. Status Badges</h2>
            <p className="text-muted-foreground">
              Visual indicators showing current AI monitoring status.
            </p>

            <div className="flex flex-wrap gap-4">
              <div className="exam-card p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Normal State</p>
                <Badge variant="ai-normal">AI: Normal</Badge>
              </div>
              <div className="exam-card p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Warning State</p>
                <Badge variant="ai-warning">AI: Warning</Badge>
              </div>
              <div className="exam-card p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Review State</p>
                <Badge variant="ai-review">AI: Review</Badge>
              </div>
            </div>
          </section>

          {/* Event Log Entry States */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">4. Event Log Entry States</h2>
            <p className="text-muted-foreground">
              How events appear in the monitoring log with neutral, transparent language.
            </p>

            <div className="space-y-3">
              <div className="p-4 bg-secondary/50 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">10:45:23</span>
                  <Badge variant="secondary">Info</Badge>
                </div>
                <p className="font-medium">Brief Gaze Away</p>
                <p className="text-sm text-muted-foreground">
                  Looked away from screen briefly. This is normal behavior and has been noted.
                </p>
              </div>

              <div className="p-4 bg-warning-light rounded-lg border border-warning/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">10:52:11</span>
                  <Badge variant="warning-light">Attention</Badge>
                </div>
                <p className="font-medium">Extended Gaze Away</p>
                <p className="text-sm text-muted-foreground">
                  Looked away from screen for an extended period. Please try to stay focused.
                </p>
              </div>

              <div className="p-4 bg-danger-light rounded-lg border border-danger/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">11:03:45</span>
                  <Badge variant="danger-light">Logged</Badge>
                </div>
                <p className="font-medium">Activity Logged for Review</p>
                <p className="text-sm text-muted-foreground">
                  This event has been recorded for review by authorized personnel. You may be contacted for clarification.
                </p>
              </div>
            </div>
          </section>

          {/* Copy Guidelines */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Copy Guidelines</h2>
            <p className="text-muted-foreground">
              Examples of calm, respectful language used in the system.
            </p>

            <div className="exam-card p-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary rounded">
                  <div>
                    <p className="text-sm text-danger line-through">Cheating detected</p>
                  </div>
                  <div>
                    <p className="text-sm text-success">Activity logged for review</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary rounded">
                  <div>
                    <p className="text-sm text-danger line-through">Violation!</p>
                  </div>
                  <div>
                    <p className="text-sm text-success">Please keep your face visible</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary rounded">
                  <div>
                    <p className="text-sm text-danger line-through">Suspicious behavior</p>
                  </div>
                  <div>
                    <p className="text-sm text-success">Event noted for review</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-3 bg-secondary rounded">
                  <div>
                    <p className="text-sm text-danger line-through">You are being recorded</p>
                  </div>
                  <div>
                    <p className="text-sm text-success">Recording active for exam integrity</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}


