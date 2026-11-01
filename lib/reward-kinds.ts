import type { RewardTriggerKind } from '@/types/reward';

// The Rewards page has one tab per reward kind, each backed by its own
// backend API group (HunterX-Backend src/routes/admin.js REWARD_KIND_PATHS).

export type RewardTab = 'streaks' | 'levels' | 'birthday' | 'special';

export const REWARD_TABS: { value: RewardTab; label: string; kind: RewardTriggerKind }[] = [
  { value: 'streaks', label: 'Streak milestones', kind: 'STREAK' },
  { value: 'levels', label: 'Level-ups', kind: 'LEVEL_UP' },
  { value: 'birthday', label: 'Birthday', kind: 'BIRTHDAY' },
  { value: 'special', label: 'Special rewards', kind: 'TASK' },
];

export function parseRewardTab(value: string | string[] | undefined): RewardTab {
  return REWARD_TABS.some((t) => t.value === value) ? (value as RewardTab) : 'streaks';
}

export const kindOfTab = (tab: RewardTab): RewardTriggerKind => REWARD_TABS.find((t) => t.value === tab)!.kind;
