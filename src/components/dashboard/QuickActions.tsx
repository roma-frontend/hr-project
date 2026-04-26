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
  Calendar,
  FileText,
  User,
  Settings,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  description?: string;
  role?: string[];
}

export function QuickActions() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  // ═══════════════════════════════════════════════════════════════
  // OPTIMIZED: Memoize actions array
  // ═══════════════════════════════════════════════════════════════
  const actions = useMemo<QuickAction[]>(() => {
    // Действия для всех ролей
    const commonActions: QuickAction[] = [
      {
        id: 'leave-request',
        label: t('quickActions.leaveRequest'),
        icon: <Plus className="w-5 h-5" />,
        href: '/leaves',
        color: 'bg-blue-500 hover:bg-blue-600',
        description: t('quickActions.leaveRequestDesc'),
      },
      {
        id: 'check-in',
        label: t('quickActions.checkIn'),
        icon: <Clock className="w-5 h-5" />,
        href: '/attendance',
        color: 'bg-green-500 hover:bg-green-600',
        description: t('quickActions.checkInDesc'),
      },
      {
        id: 'chat',
        label: t('quickActions.chat'),
        icon: <MessageCircle className="w-5 h-5" />,
        href: '/chat',
        color: 'bg-purple-500 hover:bg-purple-600',
        description: t('quickActions.chatDesc'),
      },
      {
        id: 'tasks',
        label: t('quickActions.tasks'),
        icon: <CheckSquare className="w-5 h-5" />,
        href: '/tasks',
        color: 'bg-orange-500 hover:bg-orange-600',
        description: t('quickActions.tasksDesc'),
      },
    ];

    // Дополнительные действия для менеджеров
    const managerActions: QuickAction[] = [
      {
        id: 'approvals',
        label: t('quickActions.approvals'),
        icon: <User className="w-5 h-5" />,
        href: '/approvals',
        color: 'bg-indigo-500 hover:bg-indigo-600',
        description: t('quickActions.approvalsDesc'),
        role: ['admin', 'supervisor'],
      },
      {
        id: 'analytics',
        label: t('quickActions.analytics'),
        icon: <FileText className="w-5 h-5" />,
        href: '/analytics',
        color: 'bg-pink-500 hover:bg-pink-600',
        description: t('quickActions.analyticsDesc'),
        role: ['admin', 'supervisor'],
      },
    ];

    // Действия для админов
    const adminActions: QuickAction[] = [
      {
        id: 'employees',
        label: t('quickActions.employees'),
        icon: <User className="w-5 h-5" />,
        href: '/employees',
        color: 'bg-teal-500 hover:bg-teal-600',
        description: t('quickActions.employeesDesc'),
        role: ['admin', 'superadmin'],
      },
      {
        id: 'settings',
        label: t('quickActions.settings'),
        icon: <Settings className="w-5 h-5" />,
        href: '/settings',
        color: 'bg-gray-500 hover:bg-gray-600',
        description: t('quickActions.settingsDesc'),
        role: ['admin', 'superadmin'],
      },
    ];

    // Собрать все действия для текущей роли
    return [
      ...commonActions,
      ...(user?.role === 'admin' || user?.role === 'supervisor' ? managerActions : []),
      ...(user?.role === 'admin' || user?.role === 'superadmin' ? adminActions : []),
    ];
  }, [user?.role, t]);

  // ═══════════════════════════════════════════════════════════════
  // OPTIMIZED: useCallback for handleAction
  // ═══════════════════════════════════════════════════════════════
  const handleAction = useCallback(
    (href: string, label: string) => {
      router.push(href);
      toast.success(t('quickActions.toast.success'), {
        description: label,
      });
    },
    [router, t],
  );

  return (
    <Card
      data-tour="quick-actions"
      className="border-0 shadow-xl dark:to-gray-800 ring-1 ring-gray-900/5 dark:ring-white/10"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2.5 rounded-xl bg-linear-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{t('quickActions.title')}</CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('quickActions.subtitle') || 'Быстрый доступ к основным функциям'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {actions.map((action, index) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              <Button
                onClick={() => handleAction(action.href, action.label)}
                className={`w-full h-28 flex flex-col items-center justify-center gap-2.5 text-wrap rounded-2xl transition-all duration-200 ${action.color} text-white shadow-md hover:shadow-xl hover:shadow-gray-900/10 dark:hover:shadow-black/30 border border-white/20 dark:border-white/10`}
                variant="ghost"
              >
                <div className="p-2.5 rounded-full bg-white/25 backdrop-blur-sm shadow-inner">
                  {action.icon}
                </div>
                <span className="text-xs font-semibold text-center leading-tight">
                  {action.label}
                </span>
              </Button>
              {action.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 line-clamp-2">
                  {action.description}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-5 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{t('quickActions.shortcuts.hint')}</span>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2.5 py-1.5 rounded-lg bg-gradient-to-b from-white to-gray-100 dark:from-gray-700 dark:to-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm">
                Ctrl
              </kbd>
              <span className="text-gray-400">+</span>
              <kbd className="px-2.5 py-1.5 rounded-lg bg-gradient-to-b from-white to-gray-100 dark:from-gray-700 dark:to-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-sm">
                K
              </kbd>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
