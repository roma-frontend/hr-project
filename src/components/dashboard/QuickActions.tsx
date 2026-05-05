/**
 * Quick Actions — Быстрые действия для Dashboard
 *
 * Позволяет сотрудникам выполнять частые действия в 1 клик
 * Адаптируется под роль пользователя
 */

'use client';

import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { motion } from '@/lib/cssMotion';
import {
  Plus,
  Clock,
  MessageCircle,
  CheckSquare,
  FileText,
  User,
  Settings,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthUser } from '@/store/useAuthStore';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  description?: string;
  role?: string[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function QuickActions() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthUser();

  const actions = useMemo<QuickAction[]>(() => {
    const commonActions: QuickAction[] = [
      {
        id: 'leave-request',
        label: t('quickActions.leaveRequest'),
        icon: Plus,
        href: '/leaves',
        description: t('quickActions.leaveRequestDesc'),
      },
      {
        id: 'check-in',
        label: t('quickActions.checkIn'),
        icon: Clock,
        href: '/attendance',
        description: t('quickActions.checkInDesc'),
      },
      {
        id: 'chat',
        label: t('quickActions.chat'),
        icon: MessageCircle,
        href: '/chat',
        description: t('quickActions.chatDesc'),
      },
      {
        id: 'tasks',
        label: t('quickActions.tasks'),
        icon: CheckSquare,
        href: '/tasks',
        description: t('quickActions.tasksDesc'),
      },
    ];

    const managerActions: QuickAction[] = [
      {
        id: 'approvals',
        label: t('quickActions.approvals'),
        icon: User,
        href: '/approvals',
        description: t('quickActions.approvalsDesc'),
        role: ['admin', 'supervisor'],
      },
      {
        id: 'analytics',
        label: t('quickActions.analytics'),
        icon: FileText,
        href: '/analytics',
        description: t('quickActions.analyticsDesc'),
        role: ['admin', 'supervisor'],
      },
    ];

    const adminActions: QuickAction[] = [
      {
        id: 'employees',
        label: t('quickActions.employees'),
        icon: User,
        href: '/employees',
        description: t('quickActions.employeesDesc'),
        role: ['admin', 'superadmin'],
      },
      {
        id: 'settings',
        label: t('quickActions.settings'),
        icon: Settings,
        href: '/settings',
        description: t('quickActions.settingsDesc'),
        role: ['admin', 'superadmin'],
      },
    ];

    return [
      ...commonActions,
      ...(user?.role === 'admin' || user?.role === 'supervisor' ? managerActions : []),
      ...(user?.role === 'admin' || user?.role === 'superadmin' ? adminActions : []),
    ];
  }, [user?.role, t]);

  const handleAction = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );

  return (
    <Card className="border-(--border)">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-(--primary)/10">
              <Zap className="w-5 h-5 text-(--primary)" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('quickActions.title')}</CardTitle>
              <p className="text-sm text-(--muted-foreground) mt-0.5">
                {t('quickActions.subtitle') || 'Быстрый доступ к основным функциям'}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-(--muted-foreground)">
            <kbd className="px-2 py-1 rounded-md bg-(--muted) border border-(--border) font-mono">
              Ctrl
            </kbd>
            <span>+</span>
            <kbd className="px-2 py-1 rounded-md bg-(--muted) border border-(--border) font-mono">
              K
            </kbd>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.id} variants={itemVariants}>
                <button
                  onClick={() => handleAction(action.href)}
                  className="w-full text-left p-4 rounded-xl border border-(--border) bg-(--card) hover:border-(--primary)/30 hover:bg-(--primary)/5 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--primary)/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-(--muted) group-hover:bg-(--primary)/10 transition-colors duration-200">
                      <Icon className="w-4 h-4 text-(--muted-foreground) group-hover:text-(--primary) transition-colors duration-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--text-primary) group-hover:text-(--primary) transition-colors duration-200">
                        {action.label}
                      </p>
                      {action.description && (
                        <p className="text-xs text-(--muted-foreground) mt-1 line-clamp-2">
                          {action.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-(--muted-foreground) group-hover:text-(--primary) group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
                  </div>
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
