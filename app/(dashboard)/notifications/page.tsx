import { getBroadcasts, getSchedules } from '@/lib/api/notifications';
import { getSessionUser } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';
import { NotificationsClient, type NotificationsTab } from './_components/notifications-client';

type SearchParams = Promise<{ tab?: string | string[]; page?: string | string[] }>;

// One fetch with a page number that ran past the end (e.g. the last item on
// page 2 was cancelled) falls back to the last page that has rows.
async function lastValidPage<T extends { pagination: { total_pages: number } }>(
  page: number,
  fetchPage: (page: number) => Promise<T>
): Promise<T> {
  const result = await fetchPage(page);
  const last = result.pagination.total_pages;
  return page > 1 && last > 0 && page > last ? fetchPage(last) : result;
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const params = await searchParams;
  const tab: NotificationsTab = params.tab === 'history' ? 'history' : 'scheduled';
  const page = Math.max(1, Number(params.page) || 1);

  // Both lists load so each tab label can show its total; only the open tab uses ?page=.
  const [scheduled, history] = await Promise.all([
    lastValidPage(tab === 'scheduled' ? page : 1, getSchedules),
    lastValidPage(tab === 'history' ? page : 1, getBroadcasts),
  ]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
        <p className="text-sm text-ink-muted mt-1">
          Send announcements to hunters as a push notification and an in-app inbox message — now, at a set time, or on a repeat.
        </p>
      </div>
      <NotificationsClient
        tab={tab}
        schedules={scheduled.schedules}
        schedulesPage={scheduled.pagination}
        broadcasts={history.broadcasts}
        broadcastsPage={history.pagination}
      />
    </div>
  );
}
