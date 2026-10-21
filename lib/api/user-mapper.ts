import type { User, UserRank, UserActivityLogEntry } from '@/types/user';

function mapActivityLogEntry(a: any): UserActivityLogEntry {
  const rawType = String(a.type || 'TASK_COMPLETION').toUpperCase();
  const id = String(a.id);
  const occurredAt =
    a.occurred_at ||
    a.occurredAt ||
    a.completed_at ||
    a.completedAt ||
    a.schedule_date ||
    new Date().toISOString();
  const reason = a.reason ?? null;
  const details = a.details ?? null;
  const performedBy =
    a.performed_by || a.performedBy
      ? {
          id: String(a.performed_by?.id || a.performedBy?.id || ''),
          name: String(a.performed_by?.name || a.performedBy?.name || ''),
        }
      : null;

  if (rawType === 'BAN') {
    return {
      id,
      type: 'BAN',
      title: a.title || 'User Banned',
      occurredAt,
      reason,
      details,
      performedBy,
    };
  }

  if (rawType === 'UNBAN') {
    return {
      id,
      type: 'UNBAN',
      title: a.title || 'User Unbanned',
      occurredAt,
      reason,
      details,
      performedBy,
    };
  }

  if (rawType === 'STREAK_RESET') {
    return {
      id,
      type: 'STREAK_RESET',
      title: a.title || 'Streak Reset',
      occurredAt,
      reason,
      details,
      performedBy,
    };
  }

  const rawStatus = String(a.status || 'completed').toLowerCase();
  const status: 'completed' | 'partial' | 'skipped' =
    rawStatus === 'partial' ? 'partial' : rawStatus === 'skipped' ? 'skipped' : 'completed';

  return {
    id,
    type: 'TASK_COMPLETION',
    title: a.title || a.task_title || a.taskTitle || 'Task completed',
    occurredAt,
    taskTitle: a.task_title ?? a.taskTitle ?? a.title ?? 'Task',
    completedAt: a.completed_at ?? a.completedAt ?? occurredAt,
    scheduleDate: a.schedule_date ?? a.scheduleDate,
    xpEarned: Number(a.xp_earned ?? a.xpEarned ?? 0),
    status,
  };
}

/**
 * Maps a raw snake_case user row (as returned by GET /admin/users list items,
 * and by the ban/unban/xp-adjustment/reset-streak actions) to the frontend's
 * User type. Kept as a plain sync function in its own module (not a Server
 * Function) so both lib/api/users.ts ('use server') and lib/api/user-actions.ts
 * ('use server') can import it — a 'use server' file's exports must all be
 * async functions, so this can't live inside either of them.
 */
export function mapRawUserToUser(raw: any): User {
  const level = raw.level ?? 1;
  const heightCm = raw.height_cm ?? raw.heightCm ?? 0;
  const weightKg = raw.weight_kg ?? raw.weightKg ?? 0;
  const bmi = raw.bmi ?? (weightKg && heightCm ? Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10 : 0);

  const rawRank = String(raw.rank || 'bronze').toLowerCase();
  const validRanks: UserRank[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'];
  const rank: UserRank = validRanks.includes(rawRank as UserRank) ? (rawRank as UserRank) : 'bronze';

  const rawAuth = Array.isArray(raw.auth_providers) && raw.auth_providers.length > 0
    ? String(raw.auth_providers[0]).toLowerCase()
    : String(raw.auth_provider || raw.authProvider || 'email').toLowerCase();
  const authProvider = rawAuth.includes('google') ? 'google' : rawAuth.includes('apple') ? 'apple' : 'email';

  return {
    id: String(raw.id),
    hunterId: raw.hunter_id || raw.hunterId || `HTR-${String(raw.id).padStart(5, '0')}`,
    displayName: raw.name || raw.displayName || raw.email?.split('@')[0] || 'Hunter',
    email: raw.email || '',
    avatarUrl: raw.avatar_url || raw.avatar_id || raw.avatarUrl || null,
    level,
    xp: raw.xp ?? 0,
    rank,
    currentStreak: raw.streak ?? raw.current_streak ?? raw.currentStreak ?? 0,
    longestStreak: raw.longest_streak ?? raw.longestStreak ?? 0,
    dragonStage: raw.dragon_stage ?? raw.dragonStage ?? 1,
    heightCm,
    weightKg,
    bmi,
    status: raw.is_banned || String(raw.status || '').toUpperCase() === 'BANNED' ? 'banned' : 'active',
    banReason: raw.ban_reason ?? raw.banReason ?? null,
    bannedAt: raw.banned_at ?? raw.bannedAt ?? null,
    authProvider,
    role: (raw.role?.toLowerCase() as 'admin' | 'user') || 'user',
    createdAt: raw.signup_date || raw.created_at || raw.createdAt || new Date().toISOString(),
    activityLog: (raw.activity_log || raw.activityLog || []).map(mapActivityLogEntry),
    badges: (raw.badges || []).map((b: any) => ({
      id: String(b.id),
      name: b.name,
      description: b.description ?? '',
      earnedAt: b.earned_at ?? b.earnedAt,
    })),
    rewardClaims: (raw.reward_claims || raw.rewardClaims || []).map((r: any) => ({
      id: String(r.id),
      rewardName: r.reward_name ?? r.rewardName ?? 'Reward',
      type: r.type ?? 'coupon',
      status: r.status ? String(r.status).toLowerCase() : undefined,
      claimedAt: r.claimed_at ?? r.claimedAt ?? r.assigned_at,
    })),
    feedbackTickets: (raw.feedback_tickets || raw.feedbackTickets || []).map((f: any) => ({
      id: String(f.id),
      subject: f.subject,
      message: f.message ?? '',
      rating: f.rating ?? null,
      status: f.status === 'resolved' ? 'resolved' : 'open',
      createdAt: f.created_at ?? f.createdAt,
    })),
  };
}
