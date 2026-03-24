/**
 * Command Palette — Умный поиск по функциям (Ctrl+K)
 * 
 * Позволяет быстро найти и перейти к любой функции
 * Аналог Spotlight в macOS или Cmd+K в Vercel
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Command, ArrowRight, FileText, Users, Calendar, Settings, BarChart3, MessageCircle, ClipboardList, Clock, CheckSquare, User, ShieldCheck, CreditCard, Sparkles, Car } from "lucide-react";
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
  }, [isOpen, selectedIndex]);

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

  return (
    <>
      {/* Кнопка открытия (можно добавить в хедер) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-colors"
        aria-label="Open command palette"
      >
        <Command className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Затемнение фона */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Модальное окно */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
            >
              <div className="bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden">
                {/* Поисковая строка */}
                <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
                  <Search className="w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedIndex(0);
                    }}
                    placeholder={t("commandPalette.placeholder")}
                    className="flex-1 bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                    autoFocus
                  />
                  <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-mono rounded bg-[var(--background-subtle)] border border-[var(--border)] text-[var(--text-muted)]">
                    ESC
                  </kbd>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Результаты поиска */}
                <div className="max-h-96 overflow-y-auto p-2">
                  {filteredCommands.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-muted)]">
                      <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>{t("commandPalette.noResults")}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredCommands.map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                            index === selectedIndex
                              ? "bg-[var(--primary)]/10"
                              : "hover:bg-[var(--background-subtle)]"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-lg",
                            index === selectedIndex
                              ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                              : "bg-[var(--background-subtle)] text-[var(--text-muted)]"
                          )}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--text-primary)] truncate">
                              {item.label}
                            </div>
                            {item.description && (
                              <div className="text-sm text-[var(--text-muted)] truncate">
                                {item.description}
                              </div>
                            )}
                          </div>
                          <ArrowRight className={cn(
                            "w-4 h-4",
                            index === selectedIndex
                              ? "text-[var(--primary)]"
                              : "text-[var(--text-muted)]"
                          )} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Подсказки */}
                <div className="flex items-center justify-between px-4 py-3 bg-[var(--background-subtle)] border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">↑</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">↓</kbd>
                      <span>{t("commandPalette.navigate")}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">↵</kbd>
                      <span>{t("commandPalette.select")}</span>
                    </span>
                  </div>
                  <span>{t("commandPalette.shortcut")}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
