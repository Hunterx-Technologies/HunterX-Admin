import type { BroadcastSchedule, ScheduleInput } from '@/types/notification';

// Backend shape — see broadcastScheduleService.js#serialize.
export interface RawScheduleRun {
  id: string;
  broadcast_id: string;
  run_for_local: string;
  status: BroadcastSchedule['runs'][number]['status'];
  recipients: number | null;
  reachable_by_push: number | null;
  error: string | null;
  pushed?: number;
  pending?: number;
  not_pushed?: number;
}

export interface RawSchedule {
  id: string;
  title: string;
  body: string;
  url: string | null;
  audience: BroadcastSchedule['audience'];
  inactive_days: number | null;
  recurrence: BroadcastSchedule['recurrence'];
  send_date: string;
  send_time: string;
  next_send_local: string | null;
  status: BroadcastSchedule['status'];
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  runs?: RawScheduleRun[];
}

export function mapSchedule(raw: RawSchedule): BroadcastSchedule {
  return {
    id: raw.id,
    title: raw.title,
    body: raw.body,
    url: raw.url ?? '',
    audience: raw.audience,
    inactiveDays: raw.inactive_days,
    recurrence: raw.recurrence,
    sendDate: raw.send_date,
    sendTime: raw.send_time,
    nextSendLocal: raw.next_send_local,
    status: raw.status,
    runCount: raw.run_count ?? 0,
    lastRunAt: raw.last_run_at,
    lastError: raw.last_error,
    runs: (raw.runs ?? []).map((r) => ({
      id: r.id,
      broadcastId: r.broadcast_id,
      runForLocal: r.run_for_local,
      status: r.status,
      recipients: r.recipients,
      reachableByPush: r.reachable_by_push,
      error: r.error,
      pushed: r.pushed ?? 0,
      pending: r.pending ?? 0,
      notPushed: r.not_pushed ?? 0,
    })),
  };
}

export function toSchedulePayload(input: ScheduleInput) {
  return {
    title: input.title,
    body: input.body,
    url: input.url || undefined,
    audience: input.audience,
    inactive_days: input.audience === 'inactive' ? input.inactiveDays : undefined,
    send_date: input.sendDate,
    send_time: input.sendTime,
    recurrence: input.recurrence,
  };
}
