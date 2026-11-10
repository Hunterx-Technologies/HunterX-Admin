'use server';

import type { ApiResponse } from '@/types/api';
import type { BroadcastInput, BroadcastResult, BroadcastSchedule, ScheduleInput } from '@/types/notification';
import { apiClient, unwrap } from '@/lib/api/client';
import { mapSchedule, toSchedulePayload, type RawSchedule } from '@/lib/api/schedule-mapper';

// Server Action invoked from the broadcast form (preview + send). Backend
// validation errors (TITLE_TOO_LONG, INVALID_URL, ...) surface as ApiError
// with a human-readable .message for the form to display.

function toBroadcastPayload(input: BroadcastInput, dryRun: boolean) {
  return {
    title: input.title,
    body: input.body,
    url: input.url || undefined,
    audience: input.audience,
    inactive_days: input.audience === 'inactive' ? input.inactiveDays : undefined,
    dry_run: dryRun,
  };
}

export async function sendBroadcast(input: BroadcastInput, dryRun: boolean): Promise<BroadcastResult> {
  const raw = await unwrap(
    apiClient.post<ApiResponse<{ dry_run: boolean; broadcast_id?: string; recipients: number; reachable_by_push: number }>>(
      '/admin/notifications/broadcast',
      toBroadcastPayload(input, dryRun)
    )
  );
  return {
    dryRun: raw.dry_run,
    broadcastId: raw.broadcast_id ?? null,
    recipients: raw.recipients,
    reachableByPush: raw.reachable_by_push,
  };
}

// ── Scheduled / recurring broadcasts ──

type ScheduleResponse = ApiResponse<{ schedule: RawSchedule }>;

export async function createSchedule(input: ScheduleInput): Promise<BroadcastSchedule> {
  const { schedule } = await unwrap(apiClient.post<ScheduleResponse>('/admin/notifications/schedules', toSchedulePayload(input)));
  return mapSchedule(schedule);
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<BroadcastSchedule> {
  const { schedule } = await unwrap(
    apiClient.patch<ScheduleResponse>(`/admin/notifications/schedules/${encodeURIComponent(id)}`, toSchedulePayload(input))
  );
  return mapSchedule(schedule);
}

export async function changeScheduleState(id: string, action: 'pause' | 'resume' | 'cancel'): Promise<BroadcastSchedule> {
  const { schedule } = await unwrap(
    apiClient.post<ScheduleResponse>(`/admin/notifications/schedules/${encodeURIComponent(id)}/${action}`)
  );
  return mapSchedule(schedule);
}
