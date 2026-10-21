'use client';

import * as React from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TrendPoint, CouponOverview, RankDistributionPoint } from '@/types/dashboard';

const ACCENT = 'var(--accent-ink)';
const GRID = 'var(--line)';
const AXIS_TEXT = { fill: 'var(--ink-faint)', fontSize: 11 };

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--ink)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  padding: '8px 12px',
};

const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--ink)',
  fontWeight: 600,
  marginBottom: 4,
};

const tooltipItemStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '2px 0',
};

const tooltipCursorBar = {
  fill: 'var(--line)',
  opacity: 0.35,
};

const tooltipCursorLine = {
  stroke: 'var(--line-strong)',
  strokeWidth: 1,
  strokeDasharray: '4 4',
};

function formatShortDate(d: string) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MrrTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={AXIS_TEXT}
          interval={13}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_TEXT}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
          width={48}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          cursor={tooltipCursorLine}
          labelFormatter={(v) => formatShortDate(String(v))}
          formatter={(value) => [`$${Number(value).toLocaleString()}`, 'MRR (Monthly Recurring Revenue)']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#mrrFill)"
          dot={false}
          activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DauTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={AXIS_TEXT}
          interval={5}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          cursor={tooltipCursorLine}
          labelFormatter={(v) => formatShortDate(String(v))}
          formatter={(value) => [`${Number(value)} users`, 'DAU']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={ACCENT}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StreakDropoffChart({ data }: { data: { day: number; usersRemaining: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="dropoffFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(v) => `Day ${v}`}
          tick={AXIS_TEXT}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          cursor={tooltipCursorLine}
          labelFormatter={(v) => `Day ${v}`}
          formatter={(value) => [`${Number(value)} users`, 'Still on streak']}
        />
        <Area
          type="monotone"
          dataKey="usersRemaining"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#dropoffFill)"
          dot={false}
          activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const SUBSCRIPTION_STATUS_COLOR: Record<string, string> = {
  Active: 'var(--ok-ink)',
  Trialing: 'var(--warn-ink)',
  'Past Due': 'var(--caution-ink)',
  Canceled: 'var(--bad-ink)',
};

export function SubscriptionDonut({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={SUBSCRIPTION_STATUS_COLOR[entry.status] ?? 'var(--ink-faint)'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              formatter={(value, name) => {
                const num = Number(value);
                return [`${num} (${Math.round((num / total) * 100)}%)`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-ink">{total}</span>
          <span className="text-[10px] text-ink-faint uppercase tracking-wider">Total</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        {data.map((entry) => (
          <div key={entry.status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-ink-muted">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: SUBSCRIPTION_STATUS_COLOR[entry.status] ?? 'var(--ink-faint)' }}
              />
              {entry.status}
            </span>
            <span className="font-semibold text-ink">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const COUPON_UNUSED_COLOR = 'var(--silver-ink)';

function CouponTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const order = ['used', 'unused', 'expired'];
  const sorted = [...payload].sort((a, b) => {
    const aKey = String(a.dataKey || a.name).toLowerCase();
    const bKey = String(b.dataKey || b.name).toLowerCase();
    return order.indexOf(aKey) - order.indexOf(bKey);
  });

  return (
    <div
      style={tooltipStyle}
      className="rounded-xl border border-line bg-surface/95 backdrop-blur-md px-3.5 py-2.5 shadow-2xl text-xs space-y-1.5"
    >
      <p style={tooltipLabelStyle} className="font-semibold text-ink text-xs mb-1">
        {label}
      </p>
      <div className="space-y-1">
        {sorted.map((entry: any) => {
          const color = entry.color || entry.fill || 'var(--ink)';
          return (
            <div key={entry.name} className="flex items-center gap-2 text-xs font-medium" style={{ color }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="capitalize">{entry.name} :</span>
              <span className="font-bold text-ink ml-auto">{entry.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CouponTierChart({ data }: { data: CouponOverview['byTier'] }) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="tier" tick={AXIS_TEXT} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<CouponTooltip />} cursor={tooltipCursorBar} />
          <Bar dataKey="used" name="Used" fill="var(--ok-ink)" radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="unused" name="Unused" fill={COUPON_UNUSED_COLOR} radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="expired" name="Expired" fill="var(--bad-ink)" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-5 text-xs">
        {[
          { label: 'Used', color: 'var(--ok-ink)' },
          { label: 'Unused', color: COUPON_UNUSED_COLOR },
          { label: 'Expired', color: 'var(--bad-ink)' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 font-medium" style={{ color: l.color }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RankDistributionChart({ data }: { data: RankDistributionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="rank" tick={AXIS_TEXT} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          cursor={tooltipCursorBar}
          formatter={(value) => [`${Number(value)} users`, 'Users']}
        />
        <Bar dataKey="users" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={entry.rank} fillOpacity={0.35 + (i / Math.max(1, data.length - 1)) * 0.65} fill={ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
