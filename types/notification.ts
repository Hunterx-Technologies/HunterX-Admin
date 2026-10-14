export type BroadcastAudience = 'all' | 'inactive' | 'users';

export interface BroadcastInput {
  title: string;
  body: string;
  url: string;
  audience: BroadcastAudience;
  inactiveDays: number;
  /** Comma/space/newline-separated user ids (audience = 'users'). */
  userIds: string;
}

export interface BroadcastResult {
  dryRun: boolean;
  broadcastId: string | null;
  recipients: number;
  reachableByPush: number;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  createdAt: string | null;
  recipients: number;
  pushed: number;
  pending: number;
  notPushed: number;
  read: number;
}
