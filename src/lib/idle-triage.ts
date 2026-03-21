import type { ExamCandidateStatusRow } from "@/lib/exams-module-types";

export type IdleBand = "all" | "critical" | "warning" | "healthy";

export function getIdleMinutes(lastActivityAt?: string) {
  if (!lastActivityAt) return null;
  const ms = Date.now() - new Date(lastActivityAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60000);
}

export function getInProgressIdlePriority(
  status: ExamCandidateStatusRow["status"],
  idleMin: number | null,
) {
  if (status !== "in_progress") return 3;
  if (idleMin === null) return 2;
  if (idleMin >= 15) return 0;
  if (idleMin >= 5) return 1;
  return 2;
}

export function matchesIdleBand(row: ExamCandidateStatusRow, band: IdleBand) {
  if (band === "all") return true;
  if (row.status !== "in_progress") return false;
  const idleMin = getIdleMinutes(row.lastActivityAt);
  if (band === "critical") return idleMin !== null && idleMin >= 15;
  if (band === "warning") return idleMin !== null && idleMin >= 5 && idleMin < 15;
  return idleMin === null || idleMin < 5;
}

export function summarizeIdleBands(rows: ExamCandidateStatusRow[]) {
  let critical = 0;
  let warning = 0;
  let healthy = 0;
  for (const row of rows) {
    if (row.status !== "in_progress") continue;
    const idleMin = getIdleMinutes(row.lastActivityAt);
    if (idleMin == null || idleMin < 5) {
      healthy += 1;
    } else if (idleMin < 15) {
      warning += 1;
    } else {
      critical += 1;
    }
  }
  return { critical, warning, healthy };
}

interface BuildTriageCandidateRowsOptions {
  idleFilter?: IdleBand;
  statusFilter?: string;
  flagsFilter?: string;
  searchQuery?: string;
}

/**
 * Shared candidate triage pipeline:
 * - apply optional status/flags/search/idle filters
 * - sort by in-progress idle risk first, then recency
 */
export function buildTriageCandidateRows(
  rows: ExamCandidateStatusRow[],
  options: BuildTriageCandidateRowsOptions = {},
) {
  const {
    idleFilter = "all",
    statusFilter = "all",
    flagsFilter = "all",
    searchQuery = "",
  } = options;
  const query = searchQuery.toLowerCase().trim();

  return [...rows]
    .filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!matchesIdleBand(row, idleFilter)) return false;
      if (flagsFilter === "has_flags" && row.flags === 0) return false;
      if (flagsFilter === "no_flags" && row.flags > 0) return false;
      if (
        query &&
        !(row.candidateName.toLowerCase().includes(query) || row.email.toLowerCase().includes(query))
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const idleA = getIdleMinutes(a.lastActivityAt);
      const idleB = getIdleMinutes(b.lastActivityAt);
      const priA = getInProgressIdlePriority(a.status, idleA);
      const priB = getInProgressIdlePriority(b.status, idleB);
      if (priA !== priB) return priA - priB;
      if (a.status === "in_progress" && b.status === "in_progress") {
        return (idleB ?? -1) - (idleA ?? -1);
      }
      return (
        new Date(b.lastActivityAt ?? b.startTime ?? 0).getTime() -
        new Date(a.lastActivityAt ?? a.startTime ?? 0).getTime()
      );
    });
}

