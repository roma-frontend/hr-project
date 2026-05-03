import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

function createRipple(event: React.MouseEvent<HTMLButtonElement>) {
  const button = event.currentTarget;
  const existingRipple = button.querySelector('.ripple-circle');
  if (existingRipple) existingRipple.remove();

  const circle = document.createElement('span');
  circle.classList.add('ripple-circle');

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  circle.style.width = circle.style.height = `${size}px`;
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;

  button.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'btn-gradient text-white shadow-md hover:shadow-lg',
        primary: 'btn-gradient text-white shadow-md hover:shadow-lg',
        destructive:
          'bg-(--button-danger-bg) text-(--button-danger-text) border border-(--button-danger-border) hover:bg-(--button-danger-hover) shadow-sm hover:shadow-md',
        outline:
          'border border-(--button-outline-border) bg-(--button-outline-bg) text-(--button-outline-text) hover:bg-(--button-outline-hover) shadow-sm',
        secondary:
          'bg-(--button-secondary-bg) text-(--button-secondary-text) border border-(--button-secondary-border) hover:bg-(--button-secondary-hover) shadow-sm hover:shadow-md',
        ghost: 'hover:bg-(--button-outline-hover) text-(--text-primary)',
        link: 'text-(--primary) underline-offset-4 hover:underline',

        // ═══════════════════════════════════════════════════════════════
        // LANDING PAGE VARIANTS — Градиенты и эффекты для landing page
        // ═══════════════════════════════════════════════════════════════
        cta: 'cta-btn-primary',
        ctaSecondary: 'cta-btn-secondary',
        glass: 'backdrop-blur-sm bg-white/10 hover:bg-white/20 border border-white/20 text-white',

        // ═══════════════════════════════════════════════════════════════
        // EXTENDED VARIANTS — Для dashboard и форм
        // ═══════════════════════════════════════════════════════════════
        success:
          'bg-(--button-success-bg) text-(--button-success-text) border border-(--button-success-border) hover:bg-(--button-success-hover) shadow-sm hover:shadow-md',
        warning:
          'bg-(--button-danger-bg) text-(--button-danger-text) border border-(--button-danger-border) hover:bg-(--button-danger-hover) shadow-sm hover:shadow-md',
        info: 'bg-(--button-secondary-bg) text-(--button-secondary-text) border border-(--button-secondary-border) hover:bg-(--button-secondary-hover) shadow-sm hover:shadow-md',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        xl: 'h-12 rounded-xl px-8 text-base has-[>svg]:px-6',
        '2xl': 'h-14 rounded-2xl px-10 text-lg has-[>svg]:px-8',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }), 'ripple-effect')}
      onClick={(e) => {
        createRipple(e);
        props.onClick?.(e);
      }}
      {...props}
    />
  );
}

export { Button, buttonVariants };
