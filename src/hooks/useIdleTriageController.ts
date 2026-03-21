import { useCallback, useMemo, useState } from "react";
import type { IdleBand } from "@/lib/idle-triage";

interface UseIdleTriageControllerOptions {
  initialIdleFilter?: IdleBand;
  includeAbandoned: boolean;
  extraActiveFilterCount?: number;
  onQuickFilter?: () => void;
  onReset?: () => void;
}

export function useIdleTriageController(options: UseIdleTriageControllerOptions) {
  const {
    initialIdleFilter = "all",
    includeAbandoned,
    extraActiveFilterCount = 0,
    onQuickFilter,
    onReset,
  } = options;

  const [idleFilter, setIdleFilter] = useState<IdleBand>(initialIdleFilter);

  const applyIdleQuickFilter = useCallback(
    (band: "critical" | "warning" | "healthy") => {
      onQuickFilter?.();
      setIdleFilter((prev) => (prev === band ? "all" : band));
    },
    [onQuickFilter],
  );

  const resetAllFilters = useCallback(() => {
    onReset?.();
    setIdleFilter("all");
  }, [onReset]);

  const activeFilterCount = useMemo(
    () => (includeAbandoned ? 1 : 0) + (idleFilter !== "all" ? 1 : 0) + extraActiveFilterCount,
    [includeAbandoned, idleFilter, extraActiveFilterCount],
  );

  const hasAnyFilters = activeFilterCount > 0;

  return {
    idleFilter,
    setIdleFilter,
    applyIdleQuickFilter,
    resetAllFilters,
    activeFilterCount,
    hasAnyFilters,
  };
}

