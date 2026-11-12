import { getProofReviews } from '@/lib/api/tasks';
import type { ProofReviewStatus } from '@/types/task';
import { ReviewQueueClient } from './_components/review-queue-client';

const STATUSES: ProofReviewStatus[] = ['IN_REVIEW', 'RESUBMIT', 'REJECTED', 'COMPLETED'];

export default async function TaskReviewPage({ searchParams }: { searchParams: Promise<{ status?: string; deletion?: string }> }) {
  const params = await searchParams;
  const requested = params.status?.toUpperCase();
  const status = STATUSES.find((s) => s === requested) ?? 'IN_REVIEW';
  const pendingDeletionOnly = params.deletion?.toUpperCase() === 'PENDING';
  const page = await getProofReviews(status, undefined, pendingDeletionOnly);
  return (
    <ReviewQueueClient
      key={`${status}:${pendingDeletionOnly}`}
      status={status}
      pendingDeletionOnly={pendingDeletionOnly}
      initialPage={page}
    />
  );
}
