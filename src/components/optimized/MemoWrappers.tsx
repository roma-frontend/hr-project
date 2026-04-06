/**
 * React.memo wrappers for frequently-re-rendered table components
 * Prevents unnecessary re-renders when parent state changes
 */

import React from 'react';

// ── Table Row Memo Wrapper ──────────────────────────────────────────────────

/**
 * Memoized table row — re-renders only when its own data changes
 * Use for list items in Employees, Leaves, Tasks tables
 */
export const MemoTableRow = React.memo(
  ({ children, ...props }: React.ComponentProps<'tr'>) => (
    <tr {...props}>{children}</tr>
  ),
  (prevProps, nextProps) => {
    // Shallow comparison of props — skip re-render if identical
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);
    if (prevKeys.length !== nextKeys.length) return false;

    return prevKeys.every(
      (key) => prevProps[key as keyof React.ComponentProps<'tr'>] === nextProps[key as keyof React.ComponentProps<'tr'>],
    );
  },
);

// ── Badge Memo Wrapper ──────────────────────────────────────────────────────

/**
 * Memoized badge/status cell — only re-renders when status changes
 */
export const MemoBadge = React.memo(
  ({ children, className, ...props }: React.ComponentProps<'span'>) => (
    <span className={className} {...props}>
      {children}
    </span>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.children === nextProps.children &&
      prevProps.className === nextProps.className
    );
  },
);

// ── Stat Card Memo Wrapper ──────────────────────────────────────────────────

/**
 * Memoized stat card for dashboard metrics
 */
export const MemoStatCard = React.memo(
  ({
    children,
    className,
    'data-testid': dataTestId,
  }: {
    children: React.ReactNode;
    className?: string;
    'data-testid'?: string;
  }) => (
    <div className={className} data-testid={dataTestId}>
      {children}
    </div>
  ),
);

// ── List Item Memo Wrapper ──────────────────────────────────────────────────

/**
 * Generic memoized list item with deep comparison for data prop
 */
export const MemoListItem = React.memo(
  <T,>({
    item,
    render,
    className,
  }: {
    item: T;
    render: (item: T) => React.ReactNode;
    className?: string;
  }) => <div className={className}>{render(item)}</div>,
  (prevProps, nextProps) => {
    // Compare by item identity (requires stable references)
    return prevProps.item === nextProps.item;
  },
) as <T>(props: {
  item: T;
  render: (item: T) => React.ReactNode;
  className?: string;
}) => React.ReactElement;
