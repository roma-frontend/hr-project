/**
 * DriverSearchBar - Search input for drivers
 */

'use client';

import React, { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface DriverSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DriverSearchBar = memo(function DriverSearchBar({
  value,
  onChange,
  placeholder = 'Search drivers...',
}: DriverSearchBarProps) {
  return (
    <div className="relative flex-1 sm:flex-initial">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 border-[var(--border)]"
        style={{
          borderRadius: '1rem',
          background: 'var(--background-subtle)',
        }}
      />
    </div>
  );
});
