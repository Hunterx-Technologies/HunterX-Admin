'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs } from '@/components/ui/tabs';
import { REWARD_TABS, type RewardTab } from '@/lib/reward-kinds';

/** Streak / Level-up / Birthday tabs; the selected tab lives in ?tab= so it survives a refresh. */
export function RewardTabs({ value }: { value: RewardTab }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      items={REWARD_TABS.map(({ value: v, label }) => ({ value: v, label }))}
      value={value}
      onChange={(next) => router.push(`${pathname}?tab=${next}`)}
    />
  );
}
