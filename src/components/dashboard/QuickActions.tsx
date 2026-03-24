/**
 * Quick Actions — Быстрые действия для Dashboard
 * 
 * Позволяет сотрудникам выполнять частые действия в 1 клик
 * Адаптируется под роль пользователя
 */

"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";

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

  // Действия для всех ролей
  const commonActions: QuickAction[] = [
    {
      id: "leave-request",
      label: t("quickActions.leaveRequest"),
      icon: <Plus className="w-5 h-5" />,
      href: "/leaves",
      color: "bg-blue-500 hover:bg-blue-600",
      description: t("quickActions.leaveRequestDesc"),
    },
    {
      id: "check-in",
      label: t("quickActions.checkIn"),
      icon: <Clock className="w-5 h-5" />,
      href: "/attendance",
      color: "bg-green-500 hover:bg-green-600",
      description: t("quickActions.checkInDesc"),
    },
    {
      id: "chat",
      label: t("quickActions.chat"),
      icon: <MessageCircle className="w-5 h-5" />,
      href: "/chat",
      color: "bg-purple-500 hover:bg-purple-600",
      description: t("quickActions.chatDesc"),
    },
    {
      id: "tasks",
      label: t("quickActions.tasks"),
      icon: <CheckSquare className="w-5 h-5" />,
      href: "/tasks",
      color: "bg-orange-500 hover:bg-orange-600",
      description: t("quickActions.tasksDesc"),
    },
  ];

  // Дополнительные действия для менеджеров
  const managerActions: QuickAction[] = [
    {
      id: "approvals",
      label: t("quickActions.approvals"),
      icon: <User className="w-5 h-5" />,
      href: "/approvals",
      color: "bg-indigo-500 hover:bg-indigo-600",
      description: t("quickActions.approvalsDesc"),
      role: ["admin", "supervisor"],
    },
    {
      id: "analytics",
      label: t("quickActions.analytics"),
      icon: <FileText className="w-5 h-5" />,
      href: "/analytics",
      color: "bg-pink-500 hover:bg-pink-600",
      description: t("quickActions.analyticsDesc"),
      role: ["admin", "supervisor"],
    },
  ];

  // Действия для админов
  const adminActions: QuickAction[] = [
    {
      id: "employees",
      label: t("quickActions.employees"),
      icon: <User className="w-5 h-5" />,
      href: "/employees",
      color: "bg-teal-500 hover:bg-teal-600",
      description: t("quickActions.employeesDesc"),
      role: ["admin", "superadmin"],
    },
    {
      id: "settings",
      label: t("quickActions.settings"),
      icon: <Settings className="w-5 h-5" />,
      href: "/settings",
      color: "bg-gray-500 hover:bg-gray-600",
      description: t("quickActions.settingsDesc"),
      role: ["admin", "superadmin"],
    },
  ];

  // Собрать все действия для текущей роли
  const actions = [
    ...commonActions,
    ...(user?.role === "admin" || user?.role === "supervisor" ? managerActions : []),
    ...(user?.role === "admin" || user?.role === "superadmin" ? adminActions : []),
  ];

  const handleAction = (action: QuickAction) => {
    router.push(action.href);
    toast.success(t("quickActions.toast.success"), {
      description: action.label,
    });
  };

  return (
    <Card
      data-tour="quick-actions"
      className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-lg font-semibold">
            {t("quickActions.title")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {actions.map((action, index) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={() => handleAction(action)}
                className={`w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl transition-all ${action.color} text-white shadow-md hover:shadow-lg`}
                variant="ghost"
              >
                <div className="p-2 rounded-full bg-white/20">
                  {action.icon}
                </div>
                <span className="text-xs font-medium text-center">
                  {action.label}
                </span>
              </Button>
              {action.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                  {action.description}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{t("quickActions.shortcuts.hint")}</span>
            <div className="flex gap-1">
              <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-xs">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-xs">
                K
              </kbd>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
