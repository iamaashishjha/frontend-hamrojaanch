import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import type { IdleBand } from "@/lib/idle-triage";

interface IdleSummary {
  critical: number;
  warning: number;
  healthy: number;
}

interface IdleQuickFilterCardsProps {
  summary: IdleSummary;
  activeBand: IdleBand;
  onSelect: (band: "critical" | "warning" | "healthy") => void;
  className?: string;
}

export default function IdleQuickFilterCards({
  summary,
  activeBand,
  onSelect,
  className = "grid gap-3 sm:grid-cols-3",
}: IdleQuickFilterCardsProps) {
  return (
    <div className={className}>
      <button type="button" className="text-left" onClick={() => onSelect("critical")}>
        <Card className={activeBand === "critical" ? "ring-2 ring-red-300" : undefined}>
          <CardHeader className="pb-2">
            <CardDescription>Idle Critical</CardDescription>
            <CardTitle className="text-red-600">{summary.critical}</CardTitle>
          </CardHeader>
        </Card>
      </button>
      <button type="button" className="text-left" onClick={() => onSelect("warning")}>
        <Card className={activeBand === "warning" ? "ring-2 ring-amber-300" : undefined}>
          <CardHeader className="pb-2">
            <CardDescription>Idle Warning</CardDescription>
            <CardTitle className="text-amber-600">{summary.warning}</CardTitle>
          </CardHeader>
        </Card>
      </button>
      <button type="button" className="text-left" onClick={() => onSelect("healthy")}>
        <Card className={activeBand === "healthy" ? "ring-2 ring-emerald-300" : undefined}>
          <CardHeader className="pb-2">
            <CardDescription>Idle Healthy</CardDescription>
            <CardTitle className="text-emerald-700">{summary.healthy}</CardTitle>
          </CardHeader>
        </Card>
      </button>
    </div>
  );
}

