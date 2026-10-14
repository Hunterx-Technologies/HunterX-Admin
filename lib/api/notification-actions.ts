'use server';

import type { ApiResponse } from '@/types/api';
import type { BroadcastInput, BroadcastResult } from '@/types/notification';
import { apiClient, unwrap } from '@/lib/api/client';

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
    user_ids: input.audience === 'users' ? input.userIds.split(/[\s,]+/).filter(Boolean) : undefined,
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
