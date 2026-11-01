'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  createReward,
  createRewardCoupon,
  deleteReward,
  deleteRewardCoupon,
  setRewardActive,
  setRewardCouponActive,
  updateRewardCoupon,
} from '@/lib/api/reward-actions';
import { kindOfTab, type RewardTab } from '@/lib/reward-kinds';
import type { CouponInput, RewardCoupon, RewardTrigger, RewardTriggerKind } from '@/types/reward';
import { AlertCircle, AlertTriangle, Cake, Flame, Link2, Pencil, Sparkles, Plus, Trash2, TrendingUp, Upload, X, type LucideIcon } from 'lucide-react';
import { buildCouponFormData } from '@/lib/reward-form';
import { imageFileError, MAX_IMAGE_LABEL } from '@/lib/upload-limits';
import { RewardImage } from './reward-image';

const EMPTY_COUPON: CouponInput = {
  title: '',
  couponCode: '',
  discountType: 'PERCENT',
  discountValue: '',
  currency: '₹',
  weight: '1',
  totalQuantity: '',
  validFrom: '',
  validUntil: '',
  validDaysAfterAward: '',
  description: '',
  productName: '',
  productCategory: '',
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
    weight: String(c.weight),
    totalQuantity: c.totalQuantity === null ? '' : String(c.totalQuantity),
    validFrom: toDateInput(c.validFrom),
    validUntil: toDateInput(c.validUntil),
    validDaysAfterAward: c.validDaysAfterAward === null ? '' : String(c.validDaysAfterAward),
    description: c.description ?? '',
    productName: c.productName ?? '',
    productCategory: c.productCategory ?? '',
    imageFile: null,
    removeImage: false,
    isActive: c.isActive,
  };
}

function formatDiscount(c: RewardCoupon) {
  return c.discountType === 'PERCENT' ? `${c.discountValue}% OFF` : `${c.currency ?? ''}${c.discountValue} OFF`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
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
  const kind = kindOfTab(tab);
  const section = SECTION[kind];
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [newValue, setNewValue] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<RewardTrigger | null>(null);

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
        <p className="text-sm text-ink-muted">{section.description}</p>
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
        {triggers.map((m) => (
          <Card key={m.id} className={m.isActive ? 'space-y-4' : 'space-y-4 border-dashed'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={m.isActive ? 'text-base font-bold text-ink' : 'text-base font-bold text-ink-muted'}>{triggerLabel(m)}</h3>
                  <Badge variant={m.isActive ? 'success' : 'muted'}>{m.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="text-sm text-ink-faint mt-0.5">
                  {!m.isActive
                    ? `Switched off — grants no new cards. ${m.cardsGranted.toLocaleString()} already granted stay with their hunters.`
                    : m.coupons.some((c) => c.isActive)
                    ? `${m.cardsGranted.toLocaleString()} scratch card${m.cardsGranted === 1 ? '' : 's'} granted`
                    : 'No active coupons — this grants no scratch card yet.'}
                </p>
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
                {m.cardsAwaitingStock > 0 && (
                  <Badge variant="warning">{m.cardsAwaitingStock} waiting on stock</Badge>
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
                  checked={m.isActive}
                  disabled={busyId !== null}
                  onCheckedChange={(checked) => run(`trigger-${m.id}`, () => setRewardActive(tab, m.id, checked))}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => setDialog({ mode: 'create', trigger: m })}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add coupon
                </Button>
              </div>
            </div>

            {m.coupons.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Weight · chance</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Valid</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.coupons.map((c) => (
                    <TableRow key={c.id} className={c.isActive ? '' : 'opacity-60'}>
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
                      <TableCell>
                        {c.weight} · {c.eligible ? `${c.probabilityPercent}%` : <span className="text-ink-faint">not drawable</span>}
                      </TableCell>
                      <TableCell>
                        {c.totalQuantity === null
                          ? `${c.awardedCount} / ∞`
                          : `${c.awardedCount} / ${c.totalQuantity}`}
                        {c.remaining === 0 && <Badge variant="danger" className="ml-2">Out</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-ink-muted">
                        {formatDate(c.validFrom) ?? 'Now'} – {formatDate(c.validUntil) ?? 'no end'}
                        {c.validDaysAfterAward && <p>{c.validDaysAfterAward}d after award</p>}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.isActive}
                          disabled={busyId !== null}
                          onCheckedChange={(checked) => run(c.id, () => setRewardCouponActive(c.id, checked))}
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
                          onClick={() =>
                            run(c.id, async () => {
                              const deleted = await deleteRewardCoupon(c.id);
                              return deleted ? 'Coupon deleted.' : `"${c.title}" was already awarded, so it was deactivated instead of deleted.`;
                            })
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
        ))}
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
    (form.discountType !== 'FLAT' || form.currency.trim().length > 0);

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
      description="Every winner of this coupon gets the same code. Higher weight = more likely to be drawn."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => save()} disabled={!isValid || saving || confirmUnlimited}>
            {saving ? 'Saving...' : state.mode === 'edit' ? 'Save changes' : 'Add coupon'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <Input label="Title" placeholder="e.g. 40% off Myntra Sports" maxLength={120} value={form.title} onChange={(e) => update('title', e.target.value)} required />
        <Input label="Coupon code" placeholder="e.g. HUNTER40" maxLength={50} value={form.couponCode} onChange={(e) => update('couponCode', e.target.value.toUpperCase())} required />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Discount type" value={form.discountType} onChange={(e) => update('discountType', e.target.value as CouponInput['discountType'])}>
            <option value="PERCENT">Percent</option>
            <option value="FLAT">Flat amount</option>
          </Select>
          <Input
            label={form.discountType === 'PERCENT' ? 'Percent off' : 'Amount off'}
            type="number"
            min={0.01}
            max={form.discountType === 'PERCENT' ? 100 : undefined}
            step="0.01"
            value={form.discountValue}
            onChange={(e) => update('discountValue', e.target.value)}
            required
          />
          {form.discountType === 'FLAT' && (
            <Input label="Currency" maxLength={8} value={form.currency} onChange={(e) => update('currency', e.target.value)} required />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Weight" hint="1–100. Chance vs. the other coupons, e.g. 50 / 30 / 20." type="number" min={1} max={100} value={form.weight} onChange={(e) => update('weight', e.target.value)} />
          <Input ref={quantityRef} label="Total quantity" hint="Leave blank for unlimited." type="number" min={1} placeholder="Unlimited" value={form.totalQuantity} onChange={(e) => update('totalQuantity', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Drawable from" type="date" value={form.validFrom} onChange={(e) => update('validFrom', e.target.value)} />
          <Input label="Valid until" type="date" value={form.validUntil} onChange={(e) => update('validUntil', e.target.value)} />
          <Input label="Expires N days after award" type="number" min={1} max={3650} value={form.validDaysAfterAward} onChange={(e) => update('validDaysAfterAward', e.target.value)} />
        </div>
        <Textarea label="Description (optional)" rows={2} maxLength={500} value={form.description} onChange={(e) => update('description', e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Product name (optional)" maxLength={120} value={form.productName} onChange={(e) => update('productName', e.target.value)} />
          <Input label="Product category (optional)" maxLength={120} value={form.productCategory} onChange={(e) => update('productCategory', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">Product image (optional)</span>
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
        <Switch checked={form.isActive} onCheckedChange={(checked) => update('isActive', checked)} label="Active" description="Inactive coupons are never drawn." />
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
                  This coupon will be unlimited — every hunter who draws it gets it. Save anyway?
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
