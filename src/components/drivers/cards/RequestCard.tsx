/**
 * RequestCard - Individual request card
 */

'use client';

import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Eye, Star, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { enUS, ru, hy } from 'date-fns/locale';
import i18n from 'i18next';

interface RequestCardProps {
  request: {
    _id: string;
    status: string;
    startTime?: number;
    tripInfo?: {
      from: string;
      to: string;
    };
    assignedDriver?: {
      userName: string;
    };
  };
  onViewDetails: () => void;
  onRate?: () => void;
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-500',
  pending: 'bg-amber-500',
  approved: 'bg-blue-500',
  cancelled: 'bg-gray-400',
};

const badgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  approved: 'outline',
  cancelled: 'outline',
};

export const RequestCard = memo(function RequestCard({
  request,
  onViewDetails,
  onRate,
}: RequestCardProps) {
  const lang = i18n.language || 'en';
  const dateFnsLocale = lang === 'ru' ? ru : lang === 'hy' ? hy : enUS;
  return (
    <div className="p-4 rounded-xl border border-(--border) bg-(--card) hover:border-(--primary)/30 transition-all duration-300 hover:shadow-lg hover:translate-x-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`w-2 h-2 rounded-full mt-2 shrink-0 ${statusColors[request.status] || 'bg-gray-400'}`}
            style={{
              boxShadow:
                request.status === 'completed'
                  ? '0 0 0 2px var(--card), 0 0 12px rgba(34, 197, 94, 0.5)'
                  : request.status === 'pending'
                    ? '0 0 0 2px var(--card), 0 0 12px rgba(245, 158, 11, 0.5)'
                    : request.status === 'approved'
                      ? '0 0 0 2px var(--card), 0 0 12px rgba(59, 130, 246, 0.5)'
                      : undefined,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-medium text-sm truncate">
                {request.tripInfo?.from} → {request.tripInfo?.to}
              </p>
              <Badge variant={badgeVariants[request.status] || 'outline'} className="text-xs">
                {request.status}
              </Badge>
            </div>
            {request.startTime && (
              <p className="text-xs text-(--text-muted) flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(request.startTime), 'MMM dd, HH:mm', { locale: dateFnsLocale })}
              </p>
            )}
            {request.assignedDriver && (
              <p className="text-xs text-(--text-muted) mt-1 flex items-center gap-1">
                <Car className="w-3 h-3" />
                {request.assignedDriver.userName}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={onViewDetails} className="gap-1">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {request.status === 'completed' && onRate && (
            <Button size="sm" variant="ghost" onClick={onRate} className="gap-1">
              <Star className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
