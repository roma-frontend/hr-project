'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from '@/lib/cssMotion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'cyan';
  prefix?: string;
  suffix?: string;
  index?: number;
}

const colorMap = {
  blue: {
    bg: 'from-[#2563eb]/20 to-[#2563eb]/5',
    icon: 'bg-[#2563eb]/20 text-[#2563eb]',
    border: 'border-[#2563eb]/20',
    glow: 'shadow-[#2563eb]/10',
  },
  green: {
    bg: 'from-[#10b981]/20 to-[#10b981]/5',
    icon: 'bg-[#10b981]/20 text-[#10b981]',
    border: 'border-[#10b981]/20',
    glow: 'shadow-[#10b981]/10',
  },
  yellow: {
    bg: 'from-[#f59e0b]/20 to-[#f59e0b]/5',
    icon: 'bg-[#f59e0b]/20 text-[#f59e0b]',
    border: 'border-[#f59e0b]/20',
    glow: 'shadow-[#f59e0b]/10',
  },
  red: {
    bg: 'from-[#ef4444]/20 to-[#ef4444]/5',
    icon: 'bg-[#ef4444]/20 text-[#ef4444]',
    border: 'border-[#ef4444]/20',
    glow: 'shadow-[#ef4444]/10',
  },
  purple: {
    bg: 'from-[#0ea5e9]/20 to-[#0ea5e9]/5',
    icon: 'bg-[#0ea5e9]/20 text-[#0ea5e9]',
    border: 'border-[#0ea5e9]/20',
    glow: 'shadow-[#0ea5e9]/10',
  },
  cyan: {
    bg: 'from-[#06b6d4]/20 to-[#06b6d4]/5',
    icon: 'bg-[#06b6d4]/20 text-[#06b6d4]',
    border: 'border-[#06b6d4]/20',
    glow: 'shadow-[#06b6d4]/10',
  },
};

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    const step = (timestamp: number) => {
      if (!start.current) start.current = timestamp;
      const elapsed = timestamp - start.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        raf.current = requestAnimationFrame(step);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return count;
}

export const StatsCard = memo(
  function StatsCard({
    title,
    value,
    change,
    changeLabel,
    icon,
    color,
    prefix = '',
    suffix = '',
    index = 0,
  }: StatsCardProps) {
    const colors = colorMap[color];
    const numericValue = typeof value === 'number' ? value : 0;
    const animatedValue = useCountUp(numericValue);
    const isPositive = (change ?? 0) >= 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
        whileHover={{ y: -2, transition: { duration: 0.2 } }}
        className={cn(
          'relative overflow-hidden rounded-lg sm:rounded-xl border p-3 sm:p-5 shadow-sm transition-colors duration-300',
          'bg-(--card)',
          colors.border,
        )}
      >
        {/* Background gradient */}
        <div
          className={cn(
            'absolute inset-0 bg-linear-to-br opacity-40 pointer-events-none',
            colors.bg,
          )}
        />

        <div className="relative flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-(--text-muted) uppercase tracking-wider mb-1 sm:mb-2 truncate">
              {title}
            </p>
            <div className="flex items-baseline gap-0.5 sm:gap-1">
              {prefix && (
                <span className="text-base sm:text-xl font-bold text-(--text-primary)">
                  {prefix}
                </span>
              )}
              <span className="text-xl sm:text-3xl font-bold text-(--text-primary) tabular-nums">
                {typeof value === 'number' ? animatedValue.toLocaleString() : value}
              </span>
              {suffix && (
                <span className="text-base sm:text-xl font-bold text-(--text-primary)">
                  {suffix}
                </span>
              )}
            </div>

            {change !== undefined && (
              <div
                className={cn(
                  'flex items-center gap-1 mt-1 sm:mt-2',
                  isPositive ? 'text-emerald-500' : 'text-red-500',
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
                <span className="text-[10px] sm:text-xs font-medium">
                  {isPositive ? '+' : ''}
                  {change}%
                </span>
                {changeLabel && (
                  <span className="text-[10px] sm:text-xs text-(--text-muted) hidden sm:inline">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            className={cn(
              'w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0',
              colors.icon,
            )}
          >
            {icon}
          </div>
        </div>
      </motion.div>
    );
  },
  (prev, next) => {
    // Custom comparison: only re-render if props actually changed
    return (
      prev.title === next.title &&
      prev.value === next.value &&
      prev.change === next.change &&
      prev.changeLabel === next.changeLabel &&
      prev.color === next.color &&
      prev.prefix === next.prefix &&
      prev.suffix === next.suffix &&
      prev.index === next.index
    );
  },
);
