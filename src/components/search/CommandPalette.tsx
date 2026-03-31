/**
 * Command Palette — Умный поиск по функциям (Ctrl+K)
 * 
 * Позволяет быстро найти и перейти к любой функции
 * Аналог Spotlight в macOS или Cmd+K в Vercel
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from '@/lib/cssMotion';
import { Search, X, ArrowRight, FileText, Users, Calendar, Settings, BarChart3, MessageCircle, ClipboardList, Clock, CheckSquare, User, ShieldCheck, CreditCard, Sparkles, Car } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  keywords: string[];
  role?: string[];
}

export function CommandPalette() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Команды для поиска
  const allCommands: CommandItem[] = [
    {
      id: "dashboard",
      label: t("nav.dashboard"),
      href: "/dashboard",
      icon: <FileText className="w-4 h-4" />,
      keywords: ["главная", "home", "dashboard", "панель"],
    },
    {
      id: "attendance",
      label: t("nav.attendance"),
      href: "/attendance",
      icon: <Clock className="w-4 h-4" />,
      keywords: ["посещаемость", "attendance", "check-in", "отметка"],
    },
    {
      id: "analytics",
      label: t("nav.analytics"),
      href: "/analytics",
      icon: <BarChart3 className="w-4 h-4" />,
      keywords: ["аналитика", "analytics", "reports", "отчеты"],
      role: ["superadmin", "admin", "supervisor"],
    },
    {
      id: "leaves",
      label: t("nav.leaves"),
      href: "/leaves",
      icon: <ClipboardList className="w-4 h-4" />,
      keywords: ["отпуска", "leaves", "vacation", "заявки"],
    },
    {
      id: "employees",
      label: t("nav.employees"),
      href: "/employees",
      icon: <Users className="w-4 h-4" />,
      keywords: ["сотрудники", "employees", "team", "команда"],
    },
    {
      id: "drivers",
      label: t("nav.drivers"),
      href: "/drivers",
      icon: <Car className="w-4 h-4" />,
      keywords: ["водители", "drivers", "поездки"],
    },
    {
      id: "calendar",
      label: t("nav.calendar"),
      href: "/calendar",
      icon: <Calendar className="w-4 h-4" />,
      keywords: ["календарь", "calendar", "events", "события"],
    },
    {
      id: "tasks",
      label: t("nav.tasks"),
      href: "/tasks",
      icon: <CheckSquare className="w-4 h-4" />,
      keywords: ["задачи", "tasks", "todo", "список"],
    },
    {
      id: "chat",
      label: t("nav.chat"),
      href: "/chat",
      icon: <MessageCircle className="w-4 h-4" />,
      keywords: ["чат", "chat", "messages", "сообщения"],
    },
    {
      id: "approvals",
      label: t("nav.approvals"),
      href: "/approvals",
      icon: <User className="w-4 h-4" />,
      keywords: ["подтверждения", "approvals", "одобрения"],
      role: ["superadmin", "admin"],
    },
    {
      id: "profile",
      label: t("nav.profile"),
      href: "/profile",
      icon: <User className="w-4 h-4" />,
      keywords: ["профиль", "profile", "account", "аккаунт"],
    },
    {
      id: "settings",
      label: t("nav.settings"),
      href: "/settings",
      icon: <Settings className="w-4 h-4" />,
      keywords: ["настройки", "settings", "configuration"],
    },
    {
      id: "ai-site-editor",
      label: t("nav.aiSiteEditor"),
      href: "/ai-site-editor",
      icon: <Sparkles className="w-4 h-4" />,
      keywords: ["ai", "редактор", "editor", "искусственный интеллект"],
      role: ["superadmin"],
    },
    {
      id: "subscriptions",
      label: t("nav.subscriptions"),
      href: "/superadmin/subscriptions",
      icon: <CreditCard className="w-4 h-4" />,
      keywords: ["подписки", "subscriptions", "billing", "оплата"],
      role: ["superadmin"],
    },
    {
      id: "security",
      label: t("nav.security"),
      href: "/superadmin/security",
      icon: <ShieldCheck className="w-4 h-4" />,
      keywords: ["безопасность", "security", "защита"],
      role: ["superadmin"],
    },
  ];

  // Фильтрация по роли и запросу
  const filteredCommands = allCommands.filter((cmd) => {
    if (cmd.role && user?.role && !cmd.role.includes(user.role)) {
      return false;
    }

    if (!query) return true;

    const queryLower = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(queryLower) ||
      cmd.keywords.some((k) => k.includes(queryLower)) ||
      (cmd.description && cmd.description.toLowerCase().includes(queryLower))
    );
  });

  const handleSelect = useCallback((item: CommandItem) => {
    router.push(item.href);
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, [router]);

  // Закрыть по ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }

      // Ctrl+K или Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Навигация стрелками
      if (isOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        }
        if (e.key === "Enter" && filteredCommands[selectedIndex]) {
          e.preventDefault();
          handleSelect(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, handleSelect]);

  return (
    <>
      {/* Кнопка открытия (можно добавить в хедер) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105"
        aria-label={t("commandPalette.open") || "Open command palette"}
      >
        <Search className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Затемнение фона */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Модальное окно */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
            >
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Поисковая строка */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                  <Search className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedIndex(0);
                    }}
                    placeholder={t("commandPalette.placeholder")}
                    className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 text-base"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-medium font-mono rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500">
                      ESC
                    </kbd>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Результаты поиска */}
                <div className="max-h-96 overflow-y-auto p-2">
                  {filteredCommands.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">{t("commandPalette.noResults")}</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t("commandPalette.tryDifferent") || "Попробуйте другой запрос"}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredCommands.map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 text-left group",
                            index === selectedIndex
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg transition-colors",
                            index === selectedIndex
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400"
                          )}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {item.label}
                            </div>
                            {item.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                {item.description}
                              </div>
                            )}
                          </div>
                          <ArrowRight className={cn(
                            "w-4 h-4 transition-colors",
                            index === selectedIndex
                              ? "text-blue-500"
                              : "text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400"
                          )} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Подсказки */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono font-medium shadow-sm">↑</kbd>
                      <kbd className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono font-medium shadow-sm">↓</kbd>
                      <span>{t("commandPalette.navigate")}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <kbd className="px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono font-medium shadow-sm">↵</kbd>
                      <span>{t("commandPalette.select")}</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 rounded bg-blue-500 text-white font-mono font-medium shadow-sm">Ctrl</kbd>
                    <kbd className="px-2 py-1 rounded bg-blue-500 text-white font-mono font-medium shadow-sm">K</kbd>
                    <span>{t("commandPalette.shortcut")}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
