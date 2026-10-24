'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deriveRewardEligibility } from '@/lib/api/reward-eligibility';
import { createTask, updateTask } from '@/lib/api/task-actions';
import type { Task, TaskInput, CreatableTaskType, LevelTarget } from '@/types/task';
import { Lock, AlertCircle, AlertTriangle, Upload, X, IndianRupee, Sparkles, HelpCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { recurrenceLabel, taskTypeLabel } from '@/lib/task-labels';
import type { RewardTrigger } from '@/types/reward';

import { imageFileError, MAX_IMAGE_LABEL } from '@/lib/upload-limits';

// Mirrors adminTaskService.js#XP_CAP — daily admin-authored tasks cap at 10
// XP, weekly quests at 70, monthly at 300 — keeping admin-created tasks in line
// with the XP economy.
const XP_CAP: Record<CreatableTaskType, number> = { DAILY_ADMIN: 10, WEEKLY: 70, MONTHLY: 300 };

const DEFAULT_FORM: TaskInput = {
  title: '',
  description: '',
  tag: '',
  imageUrl: '',
  imageUrlMale: '',
  imageUrlFemale: '',
  imageMaleFile: null,
  imageFemaleFile: null,
  taskType: 'DAILY_ADMIN',
  isRecurring: false,
  recurrenceDays: [],
  startDate: null,
  endDate: null,
  levelTarget: 'ALL',
  targetValue: null,
  targetUnit: '',
  allowsPartial: false,
  xpPartial: null,
  xpReward: null,
  isPaid: false,
  price: null,
  currency: 'INR',
  specialRewardId: null,
  proofCount: 0,
};

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

/** specialRewards: the rewards on Rewards → Special rewards, for the optional special-reward picker. */
export function TaskForm({ initialTask, specialRewards = [] }: { initialTask?: Task; specialRewards?: RewardTrigger[] }) {
  const router = useRouter();
  const [form, setForm] = React.useState<TaskInput>(
    initialTask && (initialTask.taskType === 'DAILY_ADMIN' || initialTask.taskType === 'WEEKLY' || initialTask.taskType === 'MONTHLY')
      ? {
          title: initialTask.title,
          description: initialTask.description,
          tag: initialTask.tag,
          imageUrl: initialTask.imageUrl ?? '',
          imageUrlMale: initialTask.imageUrlMale ?? initialTask.imageUrl ?? '',
          imageUrlFemale: initialTask.imageUrlFemale ?? '',
          imageMaleFile: null,
          imageFemaleFile: null,
          taskType: initialTask.taskType,
          isRecurring: initialTask.isRecurring,
          recurrenceDays: initialTask.recurrenceDays,
          startDate: toDateInput(initialTask.startDate) || null,
          endDate: toDateInput(initialTask.endDate) || null,
          levelTarget: initialTask.levelTarget,
          targetValue: initialTask.targetValue ?? null,
          targetUnit: initialTask.targetUnit ?? '',
          allowsPartial: initialTask.allowsPartial,
          xpPartial: initialTask.xpPartial,
          xpReward: initialTask.xpReward,
          isPaid: Boolean(initialTask.isPaid),
          price: initialTask.price != null ? Number(initialTask.price) : null,
          currency: initialTask.currency || 'INR',
          specialRewardId: initialTask.specialRewardId,
          proofCount: initialTask.proofCount,
        }
      : DEFAULT_FORM
  );

  const [maleFilePreview, setMaleFilePreview] = React.useState<string | null>(null);
  const [femaleFilePreview, setFemaleFilePreview] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const update = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((f: TaskInput) => ({ ...f, [key]: value }));

  const changeTaskType = (taskType: CreatableTaskType) => {
    const cap = XP_CAP[taskType];
    setForm((f) => ({
      ...f,
      taskType,
      xpReward: f.xpReward != null ? Math.min(f.xpReward, cap) : null,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, gender: 'male' | 'female') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileError = imageFileError(file);
    if (fileError) {
      setError(fileError);
      e.target.value = '';
      return;
    }

    setError(null);
    const previewUrl = URL.createObjectURL(file);

    if (gender === 'male') {
      if (maleFilePreview) URL.revokeObjectURL(maleFilePreview);
      setMaleFilePreview(previewUrl);
      update('imageMaleFile', file);
    } else {
      if (femaleFilePreview) URL.revokeObjectURL(femaleFilePreview);
      setFemaleFilePreview(previewUrl);
      update('imageFemaleFile', file);
    }
  };

  const clearFile = (gender: 'male' | 'female') => {
    if (gender === 'male') {
      if (maleFilePreview) URL.revokeObjectURL(maleFilePreview);
      setMaleFilePreview(null);
      update('imageMaleFile', null);
    } else {
      if (femaleFilePreview) URL.revokeObjectURL(femaleFilePreview);
      setFemaleFilePreview(null);
      update('imageFemaleFile', null);
    }
  };

  const cap = XP_CAP[form.taskType];
  const rewardEligibility = deriveRewardEligibility(form.xpReward ?? 0, form.taskType);

  // Validation rules per API contract
  const hasMaleImage = Boolean(form.imageMaleFile || (form.imageUrlMale && form.imageUrlMale.trim().length > 0));
  const hasFemaleImage = Boolean(form.imageFemaleFile || (form.imageUrlFemale && form.imageUrlFemale.trim().length > 0));

  const isPriceValid = !form.isPaid || (
    form.price != null &&
    form.price > 0 &&
    /^\d+(\.\d{1,2})?$/.test(String(form.price))
  );

  const isEndDateValid = !form.isPaid || Boolean(form.endDate);
  const isPartialXpValid = !form.allowsPartial || ((form.xpReward ?? 0) >= 2);

  const isValid =
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.tag.trim().length > 0 &&
    hasMaleImage &&
    hasFemaleImage &&
    form.targetUnit.trim().length > 0 &&
    form.xpReward != null &&
    form.xpReward > 0 &&
    form.xpReward <= cap &&
    isPartialXpValid &&
    !!form.startDate &&
    isEndDateValid &&
    isPriceValid;

  // Saving asks the admin to recheck first: once hunters get the task it
  // can't be deleted any more (only deactivated), and edits reach them straight away.
  const [confirmSave, setConfirmSave] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setConfirmSave(true);
  };

  const save = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      // Build multipart FormData if any image files are attached
      const hasFiles = Boolean(form.imageMaleFile || form.imageFemaleFile);

      let payload: FormData | TaskInput;

      if (hasFiles) {
        const fd = new FormData();
        fd.append('title', form.title.trim());
        if (form.description.trim()) fd.append('description', form.description.trim());
        if (form.tag.trim()) fd.append('tag', form.tag.trim());
        fd.append('task_type', form.taskType);
        fd.append('is_recurring', String(Boolean(form.isRecurring)));
        if (form.startDate) fd.append('start_date', form.startDate);
        if (form.endDate) fd.append('end_date', form.endDate);
        if (form.xpReward != null) fd.append('xp_reward', String(form.xpReward));
        fd.append('allows_partial', String(Boolean(form.allowsPartial)));
        if (form.targetValue != null) fd.append('target_value', String(form.targetValue));
        if (form.targetUnit.trim()) fd.append('target_unit', form.targetUnit.trim());
        fd.append('is_paid', String(Boolean(form.isPaid)));
        if (form.isPaid && form.price != null) fd.append('price', String(form.price));
        fd.append('special_reward_id', form.specialRewardId ?? 'none');
        fd.append('proof_count', String(form.proofCount));

        if (form.imageMaleFile) {
          fd.append('image_male', form.imageMaleFile);
        } else if (form.imageUrlMale) {
          fd.append('image_url_male', form.imageUrlMale);
          fd.append('image_url', form.imageUrlMale);
        }

        if (form.imageFemaleFile) {
          fd.append('image_female', form.imageFemaleFile);
        } else if (form.imageUrlFemale) {
          fd.append('image_url_female', form.imageUrlFemale);
        }

        payload = fd;
      } else {
        payload = form;
      }

      if (initialTask) {
        await updateTask(initialTask.id, payload);
        router.push(`/tasks/${initialTask.id}`);
      } else {
        const created = await createTask(payload);
        router.push(`/tasks/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save this task.');
    } finally {
      setSubmitting(false);
      setConfirmSave(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-4xl mx-auto space-y-6">
      {/* 1. Basic Info */}
      <Card className="space-y-5">
        <SectionHeader title="Basic Info" description="What hunters will see for this task." />
        <Input label="Title" placeholder="e.g. 30-Day Strength Program" value={form.title} onChange={(e) => update('title', e.target.value)} required />
        <Textarea label="Description" rows={3} placeholder="Describe what hunters need to do..." value={form.description} onChange={(e) => update('description', e.target.value)} required />
        <Input label="Tag" placeholder="e.g. Fitness, Strength, Cardio" value={form.tag} onChange={(e) => update('tag', e.target.value)} required />
      </Card>

      {/* 2. Artwork & Images */}
      <Card className="space-y-5">
        <SectionHeader title="Task Artwork" description={`Upload image files (WebP, JPG, PNG ≤ ${MAX_IMAGE_LABEL}). Both male and female illustrations are mandatory.`} />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Male Image */}
          <div className="space-y-3 p-4 rounded-xl border border-line bg-surface-inset/20">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block">
              Male Hunter Image <span className="text-bad-ink">*</span>
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-line hover:border-accent/60 rounded-xl p-6 cursor-pointer transition-colors bg-surface-inset/40 hover:bg-surface-inset/80">
              <Upload className="w-6 h-6 text-ink-muted mb-2" />
              <span className="text-xs font-medium text-ink">Click to upload file</span>
              <span className="text-[11px] text-ink-faint mt-0.5">WebP, PNG, JPG up to {MAX_IMAGE_LABEL}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'male')}
              />
            </label>

            {/* Preview */}
            {(maleFilePreview || form.imageUrlMale) && (
              <div className="flex items-center gap-3 pt-2 border-t border-line/60">
                <img
                  src={maleFilePreview || form.imageUrlMale || ''}
                  alt="Male preview"
                  className="w-14 h-14 rounded-lg object-cover border border-line bg-surface-inset shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-ink block truncate">
                    {form.imageMaleFile ? form.imageMaleFile.name : 'Current Image'}
                  </span>
                  <span className="text-[11px] text-ink-muted">Shown to male hunters</span>
                </div>
                {form.imageMaleFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => clearFile('male')} className="text-ink-muted hover:text-bad-ink">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Female Image */}
          <div className="space-y-3 p-4 rounded-xl border border-line bg-surface-inset/20">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block">
              Female Hunter Image <span className="text-bad-ink">*</span>
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-line hover:border-accent/60 rounded-xl p-6 cursor-pointer transition-colors bg-surface-inset/40 hover:bg-surface-inset/80">
              <Upload className="w-6 h-6 text-ink-muted mb-2" />
              <span className="text-xs font-medium text-ink">Click to upload file</span>
              <span className="text-[11px] text-ink-faint mt-0.5">WebP, PNG, JPG up to {MAX_IMAGE_LABEL}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'female')}
              />
            </label>

            {/* Preview */}
            {(femaleFilePreview || form.imageUrlFemale) && (
              <div className="flex items-center gap-3 pt-2 border-t border-line/60">
                <img
                  src={femaleFilePreview || form.imageUrlFemale || ''}
                  alt="Female preview"
                  className="w-14 h-14 rounded-lg object-cover border border-line bg-surface-inset shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-ink block truncate">
                    {form.imageFemaleFile ? form.imageFemaleFile.name : 'Current Image'}
                  </span>
                  <span className="text-[11px] text-ink-muted">Shown to female hunters</span>
                </div>
                {form.imageFemaleFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => clearFile('female')} className="text-ink-muted hover:text-bad-ink">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Task Type & Schedule */}
      <Card className="space-y-5">
        <SectionHeader title="Task Type & Schedule" description="How often this task recurs and how hunters can access it." />
        <div>
          <Select
            label="Type"
            value={form.taskType}
            onChange={(e) => changeTaskType(e.target.value as CreatableTaskType)}
            disabled={Boolean(initialTask)}
          >
            <option value="DAILY_ADMIN">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </Select>
          {initialTask && (
            <p className="text-[11px] text-ink-faint mt-1">Task type cannot be modified after creation.</p>
          )}
        </div>

        {/* Paid Task Switch */}
        <div className="p-4 rounded-xl border border-line bg-surface-inset/30 space-y-4">
          <Switch
            checked={Boolean(form.isPaid)}
            onCheckedChange={(checked) => update('isPaid', checked)}
            label="Paid Task (Locked Offer)"
            description="Users see this task locked with its price during the offer window. Buying unlocks access until the offer end date."
          />

          {form.isPaid && (
            <div className="pt-3 border-t border-line/60 animate-in fade-in duration-200">
              <Input
                label="Price (INR ₹)"
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g. 199 or 499"
                value={form.price ?? ''}
                onChange={(e) => update('price', e.target.value ? Number(e.target.value) : null)}
                required
              />
              <p className="text-[11px] text-ink-faint mt-1">Enter amount in INR with at most 2 decimal places.</p>
            </div>
          )}
        </div>

        {/* Recurring switch */}
        <Switch
          checked={form.isRecurring}
          onCheckedChange={(checked) => update('isRecurring', checked)}
          label="Recurring"
          description={
            form.taskType === 'WEEKLY'
              ? 'On: repeats every 7 days through an optional end date. Off: a single 7-day window.'
              : form.taskType === 'MONTHLY'
              ? 'On: repeats every 30 days through an optional end date. Off: a single 30-day window.'
              : 'On: repeats every day through an optional end date. Off: assignable on start date only.'
          }
        />

        {/* Date Window */}
        <div className="grid gap-4 sm:grid-cols-2">
          <DatePicker
            label={form.isPaid ? 'Offer Starts' : 'Start Date'}
            value={toDateInput(form.startDate)}
            onChange={(e) => update('startDate', e.target.value || null)}
            required
          />
          <DatePicker
            label={form.isPaid ? 'Offer Ends (access ends for buyers)' : 'End Date'}
            value={toDateInput(form.endDate)}
            onChange={(e) => update('endDate', e.target.value || null)}
            required={Boolean(form.isPaid)}
          />
        </div>

        {/* Free one-time task automatic duration hint */}
        {!form.isPaid && !form.isRecurring && !form.endDate && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-line bg-surface-inset/30 text-ink-muted text-xs">
            <HelpCircle className="w-4 h-4 text-accent-ink shrink-0" />
            <span>
              Ends automatically after {form.taskType === 'MONTHLY' ? '30 days' : form.taskType === 'WEEKLY' ? '7 days' : '1 day'}.
            </span>
          </div>
        )}
      </Card>

      {/* 4. Completion Criteria & XP */}
      <Card className="space-y-5">
        <SectionHeader title="Completion Criteria" description="What counts as done, and the XP it earns." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Target Value"
            type="number"
            placeholder="e.g. 10"
            value={form.targetValue ?? ''}
            onChange={(e) => update('targetValue', e.target.value ? Number(e.target.value) : null)}
          />
          <Input label="Unit" placeholder="e.g. km, minutes, steps" value={form.targetUnit} onChange={(e) => update('targetUnit', e.target.value)} required />
        </div>
        <Input
          label={`XP Reward (max ${cap} for ${form.taskType === 'WEEKLY' ? 'Weekly' : form.taskType === 'MONTHLY' ? 'Monthly' : 'Daily'} tasks)`}
          type="number"
          placeholder={`e.g. ${cap}`}
          max={cap}
          value={form.xpReward ?? ''}
          onChange={(e) => update('xpReward', e.target.value ? Number(e.target.value) : null)}
          required
        />

        {/* Allows Partial */}
        <div className="space-y-3">
          <Switch
            checked={form.allowsPartial}
            onCheckedChange={(checked) => update('allowsPartial', checked)}
            disabled={form.proofCount > 0}
            label="Allows Partial Completion"
            description="Award reduced XP when the target isn't fully met."
          />
          {form.allowsPartial && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-line bg-surface-inset/40 text-xs">
              <span className="text-ink font-medium">Partial XP Reward:</span>
              <span className="font-mono font-semibold text-accent-ink text-sm">
                {form.xpReward ? Math.floor(form.xpReward / 2) : 0} XP
              </span>
            </div>
          )}
          {form.allowsPartial && (form.xpReward ?? 0) < 2 && (
            <p className="text-xs text-bad-ink">
              xp_reward must be at least 2 when allows_partial is enabled.
            </p>
          )}
        </div>
      </Card>

      {/* 5. Proof (optional) */}
      <Card className="space-y-4">
        <SectionHeader
          title="Proof"
          description="Optional. Hunters complete a proof task by uploading photos; you review them in the Review Queue, and XP and rewards are paid only when you approve."
        />
        <Switch
          checked={form.proofCount > 0}
          onCheckedChange={(checked) =>
            setForm((f) => ({ ...f, proofCount: checked ? 1 : 0, allowsPartial: checked ? false : f.allowsPartial }))
          }
          label="Require photo proof"
          description="Partial completion isn't available for proof tasks."
        />
        {form.proofCount > 0 && (
          <Select
            label="Photos required"
            value={String(form.proofCount)}
            onChange={(e) => update('proofCount', Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>{`${n} photo${n === 1 ? '' : 's'}`}</option>
            ))}
          </Select>
        )}
      </Card>

      {/* 6. Special reward (optional) */}
      <Card className="space-y-4">
        <SectionHeader
          title="Special Reward"
          description="Optional. Without one, this task gives only its XP. With one, every hunter who completes it gets one scratch card from that reward — free or paid task alike."
        />
        <Switch
          checked={form.specialRewardId !== null}
          onCheckedChange={(checked) => update('specialRewardId', checked ? (specialRewards[0]?.id ?? null) : null)}
          disabled={specialRewards.length === 0}
          label="Enable task-specific special reward"
          description={
            specialRewards.length === 0
              ? 'No special rewards yet — create one under Rewards → Special rewards first.'
              : 'Completing this task also grants a card from the reward you pick.'
          }
        />
        {form.specialRewardId !== null && (
          <Select
            label="Special reward"
            value={form.specialRewardId}
            onChange={(e) => update('specialRewardId', e.target.value)}
          >
            {specialRewards.map((r) => (
              <option key={r.id} value={r.id}>
                {`${r.description || `Special reward #${r.value}`}${r.isActive ? '' : ' (inactive)'} · ${r.coupons.filter((c) => c.isActive).length} active coupon${r.coupons.filter((c) => c.isActive).length === 1 ? '' : 's'}`}
              </option>
            ))}
          </Select>
        )}
        {initialTask?.specialRewardId && form.specialRewardId !== initialTask.specialRewardId && (
          <p className="text-xs text-warn-ink">
            Changing or removing it is refused once a hunter has received this task&apos;s special reward.
          </p>
        )}
      </Card>

      {/* 7. Reward Eligibility preview */}
      <Card className="space-y-3">
        <SectionHeader title="Reward Eligibility" description="Auto-derived from the XP reward relative to this task type's cap." />
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-line bg-surface-inset/30 text-ink-muted">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <Badge variant={rewardEligibility === 'bonus' ? 'warning' : 'muted'}>
            {rewardEligibility}
          </Badge>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? 'Saving...' : initialTask ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmSave}
        title={initialTask ? 'Save these changes?' : 'Create this task?'}
        message={
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-warn-ink">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Please recheck everything before saving.{' '}
                {initialTask
                  ? 'Changes reach every hunter who has this task straight away.'
                  : 'Once hunters are assigned this task it can no longer be deleted — only deactivated.'}
              </span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-ink-faint">Title</dt>
              <dd className="text-ink font-medium truncate">{form.title.trim()}</dd>
              <dt className="text-ink-faint">Type</dt>
              <dd className="text-ink">{taskTypeLabel(form.taskType)} · {recurrenceLabel(form.isRecurring)}</dd>
              <dt className="text-ink-faint">XP</dt>
              <dd className="text-ink">{form.xpReward ?? 0} XP{form.allowsPartial ? ' (partial allowed)' : ''}</dd>
              <dt className="text-ink-faint">Dates</dt>
              <dd className="text-ink">{form.startDate || '—'}{form.endDate ? ` → ${form.endDate}` : form.isRecurring ? ' → no end' : ''}</dd>
              <dt className="text-ink-faint">Price</dt>
              <dd className="text-ink">{form.isPaid ? `₹${form.price ?? 0}` : 'Free'}</dd>
              <dt className="text-ink-faint">Proof</dt>
              <dd className="text-ink">{form.proofCount > 0 ? `${form.proofCount} photo${form.proofCount === 1 ? '' : 's'}, reviewed before XP` : 'Not required'}</dd>
              <dt className="text-ink-faint">Special reward</dt>
              <dd className="text-ink truncate">
                {form.specialRewardId
                  ? specialRewards.find((r) => r.id === form.specialRewardId)?.description ?? 'Selected'
                  : 'None — XP only'}
              </dd>
            </dl>
          </div>
        }
        confirmLabel={initialTask ? 'Yes, save changes' : 'Yes, create task'}
        busyLabel="Saving..."
        busy={submitting}
        onCancel={() => setConfirmSave(false)}
        onConfirm={save}
      />
    </form>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink-faint mt-0.5">{description}</p>
    </div>
  );
}

