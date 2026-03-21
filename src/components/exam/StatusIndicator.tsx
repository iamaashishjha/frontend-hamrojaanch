import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";

export type StatusType = "ready" | "attention" | "blocked" | "loading";

interface StatusIndicatorProps {
  status: StatusType;
  label: string;
  description?: string;
  className?: string;
}

const statusConfig = {
  ready: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success-light",
    border: "border-success/30",
    label: "Ready",
  },
  attention: {
    icon: AlertCircle,
    color: "text-warning",
    bg: "bg-warning-light",
    border: "border-warning/30",
    label: "Needs Attention",
  },
  blocked: {
    icon: XCircle,
    color: "text-danger",
    bg: "bg-danger-light",
    border: "border-danger/30",
    label: "Blocked",
  },
  loading: {
    icon: Loader2,
    color: "text-muted-foreground",
    bg: "bg-secondary",
    border: "border-border",
    label: "Checking...",
  },
};

export function StatusIndicator({ status, label, description, className }: StatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border transition-all",
        config.bg,
        config.border,
        className
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 mt-0.5 flex-shrink-0",
          config.color,
          status === "loading" && "animate-spin"
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{label}</span>
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
          </span>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}
