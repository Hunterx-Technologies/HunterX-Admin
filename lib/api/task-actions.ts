'use server';

import type { Task, TaskInput, PendingReviewItem } from '@/types/task';
import type { ApiResponse } from '@/types/api';
import { apiClient, unwrap } from '@/lib/api/client';
import { mapRawTaskToTask } from '@/lib/api/task-mapper';

// Server Actions invoked directly from Client Components (the task form's
// create/update submit, and the review queue's approve/reject buttons).
// Requires the 'use server' directive at the top of this dedicated file so
// these functions can be imported and called from 'use client' components.

// TaskInput (camelCase) -> the backend's actual POST/PUT /admin/tasks body
// (snake_case — see adminTaskService.js#buildTaskData). Backend errors
// (INVALID_XP_REWARD, XP_REWARD_EXCEEDS_CAP, etc.) surface as ApiError with
// a human-readable .message — the task form displays it rather than letting
// it throw uncaught.
function toTaskPayload(input: TaskInput) {
  const xpReward = input.xpReward ?? 0;
  const xpPartial = input.allowsPartial
    ? (input.xpPartial ?? Math.max(1, Math.floor(xpReward / 2)))
    : 0;

  return {
    title: input.title,
    description: input.description || null,
    tag: input.tag || null,
    image_url: input.imageUrl || input.imageUrlMale || null,
    image_url_male: input.imageUrlMale || input.imageUrl || null,
    image_url_female: input.imageUrlFemale || null,
    task_type: input.taskType,
    is_recurring: input.isRecurring,
    start_date: input.startDate,
    end_date: input.endDate || null,
    level_target: input.levelTarget || 'ALL',
    target_value: input.targetValue,
    target_unit: input.targetUnit || null,
    xp_reward: xpReward,
    xp_partial: xpPartial,
    allows_partial: input.allowsPartial,
    recurrence_days: input.recurrenceDays,
    is_paid: Boolean(input.isPaid),
    price: input.isPaid && input.price != null ? Number(input.price) : undefined,
  };
}

export async function createTask(input: FormData | TaskInput): Promise<Task> {
  const payload = input instanceof FormData ? input : toTaskPayload(input);
  const raw = await unwrap(apiClient.post<ApiResponse<{ task: any }>>('/admin/tasks', payload));
  return mapRawTaskToTask(raw.task);
}

export async function updateTask(id: string, input: FormData | TaskInput): Promise<Task | null> {
  try {
    const payload = input instanceof FormData ? input : toTaskPayload(input);
    const raw = await unwrap(apiClient.patch<ApiResponse<{ task: any }>>(`/admin/tasks/${id}`, payload));
    return mapRawTaskToTask(raw.task);
  } catch (error: unknown) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

export async function decideReview(id: string, status: 'approved' | 'rejected'): Promise<PendingReviewItem> {
  return unwrap(apiClient.post<ApiResponse<PendingReviewItem>>(`/admin/tasks/review-queue/${id}/decision`, { status }));
}
