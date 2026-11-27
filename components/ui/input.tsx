import * as React from 'react';
import { cn } from '@/lib/utils';
import { FieldLabel } from '@/components/ui/help-tip';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Shown in a "?" tooltip beside the label. */
  help?: React.ReactNode;
  /** Small helper text under the field (hidden while an error shows). */
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, hint, help, required, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && <FieldLabel label={label} required={required} help={help} />}
        <input
          type={type}
          ref={ref}
          aria-required={required}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-lg border border-line bg-surface-inset/50 text-ink placeholder-ink-faint transition-all duration-200 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent focus:bg-surface-inset focus:shadow-[0_0_15px_rgba(124,58,237,0.15)] disabled:opacity-50 disabled:pointer-events-none',
            error ? 'border-bad-ink focus:border-bad-ink focus:ring-bad-ink' : '',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-bad-ink font-medium">{error}</span>}
        {!error && hint && <span className="block text-xs text-ink-faint">{hint}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
