/**
 * Dashboard Tour — Интерактивный тур по Dashboard
 * 
 * Показывает новые сотрудникам основные функции dashboard
 * 5-7 шагов с подсветкой ключевых элементов
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface DashboardTourStep {
  id: string;
  target: string; // CSS selector
  title: string;
  description: string;
  icon?: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

interface DashboardTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function DashboardTour({ onComplete, onSkip }: DashboardTourProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Шаги тура
  const steps: DashboardTourStep[] = [
    {
      id: "welcome",
      target: "body",
      title: t("dashboardTour.welcome.title"),
      description: t("dashboardTour.welcome.description"),
      icon: "👋",
      placement: "center",
    },
    {
      id: "quick-stats",
      target: "[data-tour='quick-stats']",
      title: t("dashboardTour.quickStats.title"),
      description: t("dashboardTour.quickStats.description"),
      icon: "📊",
      placement: "bottom",
    },
    {
      id: "leave-balance",
      target: "[data-tour='leave-balance']",
      title: t("dashboardTour.leaveBalance.title"),
      description: t("dashboardTour.leaveBalance.description"),
      icon: "🏖",
      placement: "bottom",
    },
    {
      id: "quick-actions",
      target: "[data-tour='quick-actions']",
      title: t("dashboardTour.quickActions.title"),
      description: t("dashboardTour.quickActions.description"),
      icon: "⚡",
      placement: "top",
    },
    {
      id: "recent-activity",
      target: "[data-tour='recent-activity']",
      title: t("dashboardTour.recentActivity.title"),
      description: t("dashboardTour.recentActivity.description"),
      icon: "📋",
      placement: "top",
    },
    {
      id: "navigation",
      target: "[data-tour='sidebar']",
      title: t("dashboardTour.navigation.title"),
      description: t("dashboardTour.navigation.description"),
      icon: "🧭",
      placement: "right",
    },
    {
      id: "complete",
      target: "body",
      title: t("dashboardTour.complete.title"),
      description: t("dashboardTour.complete.description"),
      icon: "🎉",
      placement: "center",
    },
  ];

  // Найти целевой элемент и вычислить позицию
  const findTargetElement = useCallback((selector: string) => {
    if (selector === "body") return document.body.getBoundingClientRect();
    
    const element = document.querySelector(selector);
    if (element) {
      return element.getBoundingClientRect();
    }
    return null;
  }, []);

  // Обновлять позицию при смене шага
  useEffect(() => {
    const step = steps[currentStep];
    if (!step) return;

    const rect = findTargetElement(step.target);
    setTargetRect(rect);

    // Scroll to element if needed
    if (rect && step.target !== "body") {
      const element = document.querySelector(step.target);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentStep, findTargetElement]);

  // Вычислить позицию тултипа
  const getTooltipPosition = () => {
    if (!targetRect) return { top: "50%", left: "50%" };

    const step = steps[currentStep];
    const padding = 20;

    switch (step.placement) {
      case "top":
        return {
          top: targetRect.top - padding - 200,
          left: targetRect.left + (targetRect.width / 2) - 200,
        };
      case "bottom":
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + (targetRect.width / 2) - 200,
        };
      case "left":
        return {
          top: targetRect.top + (targetRect.height / 2) - 100,
          left: targetRect.left - 420,
        };
      case "right":
        return {
          top: targetRect.top + (targetRect.height / 2) - 100,
          left: targetRect.right + padding,
        };
      default:
        return { top: "50%", left: "50%" };
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsVisible(false);
      onComplete?.();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip?.();
  };

  const position = getTooltipPosition();

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Затемнение фона */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={handleSkip}
          />

          {/* Подсветка целевого элемента */}
          {targetRect && steps[currentStep].target !== "body" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed z-40 pointer-events-none"
              style={{
                top: targetRect.top,
                left: targetRect.left,
                width: targetRect.width,
                height: targetRect.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                borderRadius: "8px",
              }}
            />
          )}

          {/* Тултип */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 max-w-md"
            style={{
              top: typeof position.top === "string" ? position.top : `${position.top}px`,
              left: typeof position.left === "string" ? position.left : `${position.left}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
              {/* Кнопка закрытия */}
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Иконка */}
              <div className="text-4xl mb-4">{steps[currentStep].icon}</div>

              {/* Заголовок */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {steps[currentStep].title}
              </h3>

              {/* Описание */}
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {steps[currentStep].description}
              </p>

              {/* Прогресс */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx <= currentStep
                          ? "bg-blue-600"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  {currentStep + 1} / {steps.length}
                </span>
              </div>

              {/* Кнопки навигации */}
              <div className="flex gap-3">
                {currentStep > 0 ? (
                  <Button
                    onClick={handlePrev}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t("common.back")}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    className="flex-1"
                  >
                    {t("common.skip")}
                  </Button>
                )}

                <Button
                  onClick={handleNext}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t("common.finish")}
                    </>
                  ) : (
                    <>
                      {t("common.next")}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
