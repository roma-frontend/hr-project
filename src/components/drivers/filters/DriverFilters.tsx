/**
 * DriverFilters - Capacity and sort filters
 */

'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, SortAsc } from 'lucide-react';

interface DriverFiltersProps {
  capacityFilter: number | null;
  sortBy: 'rating' | 'name' | 'availability';
  onCapacityChange: (value: number | null) => void;
  onSortChange: (value: 'rating' | 'name' | 'availability') => void;
}

export const DriverFilters = memo(function DriverFilters({
  capacityFilter,
  sortBy,
  onCapacityChange,
  onSortChange,
}: DriverFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="w-4 h-4 text-[var(--text-muted)]" />
      <Select
        value={String(capacityFilter ?? 0)}
        onValueChange={(v) => onCapacityChange(v === '0' ? null : Number(v))}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs" style={{ borderRadius: '0.75rem' }}>
          <SelectValue placeholder="Min seats" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Any capacity</SelectItem>
          <SelectItem value="2">2+ seats</SelectItem>
          <SelectItem value="4">4+ seats</SelectItem>
          <SelectItem value="6">6+ seats</SelectItem>
          <SelectItem value="8">8+ seats</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={onSortChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs" style={{ borderRadius: '0.75rem' }}>
          <SortAsc className="w-3 h-3 mr-1" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rating">By Rating</SelectItem>
          <SelectItem value="name">By Name</SelectItem>
          <SelectItem value="availability">By Availability</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
});
