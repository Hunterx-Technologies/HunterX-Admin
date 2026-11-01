import { getRewards } from '@/lib/api/rewards';
import { getSessionUser } from '@/lib/auth/actions';
import { parseRewardTab } from '@/lib/reward-kinds';
import { redirect } from 'next/navigation';
import { RewardTabs } from './_components/reward-tabs';
import { RewardTriggersClient } from './_components/reward-triggers-client';

export default async function RewardsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Each tab loads only its own rewards, from its own API (?tab=streaks|levels|birthday).
  const tab = parseRewardTab((await searchParams).tab);
  const { triggers, error } = await getRewards(tab);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Rewards &amp; Coupons</h1>
        <p className="text-sm text-ink-muted mt-1">
          Coupons a scratch card can reveal. Hunters earn a card on a streak milestone, on reaching a level, and on their
          birthday; each card&apos;s prize is drawn at random by weight from that reward&apos;s active, in-date, in-stock coupons.
        </p>
      </div>
      <RewardTabs value={tab} />
      <RewardTriggersClient key={tab} tab={tab} triggers={triggers} loadError={error} />
    </div>
  );
}
