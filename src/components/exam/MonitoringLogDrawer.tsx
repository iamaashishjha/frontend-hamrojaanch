import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  severity: "info" | "warning" | "attention";
  description: string;
}

interface MonitoringLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LogEntry[];
}

const severityConfig = {
  info: { variant: "secondary" as const, label: "Info" },
  warning: { variant: "warning-light" as const, label: "Attention" },
  attention: { variant: "danger-light" as const, label: "Logged" },
};

export function MonitoringLogDrawer({
  isOpen,
  onClose,
  entries,
}: MonitoringLogDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l shadow-elevated z-50 animate-slide-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-lg">Monitoring Log</h2>
            <p className="text-sm text-muted-foreground">
              Activity recorded during your exam
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-3">
            {entries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No events logged yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Events will appear here as they occur
                </p>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-secondary/50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {entry.timestamp}
                    </span>
                    <Badge variant={severityConfig[entry.severity].variant}>
                      {severityConfig[entry.severity].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{entry.eventType}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t">
          <p className="text-xs text-muted-foreground text-center">
            This log is for your reference. All activity is reviewed by authorized personnel only.
          </p>
        </div>
      </div>
    </>
  );
}
