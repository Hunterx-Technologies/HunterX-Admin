import { notFound } from 'next/navigation';
import { getTaskById, getTaskAssignmentStats } from '@/lib/api/tasks';
import { getRewards } from '@/lib/api/rewards';
import { TaskDetailClient } from './_components/task-detail-client';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskById(id);

  if (!task) {
    notFound();
  }

  const [assignmentStats, special] = await Promise.all([
    getTaskAssignmentStats(id),
    task.specialRewardId ? getRewards('special') : Promise.resolve(null),
  ]);
  const specialReward = special?.triggers.find((r) => r.id === task.specialRewardId) ?? null;

  return (
    <TaskDetailClient task={task} assignmentStats={assignmentStats} specialReward={specialReward} />
  );
}
