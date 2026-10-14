'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { sendBroadcast } from '@/lib/api/notification-actions';
import type { BroadcastAudience, BroadcastInput, BroadcastResult } from '@/types/notification';
import { AlertCircle, Bell, CheckCircle2, Users } from 'lucide-react';

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

const DEFAULT_FORM: BroadcastInput = {
  title: '',
  body: '',
  url: '',
  audience: 'all',
  inactiveDays: 7,
  userIds: '',
};

export function BroadcastForm() {
  const router = useRouter();
  const [form, setForm] = React.useState<BroadcastInput>(DEFAULT_FORM);
  // Preview is tied to the exact input it was computed for — any edit
  // invalidates it, so "Send" always matches the count the admin saw.
  const [preview, setPreview] = React.useState<BroadcastResult | null>(null);
  const [busy, setBusy] = React.useState<'preview' | 'send' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<BroadcastResult | null>(null);

  const update = <K extends keyof BroadcastInput>(key: K, value: BroadcastInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPreview(null);
    setSent(null);
  };

  const isValid =
    form.title.trim().length > 0 &&
    form.title.trim().length <= MAX_TITLE &&
    form.body.trim().length > 0 &&
    form.body.trim().length <= MAX_BODY &&
    (form.audience !== 'inactive' || (Number.isInteger(form.inactiveDays) && form.inactiveDays >= 1 && form.inactiveDays <= 365)) &&
    (form.audience !== 'users' || form.userIds.trim().length > 0);

  const run = async (dryRun: boolean) => {
    if (!isValid) return;
    setBusy(dryRun ? 'preview' : 'send');
    setError(null);
    try {
      const result = await sendBroadcast(form, dryRun);
      if (dryRun) {
        setPreview(result);
      } else {
        setSent(result);
        setPreview(null);
        setForm(DEFAULT_FORM);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send this broadcast.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); run(!preview); }} noValidate className="space-y-6">
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
          <option value="users">Specific user IDs</option>
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
        {form.audience === 'users' && (
          <Textarea
            label="User IDs (comma, space or newline separated)"
            rows={3}
            placeholder="12, 48, 103"
            value={form.userIds}
            onChange={(e) => update('userIds', e.target.value)}
            required
          />
        )}
      </Card>

      {preview && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-accent/20 bg-accent/10 text-accent-ink text-sm">
          <Users className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {preview.recipients.toLocaleString()} hunter{preview.recipients === 1 ? '' : 's'} will get this in their inbox,{' '}
            {preview.reachableByPush.toLocaleString()} by push. Quiet hours (22:00–07:00 local) delay delivery for some.
          </span>
        </div>
      )}

      {sent && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-ok-ink text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Broadcast queued for {sent.recipients.toLocaleString()} hunter{sent.recipients === 1 ? '' : 's'}.</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-bad-ink/20 bg-bad-ink/10 text-bad-ink text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {preview ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setPreview(null)} disabled={busy !== null}>
              Edit
            </Button>
            <Button type="submit" disabled={!isValid || busy !== null || preview.recipients === 0}>
              {busy === 'send' ? 'Sending...' : `Send to ${preview.recipients.toLocaleString()}`}
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
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink-faint mt-0.5">{description}</p>
    </div>
  );
}
