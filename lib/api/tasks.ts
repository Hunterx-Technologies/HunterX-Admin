'use server';

// Server Functions backing the tasks list/detail/review pages. This whole
// file must be a file-level 'use server' module (not inline per-function):
// app/(dashboard)/layout.tsx, a Client Component, imports getTasks() directly
// for a sidebar count, and Next.js disallows inline 'use server' inside any
// file that's part of a Client Component's module graph. (The sync
// deriveRewardEligibility helper lives in ./reward-eligibility.ts instead,
// since a 'use server' file's exports must all be async functions.)
// Mutating actions (create/update/review decision) live in ./task-actions.ts.

import { apiClient } from '@/lib/api/client';
import { mapRawTaskToTask } from '@/lib/api/task-mapper';
import type {
  Task,
  TaskStats,
  CompletionStatus,
  TaskAssignmentStats,
  PendingReviewItem,
  ProofReviewPage,
  ProofReviewStatus,
} from '@/types/task';

export async function getTasks(): Promise<Task[]> {
  try {
    const response = await apiClient.get<any>('/admin/tasks');
    const resData = response.data;
    if (resData?.success && Array.isArray(resData.data?.tasks)) {
      return resData.data.tasks.map(mapRawTaskToTask);
    }
    if (resData?.success && Array.isArray(resData.data)) {
      return resData.data.map(mapRawTaskToTask);
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function getTaskById(id: string): Promise<Task | null> {
  try {
    const tasks = await getTasks();
    return tasks.find((t) => t.id === id) ?? null;
  } catch (error) {
    return null;
  }
}

export async function getTaskStats(): Promise<TaskStats> {
  try {
    const tasks = await getTasks();
    const active = tasks.filter((t) => t.status === 'active');
    const pendingReviews = await getPendingReviews();
    return {
      totalTasks: tasks.length,
      activeTasks: active.length,
      pendingReviews: pendingReviews.length,
      avgXpReward: tasks.length ? Math.round(tasks.reduce((sum, t) => sum + t.xpReward, 0) / tasks.length) : 0,
      completionsToday: 0,
    };
  } catch (error) {
    return {
      totalTasks: 0,
      activeTasks: 0,
      pendingReviews: 0,
      avgXpReward: 0,
      completionsToday: 0,
    };
  }
}

const EMPTY_ASSIGNMENT_STATS: TaskAssignmentStats = {
  usersAssigned: 0, shownToday: 0, firstShownOn: null, lastShownOn: null, usersCompleted: 0, completions: 0, completionRate: 0,
};

export async function getTaskAssignmentStats(taskId: string): Promise<TaskAssignmentStats> {
  try {
    const response = await apiClient.get(`/admin/tasks/${taskId}/assignment-stats`);
    const s = response.data?.success ? response.data.data : null;
    if (!s) return EMPTY_ASSIGNMENT_STATS;
    return {
      usersAssigned: s.users_assigned ?? 0,
      shownToday: s.shown_today ?? 0,
      firstShownOn: s.first_shown_on ?? null,
      lastShownOn: s.last_shown_on ?? null,
      usersCompleted: s.users_completed ?? 0,
      completions: s.completions ?? 0,
      completionRate: s.completion_rate ?? 0,
    };
  } catch {
    return EMPTY_ASSIGNMENT_STATS;
  }
}

interface RawProofReview {
  id: string;
  task_id: string;
  task_title: string;
  task_type: PendingReviewItem['taskType'];
  xp_reward: number;
  proof_count: number;
  user_id: string;
  user_name: string | null;
  hunter_id: string | null;
  schedule_date: string;
  status: ProofReviewStatus;
  proof_urls: string[];
  proof_submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  xp_earned: number;
}

const EMPTY_COUNTS: Record<ProofReviewStatus, number> = { IN_REVIEW: 0, RESUBMIT: 0, REJECTED: 0, COMPLETED: 0 };

/** One page of proof submissions with that status (IN_REVIEW = the queue, oldest first). */
export async function getProofReviews(status: ProofReviewStatus = 'IN_REVIEW', cursor?: string): Promise<ProofReviewPage & { error: string | null }> {
  try {
    const response = await apiClient.get('/admin/tasks/review-queue', { params: { status, ...(cursor ? { cursor } : {}) } });
    const data = response.data?.data as { items: RawProofReview[]; next_cursor: string | null; counts: Record<string, number> };
    return {
      error: null,
      nextCursor: data.next_cursor,
      counts: {
        IN_REVIEW: data.counts.in_review ?? 0,
        RESUBMIT: data.counts.resubmit ?? 0,
        REJECTED: data.counts.rejected ?? 0,
        COMPLETED: data.counts.completed ?? 0,
      },
      items: data.items.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        taskTitle: r.task_title,
        taskType: r.task_type,
        xpReward: r.xp_reward,
        proofCount: r.proof_count,
        userId: r.user_id,
        userName: r.user_name || 'Hunter',
        hunterId: r.hunter_id,
        scheduleDate: r.schedule_date,
        status: r.status,
        proofUrls: r.proof_urls,
        submittedAt: r.proof_submitted_at,
        reviewedAt: r.reviewed_at,
        reviewNote: r.review_note,
        xpEarned: r.xp_earned,
      })),
    };
  } catch (error: unknown) {
    console.error('[getProofReviews] failed:', error);
    return { items: [], nextCursor: null, counts: EMPTY_COUNTS, error: error instanceof Error ? error.message : 'Failed to load the review queue.' };
  }
}

/** Submissions waiting for a decision (first page) — for counts and dashboard alerts. */
export async function getPendingReviews(): Promise<PendingReviewItem[]> {
  return (await getProofReviews('IN_REVIEW')).items;
}
