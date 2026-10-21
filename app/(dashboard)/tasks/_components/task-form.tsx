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
import { Lock, AlertCircle, Upload, X, IndianRupee, Sparkles, HelpCircle } from 'lucide-react';


const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB client limit

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
};

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

export function TaskForm({ initialTask }: { initialTask?: Task }) {
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

    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Each image must be 10MB or smaller (${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      e.target.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Images must be image files (jpg, png, webp, ...)');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <SectionHeader title="Task Artwork" description="Upload image files (WebP, JPG, PNG ≤ 10MB). Both male and female illustrations are mandatory." />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Male Image */}
          <div className="space-y-3 p-4 rounded-xl border border-line bg-surface-inset/20">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider block">
              Male Hunter Image <span className="text-bad-ink">*</span>
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-line hover:border-accent/60 rounded-xl p-6 cursor-pointer transition-colors bg-surface-inset/40 hover:bg-surface-inset/80">
              <Upload className="w-6 h-6 text-ink-muted mb-2" />
              <span className="text-xs font-medium text-ink">Click to upload file</span>
              <span className="text-[11px] text-ink-faint mt-0.5">WebP, PNG, JPG up to 10MB</span>
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
              <span className="text-[11px] text-ink-faint mt-0.5">WebP, PNG, JPG up to 10MB</span>
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

      {/* 5. Reward Eligibility preview */}
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

