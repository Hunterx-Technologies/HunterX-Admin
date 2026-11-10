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
import { createSchedule, sendBroadcast, updateSchedule } from '@/lib/api/notification-actions';
import { defaultSendMoment, describeSchedule, formatWall, inQuietHours, istToEpoch } from '@/lib/ist';
import type {
  BroadcastAudience,
  BroadcastRecurrence,
  BroadcastResult,
  BroadcastSchedule,
  ScheduleInput,
} from '@/types/notification';
import { AlertCircle, Bell, CalendarClock, CheckCircle2, Moon, Pencil, Users } from 'lucide-react';

// Mirrors broadcastService.js limits.
const MAX_TITLE = 65;
const MAX_BODY = 240;

// expo-router paths in HunterX-Mobile the push opens on tap.
const DESTINATIONS: { value: string; label: string }[] = [
  { value: '', label: 'Home (default)' },
  { value: '/rewards', label: 'Rewards' },
  { value: '/(tabs)/leaderboard', label: 'Leaderboard' },
  { value: '/(tabs)/metrics', label: 'Metrics' },
  { value: '/(tabs)/profile', label: 'Profile' },
  { value: '/feedback', label: 'Feedback' },
];

type When = 'now' | 'later';
type RepeatFrequency = Exclude<BroadcastRecurrence, 'NONE'>;

interface FormState extends Omit<ScheduleInput, 'recurrence'> {
  when: When;
  repeat: boolean;
  frequency: RepeatFrequency;
}

function emptyForm(): FormState {
  const { date, time } = defaultSendMoment();
  return {
    title: '',
    body: '',
    url: '',
    audience: 'all',
    inactiveDays: 7,
    when: 'now',
    sendDate: date,
    sendTime: time,
    repeat: false,
    frequency: 'DAILY',
  };
}

function formFromSchedule(s: BroadcastSchedule): FormState {
  return {
    title: s.title,
    body: s.body,
    url: s.url,
    audience: s.audience,
    inactiveDays: s.inactiveDays ?? 7,
    when: 'later',
    sendDate: s.sendDate,
    sendTime: s.sendTime,
    repeat: s.recurrence !== 'NONE',
    frequency: s.recurrence === 'NONE' ? 'DAILY' : s.recurrence,
  };
}

function toScheduleInput(form: FormState): ScheduleInput {
  return {
    title: form.title,
    body: form.body,
    url: form.url,
    audience: form.audience,
    inactiveDays: form.inactiveDays,
    sendDate: form.sendDate,
    sendTime: form.sendTime,
    recurrence: form.repeat ? form.frequency : 'NONE',
  };
}

type Notice = { kind: 'sent' | 'scheduled' | 'updated'; text: string };

export interface BroadcastFormProps {
  /** A scheduled notification being edited, or null when composing a new one. */
  editing: BroadcastSchedule | null;
  onEditDone: () => void;
}

