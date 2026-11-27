'use server';

// Server Functions backing the Rewards page (scratch-card coupons for
// streaks, level-ups and birthdays).
// Mutations live in ./reward-actions.ts. See the backend's
// adminRewardService.js for how coupons are allocated.

import { apiClient, unwrap } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { CouponAllocationStatus, RewardCoupon, RewardHistoryEntry, RewardStatus, RewardTrigger, RewardTriggerKind } from '@/types/reward';
import type { RewardTab } from '@/lib/reward-kinds';

// Backend shape — see adminRewardService.js#serializeCoupon.
export interface RawRewardCoupon {
  id: string;
  trigger_id: string;
  title: string;
  description: string | null;
  coupon_code: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number;
  currency: string | null;
  chance_percent: number;
  total_quantity: number | null;
  awarded_count: number;
  remaining: number | null;
  valid_from: string | null;
  valid_until: string | null;
  valid_days_after_award: number | null;
  product_name: string | null;
  product_category: string | null;
  product_image_url: string | null;
  redeem_url: string | null;
  is_active: boolean;
  allocation: { target: number; assigned: number; remaining_quota: number; available_stock: number | null; status: CouponAllocationStatus };
}

interface RawRewardTrigger {
  id: string;
  kind: RewardTriggerKind;
  value: number;
  is_active: boolean;
  tasks?: { id: string; title: string; is_active: boolean }[];
  description: string | null;
  activated_at: string | null;
  is_live: boolean;
  status?: RewardStatus;
  total_percent: number;
  unallocated_percent: number;
  eligible_users: number;
  assigned_count: number;
  lifetime_eligible?: number;
  lifetime_assigned?: number;
  historical_eligible?: number;
  historical_assigned?: number;
  cards_granted: number;
  legacy_unfilled_cards: number;
  coupons: RawRewardCoupon[];
}

function mapCoupon(c: RawRewardCoupon): RewardCoupon {
  return {
    id: c.id,
    triggerId: c.trigger_id,
    title: c.title,
    description: c.description,
    couponCode: c.coupon_code,
    discountType: c.discount_type,
    discountValue: c.discount_value,
    currency: c.currency,
    chancePercent: c.chance_percent,
    totalQuantity: c.total_quantity,
    awardedCount: c.awarded_count,
    remaining: c.remaining,
    validFrom: c.valid_from,
    validUntil: c.valid_until,
    validDaysAfterAward: c.valid_days_after_award,
    productName: c.product_name,
    productCategory: c.product_category,
    productImageUrl: c.product_image_url,
    redeemUrl: c.redeem_url ?? null,
    isActive: c.is_active,
    allocation: {
      target: c.allocation.target,
      assigned: c.allocation.assigned,
      remainingQuota: c.allocation.remaining_quota,
      availableStock: c.allocation.available_stock,
      status: c.allocation.status,
    },
  };
}

export async function getRewards(tab: RewardTab): Promise<{ triggers: RewardTrigger[]; error: string | null }> {
  try {
    const { rewards: triggers } = await unwrap(
      apiClient.get<ApiResponse<{ rewards: RawRewardTrigger[] }>>(`/admin/rewards/${tab}`)
    );
    return {
      error: null,
      triggers: triggers.map((m) => ({
        id: m.id,
        kind: m.kind,
        value: m.value,
        isActive: m.is_active,
        tasks: m.tasks?.map((t) => ({ id: t.id, title: t.title, isActive: t.is_active })),
        description: m.description,
        activatedAt: m.activated_at,
        isLive: m.is_live,
        // Older backends don't send status: derive it the same way.
        status: m.status ?? (!m.is_active ? 'INACTIVE' : !m.activated_at ? 'NOT_ACTIVATED' : m.is_live ? 'ACTIVE' : 'SCHEDULED'),
        totalPercent: m.total_percent,
        unallocatedPercent: m.unallocated_percent,
        eligibleUsers: m.eligible_users,
        assignedCount: m.assigned_count,
        lifetimeEligible: m.lifetime_eligible ?? m.eligible_users,
        lifetimeAssigned: m.lifetime_assigned ?? m.assigned_count,
        historicalEligible: m.historical_eligible ?? 0,
        historicalAssigned: m.historical_assigned ?? 0,
        cardsGranted: m.cards_granted,
        legacyUnfilledCards: m.legacy_unfilled_cards,
        coupons: m.coupons.map(mapCoupon),
      })),
    };
  } catch (error: unknown) {
    console.error(`[getRewards:${tab}] failed:`, error);
    return { triggers: [], error: error instanceof Error ? error.message : 'Failed to load rewards.' };
  }
}

/** A reward's configuration history (who changed what, before → after), oldest first. Read-only. */
export async function getRewardHistory(tab: RewardTab, rewardId: string): Promise<{ history: RewardHistoryEntry[]; error: string | null }> {
  try {
    const { history } = await unwrap(apiClient.get<ApiResponse<{ history: RewardHistoryEntry[] }>>(`/admin/rewards/${tab}/${rewardId}/history`));
    return { history, error: null };
  } catch (error: unknown) {
    console.error(`[getRewardHistory:${tab}] failed:`, error);
    return { history: [], error: error instanceof Error ? error.message : 'Failed to load the history.' };
  }
}
