import { useMemo, useState } from "react";
import type { UIEvent } from "react";

type UseVirtualRowsInput = {
  itemCount: number;
  rowHeight: number;
  containerHeight: number;
  overscan?: number;
  enabled?: boolean;
};

type UseVirtualRowsResult = {
  enabled: boolean;
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
};

export function useVirtualRows(input: UseVirtualRowsInput): UseVirtualRowsResult {
  const [scrollTop, setScrollTop] = useState(0);
  const enabled = Boolean(input.enabled);
  const overscan = input.overscan ?? 8;

  const windowState = useMemo(() => {
    if (!enabled) {
      return {
        startIndex: 0,
        endIndex: input.itemCount,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const visibleCount = Math.max(1, Math.ceil(input.containerHeight / input.rowHeight));
    const rawStart = Math.floor(scrollTop / input.rowHeight) - overscan;
    const startIndex = Math.max(0, rawStart);
    const rawEnd = startIndex + visibleCount + overscan * 2;
    const endIndex = Math.min(input.itemCount, rawEnd);

    return {
      startIndex,
      endIndex,
      topSpacerHeight: startIndex * input.rowHeight,
      bottomSpacerHeight: Math.max(0, (input.itemCount - endIndex) * input.rowHeight),
    };
  }, [
    enabled,
    input.containerHeight,
    input.itemCount,
    input.rowHeight,
    overscan,
    scrollTop,
  ]);

  return {
    enabled,
    ...windowState,
    onScroll: (event) => setScrollTop(event.currentTarget.scrollTop),
  };
}
