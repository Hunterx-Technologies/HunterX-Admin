'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  changeRewardValue,
  createReward,
  createRewardCoupon,
  deleteReward,
  deleteRewardCoupon,
  renameReward,
  setRewardActive,
  setRewardActivation,
  setRewardCouponActive,
  setRewardCouponChances,
  updateRewardCoupon,
} from '@/lib/api/reward-actions';
import { getRewardHistory } from '@/lib/api/rewards';
import { kindOfTab, type RewardTab } from '@/lib/reward-kinds';
import type { CouponAllocationStatus, CouponInput, RewardCoupon, RewardHistoryEntry, RewardStatus, RewardTrigger, RewardTriggerKind } from '@/types/reward';
import { AlertCircle, AlertTriangle, Cake, CalendarClock, ChevronDown, ChevronsDownUp, ChevronsUpDown, Flame, History, Link2, Pencil, Percent, Sparkles, Plus, Trash2, TrendingUp, Upload, X, type LucideIcon } from 'lucide-react';
import { buildCouponFormData } from '@/lib/reward-form';
import { imageFileError, MAX_IMAGE_LABEL } from '@/lib/upload-limits';
import { RewardImage } from './reward-image';
import { useAdminTimeZone } from '@/components/admin-timezone';
import { HelpTip } from '@/components/ui/help-tip';

const EMPTY_COUPON: CouponInput = {
  title: '',
  couponCode: '',
  discountType: 'PERCENT',
  discountValue: '',
  currency: '₹',
  chancePercent: '',
  totalQuantity: '',
  validFrom: '',
  validUntil: '',
  validDaysAfterAward: '',
  description: '',
  productName: '',
  productCategory: '',
  redeemUrl: '',
  imageFile: null,
  removeImage: false,
  isActive: true,
};

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function couponToInput(c: RewardCoupon): CouponInput {
  return {
    title: c.title,
    couponCode: c.couponCode,
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    currency: c.currency ?? '₹',
    chancePercent: String(c.chancePercent),
    totalQuantity: c.totalQuantity === null ? '' : String(c.totalQuantity),
    validFrom: toDateInput(c.validFrom),
    validUntil: toDateInput(c.validUntil),
    validDaysAfterAward: c.validDaysAfterAward === null ? '' : String(c.validDaysAfterAward),
    description: c.description ?? '',
    productName: c.productName ?? '',
    productCategory: c.productCategory ?? '',
    redeemUrl: c.redeemUrl ?? '',
    imageFile: null,
    removeImage: false,
    isActive: c.isActive,
  };
}

function formatDiscount(c: RewardCoupon) {
  return c.discountType === 'PERCENT' ? `${c.discountValue}% OFF` : `${c.currency ?? ''}${c.discountValue} OFF`;
}

// Dates are formatted with a fixed locale in the admin's zone (the hx_tz
// cookie, see components/admin-timezone.tsx), so the server render and the
// browser produce the same text and hydration doesn't fail.
function formatDate(iso: string | null, timeZone: string) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone }) : null;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

type DialogState = { mode: 'create'; trigger: RewardTrigger } | { mode: 'edit'; trigger: RewardTrigger; coupon: RewardCoupon } | null;

const SECTION: Record<RewardTriggerKind, { description: string; icon: LucideIcon; inputLabel?: string; placeholder?: string; max?: number }> = {
  STREAK: {
    description: 'A card the first time a hunter\'s daily streak reaches this many days.',
    icon: Flame,
    inputLabel: 'Streak length (days)',
    placeholder: 'e.g. 21',
    max: 3650,
  },
  LEVEL_UP: {
    description: 'A card when a hunter reaches this level (one per level, even in a multi-level jump).',
    icon: TrendingUp,
    inputLabel: 'Level reached',
    placeholder: 'e.g. 10',
    max: 1000,
  },
  BIRTHDAY: {
    description: 'A card once a year on the hunter\'s birthday. Skipped if their date of birth changed in the last 30 days.',
    icon: Cake,
  },
  TASK: {
    description: 'Exclusive rewards (e.g. a Nike drop) you link to specific tasks when creating or editing them. Every hunter who completes a linked task gets one card — once per task. Tasks without one just give their XP.',
    icon: Sparkles,
    inputLabel: 'Special reward name',
    placeholder: 'e.g. Nike drop',
  },
};

export function triggerLabel(t: Pick<RewardTrigger, 'kind' | 'value' | 'description'>) {
  if (t.kind === 'TASK') return t.description || `Special reward #${t.value}`;
  if (t.kind === 'STREAK') return `${t.value}-day streak`;
  if (t.kind === 'LEVEL_UP') return `Level ${t.value}`;
  return 'Birthday';
}

