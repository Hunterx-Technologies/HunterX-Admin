'use server';

// Server Functions backing the Notifications page (broadcast history).
// The send action lives in ./notification-actions.ts.

import { apiClient, unwrap } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { Broadcast } from '@/types/notification';

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

export async function getBroadcasts(): Promise<Broadcast[]> {
  try {
    const { broadcasts } = await unwrap(
      apiClient.get<ApiResponse<{ broadcasts: RawBroadcast[] }>>('/admin/notifications/broadcasts', { params: { limit: 20 } })
    );
    return broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      createdAt: b.created_at ?? null,
      recipients: b.recipients ?? 0,
      pushed: b.pushed ?? 0,
      pending: b.pending ?? 0,
      notPushed: b.not_pushed ?? 0,
      read: b.read ?? 0,
    }));
  } catch (error) {
    console.error('[getBroadcasts] failed:', error);
    return [];
  }
}
