export type BroadcastAudience = 'all' | 'inactive';

export interface BroadcastInput {
  title: string;
  body: string;
  url: string;
  audience: BroadcastAudience;
  inactiveDays: number;
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

// ── Scheduled / recurring broadcasts (broadcastScheduleService.js) ──

export type BroadcastRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type ScheduleStatus = 'SCHEDULED' | 'PAUSED' | 'SENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
export type ScheduleRunStatus = 'QUEUING' | 'QUEUED' | 'SKIPPED' | 'FAILED';

/** Broadcast content plus when to send it — a wall clock each hunter gets it at in their own timezone. */
export interface ScheduleInput extends BroadcastInput {
  sendDate: string; // YYYY-MM-DD
  sendTime: string; // HH:MM
  recurrence: BroadcastRecurrence;
}

export interface ScheduleRun {
  id: string;
  broadcastId: string;
  /** 'YYYY-MM-DDTHH:MM' wall clock (each hunter's local time). */
  runForLocal: string;
  status: ScheduleRunStatus;
  recipients: number | null;
  reachableByPush: number | null;
  error: string | null;
  pushed: number;
  pending: number;
  notPushed: number;
}

export interface BroadcastSchedule {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: BroadcastAudience;
  inactiveDays: number | null;
  recurrence: BroadcastRecurrence;
  sendDate: string;
  sendTime: string;
  /** 'YYYY-MM-DDTHH:MM' wall clock (each hunter's local time). */
  nextSendLocal: string | null;
  status: ScheduleStatus;
  runCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  runs: ScheduleRun[];
}