/** One tab of the Rewards page: the rewards of one kind, loaded from that kind's API. */
export function RewardTriggersClient({ tab, triggers, loadError }: { tab: RewardTab; triggers: RewardTrigger[]; loadError: string | null }) {
  const router = useRouter();
  const timeZone = useAdminTimeZone();
  const kind = kindOfTab(tab);
  const section = SECTION[kind];
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [newValue, setNewValue] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<RewardTrigger | null>(null);
  const [confirmDeleteCoupon, setConfirmDeleteCoupon] = React.useState<RewardCoupon | null>(null);
  const [renaming, setRenaming] = React.useState<{ id: string; name: string } | null>(null);
  const [chancesFor, setChancesFor] = React.useState<RewardTrigger | null>(null);
  const [historyFor, setHistoryFor] = React.useState<RewardTrigger | null>(null);
  // Which reward cards show their coupon table. All start collapsed so a long
  // list stays scannable; opening the add-coupon dialog expands that reward.
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const setOpen = (id: string, open: boolean) =>
    setExpanded((prev) => {
      if (prev.has(id) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  const expandable = triggers.filter((t) => t.coupons.length > 0);
  const allExpanded = expandable.length > 0 && expandable.every((t) => expanded.has(t.id));

  // On/off switches flip at once (optimistic) instead of waiting for the save
  // and page refresh, and only the switch being saved is locked — so the rest
  // of the page doesn't dim and blink. Keys: `t:<rewardId>` / `c:<couponId>`.
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});
  const savingToggles = React.useRef(new Set<string>());
  const serverActive = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const t of triggers) {
      map[`t:${t.id}`] = t.isActive;
      for (const c of t.coupons) map[`c:${c.id}`] = c.isActive;
    }
    return map;
  }, [triggers]);
  // Once fresh data shows the saved value, drop the optimistic one.
  React.useEffect(() => {
    setToggled((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([key, v]) => serverActive[key] !== v || savingToggles.current.has(key)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [serverActive]);
  const isOn = (key: string) => toggled[key] ?? serverActive[key];
  const toggle = async (key: string, checked: boolean, save: () => Promise<void>) => {
    if (savingToggles.current.has(key)) return;
    savingToggles.current.add(key);
    setToggled((prev) => ({ ...prev, [key]: checked }));
    setError(null);
    setNotice(null);
    try {
      await save();
      React.startTransition(() => router.refresh());
    } catch (err) {
      setToggled((prev) => {
        const rest = { ...prev };
        delete rest[key];
        return rest;
      });
      setError(errorMessage(err, 'Something went wrong. Try again.'));
    } finally {
      savingToggles.current.delete(key);
    }
  };

  // Special rewards edit their name; streak / level rewards their number.
  const editsValue = kind === 'STREAK' || kind === 'LEVEL_UP';
  const renameNumber = Number(renaming?.name);
  const renameValid = !!renaming && (editsValue
    ? Number.isInteger(renameNumber) && renameNumber >= 1 && renameNumber <= (section.max ?? 0)
    : renaming.name.trim().length > 0 && renaming.name.trim().length <= 120);
  const saveRename = (m: RewardTrigger) => {
    if (!renaming || !renameValid) return;
    const name = renaming.name.trim();
    if (editsValue ? renameNumber === m.value : name === triggerLabel(m)) return setRenaming(null);
    run(`rename-${m.id}`, async () => {
      if (editsValue) await changeRewardValue(tab, m.id, renameNumber);
      else await renameReward(tab, m.id, name);
      setRenaming(null);
    });
  };

  const run = async (id: string, action: () => Promise<string | void>) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const message = await action();
      if (message) setNotice(message);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const value = Number(newValue);
  const valueValid = kind === 'TASK'
    ? newValue.trim().length > 0 && newValue.trim().length <= 120
    : Number.isInteger(value) && value >= 1 && value <= (section.max ?? 0);
  // There's only ever one birthday reward.
  const canAddBirthday = kind === 'BIRTHDAY' && triggers.length === 0 && !loadError;

  return (
    <div className="space-y-6">
      {loadError && <ErrorBanner message={`Couldn't load these rewards: ${loadError}`} />}
      {error && <ErrorBanner message={error} />}
      {notice && (
        <div className="p-3.5 rounded-lg border border-accent/20 bg-accent/10 text-accent-ink text-sm">{notice}</div>
      )}

      <div className="flex items-start gap-2.5">
        <section.icon className="w-5 h-5 text-accent-ink mt-0.5" />
        <p className="flex-1 text-sm text-ink-muted">{section.description}</p>
        {expandable.length > 1 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(expandable.map((t) => t.id)))}
          >
            {allExpanded ? <ChevronsDownUp className="w-3.5 h-3.5 mr-1" /> : <ChevronsUpDown className="w-3.5 h-3.5 mr-1" />}
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
        )}
      </div>

      {kind !== 'BIRTHDAY' && (
        <Card className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Input
              label={section.inputLabel}
              type={kind === 'TASK' ? 'text' : 'number'}
              min={kind === 'TASK' ? undefined : 1}
              max={section.max}
              maxLength={kind === 'TASK' ? 120 : undefined}
              placeholder={section.placeholder}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={!valueValid || busyId !== null}
            onClick={() =>
              run('new-trigger', async () => {
                await (kind === 'TASK' ? createReward(tab, undefined, newValue.trim()) : createReward(tab, value));
                setNewValue('');
              })
            }
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> {busyId === 'new-trigger' ? 'Adding...' : { STREAK: 'Add streak reward', LEVEL_UP: 'Add level reward', TASK: 'Add special reward', BIRTHDAY: '' }[kind]}
          </Button>
        </Card>
      )}

      {canAddBirthday && (
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">No birthday reward yet. Add it, then give it coupons.</p>
          <Button
            type="button"
            disabled={busyId !== null}
            onClick={() => run('new-trigger', () => createReward(tab))}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> {busyId === 'new-trigger' ? 'Adding...' : 'Add birthday reward'}
          </Button>
        </Card>
      )}

      {kind !== 'BIRTHDAY' && !loadError && triggers.length === 0 && (
        <p className="text-sm text-ink-muted px-1">None yet — add one above.</p>
      )}

      <div className="space-y-4">
        {triggers.map((m) => { const active = isOn(`t:${m.id}`); const hasCoupons = m.coupons.length > 0; const open = hasCoupons && expanded.has(m.id); return (
          <Card key={m.id} className={active ? undefined : 'border-dashed'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                {renaming?.id === m.id ? (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRename(m);
                    }}
                  >
                    <Input
                      autoFocus
                      aria-label={section.inputLabel}
                      type={editsValue ? 'number' : 'text'}
                      min={editsValue ? 1 : undefined}
                      max={editsValue ? section.max : undefined}
                      maxLength={editsValue ? undefined : 120}
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: m.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                      className={editsValue ? 'w-32' : 'w-72 max-w-full'}
                    />
                    <Button type="submit" size="sm" disabled={!renameValid || busyId !== null}>
                      {busyId === `rename-${m.id}` ? 'Saving...' : 'Save'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busyId === `rename-${m.id}`} onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                    {editsValue && m.cardsGranted > 0 && (
                      <p className="basis-full text-xs text-warn-ink">
                        {m.cardsGranted.toLocaleString('en-US')} hunter{m.cardsGranted === 1 ? ' has' : 's have'} already got this card. They keep it (it&apos;ll show the new{' '}
                        {kind === 'STREAK' ? 'streak' : 'level'}) and won&apos;t get this reward again.
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`reward-coupons-${m.id}`}
                      disabled={!hasCoupons}
                      title={hasCoupons ? (open ? 'Hide coupons' : 'Show coupons') : 'No coupons yet'}
                      onClick={() => setOpen(m.id, !open)}
                      className="-ml-1 flex items-center gap-1.5 rounded-md px-1 text-left cursor-pointer disabled:cursor-default"
                    >
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${hasCoupons ? 'text-ink-faint' : 'text-ink-faint/30'} ${open ? '' : '-rotate-90'}`}
                      />
                      <h3 className={active ? 'text-base font-bold text-ink' : 'text-base font-bold text-ink-muted'}>{triggerLabel(m)}</h3>
                    </button>
                    {m.kind !== 'BIRTHDAY' && (
                      <button
                        type="button"
                        aria-label={editsValue ? `Edit ${section.inputLabel?.toLowerCase()}` : 'Rename reward'}
                        title={editsValue ? 'Edit' : 'Rename'}
                        disabled={busyId !== null}
                        onClick={() => setRenaming({ id: m.id, name: editsValue ? String(m.value) : triggerLabel(m) })}
                        className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-surface-inset disabled:opacity-50 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <RewardStatusBadge trigger={m} active={active} />
                    {active && m.coupons.some((c) => c.isActive) && m.totalPercent === 0 && (
                      <span title="Its active coupons add up to 0%, so hunters completing it get no coupon. Use Set chances to give them a share.">
                        <Badge variant="warning">0% allocated</Badge>
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm text-ink-faint mt-0.5">
                  {hasCoupons && `${m.coupons.length} coupon${m.coupons.length === 1 ? '' : 's'} · `}
                  {!active
                    ? `Switched off — grants no new cards. ${m.cardsGranted.toLocaleString('en-US')} already granted stay with their hunters.`
                    : m.coupons.some((c) => isOn(`c:${c.id}`))
                    ? `${m.cardsGranted.toLocaleString('en-US')} scratch card${m.cardsGranted === 1 ? '' : 's'} granted`
                    : 'No active coupons — this grants no scratch card yet.'}
                </p>
                <ActivationLine
                  trigger={m}
                  busy={busyId !== null}
                  saving={busyId === `activate-${m.id}`}
                  onSave={(iso) => run(`activate-${m.id}`, async () => {
                    await setRewardActivation(tab, m.id, iso);
                    return `${triggerLabel(m)}: only completions from ${formatDateTime(iso, timeZone)} on are considered.`;
                  })}
                />
                {(m.activatedAt || m.lifetimeEligible > 0) && (
                  <div className="text-xs text-ink-muted mt-1 tabular-nums space-y-0.5">
                    <p className="flex flex-wrap items-center gap-x-1">
                      <span className="text-ink-faint">Current window:</span>
                      {m.eligibleUsers.toLocaleString('en-US')} eligible hunter{m.eligibleUsers === 1 ? '' : 's'} · {m.assignedCount.toLocaleString('en-US')} assigned a coupon ·{' '}
                      <span className={m.totalPercent > 0 ? '' : 'text-warn-ink'}>{m.totalPercent}% allocated</span> · {m.unallocatedPercent}% unallocated
                      <HelpTip label="Current window and lifetime" className="ml-0.5">{HELP.stats}</HelpTip>
                    </p>
                    {m.lifetimeEligible > 0 && (
                      <p>
                        <span className="text-ink-faint">Lifetime:</span> {m.lifetimeEligible.toLocaleString('en-US')} eligible · {m.lifetimeAssigned.toLocaleString('en-US')} assigned
                        {m.historicalEligible > 0 && (
                          <span className="text-ink-faint">
                            {' '}· {m.historicalAssigned.toLocaleString('en-US')} of them assigned ({m.historicalEligible.toLocaleString('en-US')} considered) before the current activation time — kept, not counted in this window
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {m.kind === 'TASK' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                    <Link2 className="w-3.5 h-3.5 text-ink-faint" />
                    {m.tasks && m.tasks.length > 0 ? (
                      m.tasks.map((t) => (
                        <a key={t.id} href={`/tasks/${t.id}`} className={t.isActive ? 'text-accent-ink hover:underline' : 'text-ink-faint line-through hover:underline'}>
                          {t.title}
                        </a>
                      ))
                    ) : (
                      <span className="text-ink-faint">Not linked to any task yet — link it from the task form.</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {m.legacyUnfilledCards > 0 && (
                  <span title="Cards earned before coupons were allocated on the spot, while this reward was out of stock. Their hunters were never told and, under the current rules, they are not filled later.">
                    <Badge variant="muted">{m.legacyUnfilledCards} old unfilled</Badge>
                  </span>
                )}
                {m.cardsGranted === 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Delete reward"
                    title="Delete — possible because no hunter has received a card from it yet"
                    disabled={busyId !== null}
                    onClick={() => setConfirmDelete(m)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Switch
                  checked={active}
                  onCheckedChange={(checked) => toggle(`t:${m.id}`, checked, () => setRewardActive(tab, m.id, checked))}
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => setHistoryFor(m)} title="Who changed this reward's settings, and when">
                  <History className="w-3.5 h-3.5 mr-1" /> History
                </Button>
                {m.coupons.some((c) => c.isActive) && (
                  <Button type="button" size="sm" variant="ghost" disabled={busyId !== null} onClick={() => setChancesFor(m)}>
                    <Percent className="w-3.5 h-3.5 mr-1" /> Set chances
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => {
                    setOpen(m.id, true);
                    setDialog({ mode: 'create', trigger: m });
                  }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add coupon
                </Button>
              </div>
            </div>

            {hasCoupons && (
              <div
                id={`reward-coupons-${m.id}`}
                inert={!open}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
              >
              <div className="min-h-0 overflow-hidden">
              <div className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Chance</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">Assigned / target <HelpTip label="Assigned / target">{HELP.target}</HelpTip></span>
                    </TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.coupons.map((c) => (
                    <TableRow key={c.id} className={isOn(`c:${c.id}`) ? '' : 'opacity-60'}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <RewardImage src={c.productImageUrl} alt={c.title} className="w-12 h-10 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{c.title}</p>
                            <p className="text-xs font-mono text-ink-faint">{c.couponCode}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDiscount(c)}</TableCell>
                      <TableCell className="tabular-nums">{c.chancePercent}%</TableCell>
                      <TableCell className="tabular-nums">
                        {c.allocation.assigned} / {c.allocation.target}
                        {c.allocation.remainingQuota > 0 && <p className="text-xs text-ink-faint">{c.allocation.remainingQuota} left</p>}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {c.totalQuantity === null ? (
                          <span title={`${c.awardedCount} awarded in total`}>Unlimited</span>
                        ) : (
                          <span title={`${c.awardedCount} of ${c.totalQuantity} awarded in total`}>{c.allocation.availableStock} left</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <AllocationBadge status={c.allocation.status} />
                      </TableCell>
                      <TableCell className="text-xs text-ink-muted">
                        {formatDate(c.validFrom, timeZone) ?? 'Now'} – {formatDate(c.validUntil, timeZone) ?? 'no end'}
                        {c.validDaysAfterAward && <p>{c.validDaysAfterAward}d after award</p>}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={isOn(`c:${c.id}`)}
                          onCheckedChange={(checked) => toggle(`c:${c.id}`, checked, () => setRewardCouponActive(c.id, checked))}
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Edit coupon"
                          onClick={() => setDialog({ mode: 'edit', trigger: m, coupon: c })}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Delete coupon"
                          disabled={busyId !== null}
                          onClick={() => setConfirmDeleteCoupon(c)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
            ))}
          </TableBody>
        </Table>
              </div>
              </div>
              </div>
      )}
    </Card>
        ); })}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete ${confirmDelete ? triggerLabel(confirmDelete) : ''} reward?`}
        message={
          <>
            No hunter has received a card from it yet, so it can be removed for good, along with its{' '}
            {confirmDelete?.coupons.length ?? 0} coupon{confirmDelete?.coupons.length === 1 ? '' : 's'} and their images. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete reward"
        busyLabel="Deleting..."
        busy={busyId === `delete-${confirmDelete?.id}`}
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          if (!target) return;
          run(`delete-${target.id}`, async () => {
            await deleteReward(tab, target.id);
            return `${triggerLabel(target)} reward deleted.`;
          }).finally(() => setConfirmDelete(null));
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteCoupon}
        title={`Delete "${confirmDeleteCoupon?.title ?? ''}"?`}
        message={
          confirmDeleteCoupon && confirmDeleteCoupon.awardedCount > 0 ? (
            <>
              {confirmDeleteCoupon.awardedCount.toLocaleString('en-US')} hunter{confirmDeleteCoupon.awardedCount === 1 ? ' has' : 's have'}{' '}
              already won this coupon, so it will be switched off instead of deleted. They keep their codes; it just won&apos;t be assigned again.
            </>
          ) : (
            <>Nobody has won this coupon yet, so it will be removed for good, along with its image. This can&apos;t be undone.</>
          )
        }
        confirmLabel={confirmDeleteCoupon && confirmDeleteCoupon.awardedCount > 0 ? 'Switch off coupon' : 'Delete coupon'}
        busyLabel="Deleting..."
        busy={busyId === `delete-coupon-${confirmDeleteCoupon?.id}`}
        destructive
        onCancel={() => setConfirmDeleteCoupon(null)}
        onConfirm={() => {
          const target = confirmDeleteCoupon;
          if (!target) return;
          run(`delete-coupon-${target.id}`, async () => {
            const deleted = await deleteRewardCoupon(target.id);
            return deleted ? 'Coupon deleted.' : `"${target.title}" was already awarded, so it was deactivated instead of deleted.`;
          }).finally(() => setConfirmDeleteCoupon(null));
        }}
      />

      {historyFor && <RewardHistoryDialog key={historyFor.id} tab={tab} trigger={historyFor} onClose={() => setHistoryFor(null)} />}

      {chancesFor && (
        <SetChancesDialog
          key={chancesFor.id}
          tab={tab}
          trigger={chancesFor}
          onClose={() => setChancesFor(null)}
          onSaved={() => {
            const label = triggerLabel(chancesFor);
            setChancesFor(null);
            setOpen(chancesFor.id, true);
            setError(null);
            setNotice(`Chances updated for ${label}. They apply to hunters from now on; every coupon already assigned stays assigned.`);
            router.refresh();
          }}
        />
      )}

      {dialog && (
        <CouponDialog
          key={dialog.mode === 'edit' ? dialog.coupon.id : `new-${dialog.trigger.id}`}
          tab={tab}
          state={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CouponDialog({ tab, state, onClose, onSaved }: { tab: RewardTab; state: NonNullable<DialogState>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<CouponInput>(state.mode === 'edit' ? couponToInput(state.coupon) : EMPTY_COUPON);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const update = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const value = Number(form.discountValue);
  const isValid =
    form.title.trim().length > 0 &&
    /^[A-Za-z0-9_-]{3,50}$/.test(form.couponCode.trim()) &&
    Number.isFinite(value) && value > 0 &&
    (form.discountType !== 'PERCENT' || value <= 100) &&
    (form.discountType !== 'FLAT' || form.currency.trim().length > 0) &&
    parseChance(form.chancePercent) !== null &&
    (!form.isActive || chanceRoom(state.trigger, state.mode === 'edit' ? state.coupon.id : null) >= (parseChance(form.chancePercent) ?? 0));

  // Saving with no quantity asks once: an unlimited coupon can be won by every hunter.
  const [confirmUnlimited, setConfirmUnlimited] = React.useState(false);
  const quantityRef = React.useRef<HTMLInputElement>(null);

  // Product image: a newly picked file previews locally until saved.
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  React.useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);
  const currentImage = state.mode === 'edit' && !form.removeImage ? state.coupon.productImageUrl : null;
  const shownImage = filePreview ?? currentImage;

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fileError = imageFileError(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setError(null);
    setFilePreview(URL.createObjectURL(file));
    setForm((f) => ({ ...f, imageFile: file, removeImage: false }));
  };

  const clearImage = () => {
    setFilePreview(null);
    setForm((f) => ({ ...f, imageFile: null, removeImage: state.mode === 'edit' && !!state.coupon.productImageUrl }));
  };

  const save = async ({ unlimitedConfirmed = false } = {}) => {
    if (!isValid) return;
    if (form.totalQuantity.trim() === '' && !unlimitedConfirmed) {
      setConfirmUnlimited(true);
      return;
    }
    setConfirmUnlimited(false);
    setSaving(true);
    setError(null);
    try {
      const body = buildCouponFormData(form);
      if (state.mode === 'edit') await updateRewardCoupon(state.coupon.id, body);
      else await createRewardCoupon(tab, state.trigger.id, body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save this coupon.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={state.mode === 'edit' ? 'Edit coupon' : `Add coupon · ${triggerLabel(state.trigger)}`}
      description="Every winner of this coupon gets the same code. Tap ? beside a field to see what it does."
      className="max-w-2xl p-5 sm:p-6"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => save()} disabled={!isValid || saving || confirmUnlimited}>
            {saving ? 'Saving...' : state.mode === 'edit' ? 'Save changes' : 'Add coupon'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4 max-h-[min(65vh,40rem)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] -mx-1 pl-1 pr-2 pb-1">
        <Input label="Title" help={HELP.title} placeholder="e.g. 40% off Myntra Sports" maxLength={120} value={form.title} onChange={(e) => update('title', e.target.value)} required />
        <Input label="Coupon code" help={HELP.couponCode} placeholder="e.g. HUNTER40" maxLength={50} value={form.couponCode} onChange={(e) => update('couponCode', e.target.value.toUpperCase())} required />
        {/* Coupons are percent-off only. A legacy flat-amount coupon keeps its
            amount + currency when edited rather than being reread as a percent. */}
        {form.discountType === 'FLAT' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Input label="Amount off" help={HELP.amountOff} hint="Older flat-amount coupon." type="number" min={0.01} step="0.01" value={form.discountValue} onChange={(e) => update('discountValue', e.target.value)} required />
            <Input label="Currency" maxLength={8} value={form.currency} onChange={(e) => update('currency', e.target.value)} required />
          </div>
        )}
        <div className={`grid grid-cols-1 gap-3 items-start ${form.discountType === 'PERCENT' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {form.discountType === 'PERCENT' && (
            <Input label="Percent off" help={HELP.percentOff} hint="1–100." type="number" min={0.01} max={100} step="0.01" value={form.discountValue} onChange={(e) => update('discountValue', e.target.value)} required />
          )}
          <Input
            label="Chance (%)"
            help={HELP.chance}
            hint={`0–100. ${chanceRoom(state.trigger, state.mode === 'edit' ? state.coupon.id : null)}% is free on this reward.`}
            placeholder="e.g. 25"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.chancePercent}
            onChange={(e) => update('chancePercent', e.target.value)}
            error={
              form.chancePercent.trim() !== '' && parseChance(form.chancePercent) === null
                ? 'Use a percentage from 0 to 100 (up to 2 decimals).'
                : form.isActive && (parseChance(form.chancePercent) ?? 0) > chanceRoom(state.trigger, state.mode === 'edit' ? state.coupon.id : null)
                ? `Only ${chanceRoom(state.trigger, state.mode === 'edit' ? state.coupon.id : null)}% is free — the reward's coupons can add up to 100% at most.`
                : undefined
            }
            required
          />
          <Input ref={quantityRef} label="Total quantity" help={HELP.totalQuantity} hint="Leave blank for unlimited." type="number" min={1} placeholder="Unlimited" value={form.totalQuantity} onChange={(e) => update('totalQuantity', e.target.value)} />
        </div>
        <ChancePreview trigger={state.trigger} editingId={state.mode === 'edit' ? state.coupon.id : null} chance={parseChance(form.chancePercent)} isActive={form.isActive} title={form.title.trim() || form.couponCode.trim() || 'This coupon'} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
          <Input label="Assignable from" help={HELP.validFrom} type="date" value={form.validFrom} onChange={(e) => update('validFrom', e.target.value)} />
          <Input label="Valid until" help={HELP.validUntil} type="date" value={form.validUntil} onChange={(e) => update('validUntil', e.target.value)} />
          <Input label="Expires after (days)" help={HELP.expiresAfter} hint="Counted from the day it's won." type="number" min={1} max={3650} value={form.validDaysAfterAward} onChange={(e) => update('validDaysAfterAward', e.target.value)} />
        </div>
        <Textarea label="Description (optional)" help={HELP.description} rows={2} maxLength={500} value={form.description} onChange={(e) => update('description', e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <Input label="Product name (optional)" help={HELP.productName} maxLength={120} value={form.productName} onChange={(e) => update('productName', e.target.value)} />
          <Input label="Product category (optional)" help={HELP.productCategory} maxLength={120} value={form.productCategory} onChange={(e) => update('productCategory', e.target.value)} />
        </div>
        <Input
          label="Redeem URL (optional)"
          help={HELP.redeemUrl}
          hint="The partner's website. In the app, Redeem now copies the code, marks the reward redeemed and opens this link."
          inputMode="url"
          autoComplete="off"
          maxLength={500}
          placeholder="https://gymgasm.com"
          value={form.redeemUrl}
          onChange={(e) => update('redeemUrl', e.target.value)}
        />
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Product image (optional)</span>
            <HelpTip label="Product image">{HELP.productImage}</HelpTip>
          </div>
          <div className="flex items-center gap-4">
            <RewardImage src={shownImage} alt="Product image preview" className="w-28 h-20 shrink-0" />
            <div className="flex flex-col gap-2 min-w-0">
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-line hover:border-accent/60 px-3 py-2 text-xs font-medium text-ink bg-surface-inset/40 hover:bg-surface-inset/80 transition-colors">
                <Upload className="w-3.5 h-3.5 text-ink-muted" />
                {shownImage ? 'Replace image' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
              </label>
              {shownImage && (
                <button type="button" onClick={clearImage} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-bad-ink cursor-pointer">
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>
          <span className="block text-xs text-ink-faint">
            WebP, PNG or JPG up to {MAX_IMAGE_LABEL}, landscape (about 3:2) with the product centred. It&apos;s compressed before upload.
            Without one, hunters see the default HunterX image.
          </span>
        </div>
        <Switch checked={form.isActive} onCheckedChange={(checked) => update('isActive', checked)} label="Active" description="Inactive coupons are never assigned and don't count towards the 100%." />
        {error && <ErrorBanner message={error} />}
      </form>
      {confirmUnlimited && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/50 p-6">
          <div role="alertdialog" aria-labelledby="unlimited-title" className="w-full max-w-xs rounded-xl border border-amber-500/30 bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-warn-ink mt-0.5" />
              <div>
                <p id="unlimited-title" className="text-sm font-semibold text-ink">No quantity set</p>
                <p className="text-sm text-ink-muted mt-1">
                  This coupon will be unlimited — only its chance limits how many hunters get it. Save anyway?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setConfirmUnlimited(false); quantityRef.current?.focus(); }}>Set a limit</Button>
              <Button type="button" size="sm" onClick={() => save({ unlimitedConfirmed: true })}>Save as unlimited</Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

// ── Chances & allocation ────────────────────────────────────────
// Each coupon targets its chance (%) of the reward's eligible hunters —
// those completing it after activation. A reward's active coupons add up to
// at most 100%; the rest get no coupon ("unallocated"). Allocation happens
// the moment a hunter completes the reward, within the targets and the
// stock (backend rewardService.js#allocateTriggerCard).

/** A percentage from 0 to 100 with at most 2 decimals, or null. */
function parseChance(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6 ? n : null;
}

const toHundredths = (n: number) => Math.round(n * 100);

/** How many % are still free on this reward, leaving out `editingId`. */
function chanceRoom(trigger: RewardTrigger, editingId: string | null): number {
  const used = trigger.coupons.filter((c) => c.isActive && c.id !== editingId).reduce((sum, c) => sum + toHundredths(c.chancePercent), 0);
  return Math.max(0, 10_000 - used) / 100;
}

function formatDateTime(iso: string | null, timeZone: string) {
  return iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
    : '—';
}

/** ISO → the browser's (the admin's) wall clock for <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ALLOCATION_STATUS: Record<CouponAllocationStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'muted'; title: string }> = {
  AVAILABLE: { label: 'Available', variant: 'success', title: 'Owed now — it has fewer hunters than its share (e.g. after a restock or a raised chance) — so the next hunter can get it.' },
  WAITING_FOR_HUNTERS: { label: 'Waiting for hunters', variant: 'muted', title: 'No eligible hunter has completed this reward in the current window yet.' },
  PENDING_ALLOCATION: { label: 'Pending allocation', variant: 'default', title: 'Below its share of the eligible hunters so far. It is assigned as more hunters complete the reward.' },
  QUOTA_REACHED: { label: 'Quota reached', variant: 'warning', title: 'Has its full share of the eligible hunters so far, even counting the next one. It comes up again as more hunters complete the reward.' },
  OUT_OF_STOCK: { label: 'Out of stock', variant: 'danger', title: 'No units left. Its share is not handed to other coupons; raise Total quantity to restock.' },
  NO_CHANCE: { label: '0%', variant: 'muted', title: 'Its chance is 0%, so it is never assigned.' },
  NOT_STARTED: { label: 'Not started', variant: 'muted', title: 'Before its Assignable from date.' },
  ENDED: { label: 'Ended', variant: 'muted', title: 'Past its Valid until date.' },
  INACTIVE: { label: 'Off', variant: 'muted', title: 'Switched off: never assigned.' },
  REWARD_INACTIVE: { label: 'Inactive', variant: 'muted', title: 'The reward is switched off, so no coupon is assigned.' },
  SCHEDULED: { label: 'Scheduled', variant: 'default', title: "The reward's activation time is in the future. Nothing is assigned before then." },
};

const REWARD_STATUS: Record<RewardStatus, { label: string; variant: 'success' | 'default' | 'muted' }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  SCHEDULED: { label: 'Scheduled', variant: 'default' },
  INACTIVE: { label: 'Inactive', variant: 'muted' },
  NOT_ACTIVATED: { label: 'Not activated', variant: 'muted' },
};

/**
 * Active / Scheduled / Inactive, from the switch (optimistic while saving) and the activation time. A scheduled
 * reward turns Active by itself: the page refreshes when its activation time arrives.
 */
function RewardStatusBadge({ trigger, active }: { trigger: RewardTrigger; active: boolean }) {
  const router = useRouter();
  const timeZone = useAdminTimeZone();
  React.useEffect(() => {
    if (!active || trigger.status !== 'SCHEDULED' || !trigger.activatedAt) return;
    const ms = new Date(trigger.activatedAt).getTime() - Date.now();
    if (ms > 2_000_000_000) return; // past setTimeout's limit (~23 days); a later visit shows it
    const timer = setTimeout(() => router.refresh(), Math.max(0, ms) + 1000);
    return () => clearTimeout(timer);
  }, [active, trigger.status, trigger.activatedAt, router]);

  // Switched on just now (not saved yet): on, so Scheduled or Active by the
  // activation time. The clock is read once, not on every render.
  const [shownAt] = React.useState(() => Date.now());
  const status: RewardStatus = !active
    ? 'INACTIVE'
    : trigger.status !== 'INACTIVE'
    ? trigger.status
    : trigger.activatedAt && new Date(trigger.activatedAt).getTime() > shownAt
    ? 'SCHEDULED'
    : 'ACTIVE';
  const s = REWARD_STATUS[status];
  const title = status === 'SCHEDULED' && trigger.activatedAt ? `Switched on; starts ${formatDateTime(trigger.activatedAt, timeZone)}` : undefined;
  return (
    <span title={title}>
      <Badge variant={s.variant}>{s.label}</Badge>
    </span>
  );
}

// ── Configuration history ───────────────────────────────────────

const HISTORY_ACTION: Record<string, string> = {
  TRIGGER_CREATED: 'Reward created',
  TRIGGER_UPDATED: 'Reward changed',
  TRIGGER_DELETED: 'Reward deleted',
  COUPON_CREATED: 'Coupon added',
  COUPON_UPDATED: 'Coupon changed',
  COUPON_DEACTIVATED: 'Coupon switched off',
  COUPON_DELETED: 'Coupon deleted',
  CHANCES_SET: 'Chances set',
};

const HISTORY_FIELD: Record<string, string> = {
  title: 'Title',
  coupon_code: 'Code',
  chance_percent: 'Chance',
  total_quantity: 'Stock (total quantity)',
  valid_from: 'Assignable from',
  valid_until: 'Valid until',
  is_active: 'Switched on',
  activated_at: 'Activation time',
  description: 'Name',
  value: 'Value',
  kind: 'Kind',
};

function historyValue(field: string, value: unknown, timeZone: string): string {
  if (value === null || value === undefined) return field === 'total_quantity' ? 'Unlimited' : '—';
  if (field === 'chance_percent') return `${value}%`;
  if (field === 'is_active') return value ? 'On' : 'Off';
  if ((field === 'activated_at' || field === 'valid_from' || field === 'valid_until') && typeof value === 'string') return formatDateTime(value, timeZone);
  return String(value);
}

/** Read-only list of a reward's configuration changes, oldest first. */
function RewardHistoryDialog({ tab, trigger, onClose }: { tab: RewardTab; trigger: RewardTrigger; onClose: () => void }) {
  const timeZone = useAdminTimeZone();
  const [state, setState] = React.useState<{ history: RewardHistoryEntry[] | null; error: string | null }>({ history: null, error: null });

  React.useEffect(() => {
    let cancelled = false;
    getRewardHistory(tab, trigger.id).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, trigger.id]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`History · ${triggerLabel(trigger)}`}
      description="Every change to this reward's settings, oldest first: who made it, and the value before → after. It can't be edited."
      className="max-w-2xl p-5 sm:p-6"
      footer={<Button type="button" variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="max-h-[min(65vh,40rem)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] -mx-1 pl-1 pr-2 pb-1">
        {state.error ? (
          <ErrorBanner message={`Couldn't load the history: ${state.error}`} />
        ) : state.history === null ? (
          <p className="text-sm text-ink-muted py-6 text-center">Loading…</p>
        ) : state.history.length === 0 ? (
          <p className="text-sm text-ink-muted py-6 text-center">No changes recorded yet.</p>
        ) : (
          <ol className="divide-y divide-line rounded-lg border border-line">
            {state.history.map((h) => (
              <li key={h.id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm font-medium text-ink">
                    {HISTORY_ACTION[h.action] ?? h.action}
                    {h.coupon?.title && <span className="font-normal text-ink-muted"> · {h.coupon.title}</span>}
                  </p>
                  <p className="text-xs text-ink-faint tabular-nums">{formatDateTime(h.at, timeZone)}</p>
                </div>
                <p className="text-xs text-ink-muted">
                  {h.admin ? (
                    <>
                      By <span className="text-ink">{h.admin.name}</span>
                      {h.admin.email && <span className="text-ink-faint"> ({h.admin.email})</span>}
                    </>
                  ) : (
                    <span className="text-ink-faint">Admin not recorded</span>
                  )}
                </p>
                {h.changes.length > 0 && (
                  <ul className="space-y-0.5 text-xs">
                    {h.changes.map((c, i) => (
                      <li key={`${c.field}-${c.coupon?.id ?? i}`} className="flex flex-wrap gap-x-1.5 text-ink-muted">
                        <span className="text-ink-faint">{c.coupon ? `${c.coupon.title} — ${HISTORY_FIELD[c.field] ?? c.field}` : (HISTORY_FIELD[c.field] ?? c.field)}:</span>
                        {h.action.endsWith('_CREATED') ? (
                          <span className="text-ink tabular-nums">{historyValue(c.field, c.after, timeZone)}</span>
                        ) : h.action.endsWith('_DELETED') ? (
                          <span className="tabular-nums line-through">{historyValue(c.field, c.before, timeZone)}</span>
                        ) : (
                          <span className="tabular-nums">
                            {historyValue(c.field, c.before, timeZone)} <span className="text-ink-faint">→</span>{' '}
                            <span className="text-ink">{historyValue(c.field, c.after, timeZone)}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Dialog>
  );
}

function AllocationBadge({ status }: { status: CouponAllocationStatus }) {
  const s = ALLOCATION_STATUS[status];
  return (
    <span title={s.title}>
      <Badge variant={s.variant}>{s.label}</Badge>
    </span>
  );
}

/** "Live since …" / "Starts …" / "Not activated", with an inline editor. */
function ActivationLine({ trigger, busy, saving, onSave }: { trigger: RewardTrigger; busy: boolean; saving: boolean; onSave: (iso: string) => void }) {
  const timeZone = useAdminTimeZone();
  const [editing, setEditing] = React.useState<string | null>(null);
  const valid = editing !== null && !Number.isNaN(new Date(editing).getTime());

  if (editing !== null) {
    return (
      <form
        className="flex flex-wrap items-center gap-2 mt-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(new Date(editing).toISOString());
          setEditing(null);
        }}
      >
        <input
          type="datetime-local"
          aria-label="Activation time"
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          className="px-2.5 py-1 rounded-lg border border-line bg-surface-inset/50 text-sm text-ink focus:outline-none focus:border-accent"
        />
        <Button type="submit" size="sm" disabled={!valid || busy}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
        <p className="basis-full text-xs text-ink-faint">
          Only hunters completing this reward from then on are considered, and the percentage targets count from then. Coupons already assigned stay assigned
          and stay in the lifetime figures, and nobody already considered is considered again.
        </p>
      </form>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-muted mt-1">
      <CalendarClock className="w-3.5 h-3.5 text-ink-faint" />
      {!trigger.activatedAt
        ? 'Not activated — switch it on to activate it now.'
        : trigger.isLive
        ? `Live for completions since ${formatDateTime(trigger.activatedAt, timeZone)}`
        : trigger.isActive
        ? `Starts ${formatDateTime(trigger.activatedAt, timeZone)}`
        : `Activation ${formatDateTime(trigger.activatedAt, timeZone)} (switched off)`}
      <button
        type="button"
        disabled={busy || saving}
        onClick={() => setEditing(toLocalInput(trigger.activatedAt))}
        className="ml-1 text-accent-ink hover:underline disabled:opacity-50 cursor-pointer"
      >
        {saving ? 'Saving...' : 'Change'}
      </button>
    </p>
  );
}

const HELP = {
  title: <p>The coupon&apos;s name, e.g. &ldquo;30% off at Gymgasm&rdquo;. Hunters see it as the product name after scratching, unless you fill in Product name.</p>,
  couponCode: (
    <>
      <p>The code hunters use at the partner&apos;s checkout. Everyone who wins this coupon gets this same code.</p>
      <p>3–50 letters, numbers, - or _. Two active coupons on one reward can&apos;t share a code.</p>
    </>
  ),
  percentOff: <p>The discount this code gives, from 1 to 100. Shown on the card as e.g. &ldquo;30% OFF&rdquo;.</p>,
  amountOff: <p>This coupon was saved as a flat amount, before coupons became percent-only. It keeps its amount and currency.</p>,
  chance: (
    <>
      <p>The share of this reward&apos;s hunters who get this coupon. E.g. 25% → of every 1,000 hunters completing the reward, 250 get it.</p>
      <p>
        A reward&apos;s coupons can add up to 100% at most. Whatever is left is <strong className="text-ink">unallocated</strong>: those hunters complete the reward
        without a coupon. It&apos;s never shared out among the other coupons.
      </p>
      <p>The coupon is assigned the moment a hunter completes the reward. A hunter who gets none then never gets one later.</p>
      <p>At 100% in total every eligible hunter gets a coupon, the first one included. Below 100%, the share is rounded to the nearest hunter.</p>
    </>
  ),
  target: (
    <>
      <p>
        Target = how many of the eligible hunters this coupon should have by now. The reward&apos;s total share (eligible hunters × the coupons&apos; chances added
        up, to the nearest hunter) is split between its coupons by their chances: each gets its exact share rounded down or up, and the targets add up to the
        total. At 100%, that is every eligible hunter.
      </p>
      <p>E.g. five coupons at 20% and 6 hunters: the targets are 1, 1, 1, 1, 1 plus one more for one of them — 6 in all.</p>
      <p>A coupon is assigned only while it has quota left (target − assigned) and stock. Changing a chance never takes back a coupon already assigned.</p>
    </>
  ),
  totalQuantity: (
    <>
      <p>How many hunters can win this coupon in total. Blank = unlimited (only its chance limits it).</p>
      <p>When it runs out its share is <strong className="text-ink">not</strong> handed to the other coupons — those hunters get no coupon. Raise it to restock; hunters who completed meanwhile aren&apos;t revisited.</p>
    </>
  ),
  validFrom: <p>The coupon isn&apos;t assigned before this date. Blank = from now.</p>,
  validUntil: <p>From this date the coupon is no longer assigned, and cards already won with it expire. Blank = no end date.</p>,
  expiresAfter: <p>A won card expires this many days after the hunter wins it, or on Valid until if that comes first. Blank = only Valid until applies.</p>,
  description: <p>A note for admins. It isn&apos;t shown to hunters.</p>,
  productName: <p>Shown to hunters after they scratch the card, e.g. &ldquo;Gymgasm Membership&rdquo;. Blank = the Title is shown.</p>,
  productCategory: <p>Shown to hunters with the product after they scratch the card, e.g. &ldquo;Fitness&rdquo;.</p>,
  redeemUrl: <p>The partner&apos;s website. In the app, Redeem now copies the code, marks the reward redeemed and opens this link.</p>,
  productImage: <p>The picture on the hunter&apos;s reward. Without one, hunters see the default HunterX image.</p>,
  stats: (
    <>
      <p>
        <strong className="text-ink">Current window</strong>: hunters who completed this reward since its activation time, and how many of them got a coupon.
        The percentage targets are counted from these.
      </p>
      <p>
        <strong className="text-ink">Lifetime</strong>: every hunter ever considered and every coupon ever assigned. Moving the activation time starts a new window
        but never removes or hides what was assigned before — those hunters keep their cards and aren&apos;t considered again.
      </p>
    </>
  ),
  setChances: (
    <>
      <p>Each coupon&apos;s share of the hunters who complete this reward. They can add up to 100% at most, and all are saved together.</p>
      <p>The rest is unallocated: those hunters get no coupon. Out-of-stock coupons keep their share — it isn&apos;t passed on.</p>
      <p>New chances apply from now on. Coupons already assigned stay with their hunters; a coupon already past its new target gets no more until the target catches up.</p>
      <p>Switched-off coupons aren&apos;t listed: they&apos;re never assigned.</p>
    </>
  ),
};

/** This reward's chances if the dialog is saved as-is. */
function ChancePreview({ trigger, editingId, chance, isActive, title }: { trigger: RewardTrigger; editingId: string | null; chance: number | null; isActive: boolean; title: string }) {
  const others = trigger.coupons.filter((c) => c.isActive && c.id !== editingId);
  if (chance === null && others.length === 0) return null;

  const rows = [
    ...others.map((c) => ({ id: c.id, title: c.title, chance: c.chancePercent, isThis: false })),
    ...(isActive && chance !== null ? [{ id: 'this', title, chance, isThis: true }] : []),
  ];
  const total = rows.reduce((sum, r) => sum + toHundredths(r.chance), 0) / 100;
  const over = total > 100;

  return (
    <div className="rounded-lg border border-line bg-surface-inset/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Chances on {triggerLabel(trigger)} after saving</p>
      {chance === null ? (
        <p className="text-xs text-ink-faint">Enter a chance to see the split.</p>
      ) : !isActive ? (
        <p className="text-xs text-ink-faint">This coupon is switched off, so it won&apos;t be assigned or count towards the 100%.</p>
      ) : null}
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className={`flex items-center justify-between gap-3 ${r.isThis ? 'text-accent-ink font-medium' : 'text-ink'}`}>
            <span className="min-w-0 truncate">
              {r.title}
              {r.isThis && <span className="ml-1.5 text-xs font-normal">({editingId ? 'editing' : 'new'})</span>}
            </span>
            <span className="shrink-0 tabular-nums">{r.chance}%</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 text-ink-faint">
          <span>Unallocated (no coupon)</span>
          <span className="shrink-0 tabular-nums">{over ? '—' : `${Math.round((100 - total) * 100) / 100}%`}</span>
        </li>
      </ul>
      <p className={`text-xs ${over ? 'text-bad-ink' : 'text-ok-ink'}`}>
        Total {total}%{over ? ' — over 100%. Lower this chance, or use Set chances on the reward.' : ''}
      </p>
    </div>
  );
}

/** "Set chances": edit every active coupon's % together; saves at 100% or less. */
function SetChancesDialog({ tab, trigger, onClose, onSaved }: { tab: RewardTab; trigger: RewardTrigger; onClose: () => void; onSaved: () => void }) {
  const coupons = React.useMemo(() => trigger.coupons.filter((c) => c.isActive), [trigger.coupons]);
  const [values, setValues] = React.useState<Record<string, string>>(() => Object.fromEntries(coupons.map((c) => [c.id, String(c.chancePercent)])));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsed = coupons.map((c) => ({ coupon: c, chance: parseChance(values[c.id] ?? '') }));
  const allValid = parsed.every((p) => p.chance !== null);
  const totalHundredths = parsed.reduce((sum, p) => sum + toHundredths(p.chance ?? 0), 0);
  const total = totalHundredths / 100;
  const canSave = allValid && totalHundredths <= 10_000 && !saving;
  // Lowered below what a coupon already has (its exact new share of the current window): it keeps them and pauses.
  const pausing = parsed.filter((p) => p.chance !== null && trigger.eligibleUsers * toHundredths(p.chance) < p.coupon.allocation.assigned * 10_000);

  const splitEvenly = () => {
    const n = coupons.length;
    const base = Math.floor(100 / n);
    const extra = 100 - base * n;
    setValues(Object.fromEntries(coupons.map((c, i) => [c.id, String(base + (i < extra ? 1 : 0))])));
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await setRewardCouponChances(tab, trigger.id, parsed.map((p) => ({ id: p.coupon.id, chance_percent: p.chance! })));
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the chances. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Set chances · ${triggerLabel(trigger)}`}
      description="The share of this reward's hunters who get each coupon. Up to 100% in total; the rest get no coupon."
      className="max-w-xl p-5 sm:p-6"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={save} disabled={!canSave}>{saving ? 'Saving...' : 'Save chances'}</Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[min(65vh,36rem)] overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] -mx-1 pl-1 pr-2 pb-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Chance per coupon</span>
            <HelpTip label="Set chances">{HELP.setChances}</HelpTip>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={splitEvenly} disabled={saving}>
            Split 100% evenly
          </Button>
        </div>

        <ul className="divide-y divide-line rounded-lg border border-line">
          {parsed.map(({ coupon: c, chance }) => {
            const raw = values[c.id] ?? '';
            return (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <RewardImage src={c.productImageUrl} alt={c.title} className="hidden sm:block w-10 h-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{c.title}</p>
                  <p className="text-xs text-ink-faint truncate">
                    {c.couponCode} · {formatDiscount(c)} · {c.allocation.assigned} assigned
                    {c.allocation.status === 'OUT_OF_STOCK' && <span className="text-warn-ink"> · out of stock</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    aria-label={`${c.title} chance (%)`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    value={raw}
                    onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                    className={`w-20 px-2.5 py-1.5 rounded-lg border bg-surface-inset/50 text-ink text-right tabular-nums focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
                      chance === null ? 'border-bad-ink' : 'border-line'
                    }`}
                  />
                  <span className="text-sm text-ink-muted">%</span>
                </div>
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-ink-faint">
            <span>Unallocated (no coupon)</span>
            <span className="tabular-nums pr-5">{allValid && totalHundredths <= 10_000 ? `${(10_000 - totalHundredths) / 100}%` : '—'}</span>
          </li>
        </ul>

        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${allValid && totalHundredths <= 10_000 ? 'bg-ok-ink/10 text-ok-ink' : 'bg-bad-ink/10 text-bad-ink'}`}>
          <span>Total</span>
          <span className="tabular-nums">
            {total}% {!allValid ? '· each must be 0–100 (up to 2 decimals)' : totalHundredths > 10_000 ? `· ${Math.round((total - 100) * 100) / 100} over 100` : '✓'}
          </span>
        </div>

        {pausing.length > 0 && allValid && (
          <div className="rounded-lg border border-warn-ink/30 bg-warn-ink/10 p-3 text-xs text-warn-ink">
            {pausing.map((p) => p.coupon.title).join(', ')} already {pausing.length === 1 ? 'has' : 'have'} more hunters than the new chance targets. They keep their
            coupons; {pausing.length === 1 ? 'it gets' : 'they get'} no more until enough new hunters complete the reward.
          </div>
        )}

        {error && <ErrorBanner message={error} />}
      </div>
    </Dialog>
  );
}
