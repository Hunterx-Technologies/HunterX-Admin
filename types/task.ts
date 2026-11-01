// Task shape matches the real backend (HunterX-Backend prisma/schema.prisma
// `tasks` model) — task_type/level_target/recurrence_days etc, not the
// verification-method/monthly/one-time concepts from the old mock contract.
// Those old concepts (VerificationMethod, PendingReviewItem) are kept below
// only for the Review Queue page, which has no backing data model yet and
// always renders empty (see lib/api/tasks.ts#getPendingReviews) — nothing
// creates or edits a PendingReviewItem.

export type TaskType = 'DAILY_ADMIN' | 'WEEKLY' | 'DAILY_FIXED' | 'MONTHLY';
export type CreatableTaskType = 'DAILY_ADMIN' | 'WEEKLY' | 'MONTHLY';
export type TaskStatus = 'active' | 'inactive';
export type LevelTarget = 'ALL' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type RewardEligibility = 'standard' | 'bonus';
export type CompletionStatus = 'COMPLETED' | 'SKIPPED' | 'PARTIAL' | 'IN_REVIEW' | 'RESUBMIT' | 'REJECTED';

export type Task = {
  id: string;
  title: string;
  description: string;
  tag: string;
  imageUrl: string | null;
  imageUrlMale?: string | null;
  imageUrlFemale?: string | null;
  taskType: TaskType;
  isDefaultDaily: boolean;
  /** Routine (built-in, or free recurring daily): on for every hunter unless they turn it off. Set by the backend. */
  isRoutine: boolean;
  isRecurring: boolean;
  recurrenceDays: number[]; // 0=Sun..6=Sat — WEEKLY only
  startDate: string | null;
  endDate: string | null;
  levelTarget: LevelTarget;
  targetValue: number | null;
  targetUnit: string | null;
  allowsPartial: boolean;
  xpPartial: number;
  xpReward: number;
  rewardEligibility: RewardEligibility;
  status: TaskStatus;
  createdAt: string;
  isPaid?: boolean;
  price?: number | string | null;
  currency?: string | null;
  /** True while no hunter has been assigned, completed, bought or earned XP from it — only then can it be deleted. */
  canDelete: boolean;
  /** Linked special reward (Rewards → Special rewards), or null: completing the task grants a card from it. */
  specialRewardId: string | null;
  /** Photos the hunter must upload (0 = no proof; 1–5). Proof is reviewed before XP is paid. */
  proofCount: number;
};

// Only DAILY_ADMIN/WEEKLY/MONTHLY are admin-creatable — DAILY_FIXED routines are
// seed-managed (see adminTaskService.js).
export type TaskInput = {
  title: string;
  description: string;
  tag: string;
  imageUrl: string | null;
  imageUrlMale?: string | null;
  imageUrlFemale?: string | null;
  imageMaleFile?: File | null;
  imageFemaleFile?: File | null;
  taskType: CreatableTaskType;
  isRecurring: boolean;
  recurrenceDays: number[];
  startDate: string | null; // 'YYYY-MM-DD'
  endDate: string | null; // 'YYYY-MM-DD'
  levelTarget: LevelTarget;
  targetValue: number | null;
  targetUnit: string;
  allowsPartial: boolean;
  xpPartial: number | null;
  xpReward: number | null;
  isPaid?: boolean;
  price?: number | null;
  currency?: string;
  /** null = no special reward; the task only gives its XP. */
  specialRewardId: string | null;
  /** 0 = no proof; 1–5 photos required. */
  proofCount: number;
};

export type TaskStats = {
  totalTasks: number;
  activeTasks: number;
  pendingReviews: number;
  avgXpReward: number;
  completionsToday: number;
};

export type TaskAssignmentStats = {
  /** Hunters who've had the task on their list at least once. */
  usersAssigned: number;
  /** On hunters' lists today. */
  shownToday: number;
  /** First / last day it was shown to any hunter (YYYY-MM-DD), null if never. */
  firstShownOn: string | null;
  lastShownOn: string | null;
  /** Hunters who completed it (fully or partly) at least once. */
  usersCompleted: number;
  completions: number;
  /** usersCompleted / usersAssigned, %. */
  completionRate: number;
};

// ── Proof review queue (HunterX-Backend taskProofService.js) ──────────

/** IN_REVIEW = waiting for a decision; the rest are past decisions (COMPLETED = approved). */
export type ProofReviewStatus = 'IN_REVIEW' | 'RESUBMIT' | 'REJECTED' | 'COMPLETED';
export type ProofDecision = 'APPROVE' | 'RESUBMIT' | 'REJECT';

export type PendingReviewItem = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  xpReward: number;
  proofCount: number;
  userId: string;
  userName: string;
  hunterId: string | null;
  scheduleDate: string;
  status: ProofReviewStatus;
  proofUrls: string[];
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  xpEarned: number;
};

export type ProofReviewPage = {
  items: PendingReviewItem[];
  nextCursor: string | null;
  counts: Record<ProofReviewStatus, number>;
};
