import {
  getCoreKpis,
  getSubscriptionOverview,
  getMrrTrend,
  getRecentTransactions,
  getReferralOverview,
  getTopReferrers,
  getRecentReferralActivity,
  getCouponOverview,
  getCouponActivityLog,
  getDauTrend,
  getRankDistribution,
  getStreakDropoff,
  getNeedsAttention,
} from '@/lib/api/dashboard';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import {
  MrrTrendChart,
  DauTrendChart,
  StreakDropoffChart,
  SubscriptionDonut,
  CouponTierChart,
  RankDistributionChart,
} from './_components/charts';
import {
  TransactionsTable,
  TopReferrersTable,
  ReferralActivityTable,
  CouponActivityTable,
  NeedsAttentionList,
} from './_components/dashboard-tables';
import {
  Users,
  Activity,
  UserPlus,
  CreditCard,
  CheckCircle2,
  MessageSquare,
  DollarSign,
  UserMinus,
  Percent,
  Share2,
  UserCheck,
  Gift,
  Clock,
  XCircle,
  TrendingUp,
  HeartPulse,
  Trophy,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/actions';
import { EmptyState } from '@/components/ui/empty-state';
import { WidgetError } from '@/components/widget-error';
import type { Loaded } from '@/types/dashboard';
import type { LucideIcon } from 'lucide-react';

/**
 * One chart's states: couldn't load (with Retry), no data, or the chart.
 * `isEmpty` decides when real data has nothing worth plotting (e.g. all zeros).
 */
function Widget<T>({
  result,
  isEmpty,
  emptyIcon = BarChart3,
  children,
}: {
  result: Loaded<T>;
  isEmpty: (data: T) => boolean;
  emptyIcon?: LucideIcon;
  children: (data: T) => React.ReactNode;
}) {
  if (result.error !== null) return <WidgetError message={result.error} />;
  if (isEmpty(result.data)) return <EmptyState icon={emptyIcon} message="No data found." />;
  return <>{children(result.data)}</>;
}

const allZero = <T,>(rows: T[], value: (row: T) => number) => rows.length === 0 || rows.every((r) => !value(r));

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const [
    kpis,
    subscriptionOverview,
    mrrTrend,
    transactions,
    referralOverview,
    topReferrers,
    referralActivity,
    couponOverview,
    couponActivity,
    dauTrend,
    rankDistribution,
    streakDropoff,
    needsAttention,
  ] = await Promise.all([
    getCoreKpis(),
    getSubscriptionOverview(),
    getMrrTrend(),
    getRecentTransactions(),
    getReferralOverview(),
    getTopReferrers(),
    getRecentReferralActivity(),
    getCouponOverview(),
    getCouponActivityLog(),
    getDauTrend(),
    getRankDistribution(),
    getStreakDropoff(),
    getNeedsAttention(),
  ]);

  // Stat cards read these directly; null = that request failed.
  const k = kpis.data;
  const sub = subscriptionOverview.data;
  const ref = referralOverview.data;
  const cpn = couponOverview.data;

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted mt-1">
          A live snapshot of hunters, revenue, referrals, rewards, and engagement health.
        </p>
      </div>

      {/* 1. KPI Strip */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        <StatCard name="Total Users" value={k?.totalUsers ?? 0} icon={Users} color="text-accent-ink" delta={k?.totalUsersDelta} href="/users" failed={!k} />
        <StatCard name="Active Today" value={k?.activeToday ?? 0} icon={Activity} color="text-ok-ink" delta={k?.activeTodayDelta} href="/users" failed={!k} />
        <StatCard name="New Signups Today" value={k?.newSignupsToday ?? 0} icon={UserPlus} color="text-warn-ink" delta={k?.newSignupsTodayDelta} href="/users" failed={!k} />
        <StatCard name="Active Subscriptions" value={k?.activeSubscriptions ?? 0} icon={CreditCard} color="text-accent-ink" delta={k?.activeSubscriptionsDelta} href="/subscriptions" failed={!k} />
        <StatCard name="Tasks Completed Today" value={k?.tasksCompletedToday ?? 0} icon={CheckCircle2} color="text-ok-ink" delta={k?.tasksCompletedTodayDelta} href="/tasks" failed={!k} />
        <StatCard name="Open Feedback Tickets" value={k?.openFeedbackTickets ?? 0} icon={MessageSquare} color="text-caution-ink" delta={k?.openFeedbackTicketsDelta} href="/feedback" failed={!k} />
      </div>

      {/* 2. Subscription & Revenue */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-ink">Subscription & Revenue</h2>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          <StatCard name="MRR (Monthly Recurring Revenue)" value={`$${(sub?.mrr ?? 0).toLocaleString()}`} icon={DollarSign} color="text-ok-ink" failed={!sub} />
          <StatCard name="Active Subscribers" value={sub?.activeSubscribers ?? 0} icon={Users} failed={!sub} />
          <StatCard name="New Subs Today / Week" value={`${sub?.newSubsToday ?? 0} / ${sub?.newSubsWeek ?? 0}`} icon={UserPlus} color="text-warn-ink" failed={!sub} />
          <StatCard name="Churned This Week" value={sub?.churnedThisWeek ?? 0} icon={UserMinus} color="text-bad-ink" failed={!sub} />
          <StatCard name="Trial → Paid" value={`${sub?.trialToPaidPct ?? 0}%`} icon={Percent} color="text-accent-ink" failed={!sub} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-ink mb-4">MRR (Monthly Recurring Revenue) — Last 90 Days</h3>
            <Widget result={mrrTrend} isEmpty={(d) => allZero(d, (p) => p.value)} emptyIcon={TrendingUp}>
              {(d) => <MrrTrendChart data={d} />}
            </Widget>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-ink mb-4">Subscription Status</h3>
            <Widget
              result={subscriptionOverview}
              isEmpty={(d) => allZero(d.statusBreakdown ?? [], (x) => x.count)}
              emptyIcon={CreditCard}
            >
              {(d) => <SubscriptionDonut data={d.statusBreakdown} />}
            </Widget>
          </Card>
        </div>
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">Recent Transactions</h3>
          <TransactionsTable initial={transactions} />
        </Card>
      </section>

      {/* 3. Referrals */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-ink">Referrals</h2>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          <StatCard name="Total Links Sent" value={ref?.totalLinksSent ?? 0} icon={Share2} failed={!ref} />
          <StatCard name="Successful Signups" value={ref?.successfulSignups ?? 0} icon={UserCheck} color="text-ok-ink" failed={!ref} />
          <StatCard name="Referral → Paid" value={`${ref?.referralToPaidPct ?? 0}%`} icon={Percent} color="text-accent-ink" failed={!ref} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold text-ink">Top Referrers</h3>
            <TopReferrersTable initial={topReferrers} />
          </Card>
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold text-ink">Recent Referral Activity</h3>
            <ReferralActivityTable initial={referralActivity} />
          </Card>
        </div>
      </section>

      {/* 4. Rewards & Coupons */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-ink">Rewards & Coupons</h2>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
          <StatCard name="Issued" value={cpn?.issued ?? 0} icon={Gift} failed={!cpn} />
          <StatCard name="Redeemed" value={cpn?.redeemed ?? 0} icon={CheckCircle2} color="text-ok-ink" failed={!cpn} />
          <StatCard name="Unredeemed" value={cpn?.unredeemed ?? 0} icon={Clock} color="text-warn-ink" failed={!cpn} />
          <StatCard name="Expired" value={cpn?.expired ?? 0} icon={XCircle} color="text-bad-ink" failed={!cpn} />
          <StatCard name="Redemption Rate" value={`${cpn?.redemptionRatePct ?? 0}%`} icon={Percent} color="text-accent-ink" failed={!cpn} />
        </div>
        <Card>
          <h3 className="text-sm font-semibold text-ink mb-4">Coupons by Reward Tier</h3>
          <Widget
            result={couponOverview}
            isEmpty={(d) => allZero(d.byTier ?? [], (t) => t.used + t.unused + t.expired)}
            emptyIcon={Gift}
          >
            {(d) => <CouponTierChart data={d.byTier} />}
          </Widget>
        </Card>
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-ink">Coupon Activity Log</h3>
          <CouponActivityTable initial={couponActivity} />
        </Card>
      </section>

      {/* 5. Engagement Health */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-ink">Engagement Health</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-ink" /> Daily Active Users — Last 30 Days
            </h3>
            <Widget result={dauTrend} isEmpty={(d) => allZero(d, (p) => p.value)} emptyIcon={TrendingUp}>
              {(d) => <DauTrendChart data={d} />}
            </Widget>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent-ink" /> Users by Rank
            </h3>
            <Widget result={rankDistribution} isEmpty={(d) => allZero(d, (r) => r.users)} emptyIcon={Trophy}>
              {(d) => <RankDistributionChart data={d} />}
            </Widget>
          </Card>
        </div>
        <Card>
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-accent-ink" /> Streak Drop-off — First 14 Days
          </h3>
          <Widget result={streakDropoff} isEmpty={(d) => allZero(d, (p) => p.usersRemaining)} emptyIcon={HeartPulse}>
            {(d) => <StreakDropoffChart data={d} />}
          </Widget>
        </Card>
      </section>

      {/* 6. Needs Attention */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-caution-ink" /> Needs Attention
        </h2>
        <Card>
          <NeedsAttentionList initial={needsAttention} />
        </Card>
      </section>
    </div>
  );
}
