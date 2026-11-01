import type { TaskType } from '@/types/task';

// How task types read in the admin panel. The backend keeps two daily
// types — DAILY_FIXED (the seeded routine tasks) and DAILY_ADMIN (ones
// admins create) — but to an admin both are just "Daily"; whether a task
// repeats is shown separately (Recurring / One-time).

export type TaskTypeGroup = 'daily' | 'weekly' | 'monthly';

export function taskTypeGroup(type: TaskType): TaskTypeGroup {
  if (type === 'WEEKLY') return 'weekly';
  if (type === 'MONTHLY') return 'monthly';
  return 'daily';
}

export const TASK_TYPE_GROUP_LABEL: Record<TaskTypeGroup, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const taskTypeLabel = (type: TaskType) => TASK_TYPE_GROUP_LABEL[taskTypeGroup(type)];

export const recurrenceLabel = (isRecurring: boolean) => (isRecurring ? 'Recurring' : 'One-time');
