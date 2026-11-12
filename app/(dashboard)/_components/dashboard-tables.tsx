'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { PaginationBar } from '@/components/ui/pagination';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle, Inbox, MapPinned, MessageSquareWarning, CreditCard, UserX, ChevronRight } from 'lucide-react';
import { WidgetError } from '@/components/widget-error';
import type {
  Transaction,
  PaymentStatus,
  TopReferrer,
  ReferralActivity,
  CouponActivityEntry,
  NeedsAttentionItem,
  DashboardListQuery,
  PagedList,
} from '@/types/dashboard';
import {
  getRecentTransactions,
  getTopReferrers,
  getRecentReferralActivity,
  getCouponActivityLog,
  getNeedsAttention,
} from '@/lib/api/dashboard';
import { cn, formatDate } from '@/lib/utils';
import type { RangeParams } from '@/lib/dashboard-range';

// ── Paging + sorting (done by the backend) ────────────────

type SortLabels = Record<string, string>;

/**
 * One list's page / sort / filter state. Starts from the server-rendered
 * first page; each change fetches just this list. A late response from an
 * older request is ignored. A failed fetch keeps the last good page on
 * screen and sets `error`; `data.error` stays set only while nothing has
 * loaded yet.
 */
function usePagedList<T>(initial: PagedList<T>, load: (q: DashboardListQuery) => Promise<PagedList<T>>) {
  const [data, setData] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<DashboardListQuery>({ sort: initial.sort });
  const [pending, startTransition] = React.useTransition();
  const latest = React.useRef(0);

  const fetchList = (next: DashboardListQuery) => {
    const id = ++latest.current;
    startTransition(async () => {
      const result = await load(next);
      if (id !== latest.current) return;
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        setError(null);
      }
    });
  };

  const update = (patch: DashboardListQuery) => {
    const next = { ...query, ...patch };
    setQuery(next);
    fetchList(next);
  };

  return { data, query, pending, update, error, retry: () => fetchList(query) };
}

/** The list never loaded: the whole widget becomes the error state. */
function NeverLoaded({ message, onRetry, pending }: { message: string; onRetry: () => void; pending: boolean }) {
  return <WidgetError compact message={pending ? 'Retrying…' : message} onRetry={onRetry} />;
}

