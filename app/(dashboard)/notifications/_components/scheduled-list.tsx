'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { changeScheduleState } from '@/lib/api/notification-actions';
import { RECURRENCE_LABEL, describeSchedule, formatWall } from '@/lib/ist';
import { cn } from '@/lib/utils';
import type { BroadcastSchedule, ScheduleRun, ScheduleStatus } from '@/types/notification';
import { AlertCircle, CalendarClock, Pause, Pencil, Play, Repeat, X } from 'lucide-react';

const STATUS_BADGE: Record<ScheduleStatus, { label: string; variant: NonNullable<BadgeProps['variant']> }> = {
  SCHEDULED: { label: 'Scheduled', variant: 'default' },
  PAUSED: { label: 'Paused', variant: 'muted' },
  SENDING: { label: 'Sending', variant: 'warning' },
  SENT: { label: 'Sent', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'muted' },
  FAILED: { label: 'Failed', variant: 'danger' },
};

type Action = 'pause' | 'resume' | 'cancel';

export interface ScheduledListProps {
  schedules: BroadcastSchedule[];
  editingId: string | null;
  onEdit: (schedule: BroadcastSchedule) => void;
}

export function ScheduledList({ schedules, editingId, onEdit }: ScheduledListProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<{ id: string; action: Action } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState<BroadcastSchedule | null>(null);

  const act = async (schedule: BroadcastSchedule, action: Action) => {
    setBusy({ id: schedule.id, action });
    setError(null);
    try {
      await changeScheduleState(schedule.id, action);
      setConfirmCancel(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setConfirmCancel(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState icon={CalendarClock} message="Nothing scheduled. Choose “Schedule for later” above to add one." />
      ) : (
        <ul className="divide-y divide-line/70 -mx-1">
          {schedules.map((s) => (
            <ScheduleItem
              key={s.id}
              schedule={s}
              isEditing={editingId === s.id}
              busyAction={busy?.id === s.id ? busy.action : null}
              disabled={busy !== null}
              onEdit={() => onEdit(s)}
              onPause={() => act(s, 'pause')}
              onResume={() => act(s, 'resume')}
              onCancel={() => setConfirmCancel(s)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancel this notification?"
        message={
          confirmCancel && (
            <>
              {confirmCancel.status === 'SENDING' ? (
                <>
                  &ldquo;{confirmCancel.title}&rdquo; is reaching hunters timezone by timezone. Hunters who already got
                  it keep it; nobody else will.
                </>
              ) : (
                <>
                  &ldquo;{confirmCancel.title}&rdquo; won&apos;t be sent
                  {confirmCancel.recurrence !== 'NONE' ? ' again' : ''}.
                </>
              )}{' '}
              This can&apos;t be undone — you&apos;d need to schedule it again.
            </>
          )
        }
        confirmLabel="Cancel notification"
        busyLabel="Cancelling..."
        busy={busy?.action === 'cancel'}
        destructive
        onConfirm={() => confirmCancel && act(confirmCancel, 'cancel')}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}

interface ScheduleItemProps {
  schedule: BroadcastSchedule;
  isEditing: boolean;
  busyAction: Action | null;
  disabled: boolean;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function ScheduleItem({ schedule: s, isEditing, busyAction, disabled, onEdit, onPause, onResume, onCancel }: ScheduleItemProps) {
  const badge = STATUS_BADGE[s.status];
  const recurring = s.recurrence !== 'NONE';
  const lastRun = s.runs[0];
  const canEdit = s.status === 'SCHEDULED' || s.status === 'PAUSED' || s.status === 'FAILED';
  const canCancel = canEdit || s.status === 'SENDING';

  return (
    <li className={cn('px-1 py-4 first:pt-1 last:pb-1', isEditing && 'opacity-60')}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink truncate max-w-full">{s.title}</p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {recurring && (
              <Badge variant="muted">
                <Repeat className="w-3 h-3" />
                {RECURRENCE_LABEL[s.recurrence]}
              </Badge>
            )}
            {isEditing && <Badge variant="default">Editing</Badge>}
          </div>
          <p className="text-sm text-ink-muted line-clamp-2">{s.body}</p>

          <dl className="text-xs text-ink-faint space-y-0.5">
            <div>
              <dt className="sr-only">Schedule</dt>
              <dd>{describeSchedule(s.sendDate, s.sendTime, s.recurrence)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <dt className="sr-only">Next send</dt>
              <dd className="text-ink-muted">
                {s.status === 'SCHEDULED' && s.nextSendLocal && <>Next: <span className="text-ink">{formatWall(s.nextSendLocal)}</span></>}
                {s.status === 'PAUSED' && 'Paused — resume to continue from the next occurrence'}
                {s.status === 'SENDING' && 'Delivering — reaches each timezone at its local time'}
                {s.status === 'FAILED' && 'Not sent — edit to reschedule, or cancel'}
              </dd>
              <dd>
                {s.audience === 'inactive' ? `Inactive ${s.inactiveDays ?? '?'}+ days` : 'All hunters'}
              </dd>
              {recurring && s.runCount > 0 && <dd>Sent {s.runCount}×</dd>}
            </div>
            {lastRun && <RunSummary run={lastRun} />}
          </dl>

          {s.lastError && (s.status === 'FAILED' || lastRun?.status !== 'QUEUED') && (
            <p className="flex items-start gap-1.5 text-xs text-bad-ink">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {s.lastError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={disabled || isEditing}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
          {recurring && s.status === 'SCHEDULED' && (
            <Button type="button" variant="outline" size="sm" onClick={onPause} disabled={disabled}>
              <Pause className="w-3.5 h-3.5" />
              {busyAction === 'pause' ? 'Pausing...' : 'Pause'}
            </Button>
          )}
          {recurring && s.status === 'PAUSED' && (
            <Button type="button" variant="outline" size="sm" onClick={onResume} disabled={disabled}>
              <Play className="w-3.5 h-3.5" />
              {busyAction === 'resume' ? 'Resuming...' : 'Resume'}
            </Button>
          )}
          {canCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={disabled} className="text-bad-ink">
              <X className="w-3.5 h-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function RunSummary({ run }: { run: ScheduleRun }) {
  const when = formatWall(run.runForLocal, { withYear: false });
  let detail: string;
  switch (run.status) {
    case 'QUEUED':
      detail = `${(run.recipients ?? 0).toLocaleString()} recipients · ${run.pushed.toLocaleString()} pushed${
        run.pending > 0 ? ` · ${run.pending.toLocaleString()} pending` : ''
      }`;
      break;
    case 'QUEUING':
      detail = 'queuing…';
      break;
    case 'SKIPPED':
      detail = `skipped${run.error ? ` — ${run.error}` : ''}`;
      break;
    default:
      detail = `failed${run.error ? ` — ${run.error}` : ''}`;
  }
  return (
    <div>
      <dt className="sr-only">Last send</dt>
      <dd>
        Last: {when} · {detail}
      </dd>
    </div>
  );
}
