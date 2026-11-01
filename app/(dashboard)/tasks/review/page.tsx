import { getProofReviews } from '@/lib/api/tasks';
import type { ProofReviewStatus } from '@/types/task';
import { ReviewQueueClient } from './_components/review-queue-client';

const STATUSES: ProofReviewStatus[] = ['IN_REVIEW', 'RESUBMIT', 'REJECTED', 'COMPLETED'];

export default async function TaskReviewPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status?.toUpperCase();
  const status = STATUSES.find((s) => s === requested) ?? 'IN_REVIEW';
  const page = await getProofReviews(status);
  return <ReviewQueueClient key={status} status={status} initialPage={page} />;
}
