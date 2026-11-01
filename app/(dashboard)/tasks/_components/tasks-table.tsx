'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { Task } from '@/types/task';
import { recurrenceLabel, TASK_TYPE_GROUP_LABEL, taskTypeGroup, taskTypeLabel } from '@/lib/task-labels';
import { Search, ListChecks } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export function TasksTable({ tasks }: { tasks: Task[] }) {
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState('all');
  const [status, setStatus] = React.useState('all');
  const [recurrence, setRecurrence] = React.useState('all');

  const filtered = tasks.filter((task) => {
    if (query && !task.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (type !== 'all' && taskTypeGroup(task.taskType) !== type) return false;
    if (recurrence !== 'all' && task.isRecurring !== (recurrence === 'recurring')) return false;
    if (status !== 'all' && task.status !== status) return false;
    return true;
  });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <Input placeholder="Search by title..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="w-40">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All Types</option>
            {Object.entries(TASK_TYPE_GROUP_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            <option value="all">All</option>
            <option value="recurring">Recurring</option>
            <option value="one-time">One-time</option>
          </Select>
        </div>
        <div className="w-36">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>XP Reward</TableHead>
            <TableHead>Level Target</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link href={`/tasks/${task.id}`} className="font-medium text-ink hover:text-accent-ink transition-colors">
                    {task.title}
                  </Link>
                  {task.isPaid && (
                    <Badge variant="warning" className="text-[10px] px-1.5 py-0.5 font-mono">
                      ₹{task.price}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-faint">{task.tag}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="default">{taskTypeLabel(task.taskType)}</Badge>
                  <Badge variant="muted">{recurrenceLabel(task.isRecurring)}</Badge>
                </div>
              </TableCell>
              <TableCell>{task.xpReward} XP</TableCell>
              <TableCell className="text-ink-muted">{task.levelTarget === 'ALL' ? 'All Levels' : task.levelTarget}</TableCell>
              <TableCell>
                <Badge variant={task.status === 'active' ? 'success' : 'muted'}>{task.status}</Badge>
              </TableCell>
              <TableCell className="text-ink-muted">{formatDate(task.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filtered.length === 0 && <EmptyState icon={ListChecks} message="No data found." />}
    </Card>
  );
}