export const BroadcastForm = React.forwardRef<HTMLFormElement, BroadcastFormProps>(function BroadcastForm(
  { editing, onEditDone },
  ref
) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(emptyForm);
  // Preview is tied to the exact input it was computed for — any edit
  // invalidates it, so "Send" always matches the count the admin saw.
  const [preview, setPreview] = React.useState<BroadcastResult | null>(null);
  const [busy, setBusy] = React.useState<'preview' | 'submit' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  // Re-checked every 30 s so "must be in the future" stays honest while the page sits open.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Load (or clear) the schedule being edited — reset during render when a
  // different schedule is picked, not on every refresh of the same one.
  const editingId = editing?.id ?? null;
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  if (editingId !== loadedId) {
    setLoadedId(editingId);
    setForm(editing ? formFromSchedule(editing) : emptyForm());
    setPreview(null);
    setError(null);
    if (editing) setNotice(null);
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPreview(null);
    setNotice(null);
  };

  const scheduled = form.when === 'later';
  const recurrence: BroadcastRecurrence = form.repeat ? form.frequency : 'NONE';
  const sendAt = istToEpoch(form.sendDate, form.sendTime);
  // Editing a recurring schedule may keep a start date that has passed — the
  // backend just moves on to the next occurrence. Everything else must be ahead.
  const mustBeFuture = !(editing && recurrence !== 'NONE');

  const contentValid =
    form.title.trim().length > 0 &&
    form.title.trim().length <= MAX_TITLE &&
    form.body.trim().length > 0 &&
    form.body.trim().length <= MAX_BODY &&
    (form.audience !== 'inactive' || (Number.isInteger(form.inactiveDays) && form.inactiveDays >= 1 && form.inactiveDays <= 365));

  let timingError: string | null = null;
  if (scheduled) {
    if (Number.isNaN(sendAt)) timingError = 'Pick a send date and time.';
    else if (mustBeFuture && sendAt <= now) timingError = 'The send date and time must be in the future (India time).';
  }
  const isValid = contentValid && !timingError;

  const runPreview = async () => {
    if (!contentValid) return;
    setBusy('preview');
    setError(null);
    try {
      setPreview(await sendBroadcast(form, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to count recipients.');
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!isValid) return;
    setBusy('submit');
    setError(null);
    try {
      if (!scheduled) {
        const result = await sendBroadcast(form, false);
        setNotice({
          kind: 'sent',
          text: `Broadcast queued for ${result.recipients.toLocaleString()} hunter${result.recipients === 1 ? '' : 's'}.`,
        });
      } else if (editing) {
        const saved = await updateSchedule(editing.id, toScheduleInput(form));
        setNotice({ kind: 'updated', text: `Changes saved. ${nextSendText(saved)}` });
        onEditDone();
      } else {
        const saved = await createSchedule(toScheduleInput(form));
        setNotice({ kind: 'scheduled', text: `Notification scheduled. ${nextSendText(saved)}` });
      }
      setPreview(null);
      setForm(emptyForm());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // "Send now" keeps the preview-then-send safety step; scheduling can be
  // saved straight away (the audience is resolved again at send time).
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduled && !preview) runPreview();
    else submit();
  };

  const cancelEdit = () => {
    setNotice(null);
    onEditDone();
  };

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate className="space-y-6 scroll-mt-6">
      {editing && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-accent/30 bg-accent/10 text-sm">
          <span className="flex items-center gap-2 text-accent-ink font-medium">
            <Pencil className="w-4 h-4 shrink-0" />
            Editing scheduled notification &ldquo;{editing.title}&rdquo;
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={busy !== null}>
            Discard changes
          </Button>
        </div>
      )}

      <Card className="space-y-5">
        <SectionHeader title="Message" description="Shown as a push notification and in every recipient's in-app inbox." />
        <Input
          label={`Title (${form.title.trim().length}/${MAX_TITLE})`}
          placeholder="e.g. Season 2 has begun"
          value={form.title}
          maxLength={MAX_TITLE}
          onChange={(e) => update('title', e.target.value)}
          required
        />
        <Textarea
          label={`Body (${form.body.trim().length}/${MAX_BODY})`}
          rows={3}
          placeholder="e.g. New ranks, new rewards. Clear today's quests to claim your spot."
          value={form.body}
          maxLength={MAX_BODY}
          onChange={(e) => update('body', e.target.value)}
          required
        />
        <Select label="Opens on tap" value={form.url} onChange={(e) => update('url', e.target.value)}>
          {DESTINATIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </Select>

        {(form.title.trim() || form.body.trim()) && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-line bg-surface-inset/40">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-accent/10 text-accent-ink flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{form.title.trim() || 'Title'}</p>
              <p className="text-sm text-ink-muted line-clamp-2">{form.body.trim() || 'Body'}</p>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-5">
        <SectionHeader title="Audience" description="Hunters who turned off announcements are always excluded." />
        <Select label="Send to" value={form.audience} onChange={(e) => update('audience', e.target.value as BroadcastAudience)}>
          <option value="all">All hunters</option>
          <option value="inactive">Inactive hunters</option>
        </Select>
        {form.audience === 'inactive' && (
          <Input
            label="No completed quest in the last N days"
            type="number"
            min={1}
            max={365}
            value={form.inactiveDays}
            onChange={(e) => update('inactiveDays', Number(e.target.value))}
            required
          />
        )}
      </Card>

      <Card className="space-y-5">
        <SectionHeader
          title="Delivery"
          description="A scheduled notification reaches every hunter at the chosen date and time in their own timezone — 9 AM in India, 9 AM in London, 9 AM in New York."
        />
        {!editing && (
          <Select label="When" value={form.when} onChange={(e) => update('when', e.target.value as When)}>
            <option value="now">Send now</option>
            <option value="later">Schedule for later</option>
          </Select>
        )}

        {scheduled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Send date"
                value={form.sendDate}
                onChange={(e) => update('sendDate', e.target.value)}
                required
              />
              <Input
                label="Send time (hunter's local time)"
                type="time"
                value={form.sendTime}
                onChange={(e) => update('sendTime', e.target.value)}
                className="[color-scheme:dark] [[data-theme=light]_&]:[color-scheme:light]"
                required
              />
            </div>

            <div className="p-3.5 rounded-xl border border-line bg-surface-inset/40 space-y-4">
              <Switch
                checked={form.repeat}
                onCheckedChange={(checked) => update('repeat', checked)}
                label="Repeat"
                description="Send again automatically until you pause or cancel it."
              />
              {form.repeat && (
                <Select
                  label="Frequency"
                  value={form.frequency}
                  onChange={(e) => update('frequency', e.target.value as RepeatFrequency)}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </Select>
              )}
            </div>

            {timingError ? (
              <p className="flex items-center gap-2 text-sm text-bad-ink">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {timingError}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <CalendarClock className="w-4 h-4 shrink-0 text-accent-ink" />
                {describeSchedule(form.sendDate, form.sendTime, recurrence)}
              </p>
            )}
            {!timingError && inQuietHours(form.sendTime) && (
              <p className="flex items-start gap-2 text-xs text-warn-ink">
                <Moon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                This is inside quiet hours (22:00–07:00), so hunters get it at 07:00 their time instead — in the
                inbox and as a push.
              </p>
            )}
          </>
        )}
      </Card>

      {preview && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-accent/20 bg-accent/10 text-accent-ink text-sm">
          <Users className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {scheduled ? 'Right now, ' : ''}
            {preview.recipients.toLocaleString()} hunter{preview.recipients === 1 ? '' : 's'} would get this in their inbox,{' '}
            {preview.reachableByPush.toLocaleString()} by push.{' '}
            {scheduled
              ? 'The audience is worked out again when each send starts.'
              : 'Quiet hours (22:00–07:00 local) delay delivery for some.'}
          </span>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-ok-ink text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice.text}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {scheduled ? (
          <>
            <Button type="button" variant="ghost" onClick={runPreview} disabled={!contentValid || busy !== null}>
              {busy === 'preview' ? 'Counting...' : 'Preview recipients'}
            </Button>
            <Button type="submit" disabled={!isValid || busy !== null}>
              {busy === 'submit' ? 'Saving...' : editing ? 'Save changes' : form.repeat ? 'Schedule recurring' : 'Schedule'}
            </Button>
          </>
        ) : preview ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setPreview(null)} disabled={busy !== null}>
              Edit
            </Button>
            <Button type="submit" disabled={!isValid || busy !== null || preview.recipients === 0}>
              {busy === 'submit' ? 'Sending...' : `Send to ${preview.recipients.toLocaleString()}`}
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={!isValid || busy !== null}>
            {busy === 'preview' ? 'Counting...' : 'Preview recipients'}
          </Button>
        )}
      </div>
    </form>
  );
});

function nextSendText(s: BroadcastSchedule): string {
  if (s.status === 'PAUSED') return 'It stays paused until you resume it.';
  return s.nextSendLocal ? `Next send: ${formatWall(s.nextSendLocal)}.` : '';
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink-faint mt-0.5">{description}</p>
    </div>
  );
}
