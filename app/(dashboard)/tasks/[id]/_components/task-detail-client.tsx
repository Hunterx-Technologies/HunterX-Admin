'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task, TaskAssignmentStats } from '@/types/task';
import type { RewardTrigger } from '@/types/reward';
import { recurrenceLabel, taskTypeLabel } from '@/lib/task-labels';
import { ArrowLeft, Pencil, Users, CheckCircle2, Timer, History, Power, AlertCircle, Trash2, CalendarClock } from 'lucide-react';
import { deleteTask, setTaskActive } from '@/lib/api/task-actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate } from '@/lib/utils';

export function TaskDetailClient({
  task,
  assignmentStats,
  specialReward,
}: {
  task: Task;
  assignmentStats: TaskAssignmentStats;
  /** The linked special reward, if any. */
  specialReward: RewardTrigger | null;
}) {
  const router = useRouter();
  const [toggling, setToggling] = React.useState(false);
  const [toggleError, setToggleError] = React.useState<string | null>(null);
  const isActive = task.status === 'active';
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const removeTask = async () => {
    setDeleting(true);
    setToggleError(null);
    try {
      await deleteTask(task.id);
      router.push('/tasks');
      router.refresh();
    } catch (err) {
      setConfirmDelete(false);
      setToggleError(err instanceof Error ? err.message : 'Failed to delete this task.');
      setDeleting(false);
    }
  };

  const toggleActive = async () => {
    setToggling(true);
    setToggleError(null);
    try {
      await setTaskActive(task.id, !isActive);
      router.refresh();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update this task.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Link>
        <div className="flex items-center gap-2">
          {task.canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={toggling || deleting}
              title="Possible because no hunter has been assigned this task yet"
              className="text-bad-ink"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </Button>
          )}
          <Button
            variant={isActive ? 'ghost' : 'outline'}
            size="sm"
            onClick={toggleActive}
            disabled={toggling}
            title={isActive ? 'Hide from hunters; past completions are kept' : 'Show to hunters again'}
          >
            <Power className="w-3.5 h-3.5 mr-2" />
            {toggling ? 'Saving...' : isActive ? 'Deactivate' : 'Activate'}
          </Button>
          {task.taskType === 'DAILY_FIXED' ? (
            <Button variant="outline" size="sm" disabled title="Built-in daily tasks (water, steps, protein…) can only be switched on or off">
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Task
            </Button>
          ) : (
            <Link href={`/tasks/${task.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Task
              </Button>
            </Link>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this task?"
        message={
          <>
            &ldquo;{task.title}&rdquo; hasn&apos;t been assigned to any hunter yet, so it can be removed for good,
            along with its images. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete task"
        busyLabel="Deleting..."
        busy={deleting}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={removeTask}
      />

      {toggleError && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{toggleError}</span>
        </div>
      )}

      <Card className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-ink">{task.title}</h1>
          <Badge variant={task.status === 'active' ? 'success' : 'muted'}>{task.status}</Badge>
          <Badge variant="default">{task.rewardEligibility}</Badge>
          {task.isPaid ? (
            <Badge variant="warning" className="font-mono">
              ₹{task.price} Paid
            </Badge>
          ) : (
            <Badge variant="muted">Free</Badge>
          )}
        </div>
        <p className="text-sm text-ink-muted">{task.description}</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tag" value={task.tag} />
        <Field label="Type" value={`${taskTypeLabel(task.taskType)} · ${recurrenceLabel(task.isRecurring)}`} />
        <Field label="Pricing" value={task.isPaid ? `₹${task.price} (${task.currency || 'INR'})` : 'Free'} />
        <Field label="Target" value={task.targetValue != null && task.targetUnit ? `${task.targetValue} ${task.targetUnit}` : 'None'} />
        <Field label="XP Reward" value={`${task.xpReward} XP`} />
        <Field label="Created" value={formatDate(task.createdAt) || '—'} />
        <Field
          label={task.isPaid ? 'Offer starts' : 'Shown to hunters from'}
          value={formatDate(task.startDate) || formatDate(task.createdAt) || '—'}
        />
        <Field
          label={task.isPaid ? 'Offer ends' : 'End date'}
          value={task.endDate ? formatDate(task.endDate) : task.isRecurring ? 'No end date (recurring)' : '—'}
        />
        <Field label="Level Target" value={task.levelTarget === 'ALL' ? 'All Levels' : task.levelTarget} />
        <Field label="Allows Partial" value={task.allowsPartial ? `Yes (${task.xpPartial} XP)` : 'No'} />
        <Field label="Default Daily" value={task.isDefaultDaily ? 'Yes' : 'No'} />
        <Field
          label="Special Reward"
          value={
            specialReward
              ? `${specialReward.description || `Special reward #${specialReward.value}`}${specialReward.isActive ? '' : ' (inactive)'}`
              : task.specialRewardId ? 'Linked' : 'None — XP only'
          }
        />
      </div>

      {(task.imageUrlMale || task.imageUrlFemale || task.imageUrl) && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Task Artwork</h2>
          <div className="flex flex-wrap gap-6 items-center">
            {(task.imageUrlMale || task.imageUrl) && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface-inset/40">
                <img
                  src={task.imageUrlMale || task.imageUrl || ''}
                  alt={`${task.title} (Male)`}
                  className="w-16 h-16 rounded-lg object-cover border border-line bg-surface-inset"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <p className="text-xs font-semibold text-ink">Male Artwork</p>
                  <p className="text-[11px] text-ink-faint">Displayed for male hunters</p>
                </div>
              </div>
            )}
            {task.imageUrlFemale && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface-inset/40">
                <img
                  src={task.imageUrlFemale}
                  alt={`${task.title} (Female)`}
                  className="w-16 h-16 rounded-lg object-cover border border-line bg-surface-inset"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <p className="text-xs font-semibold text-ink">Female Artwork</p>
                  <p className="text-[11px] text-ink-faint">Displayed for female hunters</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Assignment Stats</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={CalendarClock}
          label="First shown to hunters"
          value={assignmentStats.firstShownOn ? formatDate(assignmentStats.firstShownOn) : 'Not shown to anyone yet'}
        />
        <StatTile
          icon={CalendarClock}
          label="Last shown"
          value={assignmentStats.lastShownOn ? formatDate(assignmentStats.lastShownOn) : '—'}
        />
        <StatTile icon={Timer} label="On hunters' lists today" value={assignmentStats.shownToday} />
        <StatTile icon={Users} label="Hunters assigned" value={assignmentStats.usersAssigned} />
        <StatTile
          icon={CheckCircle2}
          label="Completed at least once"
          value={`${assignmentStats.usersCompleted} (${assignmentStats.completionRate}%)`}
        />
        <StatTile icon={History} label="Total completions" value={assignmentStats.completions} />
      </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-line bg-surface-inset/40">
      <p className="text-xs text-ink-faint uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-ink capitalize mt-1">{value}</p>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-line bg-surface-inset/40">
      <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-ink shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-ink-faint uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
