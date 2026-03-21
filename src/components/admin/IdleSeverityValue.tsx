import { Badge } from "@/components/ui/badge";
import type { ExamCandidateStatusRow } from "@/lib/exams-module-types";

interface IdleSeverityValueProps {
  status: ExamCandidateStatusRow["status"];
  idleLabel: string;
  idleMinutes: number | null;
  mode?: "badge" | "text";
}

/**
 * Shared renderer for idle severity values.
 * Applies threshold coloring only for in-progress sessions.
 */
export default function IdleSeverityValue({
  status,
  idleLabel,
  idleMinutes,
  mode = "text",
}: IdleSeverityValueProps) {
  if (status !== "in_progress" || idleMinutes === null) {
    return <span>{idleLabel}</span>;
  }

  if (mode === "badge") {
    if (idleMinutes >= 15) return <Badge variant="danger-light">{idleLabel}</Badge>;
    if (idleMinutes >= 5) return <Badge variant="warning-light">{idleLabel}</Badge>;
    return <Badge variant="success-light">{idleLabel}</Badge>;
  }

  if (idleMinutes >= 15) return <span className="font-medium text-red-600">{idleLabel}</span>;
  if (idleMinutes >= 5) return <span className="font-medium text-amber-600">{idleLabel}</span>;
  return <span className="text-emerald-700">{idleLabel}</span>;
}

