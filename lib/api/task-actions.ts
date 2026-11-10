'use server';

import type { Task, TaskInput, ProofDecision } from '@/types/task';
import type { ApiResponse } from '@/types/api';
import { apiClient, unwrap } from '@/lib/api/client';
import { mapRawTaskToTask } from '@/lib/api/task-mapper';
import { toActionResult, type ActionResult } from '@/lib/api/action-result';

// Server Actions invoked directly from Client Components (the task form's
// create/update submit, and the review queue's approve/reject buttons).
// Requires the 'use server' directive at the top of this dedicated file so
// these functions can be imported and called from 'use client' components.

// TaskInput (camelCase) -> the backend's actual POST/PUT /admin/tasks body
// (snake_case — see adminTaskService.js#buildTaskData). Backend errors
// (INVALID_XP_REWARD, XP_REWARD_EXCEEDS_CAP, etc.) come back as
// { ok: false, error } (see action-result.ts) so their message survives
// production builds; callers use unwrapAction().
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
    special_reward_id: input.specialRewardId,
    proof_count: input.proofCount,
    xp_partial: xpPartial,
    allows_partial: input.allowsPartial,
    recurrence_days: input.recurrenceDays,
    is_paid: Boolean(input.isPaid),
    price: input.isPaid && input.price != null ? Number(input.price) : undefined,
  };
}

export async function createTask(input: FormData | TaskInput): Promise<ActionResult<Task>> {
  return toActionResult(async () => {
    const payload = input instanceof FormData ? input : toTaskPayload(input);
    const raw = await unwrap(apiClient.post<ApiResponse<{ task: any }>>('/admin/tasks', payload));
    return mapRawTaskToTask(raw.task);
  }, 'Failed to create this task.');
}

/**
 * Switches a task on or off. Off = hunters no longer see it or get it
 * assigned; their past completions and XP are kept.
 */
export async function setTaskActive(id: string, isActive: boolean): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    await unwrap(apiClient.patch<ApiResponse<unknown>>(`/admin/tasks/${id}`, { is_active: isActive }));
    return null;
  }, 'Failed to update this task.');
}

/** Only for a task no hunter has been assigned or touched (Task.canDelete); also deletes its images. */
export async function deleteTask(id: string): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    await unwrap(apiClient.delete<ApiResponse<unknown>>(`/admin/tasks/${id}`));
    return null;
  }, 'Failed to delete this task.');
}

/** data is null when the task no longer exists (404). */
export async function updateTask(id: string, input: FormData | TaskInput): Promise<ActionResult<Task | null>> {
  return toActionResult(async () => {
    try {
      const payload = input instanceof FormData ? input : toTaskPayload(input);
      const raw = await unwrap(apiClient.patch<ApiResponse<{ task: any }>>(`/admin/tasks/${id}`, payload));
      return mapRawTaskToTask(raw.task);
    } catch (error: unknown) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  }, 'Failed to save this task.');
}

/** note is required for RESUBMIT / REJECT and shown to the hunter. */
export async function decideReview(id: string, decision: ProofDecision, note?: string): Promise<ActionResult<null>> {
  return toActionResult(async () => {
    await unwrap(apiClient.post<ApiResponse<unknown>>(`/admin/tasks/review-queue/${id}/decision`, { decision, note }));
    return null;
  }, 'Could not save this decision.');
}
