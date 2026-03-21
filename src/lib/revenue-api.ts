/**
 * P2: Revenue summary API for admin dashboard.
 */
import { get } from "@/lib/apiClient";

export interface RevenueSummary {
  totalPaid: number;
  paidCount: number;
  totalRefunded: number;
  refundedCount: number;
  pendingCount: number;
  currency: string;
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  return get<RevenueSummary>("/admin/revenue/summary");
}
