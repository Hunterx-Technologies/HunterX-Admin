import { getRewards } from '@/lib/api/rewards';
import { TaskForm } from '../_components/task-form';

export default async function NewTaskPage() {
  const { triggers: specialRewards } = await getRewards('special');
  return (
    <div className="space-y-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Create Task</h1>
        <p className="text-sm text-ink-muted mt-1">Define a new task hunters can complete for XP.</p>
      </div>
      <TaskForm specialRewards={specialRewards} />
    </div>
  );
}
