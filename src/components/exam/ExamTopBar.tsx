import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import { getStoredUser } from "@/lib/auth-api";

interface ExamTopBarProps {
  examName: string;
  timeRemaining: string;
  aiStatus: "Normal" | "Warning" | "Review";
  syncStatus?: "idle" | "syncing" | "synced" | "offline" | "error";
  isRecording?: boolean;
  warningCount?: number;
  maxWarnings?: number;
}

export function ExamTopBar({
  examName,
  timeRemaining,
  aiStatus,
  syncStatus = "idle",
  isRecording = true,
  warningCount = 0,
  maxWarnings = 3,
}: ExamTopBarProps) {
  // NOTE: Exam header is UI-only; timer + AI status behavior is unchanged.
  const user = getStoredUser();
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    undefined;

  const getTimerClass = () => {
    // Parse time to determine urgency
    const parts = timeRemaining.split(":").map((part) => parseInt(part, 10)).filter((part) => !Number.isNaN(part));
    let totalSeconds = 0;
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      totalSeconds = parts[0] * 60;
    }

    if (totalSeconds <= 5 * 60) return "timer-critical";
    if (totalSeconds <= 15 * 60) return "timer-warning";
    return "timer-normal";
  };

  const getAIStatusVariant = () => {
    switch (aiStatus) {
      case "Normal":
        return "ai-normal";
      case "Warning":
        return "ai-warning";
      case "Review":
        return "ai-review";
      default:
        return "secondary";
    }
  };

  const syncLabel =
    syncStatus === "syncing"
      ? "Syncing"
      : syncStatus === "synced"
        ? "Synced"
        : syncStatus === "offline"
          ? "Offline"
          : syncStatus === "error"
            ? "Retrying"
            : "Ready";

  const syncVariant =
    syncStatus === "synced"
      ? "success-light"
      : syncStatus === "offline" || syncStatus === "error"
        ? "warning-light"
        : "secondary";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between px-4 gap-4">
        {/* LEFT: Brand + exam meta (UI-only, no behavior change) */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <BrandText />
            </div>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-semibold text-sm sm:text-base truncate max-w-[200px] sm:max-w-[260px]">
                {examName}
              </h1>
              <Badge variant="secondary" className="gap-1 text-[11px] sm:text-xs">
                <ShieldCheck className="h-3 w-3" />
                Proctored
              </Badge>
            </div>
          </div>
        </div>

        {/* CENTER: Circular countdown timer (90% scale, red) */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 scale-90">
            <div
              className={cn(
                "absolute inset-0 rounded-full flex items-center justify-center border-4",
                getTimerClass() === "timer-critical"
                  ? "border-danger/70 bg-danger/5"
                  : getTimerClass() === "timer-warning"
                  ? "border-warning/70 bg-warning/5"
                  : "border-danger/70 bg-danger/5"
              )}
            >
              <span
                className={cn(
                  "font-mono text-xs sm:text-sm font-bold",
                  getTimerClass() === "timer-critical"
                    ? "text-danger"
                    : getTimerClass() === "timer-warning"
                    ? "text-warning"
                    : "text-danger"
                )}
              >
                {timeRemaining}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: AI status, warnings, recording, avatar */}
        <div className="flex items-center gap-3">
          {/* Warning Counter */}
          <div className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs sm:text-sm font-medium">
              {warningCount}/{maxWarnings}
            </span>
          </div>

          {/* AI Status Badge */}
          <Badge variant={getAIStatusVariant()} className="hidden sm:inline-flex">
            AI: {aiStatus}
          </Badge>

          {/* Attempt sync status */}
          <Badge variant={syncVariant} className="hidden sm:inline-flex">
            Sync: {syncLabel}
          </Badge>

          {/* Recording Indicator */}
          {isRecording && (
            <div className="recording-indicator">
              <span className="recording-dot" />
              <span className="hidden sm:inline">Recording</span>
            </div>
          )}

          {/* User avatar (initial only) */}
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 text-xs font-semibold text-primary">
            {userInitial ?? <User className="h-4 w-4" />}
          </div>
        </div>
      </div>
    </header>
  );
}
