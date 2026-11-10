'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PaginationBar } from '@/components/ui/pagination';
import type { Broadcast, BroadcastSchedule } from '@/types/notification';
import type { PaginationInfo } from '@/types/user';
import { BroadcastForm } from './broadcast-form';
import { ScheduledList } from './scheduled-list';
import { BroadcastHistory } from './broadcast-history';

export type NotificationsTab = 'scheduled' | 'history';

export interface NotificationsClientProps {
  tab: NotificationsTab;
  schedules: BroadcastSchedule[];
  schedulesPage: PaginationInfo;
  broadcasts: Broadcast[];
  broadcastsPage: PaginationInfo;
}

// The send/schedule form, then one card with Scheduled / History tabs. The
// tab and page live in ?tab=&page= so they survive a refresh. Also holds
// which scheduled notification (if any) is loaded into the form for editing.
export function NotificationsClient({ tab, schedules, schedulesPage, broadcasts, broadcastsPage }: NotificationsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState<BroadcastSchedule | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Prefer the freshest copy from the list; keep the one being edited even
  // after switching tab or page (the backend rejects stale edits anyway).
  const current = editing ? (schedules.find((s) => s.id === editing.id) ?? editing) : null;

  const navigate = (nextTab: NotificationsTab, page: number) => {
    const params = new URLSearchParams();
    if (nextTab !== 'scheduled') params.set('tab', nextTab);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const startEdit = (schedule: BroadcastSchedule) => {
    setEditing(schedule);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scheduledLabel = `Scheduled${schedulesPage.total_count > 0 ? ` (${schedulesPage.total_count})` : ''}`;
  const historyLabel = `History${broadcastsPage.total_count > 0 ? ` (${broadcastsPage.total_count})` : ''}`;

  return (
    <>
      <BroadcastForm ref={formRef} editing={current} onEditDone={() => setEditing(null)} />

      <Card className="space-y-4">
        <Tabs
          items={[
            { value: 'scheduled', label: scheduledLabel },
            { value: 'history', label: historyLabel },
          ]}
          value={tab}
          onChange={(next) => next !== tab && navigate(next as NotificationsTab, 1)}
        />
        <p className="text-sm text-ink-faint">
          {tab === 'scheduled'
            ? 'Upcoming and recurring notifications. One-time ones move to History once delivered.'
            : 'Every broadcast sent, newest first. Delivery and read stats update live as pushes go out.'}
        </p>

        <div className={pending ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {tab === 'scheduled' ? (
            <ScheduledList schedules={schedules} editingId={current?.id ?? null} onEdit={startEdit} />
          ) : (
            <BroadcastHistory broadcasts={broadcasts} />
          )}
        </div>

        <PaginationBar
          pagination={tab === 'scheduled' ? schedulesPage : broadcastsPage}
          noun={tab === 'scheduled' ? 'scheduled' : 'broadcasts'}
          disabled={pending}
          onPageChange={(page) => navigate(tab, page)}
        />
      </Card>
    </>
  );
}
