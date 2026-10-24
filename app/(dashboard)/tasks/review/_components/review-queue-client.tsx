'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import type { PendingReviewItem, ProofDecision, ProofReviewPage, ProofReviewStatus } from '@/types/task';
import { decideReview } from '@/lib/api/task-actions';
import { getProofReviews } from '@/lib/api/tasks';
import { AlertCircle, ArrowLeft, Check, ClipboardList, RotateCcw, X } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';
import { taskTypeLabel } from '@/lib/task-labels';

const TAB_LABEL: Record<ProofReviewStatus, string> = {
  IN_REVIEW: 'To review',
  RESUBMIT: 'New proof requested',
  REJECTED: 'Rejected',
  COMPLETED: 'Approved',
};
const STATUSES: ProofReviewStatus[] = ['IN_REVIEW', 'RESUBMIT', 'REJECTED', 'COMPLETED'];
const MAX_NOTE = 300;

type NoteDialog = { item: PendingReviewItem; decision: Exclude<ProofDecision, 'APPROVE'> } | null;

/**
 * Proof submissions for tasks that require photo proof. To review: approve
 * (pays the XP and rewards), ask for new photos, or reject for good — the
 * last two need a reason, which the hunter sees. The other tabs are history.
 */
export function ReviewQueueClient({ status, initialPage }: { status: ProofReviewStatus; initialPage: ProofReviewPage & { error: string | null } }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = React.useState(initialPage.items);
  const [nextCursor, setNextCursor] = React.useState(initialPage.nextCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(initialPage.error);
  const [noteDialog, setNoteDialog] = React.useState<NoteDialog>(null);
  const [note, setNote] = React.useState('');
  const [photo, setPhoto] = React.useState<{ url: string; index: number; total: number } | null>(null);
  const counts = initialPage.counts;

  const decide = async (item: PendingReviewItem, decision: ProofDecision, reason?: string) => {
    setBusyId(item.id);
    setError(null);
    try {
      await decideReview(item.id, decision, reason);
      // Decided items leave this tab; the counts refresh with the page.
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNoteDialog(null);
      setNote('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this decision.');
    } finally {
      setBusyId(null);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const page = await getProofReviews(status, nextCursor);
    if (page.error) setError(page.error);
    setItems((list) => [...list, ...page.items]);
    setNextCursor(page.nextCursor);
    setLoadingMore(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/tasks" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink mt-3">Proof Review Queue</h1>
        <p className="text-sm text-ink-muted mt-1">
          Photo proof for tasks that require it. XP and rewards are paid only when you approve.
        </p>
      </div>

      <Tabs
        items={STATUSES.map((s) => ({ value: s, label: `${TAB_LABEL[s]} (${counts[s]})` }))}
        value={status}
        onChange={(next) => router.push(`${pathname}?status=${next}`)}
      />

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 && !error && (
        <EmptyState icon={ClipboardList} message={status === 'IN_REVIEW' ? 'Nothing to review right now.' : 'Nothing here yet.'} />
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/tasks/${item.taskId}`} className="text-base font-bold text-ink hover:text-accent-ink">
                    {item.taskTitle}
                  </Link>
                  <Badge variant="muted">{taskTypeLabel(item.taskType)}</Badge>
                  <Badge variant="default">{item.xpReward} XP</Badge>
                </div>
                <p className="text-sm text-ink-muted mt-1">
                  <Link href={`/users/${item.userId}`} className="text-ink hover:text-accent-ink">{item.userName}</Link>
                  {item.hunterId && <span className="text-ink-faint font-mono"> · {item.hunterId}</span>}
                  {' · '}for {formatDate(item.scheduleDate)}
                  {item.submittedAt && <> · sent {formatDateTime(item.submittedAt)}</>}
                </p>
                {item.reviewNote && (
                  <p className="text-sm text-ink-muted mt-1">
                    <span className="text-ink-faint">Reason given:</span> {item.reviewNote}
                  </p>
                )}
              </div>
              {status === 'IN_REVIEW' && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId !== null}
                    onClick={() => { setNote(''); setNoteDialog({ item, decision: 'RESUBMIT' }); }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Ask for new proof
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId !== null}
                    onClick={() => { setNote(''); setNoteDialog({ item, decision: 'REJECT' }); }}
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" /> Reject
                  </Button>
                  <Button size="sm" disabled={busyId !== null} onClick={() => decide(item, 'APPROVE')}>
                    <Check className="w-3.5 h-3.5 mr-1.5" /> {busyId === item.id ? 'Saving...' : `Approve (+${item.xpReward} XP)`}
                  </Button>
                </div>
              )}
              {status !== 'IN_REVIEW' && item.reviewedAt && (
                <span className="text-xs text-ink-faint">Decided {formatDateTime(item.reviewedAt)}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {item.proofUrls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPhoto({ url, index: i + 1, total: item.proofUrls.length })}
                  className="w-32 h-32 rounded-lg overflow-hidden border border-line bg-surface-inset cursor-zoom-in"
                  aria-label={`Open proof photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted proof photos */}
                  <img src={url} alt={`Proof ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}

      <Dialog
        open={!!noteDialog}
        onClose={() => busyId === null && setNoteDialog(null)}
        title={noteDialog?.decision === 'RESUBMIT' ? 'Ask for new proof' : 'Reject this proof'}
        description={
          noteDialog?.decision === 'RESUBMIT'
            ? 'The hunter can upload new photos while the task is still open. Tell them what to fix.'
            : 'This is final for this period — the hunter gets no XP. Tell them why.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteDialog(null)} disabled={busyId !== null}>Cancel</Button>
            <Button
              variant={noteDialog?.decision === 'REJECT' ? 'danger' : 'primary'}
              disabled={busyId !== null || note.trim().length === 0}
              onClick={() => noteDialog && decide(noteDialog.item, noteDialog.decision, note.trim())}
            >
              {busyId ? 'Saving...' : noteDialog?.decision === 'RESUBMIT' ? 'Send back' : 'Reject'}
            </Button>
          </>
        }
      >
        <Textarea
          label={`Reason shown to the hunter (${note.trim().length}/${MAX_NOTE})`}
          rows={3}
          maxLength={MAX_NOTE}
          placeholder={noteDialog?.decision === 'RESUBMIT' ? 'e.g. The photo is blurry — show the screen clearly.' : 'e.g. This isn’t the activity the quest asks for.'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Dialog>

      <Dialog open={!!photo} onClose={() => setPhoto(null)} title={photo ? `Proof photo ${photo.index} of ${photo.total}` : ''} className="max-w-3xl">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted proof photo
          <img src={photo.url} alt="Proof" className="w-full max-h-[70vh] object-contain rounded-lg bg-black" />
        )}
      </Dialog>
    </div>
  );
}
