import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { IdleBand } from "@/lib/idle-triage";

type ParamValue = string | boolean | null | undefined;

export function useTriageSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getString = useCallback(
    (key: string, fallback = "") => {
      return searchParams.get(key) ?? fallback;
    },
    [searchParams],
  );

  const getBoolean = useCallback(
    (key: string, fallback = false) => {
      const raw = searchParams.get(key);
      if (raw == null) return fallback;
      return raw === "true";
    },
    [searchParams],
  );

  const getIdleBand = useCallback(
    (key: string, fallback: IdleBand = "all"): IdleBand => {
      const raw = searchParams.get(key);
      return raw === "critical" || raw === "warning" || raw === "healthy" ? raw : fallback;
    },
    [searchParams],
  );

  const setParams = useCallback(
    (values: Record<string, ParamValue>) => {
      const next = new URLSearchParams();
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === null) continue;
        if (typeof value === "boolean") {
          if (value) next.set(key, "true");
          continue;
        }
        if (value !== "") next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  return useMemo(
    () => ({ getString, getBoolean, getIdleBand, setParams }),
    [getString, getBoolean, getIdleBand, setParams],
  );
}

