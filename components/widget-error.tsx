'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface WidgetErrorProps {
  message?: string;
  /** Defaults to re-rendering the page (re-fetches every server widget). */
  onRetry?: () => void;
  /** Smaller padding, for inline use inside a table or list. */
  compact?: boolean;
}

/** A widget whose data couldn't be loaded — distinct from "No data found". */
export function WidgetError({ message = "Couldn't load this data.", onRetry, compact }: WidgetErrorProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const retry = () => (onRetry ? onRetry() : startTransition(() => router.refresh()));

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 text-center ${compact ? 'py-6' : 'py-12'}`}
    >
      <div className="w-10 h-10 rounded-xl bg-bad-ink/10 border border-bad-ink/20 flex items-center justify-center text-bad-ink">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <p className="text-sm text-ink-muted max-w-sm">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={retry} disabled={pending}>
        <RotateCw className={`w-3.5 h-3.5 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Retrying...' : 'Retry'}
      </Button>
    </div>
  );
}
