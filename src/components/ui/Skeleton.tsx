'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'none';
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const shapeClasses = {
    text: 'rounded-sm',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-md',
  };

  const animationClass = animation === 'pulse' ? 'animate-pulse' : '';

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height ? (typeof height === 'number' ? `${height}px` : height) : '1rem',
    backgroundColor: 'var(--background-subtle)',
  };

  return (
    <div
      className={cn(
        'bg-white/5',
        shapeClasses[variant],
        animationClass,
        className,
      )}
      style={style}
    />
  );
}

// Common skeleton patterns
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height="0.75rem"
          width={i === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 space-y-3 rounded-xl border border-(--border) bg-(--card)', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="grid grid-cols-4 gap-4 p-3 bg-(--background-subtle) rounded-lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="text" width="60%" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-4 gap-4 p-3 border-b border-(--border)">
          {Array.from({ length: 4 }).map((_, colIdx) => (
            <Skeleton key={colIdx} variant="text" width={colIdx === 0 ? '80%' : '60%'} />
          ))}
        </div>
      ))}
    </div>
  );
}
