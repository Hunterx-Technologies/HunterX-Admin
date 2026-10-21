export type UserRank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'mythic';
export type UserStatus = 'active' | 'banned';
export type AuthProvider = 'email' | 'google' | 'apple';

export type PerformedBy = {
  id: string;
  name: string;
} | null;

export type TaskCompletionActivity = {
  id: string;
  type: 'TASK_COMPLETION';
  title: string;
  occurredAt: string;
  taskTitle: string;
  completedAt?: string;
  scheduleDate?: string;
  xpEarned: number;
  status: 'completed' | 'partial' | 'skipped';
};

export type BanActivity = {
  id: string;
  type: 'BAN';
  title: string;
  occurredAt: string;
  reason: string | null;
  details: Record<string, any> | null;
  performedBy: PerformedBy;
};

export type UnbanActivity = {
  id: string;
  type: 'UNBAN';
  title: string;
  occurredAt: string;
  reason: string | null;
  details: Record<string, any> | null;
  performedBy: PerformedBy;
};

export type StreakResetActivity = {
  id: string;
  type: 'STREAK_RESET';
  title: string;
  occurredAt: string;
  reason: string | null;
  details: {
    previous_streak?: number;
    previousStreak?: number;
    [key: string]: any;
  } | null;
  performedBy: PerformedBy;
};

export type UserActivityLogEntry =
  | TaskCompletionActivity
  | BanActivity
  | UnbanActivity
  | StreakResetActivity;

export type UserBadge = {
  id: string;
  name: string;
  description: string;
  earnedAt: string;
};

export type UserRewardClaim = {
  id: string;
  rewardName: string;
  type: 'coupon' | 'cosmetic' | 'xp_boost';
  status?: 'active' | 'claimed' | 'expired';
  claimedAt: string;
};

export type UserFeedbackTicket = {
  id: string;
  subject: string;
  message: string;
  rating: number | null;
  status: 'open' | 'resolved';
  createdAt: string;
};

export type User = {
  id: string;
  hunterId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  rank: UserRank;
  currentStreak: number;
  longestStreak: number;
  dragonStage: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  status: UserStatus;
  banReason: string | null;
  bannedAt: string | null;
  authProvider: AuthProvider;
  role?: 'admin' | 'user' | string;
  createdAt: string;
  activityLog: UserActivityLogEntry[];
  badges: UserBadge[];
  rewardClaims: UserRewardClaim[];
  feedbackTickets: UserFeedbackTicket[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
};

export type ApiUser = {
  id: string;
  hunter_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  level: number;
  rank: string;
  streak: number;
  longest_streak: number;
  status: 'ACTIVE' | 'BANNED' | string;
  ban_reason?: string | null;
  banned_at?: string | null;
  signup_date: string;
  auth_providers: string[];
};

export type PaginationInfo = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  has_next_page: boolean;
};

export type UsersQueryParams = {
  search?: string;
  rank?: string;
  level?: string;
  status?: string;
  date_preset?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: string;
  page?: number;
  limit?: number;
};

