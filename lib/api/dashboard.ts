'use server';

// Server Functions backing the Dashboard page. Every widget loads on its own:
// a failed request comes back as { error } so that widget shows a
// "couldn't load" state with Retry, instead of zeros that look like real data.

import type {
  CoreKpis,
  SubscriptionOverview,
  Transaction,
  ReferralOverview,
  TopReferrer,
  ReferralActivity,
  CouponOverview,
  CouponActivityEntry,
  TrendPoint,
  RankDistributionPoint,
  NeedsAttentionItem,
  DashboardListPath,
  DashboardListQuery,
  PagedList,
  Loaded,
} from '@/types/dashboard';
import { apiClient } from '@/lib/api/client';

const LOAD_ERROR = "Couldn't load this data. Check your connection and try again.";

const isObject = (d: unknown) => typeof d === 'object' && d !== null && !Array.isArray(d);

async function fetchWidget<T>(path: string, valid: (d: unknown) => boolean): Promise<Loaded<T>> {
  try {
    const response = await apiClient.get<any>(`/admin/dashboard/${path}`);
    const data = response.data?.data;
    if (response.data?.success && valid(data)) return { data: data as T, error: null };
    console.error(`[dashboard/${path}] unexpected response`);
  } catch (error) {
    console.error(`[dashboard/${path}] failed:`, error);
  }
  return { data: null, error: LOAD_ERROR };
}

export async function getCoreKpis(): Promise<Loaded<CoreKpis>> {
  return fetchWidget('kpis', isObject);
}

export async function getSubscriptionOverview(): Promise<Loaded<SubscriptionOverview>> {
  return fetchWidget('subscriptions', isObject);
}

export async function getMrrTrend(): Promise<Loaded<TrendPoint[]>> {
  return fetchWidget('mrr-trend', Array.isArray);
}

export async function getDauTrend(): Promise<Loaded<TrendPoint[]>> {
  return fetchWidget('dau-trend', Array.isArray);
}

export async function getStreakDropoff(): Promise<Loaded<{ day: number; usersRemaining: number }[]>> {
  return fetchWidget('streak-dropoff', Array.isArray);
}

export async function getRankDistribution(): Promise<Loaded<RankDistributionPoint[]>> {
  return fetchWidget('rank-distribution', Array.isArray);
}

export async function getReferralOverview(): Promise<Loaded<ReferralOverview>> {
  return fetchWidget('referrals', isObject);
}

export async function getCouponOverview(): Promise<Loaded<CouponOverview>> {
  return fetchWidget('coupons', isObject);
}

// ── Paged lists ───────────────────────────────────────────
// The backend pages and sorts these (?page=&limit=&sort=, coupon-activity
// also ?partner=). Called on first render and again by the tables when the
// page, sort or partner changes.
const LIST_LIMIT = 5;

async function getDashboardList<T>(path: DashboardListPath, query: DashboardListQuery = {}): Promise<PagedList<T>> {
  const page = Math.max(1, query.page ?? 1);
  try {
    const response = await apiClient.get<any>(`/admin/dashboard/${path}`, {
      params: { page, limit: LIST_LIMIT, sort: query.sort, partner: query.partner },
    });
    const data = response.data?.data;
    if (response.data?.success && data && Array.isArray(data.items) && data.pagination) {
      return {
        items: data.items,
        pagination: data.pagination,
        sort: data.sort ?? query.sort ?? '',
        partners: Array.isArray(data.partners) ? data.partners : undefined,
        error: null,
      };
    }
    console.error(`[dashboard/${path}] unexpected response`);
  } catch (error) {
    console.error(`[dashboard/${path}] failed:`, error);
  }
  return {
    items: [],
    pagination: { page, limit: LIST_LIMIT, total_count: 0, total_pages: 0, has_next_page: false },
    sort: query.sort ?? '',
    error: LOAD_ERROR,
  };
}

export async function getRecentTransactions(query?: DashboardListQuery): Promise<PagedList<Transaction>> {
  return getDashboardList('transactions', query);
}

export async function getTopReferrers(query?: DashboardListQuery): Promise<PagedList<TopReferrer>> {
  return getDashboardList('top-referrers', query);
}

export async function getRecentReferralActivity(query?: DashboardListQuery): Promise<PagedList<ReferralActivity>> {
  return getDashboardList('referral-activity', query);
}

export async function getCouponActivityLog(query?: DashboardListQuery): Promise<PagedList<CouponActivityEntry>> {
  return getDashboardList('coupon-activity', query);
}

export async function getNeedsAttention(query?: DashboardListQuery): Promise<PagedList<NeedsAttentionItem>> {
  return getDashboardList('needs-attention', query);
}
