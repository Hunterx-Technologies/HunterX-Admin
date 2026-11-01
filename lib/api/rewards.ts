'use server';

// Server Functions backing the Rewards page (scratch-card coupons for
// streaks, level-ups and birthdays).
// Mutations live in ./reward-actions.ts. See the backend's
// adminRewardService.js for how coupons are drawn.

import { apiClient, unwrap } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { RewardCoupon, RewardTrigger, RewardTriggerKind } from '@/types/reward';
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
  weight: number;
  total_quantity: number | null;
  awarded_count: number;
  remaining: number | null;
  valid_from: string | null;
  valid_until: string | null;
  valid_days_after_award: number | null;
  product_name: string | null;
  product_category: string | null;
  product_image_url: string | null;
  is_active: boolean;
  eligible: boolean;
  probability_percent: number;
}

interface RawRewardTrigger {
  id: string;
  kind: RewardTriggerKind;
  value: number;
  is_active: boolean;
  tasks?: { id: string; title: string; is_active: boolean }[];
  description: string | null;
  cards_granted: number;
  cards_awaiting_stock: number;
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
    weight: c.weight,
    totalQuantity: c.total_quantity,
    awardedCount: c.awarded_count,
    remaining: c.remaining,
    validFrom: c.valid_from,
    validUntil: c.valid_until,
    validDaysAfterAward: c.valid_days_after_award,
    productName: c.product_name,
    productCategory: c.product_category,
    productImageUrl: c.product_image_url,
    isActive: c.is_active,
    eligible: c.eligible,
    probabilityPercent: c.probability_percent,
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
        cardsGranted: m.cards_granted,
        cardsAwaitingStock: m.cards_awaiting_stock,
        coupons: m.coupons.map(mapCoupon),
      })),
    };
  } catch (error: unknown) {
    console.error(`[getRewards:${tab}] failed:`, error);
    return { triggers: [], error: error instanceof Error ? error.message : 'Failed to load rewards.' };
  }
}