/** A later page / sort / filter failed: keep the old rows, say so above them. */
function ListError({ message, onRetry, pending }: { message: string | null; onRetry: () => void; pending: boolean }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-xs">
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        {message} Showing the last results that loaded.
      </span>
      <button type="button" onClick={onRetry} disabled={pending} className="font-semibold underline underline-offset-2 disabled:opacity-60 cursor-pointer">
        {pending ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}

function SortMenu({ labels, value, onChange, disabled }: { labels: SortLabels; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const keys = Object.keys(labels);
  return (
    <div className="flex items-center gap-2 text-xs text-ink-muted">
      <span className="shrink-0">Sort by</span>
      <div className="w-44">
        <Select value={labels[value] ? value : keys[0]} onChange={(e) => onChange(e.target.value)} className="px-2 py-1.5 text-xs" disabled={disabled}>
          {keys.map((k) => (
            <option key={k} value={k}>
              {labels[k]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>;
}

const fade = (pending: boolean) => cn('transition-opacity', pending && 'opacity-60');

// ── Recent Transactions ───────────────────────────────────

const PAYMENT_VARIANT: Record<PaymentStatus, 'success' | 'danger' | 'warning' | 'muted'> = {
  paid: 'success',
  failed: 'danger',
  pending: 'warning',
  refunded: 'muted',
};

const TRANSACTION_SORTS: SortLabels = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  amount_desc: 'Amount: high to low',
  amount_asc: 'Amount: low to high',
  user: 'User: A–Z',
};

/** `range`: the page's date filter; the page remounts this (key) when it changes. */
export function TransactionsTable({ initial, range }: { initial: PagedList<Transaction>; range: RangeParams }) {
  const { data, query, pending, update, error, retry } = usePagedList(initial, (q) => getRecentTransactions(q, range));
  if (data.error) return <NeverLoaded message={data.error} onRetry={retry} pending={pending} />;
  const transactions = data.items;
  const pageItems = transactions;

  return (
    <div className="space-y-4">
      <ListError message={error} onRetry={retry} pending={pending} />
      {data.pagination.total_count > 1 && (
        <Toolbar>
          <SortMenu labels={TRANSACTION_SORTS} value={query.sort ?? ''} onChange={(sort) => update({ sort, page: 1 })} disabled={pending} />
        </Toolbar>
      )}
      <Table className={fade(pending)}>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.userName}</TableCell>
              <TableCell className="text-ink-muted">{t.plan}</TableCell>
              <TableCell>${t.amount}</TableCell>
              <TableCell>
                <Badge variant={PAYMENT_VARIANT[t.status]}>{t.status}</Badge>
              </TableCell>
              <TableCell className="text-ink-muted">{formatDate(t.date)}</TableCell>
              <TableCell className="text-ink-muted">{t.method}</TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-ink-faint py-8">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PaginationBar pagination={data.pagination} noun="transactions" onPageChange={(page) => update({ page })} disabled={pending} />
    </div>
  );
}

// ── Top Referrers ─────────────────────────────────────────

const REFERRER_SORTS: SortLabels = {
  paid: 'Most paid conversions',
  signups: 'Most signups',
  name: 'Hunter: A–Z',
};

/** `range`: the page's date filter; the page remounts this (key) when it changes. */
export function TopReferrersTable({ initial, range }: { initial: PagedList<TopReferrer>; range: RangeParams }) {
  const { data, query, pending, update, error, retry } = usePagedList(initial, (q) => getTopReferrers(q, range));
  if (data.error) return <NeverLoaded message={data.error} onRetry={retry} pending={pending} />;
  const referrers = data.items;
  const pageItems = referrers;

  return (
    <div className="space-y-4">
      <ListError message={error} onRetry={retry} pending={pending} />
      {data.pagination.total_count > 1 && (
        <Toolbar>
          <SortMenu labels={REFERRER_SORTS} value={query.sort ?? ''} onChange={(sort) => update({ sort, page: 1 })} disabled={pending} />
        </Toolbar>
      )}
      <Table className={fade(pending)}>
        <TableHeader>
          <TableRow>
            <TableHead>Hunter</TableHead>
            <TableHead>Links Sent</TableHead>
            <TableHead>Signups</TableHead>
            <TableHead>Paid Conversions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((r) => (
            <TableRow key={r.userId}>
              <TableCell className="font-medium">
                <Link href={`/users/${r.userId}`} className="hover:text-accent-ink transition-colors">
                  {r.userName}
                </Link>
              </TableCell>
              <TableCell>{r.linksSent}</TableCell>
              <TableCell>{r.signups}</TableCell>
              <TableCell>{r.paidConversions}</TableCell>
            </TableRow>
          ))}
          {referrers.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-ink-faint py-8">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PaginationBar pagination={data.pagination} noun="referrers" onPageChange={(page) => update({ page })} disabled={pending} />
    </div>
  );
}

// ── Recent Referral Activity ──────────────────────────────

const REFERRAL_STATUS_VARIANT: Record<ReferralActivity['status'], 'success' | 'warning' | 'default'> = {
  converted: 'success',
  signed_up: 'default',
  pending: 'warning',
};

const REFERRAL_ACTIVITY_SORTS: SortLabels = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  referrer: 'Referrer: A–Z',
};

/** `range`: the page's date filter; the page remounts this (key) when it changes. */
export function ReferralActivityTable({ initial, range }: { initial: PagedList<ReferralActivity>; range: RangeParams }) {
  const { data, query, pending, update, error, retry } = usePagedList(initial, (q) => getRecentReferralActivity(q, range));
  if (data.error) return <NeverLoaded message={data.error} onRetry={retry} pending={pending} />;
  const activity = data.items;
  const pageItems = activity;

  return (
    <div className="space-y-4">
      <ListError message={error} onRetry={retry} pending={pending} />
      {data.pagination.total_count > 1 && (
        <Toolbar>
          <SortMenu labels={REFERRAL_ACTIVITY_SORTS} value={query.sort ?? ''} onChange={(sort) => update({ sort, page: 1 })} disabled={pending} />
        </Toolbar>
      )}
      <Table className={fade(pending)}>
        <TableHeader>
          <TableRow>
            <TableHead>Referrer</TableHead>
            <TableHead>Referee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.referrerName}</TableCell>
              <TableCell className="text-ink-muted">{a.refereeName}</TableCell>
              <TableCell>
                <Badge variant={REFERRAL_STATUS_VARIANT[a.status]}>{a.status.replace('_', ' ')}</Badge>
              </TableCell>
              <TableCell className="text-ink-muted">{formatDate(a.date)}</TableCell>
            </TableRow>
          ))}
          {activity.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-ink-faint py-8">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PaginationBar pagination={data.pagination} noun="referrals" onPageChange={(page) => update({ page })} disabled={pending} />
    </div>
  );
}

// ── Coupon Activity Log ───────────────────────────────────

const COUPON_ACTION_VARIANT: Record<CouponActivityEntry['action'], 'success' | 'default' | 'muted'> = {
  redeemed: 'success',
  issued: 'default',
  expired: 'muted',
};

const COUPON_SORTS: SortLabels = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  partner: 'Partner: A–Z',
  user: 'User: A–Z',
};

