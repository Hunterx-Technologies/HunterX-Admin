'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOutsideClick } from '@/lib/hooks/use-outside-click';
import { useAnchoredPopover } from '@/lib/hooks/use-popover-placement';

/**
 * A "?" button that opens an explanation on click (not hover, so it works on
 * touch screens). The panel is portaled and fixed-positioned, so it isn't
 * clipped by a scrolling dialog body. Closes on outside click or Escape.
 */
export function HelpTip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const { placement, style } = useAnchoredPopover(open, buttonRef, panelRef);

  const close = React.useCallback(() => setOpen(false), []);
  useOutsideClick([buttonRef, panelRef], close, open);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-ink-faint hover:text-accent-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-accent cursor-pointer align-middle',
          open && 'text-accent-ink',
          className
        )}
      >
        <CircleHelp className="w-3.5 h-3.5" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            data-placement={placement}
            style={style}
            className="popover-pop z-[70] w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-muted shadow-2xl normal-case tracking-normal font-normal space-y-1.5"
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}

/** A field label with an optional "?" help button beside it. */
export function FieldLabel({ label, required, help }: { label: string; required?: boolean; help?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
        {label}
        {required && <span className="text-bad-ink ml-0.5">*</span>}
      </label>
      {help && <HelpTip label={label}>{help}</HelpTip>}
    </div>
  );
}
