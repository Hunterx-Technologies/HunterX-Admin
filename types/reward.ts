export type DiscountType = 'PERCENT' | 'FLAT';

/**
 * What grants the scratch card: a streak of `value` days, reaching level `value`, the birthday (value 0),
 * or completing a task this special reward is linked to (TASK; named by `description`).
 */
export type RewardTriggerKind = 'STREAK' | 'LEVEL_UP' | 'BIRTHDAY' | 'TASK';

/** A coupon a reward trigger's scratch card can land on. */
export interface RewardCoupon {
  id: string;
  triggerId: string;
  title: string;
  description: string | null;
  couponCode: string;
  discountType: DiscountType;
  discountValue: number;
  currency: string | null;
  weight: number;
  totalQuantity: number | null;
  awardedCount: number;
  remaining: number | null;
  validFrom: string | null;
  validUntil: string | null;
  validDaysAfterAward: number | null;
  productName: string | null;
  productCategory: string | null;
  productImageUrl: string | null;
  isActive: boolean;
  /** false = can't be drawn right now (inactive, outside its window, or out of stock). */
  eligible: boolean;
  /** Live chance of being drawn among the trigger's eligible coupons. */
  probabilityPercent: number;
}

export interface RewardTrigger {
  id: string;
  kind: RewardTriggerKind;
  value: number;
  /** Inactive rewards grant no new cards; cards already granted are kept. */
  isActive: boolean;
  /** Special (TASK) rewards only: the tasks it's linked to. */
  tasks?: { id: string; title: string; isActive: boolean }[];
  description: string | null;
  cardsGranted: number;
  /** Cards granted while nothing was in stock — they pick a prize when scratched. */
  cardsAwaitingStock: number;
  coupons: RewardCoupon[];
}

/** Form state for creating / editing a coupon. Empty strings mean "not set". */
export interface CouponInput {
  title: string;
  couponCode: string;
  discountType: DiscountType;
  discountValue: string;
  currency: string;
  weight: string;
  totalQuantity: string;
  validFrom: string;
  validUntil: string;
  validDaysAfterAward: string;
  description: string;
  productName: string;
  productCategory: string;
  /** A newly picked image to upload (compressed and stored in Cloudinary by the backend). */
  imageFile: File | null;
  /** Clear the coupon's current image on save. */
  removeImage: boolean;
  isActive: boolean;
}
