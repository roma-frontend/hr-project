import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-(--ring) focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-(--badge-primary-bg) text-(--badge-primary-text) shadow-sm',
        secondary: 'border-transparent bg-(--badge-secondary-bg) text-(--badge-secondary-text)',
        destructive:
          'border-(--badge-danger-border)/30 bg-(--badge-danger-bg) text-(--badge-danger-text)',
        outline: 'border-(--border) text-(--text-secondary)',
        success:
          'border-(--badge-success-border)/30 bg-(--badge-success-bg) text-(--badge-success-text)',
        warning:
          'border-(--badge-warning-border)/30 bg-(--badge-warning-bg) text-(--badge-warning-text)',
        info: 'border-(--badge-info-border)/30 bg-(--badge-info-bg) text-(--badge-info-text)',
        purple: 'border-[var(--purple)]/30 bg-[var(--purple)]/15 text-[var(--purple)]',
        pink: 'border-[var(--pink)]/30 bg-[var(--pink)]/15 text-[var(--pink)]',
        primary: 'border-transparent bg-(--badge-primary-bg) text-(--badge-primary-text) shadow-sm',
        danger:
          'border-(--badge-danger-border)/30 bg-(--badge-danger-bg) text-(--badge-danger-text)',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
