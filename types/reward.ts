export type DiscountType = 'PERCENT' | 'FLAT';

/**
 * What grants the scratch card: a streak of `value` days, reaching level `value`, the birthday (value 0),
 * or completing a task this special reward is linked to (TASK; named by `description`).
 */
export type RewardTriggerKind = 'STREAK' | 'LEVEL_UP' | 'BIRTHDAY' | 'TASK';

/**
 * Where a coupon stands for its reward's current window (backend
 * rewardService.js#couponAllocationStates, adminRewardService.js#couponStates):
 * AVAILABLE (owed now, the next hunter can get it), WAITING_FOR_HUNTERS (nobody
 * has completed the reward yet), PENDING_ALLOCATION (below its share; it comes up
 * as more hunters complete), QUOTA_REACHED (at its share even counting the next
 * hunter), or why it can't be assigned: OUT_OF_STOCK, NO_CHANCE (0%), NOT_STARTED,
 * ENDED, INACTIVE (coupon off), REWARD_INACTIVE (reward off), SCHEDULED (the
 * reward's activation is in the future).
 */
export type CouponAllocationStatus =
  | 'AVAILABLE'
  | 'WAITING_FOR_HUNTERS'
  | 'PENDING_ALLOCATION'
  | 'QUOTA_REACHED'
  | 'OUT_OF_STOCK'
  | 'NO_CHANCE'
  | 'NOT_STARTED'
  | 'ENDED'
  | 'INACTIVE'
  | 'REWARD_INACTIVE'
  | 'SCHEDULED';

/** ACTIVE (on and activated), SCHEDULED (on, activation in the future), INACTIVE (off), NOT_ACTIVATED (on, never activated). */
export type RewardStatus = 'ACTIVE' | 'SCHEDULED' | 'INACTIVE' | 'NOT_ACTIVATED';

/** A coupon's allocation figures for its reward's current eligible population. */
export interface CouponAllocation {
  /**
   * How many of the eligible hunters this coupon should have by now: the reward's total share (eligible × the
   * chances' sum, to the nearest hunter) split across its coupons by largest remainder — this coupon's exact
   * share rounded down or up.
   */
  target: number;
  /** Hunters assigned this coupon since the reward's activation. */
  assigned: number;
  /** max(0, target − assigned). */
  remainingQuota: number;
  /** null = unlimited. */
  availableStock: number | null;
  status: CouponAllocationStatus;
}

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
  /** Share of the reward's eligible hunters this coupon targets (0–100). */
  chancePercent: number;
  totalQuantity: number | null;
  awardedCount: number;
  remaining: number | null;
  validFrom: string | null;
  validUntil: string | null;
  validDaysAfterAward: number | null;
  productName: string | null;
  productCategory: string | null;
  productImageUrl: string | null;
  /** The partner's website; the app's "Redeem now" opens it. null = none. */
  redeemUrl: string | null;
  isActive: boolean;
  allocation: CouponAllocation;
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
  /** Only completions from this moment on are considered. null = not activated. */
  activatedAt: string | null;
  /** Switched on and activated: completions get an allocation now. */
  isLive: boolean;
  status: RewardStatus;
  /** Sum of the active coupons' chances (≤ 100). */
  totalPercent: number;
  /** 100 − totalPercent: hunters who get no coupon. Never redistributed. */
  unallocatedPercent: number;
  /** Current window: hunters considered since activation, with or without a coupon. */
  eligibleUsers: number;
  /** Current window: of those, how many got a coupon. */
  assignedCount: number;
  /** Every hunter ever considered for this reward, whatever the activation time is now. */
  lifetimeEligible: number;
  /** Every coupon this reward ever assigned. */
  lifetimeAssigned: number;
  /** Considered before the current window (e.g. under an earlier activation time). */
  historicalEligible: number;
  /** Assigned before the current window. */
  historicalAssigned: number;
  cardsGranted: number;
  /** Cards from before immediate allocation that never got a coupon. Hidden from their hunters; never filled. */
  legacyUnfilledCards: number;
  coupons: RewardCoupon[];
}

/** Form state for creating / editing a coupon. Empty strings mean "not set". */
export interface CouponInput {
  title: string;
  couponCode: string;
  discountType: DiscountType;
  discountValue: string;
  currency: string;
  chancePercent: string;
  totalQuantity: string;
  validFrom: string;
  validUntil: string;
  validDaysAfterAward: string;
  description: string;
  productName: string;
  productCategory: string;
  redeemUrl: string;
  /** A newly picked image to upload (compressed and stored in Cloudinary by the backend). */
  imageFile: File | null;
  /** Clear the coupon's current image on save. */
  removeImage: boolean;
  isActive: boolean;
}

/** One change to a reward's configuration, from reward_config_audit (read-only). */
export interface RewardHistoryEntry {
  id: string;
  at: string;
  /** TRIGGER_CREATED | TRIGGER_UPDATED | TRIGGER_DELETED | COUPON_CREATED | COUPON_UPDATED | COUPON_DEACTIVATED | COUPON_DELETED | CHANCES_SET */
  action: string;
  /** null = not recorded (e.g. a change made outside the admin panel). */
  admin: { id: string; name: string; email: string | null } | null;
  coupon: { id: string | null; title: string | null } | null;
  /** Only what changed for an update; every setting for a create or delete. CHANCES_SET: one per coupon. */
  changes: { field: string; coupon?: { id: string; title: string }; before: unknown; after: unknown }[];
}
