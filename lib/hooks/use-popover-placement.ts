import * as React from 'react';

export type PopoverPlacement = 'top' | 'bottom';

export interface AnchoredPopover {
  placement: PopoverPlacement;
  style: React.CSSProperties;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

const HIDDEN: AnchoredPopover = {
  placement: 'bottom',
  style: { position: 'fixed', top: 0, left: 0, visibility: 'hidden' },
};

/**
 * Positions a portaled popover (rendered into document.body) against its
 * trigger with `position: fixed`, so it can never be clipped by an
 * `overflow` container or painted under a sibling stacking context
 * (e.g. the next `backdrop-blur` Card). Flips above the trigger when there
 * isn't enough room below, keeps it inside the viewport horizontally, and
 * follows the trigger on scroll/resize.
 */
export function useAnchoredPopover<A extends HTMLElement, P extends HTMLElement>(
  open: boolean,
  anchorRef: React.RefObject<A | null>,
  panelRef: React.RefObject<P | null>,
  { matchWidth = false }: { matchWidth?: boolean } = {}
): AnchoredPopover {
  const [state, setState] = React.useState<AnchoredPopover>(HIDDEN);

  React.useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const rect = anchor.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const height = panel.offsetHeight;
      const width = Math.max(panel.offsetWidth, matchWidth ? rect.width : 0);

      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      const placement: PopoverPlacement =
        spaceBelow < height + GAP * 2 && spaceAbove > spaceBelow ? 'top' : 'bottom';

      const top = placement === 'top' ? rect.top - GAP - height : rect.bottom + GAP;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, vw - width - VIEWPORT_MARGIN));

      setState({
        placement,
        style: {
          position: 'fixed',
          top,
          left,
          ...(matchWidth ? { minWidth: rect.width } : null),
        },
      });
    };

    update();

    const ro = new ResizeObserver(update);
    if (panelRef.current) ro.observe(panelRef.current);
    if (anchorRef.current) ro.observe(anchorRef.current);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef, panelRef, matchWidth]);

  return open ? state : HIDDEN;
}
