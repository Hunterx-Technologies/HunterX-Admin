'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { RankBadge } from '@/components/rank-badge';
import type { User } from '@/types/user';
import { banUser, unbanUser, resetUserStreak } from '@/lib/api/user-actions';
import { getUserById } from '@/lib/api/users';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  ArrowLeft,
  Flame,
  Sparkles,
  Ruler,
  Weight,
  Activity,
  Award,
  Gift,
  MessageSquare,
  ShieldOff,
  ShieldCheck,
  RotateCcw,
  KeyRound,
  Mail,
  Globe,
  Apple,
  AlertTriangle,
} from 'lucide-react';

const AUTH_ICON = { email: Mail, google: Globe, apple: Apple } as const;

const TAB_ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity History' },
  { value: 'badges', label: 'Badges' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'feedback', label: 'Feedback / Ratings' },
];

export function UserDetailClient({ user: initialUser }: { user: User }) {
  const router = useRouter();
  const [user, setUser] = React.useState(initialUser);
  const [tab, setTab] = React.useState('overview');
  const [banDialogOpen, setBanDialogOpen] = React.useState(false);
  const [unbanDialogOpen, setUnbanDialogOpen] = React.useState(false);
  const [streakDialogOpen, setStreakDialogOpen] = React.useState(false);
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false);
  const [banReason, setBanReason] = React.useState('');
  const [actionPending, setActionPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const AuthIcon = AUTH_ICON[user.authProvider];
  const isTargetAdmin = String(user.role || '').toLowerCase() === 'admin';

  const handleConfirmBan = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      const updated = await banUser(user.id, banReason.trim());
      setUser(updated);
      setBanDialogOpen(false);
      setBanReason('');
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || 'Failed to ban user.';
      const status = err?.status;
      setActionError(msg);

      // On 409 or stale status, reload user from backend so UI matches server
      if (status === 409 || msg.toLowerCase().includes('already banned') || msg.toLowerCase().includes('not banned')) {
        try {
          const freshUser = await getUserById(user.id);
          if (freshUser) {
            setUser(freshUser);
          }
        } catch {}
        router.refresh();
      }
    } finally {
      setActionPending(false);
    }
  };

  const handleConfirmUnban = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      const updated = await unbanUser(user.id);
      setUser(updated);
      setUnbanDialogOpen(false);
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || 'Failed to unban user.';
      const status = err?.status;
      setActionError(msg);

      // On 409 or stale status, reload user from backend so UI matches server
      if (status === 409 || msg.toLowerCase().includes('not banned') || msg.toLowerCase().includes('already banned')) {
        try {
          const freshUser = await getUserById(user.id);
          if (freshUser) {
            setUser(freshUser);
          }
        } catch {}
        router.refresh();
      }
    } finally {
      setActionPending(false);
    }
  };

  const confirmResetStreak = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      const updated = await resetUserStreak(user.id);
      setUser(updated);
      setStreakDialogOpen(false);
      router.refresh();
    } catch (err: any) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset streak.');
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      {/* Header */}
      <Card className="flex flex-wrap items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-ink text-xl font-bold shrink-0">
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-ink">{user.displayName}</h1>
            <RankBadge rank={user.rank} />
            <Badge variant={user.status === 'banned' ? 'danger' : 'success'}>
              {user.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-ink-faint mt-1">
            {user.hunterId} · Level {user.level} · Member since {formatDate(user.createdAt)}
          </p>
        </div>
      </Card>

      {/* Banned notice banner */}
      {user.status === 'banned' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-bad-ink animate-in fade-in duration-200">
          <ShieldOff className="w-5 h-5 shrink-0 mt-0.5 text-bad-ink" />
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-red-400">
              Banned{user.bannedAt ? ` ${formatDateTime(user.bannedAt)}` : ''}
            </div>
            <p className="text-red-300/90 text-xs">
              <span className="font-medium text-red-200">Reason: </span>
              {user.banReason || 'No reason given'}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Tabs content */}
        <Card className="space-y-6">
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />

          {tab === 'overview' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <OverviewStat icon={Sparkles} label="Total XP" value={user.xp.toLocaleString()} />
              <OverviewStat icon={Flame} label="Current / Longest Streak" value={`${user.currentStreak}d / ${user.longestStreak}d`} />
              <OverviewStat icon={Award} label="Dragon Stage" value={`Stage ${user.dragonStage}`} />
              <OverviewStat icon={Activity} label="BMI" value={`${user.bmi}`} />
              <OverviewStat icon={Ruler} label="Height" value={`${user.heightCm} cm`} />
              <OverviewStat icon={Weight} label="Weight" value={`${user.weightKg} kg`} />
            </div>
          )}

          {tab === 'activity' && (
            user.activityLog.length === 0 ? (
              <EmptyState icon={Activity} message="No data found." />
            ) : (
              <div className="divide-y divide-line/60">
                {user.activityLog.map((entry) => {
                  if (entry.type === 'BAN') {
                    const adminName = entry.performedBy?.name?.trim() || 'a deleted admin';
                    const reasonText = entry.reason?.trim() || 'No reason given';
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-3 gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-bad-ink shrink-0 mt-0.5">
                            <ShieldOff className="w-4 h-4 text-bad-ink" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">Banned by {adminName}</p>
                            <p className="text-xs text-bad-ink/90 mt-0.5 break-words">{reasonText}</p>
                            <p className="text-xs text-ink-faint mt-0.5">{formatDateTime(entry.occurredAt)}</p>
                          </div>
                        </div>
                        <Badge variant="danger" className="shrink-0">
                          banned
                        </Badge>
                      </div>
                    );
                  }

                  if (entry.type === 'UNBAN') {
                    const adminName = entry.performedBy?.name?.trim() || 'a deleted admin';
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-3 gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-ok-ink shrink-0 mt-0.5">
                            <ShieldCheck className="w-4 h-4 text-ok-ink" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">Unbanned by {adminName}</p>
                            <p className="text-xs text-ink-faint mt-0.5">{formatDateTime(entry.occurredAt)}</p>
                          </div>
                        </div>
                        <Badge variant="success" className="shrink-0">
                          unbanned
                        </Badge>
                      </div>
                    );
                  }

                  if (entry.type === 'STREAK_RESET') {
                    const adminName = entry.performedBy?.name?.trim() || 'a deleted admin';
                    const prevStreak = entry.details?.previous_streak ?? entry.details?.previousStreak ?? 0;
                    return (
                      <div key={entry.id} className="flex items-center justify-between py-3 gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-warn-ink shrink-0 mt-0.5">
                            <RotateCcw className="w-4 h-4 text-warn-ink" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">Streak reset by {adminName}</p>
                            <p className="text-xs text-ink-muted mt-0.5">Was {prevStreak} days</p>
                            <p className="text-xs text-ink-faint mt-0.5">{formatDateTime(entry.occurredAt)}</p>
                          </div>
                        </div>
                        <Badge variant="warning" className="shrink-0">
                          streak reset
                        </Badge>
                      </div>
                    );
                  }

                  // TASK_COMPLETION (render as today)
                  return (
                    <div key={entry.id} className="flex items-center justify-between py-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{entry.taskTitle}</p>
                        <p className="text-xs text-ink-faint mt-0.5">{formatDateTime(entry.occurredAt)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-ok-ink">+{entry.xpEarned} XP</span>
                        <Badge variant={entry.status === 'completed' ? 'success' : entry.status === 'partial' ? 'warning' : 'danger'}>
                          {entry.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === 'badges' && (
            user.badges.length === 0 ? (
              <EmptyState icon={Award} message="No data found." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {user.badges.map((badge) => (
                  <div key={badge.id} className="flex items-start gap-3 p-4 rounded-xl border border-line bg-surface-inset/40">
                    <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent-ink shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{badge.name}</p>
                      <p className="text-xs text-ink-muted">{badge.description}</p>
                      <p className="text-xs text-ink-faint mt-1">Earned {formatDate(badge.earnedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'rewards' && (
            user.rewardClaims.length === 0 ? (
              <EmptyState icon={Gift} message="No data found." />
            ) : (
              <div className="divide-y divide-line/60">
                {user.rewardClaims.map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{claim.rewardName}</p>
                      <p className="text-xs text-ink-faint">
                        {claim.status === 'claimed' ? 'Claimed' : 'Assigned'} {formatDate(claim.claimedAt)}
                      </p>
                    </div>
                    <Badge variant="muted">{claim.status ?? claim.type.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'feedback' && (
            user.feedbackTickets.length === 0 ? (
              <EmptyState icon={MessageSquare} message="No data found." />
            ) : (
              <div className="divide-y divide-line/60">
                {user.feedbackTickets.map((ticket) => (
                  <div key={ticket.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{ticket.subject}</p>
                      <Badge variant={ticket.status === 'open' ? 'warning' : 'success'}>{ticket.status}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted">{ticket.message}</p>
                    <p className="text-xs text-ink-faint">
                      {ticket.rating ? `Rating: ${ticket.rating}/5 · ` : ''}
                      {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}
        </Card>

        {/* Actions panel */}
        <Card className="space-y-3 h-fit">
          <h3 className="text-sm font-semibold text-ink">Actions</h3>
          {user.status === 'active' ? (
            <Button
              variant="danger"
              className="w-full justify-start"
              disabled={actionPending || isTargetAdmin}
              title={isTargetAdmin ? 'Admin accounts cannot be banned' : undefined}
              onClick={() => {
                setActionError(null);
                setBanDialogOpen(true);
              }}
            >
              <ShieldOff className="w-4 h-4 mr-2" /> Ban User
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={actionPending}
              onClick={() => {
                setActionError(null);
                setUnbanDialogOpen(true);
              }}
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Unban User
            </Button>
          )}
          {isTargetAdmin && user.status === 'active' && (
            <p className="text-[11px] text-ink-faint px-1">Admin accounts cannot be banned.</p>
          )}
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={actionPending}
            onClick={() => {
              setActionError(null);
              setStreakDialogOpen(true);
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Reset Streak
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => setAuthDialogOpen(true)}>
            <KeyRound className="w-4 h-4 mr-2" /> View Auth Details
          </Button>
        </Card>
      </div>

      {/* Ban confirm dialog */}
      <Dialog
        open={banDialogOpen}
        onClose={() => {
          if (!actionPending) {
            setBanDialogOpen(false);
            setActionError(null);
          }
        }}
        title={`Ban ${user.displayName}?`}
        description="The user will be logged out immediately, will not be able to log in, and will be hidden from leaderboards. No data will be deleted, and they can be unbanned at any time."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setBanDialogOpen(false);
                setActionError(null);
              }}
              disabled={actionPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmBan}
              disabled={actionPending}
            >
              {actionPending ? 'Banning...' : 'Ban User'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ban-reason" className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Reason <span className="text-ink-faint font-normal normal-case">(optional)</span>
              </label>
              <span className={`text-xs ${banReason.length >= 500 ? 'text-bad-ink font-semibold' : 'text-ink-faint'}`}>
                {banReason.length}/500
              </span>
            </div>
            <textarea
              id="ban-reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="Provide an optional reason for the ban..."
              disabled={actionPending}
              className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-surface-inset/50 text-ink placeholder-ink-faint transition-all duration-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent focus:bg-surface-inset disabled:opacity-50 disabled:pointer-events-none resize-none text-sm"
            />
          </div>
          {actionError && (
            <div className="p-3 rounded-lg border border-bad-ink/20 bg-bad-surface/40 text-bad-ink text-xs font-medium">
              {actionError}
            </div>
          )}
        </div>
      </Dialog>

      {/* Unban confirm dialog */}
      <Dialog
        open={unbanDialogOpen}
        onClose={() => {
          if (!actionPending) {
            setUnbanDialogOpen(false);
            setActionError(null);
          }
        }}
        title={`Unban ${user.displayName}?`}
        description="They'll be able to log in again with all their progress restored."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setUnbanDialogOpen(false);
                setActionError(null);
              }}
              disabled={actionPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmUnban}
              disabled={actionPending}
            >
              {actionPending ? 'Unbanning...' : 'Unban User'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            This will reactivate <span className="text-ink font-medium">{user.displayName}</span> and restore full access to their account.
          </p>
          {actionError && (
            <div className="p-3 rounded-lg border border-bad-ink/20 bg-bad-surface/40 text-bad-ink text-xs font-medium">
              {actionError}
            </div>
          )}
        </div>
      </Dialog>

      {/* Reset streak confirm dialog */}
      <Dialog
        open={streakDialogOpen}
        onClose={() => {
          if (!actionPending) {
            setStreakDialogOpen(false);
            setActionError(null);
          }
        }}
        title="Reset Current Streak?"
        description={`This will set ${user.displayName}'s current streak to 0. Their longest streak record is unaffected.`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setStreakDialogOpen(false);
                setActionError(null);
              }}
              disabled={actionPending}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmResetStreak} disabled={actionPending}>
              {actionPending ? 'Resetting...' : 'Reset Streak'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Current streak: <span className="text-ink font-semibold">{user.currentStreak} days</span></p>
          {actionError && (
            <div className="p-3 rounded-lg border border-bad-ink/20 bg-bad-surface/40 text-bad-ink text-xs font-medium">
              {actionError}
            </div>
          )}
        </div>
      </Dialog>

      {/* Auth details dialog */}
      <Dialog open={authDialogOpen} onClose={() => setAuthDialogOpen(false)} title="Authentication Details">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Provider</span>
            <span className="flex items-center gap-2 text-ink font-medium capitalize">
              <AuthIcon className="w-4 h-4" /> {user.authProvider}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Email</span>
            <span className="text-ink font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Internal ID</span>
            <span className="text-ink font-medium font-mono text-xs">{user.id}</span>
          </div>
          {user.status === 'banned' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Banned At</span>
                <span className="text-ink font-medium">
                  {user.bannedAt ? formatDateTime(user.bannedAt) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Ban Reason</span>
                <span className="text-bad-ink font-medium">{user.banReason || 'No reason given'}</span>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function OverviewStat({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
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
