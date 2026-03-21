import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SessionFilterActionBarProps {
  activeFilterCount: number;
  hasAnyFilters: boolean;
  includeAbandoned: boolean;
  onToggleIncludeAbandoned: () => void;
  onResetAllFilters: () => void;
  extraActions?: ReactNode;
  className?: string;
}

export default function SessionFilterActionBar({
  activeFilterCount,
  hasAnyFilters,
  includeAbandoned,
  onToggleIncludeAbandoned,
  onResetAllFilters,
  extraActions,
  className = "flex flex-wrap gap-2",
}: SessionFilterActionBarProps) {
  return (
    <div className={className}>
      {hasAnyFilters && <Badge variant="secondary">{activeFilterCount} filter(s)</Badge>}
      {extraActions}
      <Button
        variant={includeAbandoned ? "secondary" : "outline"}
        size="sm"
        onClick={onToggleIncludeAbandoned}
      >
        {includeAbandoned ? "Hide Abandoned Sessions" : "Include Abandoned Sessions"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onResetAllFilters}
        disabled={!hasAnyFilters}
      >
        Reset All Filters
      </Button>
    </div>
  );
}

