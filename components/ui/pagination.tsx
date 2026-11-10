'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PaginationInfo } from '@/types/user';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationBarProps {
  pagination: PaginationInfo;
  /** Noun for the "Showing 1 to 10 of 42 …" line, e.g. "broadcasts". */
  noun: string;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

/** "Showing x to y of z" + prev/next. Renders nothing when there are no rows. */
export function PaginationBar({ pagination, noun, onPageChange, disabled, className }: PaginationBarProps) {
  const { page, limit, total_count, total_pages, has_next_page } = pagination;
  if (total_count === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total_count);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/60 text-xs text-ink-muted',
        className
      )}
    >
      <div>
        Showing <span className="font-semibold text-ink">{start}</span> to{' '}
        <span className="font-semibold text-ink">{end}</span> of{' '}
        <span className="font-semibold text-ink">{total_count}</span> {noun}
      </div>
      <div className="flex items-center gap-2">
        <span>
          Page <span className="font-semibold text-ink">{page}</span> of{' '}
          <span className="font-semibold text-ink">{Math.max(total_pages, 1)}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={disabled || !has_next_page}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
