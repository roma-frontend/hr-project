'use client';

import { Clock } from 'lucide-react';
import ModuleSeoPage from '@/components/features/ModuleSeoPage';

export default function AttendancePageClient({
  initialLanguage = 'en',
}: {
  initialLanguage?: string;
}) {
  return (
    <ModuleSeoPage
      initialLanguage={initialLanguage}
      module="attendance"
      icon={<Clock className="w-6 h-6" />}
      color="#6366f1"
      gradient="linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(129,140,248,0.06) 100%)"
    />
  );
}
