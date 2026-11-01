import { getBroadcasts } from '@/lib/api/notifications';
import { getSessionUser } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';
import { BroadcastForm } from './_components/broadcast-form';
import { BroadcastHistory } from './_components/broadcast-history';

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const broadcasts = await getBroadcasts();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
        <p className="text-sm text-ink-muted mt-1">
          Send announcements to hunters as a push notification and an in-app inbox message.
        </p>
      </div>
      <BroadcastForm />
      <BroadcastHistory broadcasts={broadcasts} />
    </div>
  );
}
