import * as React from 'react';

type AnyRef = React.RefObject<HTMLElement | null>;

/**
 * Closes a popover/menu on an outside pointer press or Escape, while `active`.
 * Pass several refs when the popover is portaled outside its trigger's DOM tree.
 */
export function useOutsideClick(
  refs: AnyRef | AnyRef[],
  onOutside: () => void,
  active: boolean
) {
  React.useEffect(() => {
    if (!active) return;
    // Ref objects are stable, so capturing them once per activation is safe.
    const refList = Array.isArray(refs) ? refs : [refs];

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = refList.some((r) => r.current?.contains(target));
      if (!inside) onOutside();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOutside();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onOutside]);
}
