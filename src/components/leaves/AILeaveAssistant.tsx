'use client';

import { useTranslation } from 'react-i18next';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Minus,
  Calendar,
  Users,
  Briefcase,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AILeaveAssistantProps {
  leaveRequestId: string;
  userId: string;
  onApprove?: (comment?: string) => void;
  onReject?: (comment?: string) => void;
}

export default function AILeaveAssistant({
  leaveRequestId,
  userId,
  onApprove,
  onReject,
}: AILeaveAssistantProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-(--text-muted)" />
          <p className="text-sm text-(--text-muted)">{t('aiAssistant.evaluationComingSoon')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
