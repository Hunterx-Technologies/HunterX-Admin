'use server';

// Server Functions backing the Notifications page (broadcast history).
// The send action lives in ./notification-actions.ts.

import { apiClient, unwrap } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { Broadcast, BroadcastSchedule } from '@/types/notification';
import type { PaginationInfo } from '@/types/user';
import { mapSchedule, type RawSchedule } from '@/lib/api/schedule-mapper';

// Backend shape — see broadcastService.js#listBroadcasts.
interface RawBroadcast {
  id: string;
  title: string;
  body: string;
  created_at?: string | null;
  recipients?: number;
  pushed?: number;
  pending?: number;
  not_pushed?: number;
  read?: number;
}

const NOTIFICATIONS_PAGE_SIZE = 10;

function emptyPage(page: number): PaginationInfo {
  return { page, limit: NOTIFICATIONS_PAGE_SIZE, total_count: 0, total_pages: 0, has_next_page: false };
}

function logFailure(label: string, error: any) {
  if (error?.status === 401 || error?.status === 403 || error?.code === 'unauthorized') {
    console.warn(`[${label}]: Unauthorized or session expired.`);
  } else {
    console.error(`[${label}] failed:`, error);
  }
}

/** One page of past broadcasts, newest first. */
export async function getBroadcasts(page = 1): Promise<{ broadcasts: Broadcast[]; pagination: PaginationInfo }> {
  try {
    const { broadcasts, pagination } = await unwrap(
      apiClient.get<ApiResponse<{ broadcasts: RawBroadcast[]; pagination: PaginationInfo }>>('/admin/notifications/broadcasts', {
        params: { page, limit: NOTIFICATIONS_PAGE_SIZE },
      })
    );
    return {
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        title: b.title,
        body: b.body,
        createdAt: b.created_at ?? null,
        recipients: b.recipients ?? 0,
        pushed: b.pushed ?? 0,
        pending: b.pending ?? 0,
        notPushed: b.not_pushed ?? 0,
        read: b.read ?? 0,
      })),
      pagination: pagination ?? emptyPage(page),
    };
  } catch (error: any) {
    logFailure('getBroadcasts', error);
    return { broadcasts: [], pagination: emptyPage(page) };
  }
}

/** One page of active scheduled / recurring notifications (scheduled, paused, sending, failed), next send first. */
export async function getSchedules(page = 1): Promise<{ schedules: BroadcastSchedule[]; pagination: PaginationInfo }> {
  try {
    const { schedules, pagination } = await unwrap(
      apiClient.get<ApiResponse<{ schedules: RawSchedule[]; pagination: PaginationInfo }>>('/admin/notifications/schedules', {
        params: { scope: 'active', page, limit: NOTIFICATIONS_PAGE_SIZE },
      })
    );
    return { schedules: schedules.map(mapSchedule), pagination: pagination ?? emptyPage(page) };
  } catch (error: any) {
    logFailure('getSchedules', error);
    return { schedules: [], pagination: emptyPage(page) };
  }
}
