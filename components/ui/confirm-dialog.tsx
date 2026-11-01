'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  /** Shown on the confirm button while onConfirm runs. */
  busyLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app yes/no confirmation (never the browser's window.confirm). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  busyLabel = 'Working...',
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={title}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{message}</div>
    </Dialog>
  );
}
