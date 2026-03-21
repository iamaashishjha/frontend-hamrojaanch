import { get, post, patch, del } from "@/lib/apiClient";

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listCoupons(): Promise<Coupon[]> {
  const res = await get<{ coupons: Coupon[] }>("/admin/coupons");
  return res.coupons ?? [];
}

export async function createCoupon(data: {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}): Promise<Coupon> {
  const res = await post<{ coupon: Coupon }>("/admin/coupons", data);
  return res.coupon;
}

export async function updateCoupon(id: string, data: Partial<{
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}>): Promise<Coupon> {
  const res = await patch<{ coupon: Coupon }>(`/admin/coupons/${id}`, data);
  return res.coupon;
}

export async function deleteCoupon(id: string): Promise<void> {
  await del(`/admin/coupons/${id}`);
}
