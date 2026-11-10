import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Broadcast } from '@/types/notification';
import { Megaphone } from 'lucide-react';

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—';
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function BroadcastHistory({ broadcasts }: { broadcasts: Broadcast[] }) {
  return (
    <>
      {broadcasts.length === 0 ? (
        <EmptyState icon={Megaphone} message="No broadcasts sent yet." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Pushed</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Read</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="max-w-sm">
                  <p className="font-semibold text-ink truncate">{b.title}</p>
                  <p className="text-xs text-ink-faint truncate">{b.body}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-ink-muted">{formatDate(b.createdAt)}</TableCell>
                <TableCell>{b.recipients.toLocaleString()}</TableCell>
                <TableCell>{b.pushed.toLocaleString()}</TableCell>
                <TableCell>{b.pending.toLocaleString()}</TableCell>
                <TableCell>{b.read.toLocaleString()} <span className="text-ink-faint">({pct(b.read, b.recipients)})</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
