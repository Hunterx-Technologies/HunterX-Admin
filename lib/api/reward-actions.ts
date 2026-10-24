'use server';

import type { ApiResponse } from '@/types/api';
import type { RewardTab } from '@/lib/reward-kinds';
import { apiClient, unwrap } from '@/lib/api/client';

// Server Actions for the Rewards page. Backend validation errors surface
// as ApiError with a human-readable .message for the dialog to display.

// tab picks the API group: /admin/rewards/streaks | levels | birthday.

/**
 * streaks: value = streak days; levels: value = level number; birthday: nothing (only one);
 * special: name (e.g. "Nike drop").
 */
export async function createReward(tab: RewardTab, value?: number, name?: string): Promise<void> {
  const body = tab === 'birthday' ? {} : tab === 'special' ? { description: name } : { value };
  await unwrap(apiClient.post<ApiResponse<unknown>>(`/admin/rewards/${tab}`, body));
}

/** Only for a reward that has never given anyone a card; also deletes its coupons and their images. */
export async function deleteReward(tab: RewardTab, rewardId: string): Promise<void> {
  await unwrap(apiClient.delete<ApiResponse<unknown>>(`/admin/rewards/${tab}/${rewardId}`));
}

/** Switch a reward off (no new cards) or back on. */
export async function setRewardActive(tab: RewardTab, rewardId: string, isActive: boolean): Promise<void> {
  await unwrap(apiClient.patch<ApiResponse<unknown>>(`/admin/rewards/${tab}/${rewardId}`, { is_active: isActive }));
}

/** form: built by buildCouponFormData (lib/reward-form.ts), so it can carry the image file. */
export async function createRewardCoupon(tab: RewardTab, rewardId: string, form: FormData): Promise<void> {
  await unwrap(apiClient.post<ApiResponse<unknown>>(`/admin/rewards/${tab}/${rewardId}/coupons`, form));
}

export async function updateRewardCoupon(couponId: string, form: FormData): Promise<void> {
  await unwrap(apiClient.patch<ApiResponse<unknown>>(`/admin/rewards/coupons/${couponId}`, form));
}

export async function setRewardCouponActive(couponId: string, isActive: boolean): Promise<void> {
  await unwrap(apiClient.patch<ApiResponse<unknown>>(`/admin/rewards/coupons/${couponId}`, { is_active: isActive }));
}

/** Returns true when deleted, false when it was already awarded and got deactivated instead. */
export async function deleteRewardCoupon(couponId: string): Promise<boolean> {
  const { deleted } = await unwrap(apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/admin/rewards/coupons/${couponId}`));
  return deleted;
}