/** `range`: the page's date filter; the page remounts this (key) when it changes. */
export function CouponActivityTable({ initial, range }: { initial: PagedList<CouponActivityEntry>; range: RangeParams }) {
  const { data, query, pending, update, error, retry } = usePagedList(initial, (q) => getCouponActivityLog(q, range));
  if (data.error) return <NeverLoaded message={data.error} onRetry={retry} pending={pending} />;
  const partners = data.partners ?? [];
  const pageItems = data.items;

  return (
    <div className="space-y-4">
      <ListError message={error} onRetry={retry} pending={pending} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-xs">
          <Select value={query.partner ?? 'all'} onChange={(e) => update({ partner: e.target.value, page: 1 })} disabled={pending}>
            <option value="all">All Partners</option>
            {partners.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        {(data.pagination.total_count > 1 || (query.partner ?? 'all') !== 'all') && (
          <SortMenu labels={COUPON_SORTS} value={query.sort ?? ''} onChange={(sort) => update({ sort, page: 1 })} disabled={pending} />
        )}
      </div>
      <Table className={fade(pending)}>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.code}</TableCell>
              <TableCell className="text-ink-muted">{e.partner}</TableCell>
              <TableCell>{e.userName}</TableCell>
              <TableCell>
                <Badge variant={COUPON_ACTION_VARIANT[e.action]}>{e.action}</Badge>
              </TableCell>
              <TableCell className="text-ink-muted">{formatDate(e.date)}</TableCell>
            </TableRow>
          ))}
          {pageItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-ink-faint py-8">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PaginationBar pagination={data.pagination} noun="entries" onPageChange={(page) => update({ page })} disabled={pending} />
    </div>
  );
}

// ── Needs Attention ───────────────────────────────────────

const ATTENTION_ICON: Record<NeedsAttentionItem['type'], typeof MapPinned> = {
  gps_review: MapPinned,
  feedback_ticket: MessageSquareWarning,
  failed_payment: CreditCard,
  banned_user: UserX,
};

const ATTENTION_COLOR: Record<NeedsAttentionItem['type'], string> = {
  gps_review: 'text-warn-ink',
  feedback_ticket: 'text-accent-ink',
  failed_payment: 'text-bad-ink',
  banned_user: 'text-bad-ink',
};

// "By type" (backend): failed payments → proof reviews → feedback → bans.
const ATTENTION_SORTS: SortLabels = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  type: 'By type',
};

export function NeedsAttentionList({ initial }: { initial: PagedList<NeedsAttentionItem> }) {
  const { data, query, pending, update, error, retry } = usePagedList(initial, getNeedsAttention);
  if (data.error) return <NeverLoaded message={data.error} onRetry={retry} pending={pending} />;
  const pageItems = data.items;

  if (data.pagination.total_count === 0 && pageItems.length === 0) {
    return <EmptyState icon={Inbox} message="No data found." />;
  }

  return (
    <div className="space-y-3">
      <ListError message={error} onRetry={retry} pending={pending} />
      {data.pagination.total_count > 1 && (
        <Toolbar>
          <SortMenu labels={ATTENTION_SORTS} value={query.sort ?? ''} onChange={(sort) => update({ sort, page: 1 })} disabled={pending} />
        </Toolbar>
      )}
      <div className={cn('divide-y divide-line/60', fade(pending))}>
        {pageItems.map((item) => {
          const Icon = ATTENTION_ICON[item.type];
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-4 py-3.5 group hover:bg-surface-inset/40 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className={`p-2 rounded-lg bg-surface-inset/60 border border-line shrink-0 ${ATTENTION_COLOR[item.type]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                <p className="text-xs text-ink-faint truncate">{item.description}</p>
              </div>
              <span className="text-xs text-ink-faint shrink-0 hidden sm:inline">{formatDate(item.timestamp)}</span>
              <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink-muted shrink-0" />
            </Link>
          );
        })}
      </div>
      <PaginationBar pagination={data.pagination} noun="items" onPageChange={(page) => update({ page })} disabled={pending} />
    </div>
  );
}
